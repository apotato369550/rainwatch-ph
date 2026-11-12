-- Required before enabling public AI. All admission, attempts and leases are durable.
create table public.analysis_buckets (
  scope text not null,
  subject text not null,
  bucket timestamptz not null,
  attempts integer not null default 0 check (attempts >= 0),
  primary key (scope, subject, bucket)
);
create table public.analysis_reports (
  cache_key text primary key,
  owner uuid,
  visitor text,
  lease_until timestamptz,
  payload jsonb,
  expires_at timestamptz,
  check ((owner is null and visitor is null and lease_until is null) or
         (owner is not null and visitor is not null and lease_until is not null))
);
create index analysis_reports_lease on public.analysis_reports (lease_until) where owner is not null;
alter table public.analysis_buckets enable row level security;
alter table public.analysis_reports enable row level security;
revoke all on public.analysis_buckets, public.analysis_reports from public, anon, authenticated;
-- No client policies. Service role is the only application caller.
grant all on public.analysis_buckets, public.analysis_reports to service_role;

create function public.analysis_admit(p_key text, p_visitor text, p_owner uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_now timestamptz;
  v_day timestamptz;
  v_minute timestamptz;
  v_report public.analysis_reports%rowtype;
  v_count integer;
begin
  if p_key is null or p_visitor is null or p_owner is null or
     p_key !~ '^[0-9a-f]{64}$' or p_visitor !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid analysis admission';
  end if;
  -- One brief transaction serializes site-wide admission across all instances.
  perform pg_catalog.pg_advisory_xact_lock(73182024001::bigint);
  v_now := clock_timestamp();
  v_day := date_trunc('day', v_now at time zone 'UTC') at time zone 'UTC';
  v_minute := date_trunc('minute', v_now);
  delete from public.analysis_buckets where bucket < v_day - interval '2 days';

  -- Burst caps include cache hits, busy polls and denied daily attempts.
  insert into public.analysis_buckets(scope, subject, bucket, attempts)
  values ('burst-site', 'site', v_minute, 1), ('burst-ip', p_visitor, v_minute, 1)
  on conflict (scope, subject, bucket) do update
    set attempts = least(public.analysis_buckets.attempts + 1, 1000000);
  if (select attempts from public.analysis_buckets where scope = 'burst-site' and subject = 'site' and bucket = v_minute) > 120 or
     (select attempts from public.analysis_buckets where scope = 'burst-ip' and subject = p_visitor and bucket = v_minute) > 10 then
    return jsonb_build_object('status', 'burst');
  end if;

  select * into v_report from public.analysis_reports where cache_key = p_key;
  if v_report.payload is not null and v_report.expires_at > v_now then
    return jsonb_build_object('status', 'cached', 'payload', v_report.payload, 'expiresAt', v_report.expires_at);
  end if;
  if v_report.lease_until > v_now or exists (
    select 1 from public.analysis_reports where visitor = p_visitor and lease_until > v_now
  ) then return jsonb_build_object('status', 'busy'); end if;
  select count(*) into v_count from public.analysis_reports where lease_until > v_now;
  if v_count >= 2 then return jsonb_build_object('status', 'busy'); end if;

  if coalesce((select attempts from public.analysis_buckets where scope = 'day-site' and subject = 'site' and bucket = v_day), 0) >= 40 then
    return jsonb_build_object('status', 'site_quota');
  end if;
  if coalesce((select attempts from public.analysis_buckets where scope = 'day-ip' and subject = p_visitor and bucket = v_day), 0) >= 5 then
    return jsonb_build_object('status', 'visitor_quota');
  end if;
  insert into public.analysis_buckets(scope, subject, bucket, attempts)
  values ('day-site', 'site', v_day, 1), ('day-ip', p_visitor, v_day, 1)
  on conflict (scope, subject, bucket) do update set attempts = public.analysis_buckets.attempts + 1;
  -- Attempts are charged before fetching snapshots; failure never refunds them.
  insert into public.analysis_reports(cache_key, owner, visitor, lease_until)
  values (p_key, p_owner, p_visitor, v_now + interval '180 seconds')
  on conflict (cache_key) do update set owner = p_owner, visitor = p_visitor,
    lease_until = v_now + interval '180 seconds', payload = null, expires_at = null;
  return jsonb_build_object('status', 'allowed');
end;
$$;

create function public.analysis_finish(p_key text, p_owner uuid, p_payload jsonb, p_ttl integer)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_now timestamptz;
  v_rows integer;
begin
  if p_ttl not in (21600, 604800, 2592000) or p_ttl is null then raise exception 'Invalid TTL'; end if;
  if p_payload is not null and (
    jsonb_typeof(p_payload) <> 'object' or
    coalesce(jsonb_typeof(p_payload->'analysis'), '') <> 'string' or
    coalesce(length(p_payload->>'analysis'), 0) = 0 or
    coalesce(jsonb_typeof(p_payload->'generatedAt'), '') <> 'string'
  ) then raise exception 'Invalid report'; end if;
  perform pg_catalog.pg_advisory_xact_lock(73182024001::bigint);
  v_now := clock_timestamp();
  update public.analysis_reports set owner = null, visitor = null, lease_until = null,
    payload = p_payload,
    expires_at = case when p_payload is null then null else v_now + make_interval(secs => p_ttl) end
  where cache_key = p_key and owner = p_owner and lease_until > v_now;
  get diagnostics v_rows = row_count;
  return v_rows = 1;
end;
$$;
revoke all on function public.analysis_admit(text, text, uuid) from public, anon, authenticated;
revoke all on function public.analysis_finish(text, uuid, jsonb, integer) from public, anon, authenticated;
grant execute on function public.analysis_admit(text, text, uuid) to service_role;
grant execute on function public.analysis_finish(text, uuid, jsonb, integer) to service_role;
