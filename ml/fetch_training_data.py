"""Export causal forecast/verification rows from Supabase to ml/data/training.csv."""
import os
from pathlib import Path
import requests
import pandas as pd
URL=os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "").rstrip("/")
KEY=os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
if not URL or not KEY: raise SystemExit("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY")
headers={"apikey":KEY,"Authorization":f"Bearer {KEY}"}
def table(name, select):
 r=requests.get(f"{URL}/rest/v1/{name}", params={"select":select, "limit":100000}, headers=headers, timeout=60); r.raise_for_status(); return pd.DataFrame(r.json())
f=table("weather_forecasts", "location_id,forecast_generated_at,forecast_for,precipitation,precipitation_probability,humidity,surface_pressure,cloud_cover,wind_speed,cape,soil_moisture")
o=table("weather_observations", "location_id,observed_at,precipitation")
l=table("locations", "id,latitude,longitude")
f["forecast_for"]=pd.to_datetime(f.forecast_for, utc=True); f["forecast_generated_at"]=pd.to_datetime(f.forecast_generated_at, utc=True); o["observed_at"]=pd.to_datetime(o.observed_at, utc=True)
df=f.merge(o, left_on=["location_id","forecast_for"], right_on=["location_id","observed_at"], suffixes=("", "_actual")).merge(l, left_on="location_id", right_on="id")
df.rename(columns={"precipitation":"raw_precipitation", "precipitation_actual":"actual_precipitation"}, inplace=True)
# Lags are strictly as-of issue time; never use precipitation after forecast_generated_at.
for hours in (3,6,24):
 out=[]
 for row in df.itertuples():
  prior=o[(o.location_id==row.location_id)&(o.observed_at<=row.forecast_generated_at)&(o.observed_at>row.forecast_generated_at-pd.Timedelta(hours=hours))]
  out.append(prior.precipitation.sum() if len(prior) else float("nan"))
 df[f"previous_{hours}h_rainfall"]=out
df["forecast_lead_hours"]=(df.forecast_for-df.forecast_generated_at).dt.total_seconds()/3600
df["hour_sin"]=__import__("numpy").sin((df.forecast_for.dt.hour+8)*__import__("numpy").pi/12); df["hour_cos"]=__import__("numpy").cos((df.forecast_for.dt.hour+8)*__import__("numpy").pi/12)
df["month_sin"]=__import__("numpy").sin(df.forecast_for.dt.month*__import__("numpy").pi/6); df["month_cos"]=__import__("numpy").cos(df.forecast_for.dt.month*__import__("numpy").pi/6)
Path("data").mkdir(exist_ok=True); df.to_csv("data/training.csv", index=False); print(f"wrote {len(df)} causal rows")
