create extension if not exists pgcrypto;

create table public.locations (
  id uuid primary key default gen_random_uuid(), slug text not null unique, name text not null,
  province text not null, region text not null, latitude double precision not null,
  longitude double precision not null, created_at timestamptz not null default now()
);

create table public.weather_forecasts (
  id uuid primary key default gen_random_uuid(), location_id uuid not null references public.locations(id) on delete cascade,
  forecast_generated_at timestamptz not null, forecast_for timestamptz not null,
  precipitation double precision, precipitation_probability double precision, humidity double precision,
  surface_pressure double precision, cloud_cover double precision, wind_speed double precision,
  cape double precision, soil_moisture double precision, created_at timestamptz not null default now(),
  unique(location_id, forecast_generated_at, forecast_for)
);
create index weather_forecasts_location_id_idx on public.weather_forecasts(location_id);
create index weather_forecasts_forecast_for_idx on public.weather_forecasts(forecast_for);
create index weather_forecasts_generated_at_idx on public.weather_forecasts(forecast_generated_at);

create table public.weather_observations (
  id uuid primary key default gen_random_uuid(), location_id uuid not null references public.locations(id) on delete cascade,
  observed_at timestamptz not null, precipitation double precision, humidity double precision,
  surface_pressure double precision, cloud_cover double precision, wind_speed double precision,
  cape double precision, soil_moisture double precision, source text not null default 'open-meteo-forecast',
  created_at timestamptz not null default now(), unique(location_id, observed_at)
);
create index weather_observations_location_id_idx on public.weather_observations(location_id);
create index weather_observations_observed_at_idx on public.weather_observations(observed_at);

create table public.ml_models (
  id uuid primary key default gen_random_uuid(), model_name text not null, model_version text not null unique,
  artifact jsonb not null, metrics jsonb not null, feature_names jsonb not null,
  training_rows integer not null, trained_at timestamptz not null, active boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index ml_models_one_active_idx on public.ml_models(active) where active;

create table public.ml_predictions (
  id uuid primary key default gen_random_uuid(), location_id uuid not null references public.locations(id) on delete cascade,
  forecast_for timestamptz not null, raw_forecast double precision not null, ml_forecast double precision not null,
  model_name text not null, model_version text not null, created_at timestamptz not null default now(),
  unique(location_id, forecast_for, model_version)
);
create index ml_predictions_location_id_idx on public.ml_predictions(location_id);
create index ml_predictions_forecast_for_idx on public.ml_predictions(forecast_for);

alter table public.locations enable row level security;
alter table public.weather_forecasts enable row level security;
alter table public.weather_observations enable row level security;
alter table public.ml_models enable row level security;
alter table public.ml_predictions enable row level security;

insert into public.locations (slug,name,province,region,latitude,longitude) values
('cebu','Cebu City','Cebu','Central Visayas',10.3157,123.8854),
('mandaue','Mandaue','Cebu','Central Visayas',10.3236,123.9222),
('lapu-lapu','Lapu-Lapu','Cebu','Central Visayas',10.3103,123.9494),
('manila','Manila','Metro Manila','Metro Manila',14.5995,120.9842),
('quezon-city','Quezon City','Metro Manila','Metro Manila',14.676,121.0437),
('marikina','Marikina','Metro Manila','Metro Manila',14.6507,121.1029),
('davao','Davao City','Davao del Sur','Davao Region',7.1907,125.4553),
('cagayan-de-oro','Cagayan de Oro','Misamis Oriental','Northern Mindanao',8.4542,124.6319),
('iloilo','Iloilo City','Iloilo','Western Visayas',10.7202,122.5621),
('baguio','Baguio','Benguet','Cordillera',16.4023,120.596)
on conflict (slug) do update set name=excluded.name, province=excluded.province, region=excluded.region, latitude=excluded.latitude, longitude=excluded.longitude;
