-- Run only on a disposable LOCAL Supabase database with migration applied.
-- Deliberately transaction-local: all test mutations roll back.
begin;
set local timezone = 'Pacific/Honolulu'; -- quotas must remain UTC
truncate public.analysis_buckets, public.analysis_reports;
do $$
declare
  k text := repeat('a', 64);
  ip text := repeat('b', 64);
  owner1 uuid := '00000000-0000-4000-8000-000000000001';
  owner2 uuid := '00000000-0000-4000-8000-000000000002';
  r jsonb;
  i integer;
  d timestamptz := date_trunc('day', now() at time zone 'UTC') at time zone 'UTC';
begin
  if has_function_privilege('anon', 'public.analysis_admit(text,text,uuid)', 'execute') or
     has_function_privilege('authenticated', 'public.analysis_finish(text,uuid,jsonb,integer)', 'execute') or
     not has_function_privilege('service_role', 'public.analysis_admit(text,text,uuid)', 'execute') then raise exception 'RPC permissions'; end if;
  if has_table_privilege('anon', 'public.analysis_reports', 'select') or
     has_table_privilege('authenticated', 'public.analysis_buckets', 'update') then raise exception 'Table permissions'; end if;
  if exists (select 1 from pg_class where oid in ('public.analysis_reports'::regclass, 'public.analysis_buckets'::regclass) and not relrowsecurity) then raise exception 'Missing RLS'; end if;

  r := public.analysis_admit(k, ip, owner1);
  if r->>'status' <> 'allowed' then raise exception 'First admission'; end if;
  if (select bucket from public.analysis_buckets where scope = 'day-site') <> d then raise exception 'UTC bucket'; end if;
  if public.analysis_admit(k, repeat('c',64), owner2)->>'status' <> 'busy' then raise exception 'Same-key lock'; end if;
  if public.analysis_admit(repeat('d',64), ip, owner2)->>'status' <> 'busy' then raise exception 'Per-IP lock'; end if;
  if public.analysis_finish(k, owner2, null, 21600) then raise exception 'Wrong owner release'; end if;
  update public.analysis_reports set lease_until = now() - interval '1 second' where cache_key = k;
  if public.analysis_finish(k, owner1, null, 21600) then raise exception 'Expired owner release'; end if;
  if public.analysis_admit(k, ip, owner2)->>'status' <> 'allowed' then raise exception 'Expired lock recovery'; end if;
  if public.analysis_finish(k, owner1, null, 21600) then raise exception 'Old owner completion'; end if;
  if not public.analysis_finish(k, owner2, '{"analysis":"shared","generatedAt":"2026-11-12T00:00:00Z"}',21600) then raise exception 'Owner completion'; end if;
  if public.analysis_admit(k, repeat('e',64), owner1)->>'status' <> 'cached' then raise exception 'Cross-IP cache'; end if;
  if (select attempts from public.analysis_buckets where scope = 'day-site') <> 2 then raise exception 'Cache charged or failure refunded'; end if;

  truncate public.analysis_buckets, public.analysis_reports;
  for i in 1..5 loop
    if public.analysis_admit(md5(i::text)||md5(i::text), ip, owner1)->>'status' <> 'allowed' then raise exception 'IP early quota'; end if;
    perform public.analysis_finish(md5(i::text)||md5(i::text), owner1, null, 21600);
  end loop;
  if public.analysis_admit(k, ip, owner1)->>'status' <> 'visitor_quota' then raise exception 'IP quota'; end if;
  -- Cache survives exhausted daily generation quotas.
  insert into public.analysis_reports(cache_key, payload, expires_at) values (k, '{"analysis":"cached"}', now()+interval '1 hour');
  if public.analysis_admit(k, ip, owner1)->>'status' <> 'cached' then raise exception 'Quota blocked cache'; end if;

  truncate public.analysis_buckets, public.analysis_reports;
  for i in 1..40 loop
    if public.analysis_admit(k, md5(i::text)||md5(i::text), owner1)->>'status' <> 'allowed' then raise exception 'Site early quota %', i; end if;
    perform public.analysis_finish(k, owner1, null, 21600);
  end loop;
  if public.analysis_admit(k, ip, owner1)->>'status' <> 'site_quota' then raise exception 'Site quota'; end if;
  update public.analysis_buckets set bucket = bucket - interval '1 day' where scope like 'day-%';
  if public.analysis_admit(k, ip, owner1)->>'status' <> 'allowed' then raise exception 'New UTC day'; end if;

  truncate public.analysis_buckets, public.analysis_reports;
  perform public.analysis_admit(k, ip, owner1);
  perform public.analysis_admit(repeat('c',64), repeat('d',64), owner2);
  if public.analysis_admit(repeat('e',64), repeat('f',64), owner1)->>'status' <> 'busy' then raise exception 'Site concurrency'; end if;

  truncate public.analysis_buckets, public.analysis_reports;
  -- Busy requests also consume the fixed-minute request burst budget.
  for i in 1..10 loop perform public.analysis_admit(k, ip, owner1); end loop;
  if public.analysis_admit(k, ip, owner1)->>'status' <> 'burst' then raise exception 'IP burst'; end if;
  truncate public.analysis_buckets, public.analysis_reports;
  for i in 1..120 loop perform public.analysis_admit(k, md5(i::text)||md5(i::text), owner1); end loop;
  if public.analysis_admit(k, ip, owner1)->>'status' <> 'burst' then raise exception 'Site burst'; end if;
end;
$$;
rollback;
