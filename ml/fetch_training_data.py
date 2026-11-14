"""Download immutable run forecasts and an ERA5 verification proxy."""
import time
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
import requests
import numpy as np
import pandas as pd
from common import ROOT, VARIABLES, FEATURES, arguments, dates, paths, write_json

BASE = dict(latitude=10.3157, longitude=123.8854, timezone='UTC', precipitation_unit='mm', wind_speed_unit='kmh', temperature_unit='celsius')

def download(url, params, cache, validate):
    if cache.exists():
        value = __import__('json').loads(cache.read_text())
        validate(value['response'])
        return value
    for attempt in range(3):
        try:
            r = requests.get(url, params=params, timeout=60)
            if r.status_code == 429 or r.status_code >= 500:
                if attempt == 2:
                    r.raise_for_status()
                retry = r.headers.get('Retry-After', '2')
                try:
                    delay = float(retry)
                except ValueError:
                    delay = max(0, (parsedate_to_datetime(retry)-datetime.now(timezone.utc)).total_seconds())
                time.sleep(max(delay, 2 ** attempt))
                continue
            r.raise_for_status()
            response = r.json()
            validate(response)
            value = dict(response=response, url=url, params=params, retrieved_at=datetime.now(timezone.utc).isoformat())
            write_json(cache, value)
            return value
        except (requests.ConnectionError, requests.Timeout):
            if attempt == 2:
                raise
            time.sleep(2 ** attempt)
    raise RuntimeError('Download failed')

def frame(response, variables):
    h = response['hourly']
    units = response['hourly_units']
    expected = {'precipitation':'mm', 'temperature_2m':'°C', 'relative_humidity_2m':'%', 'surface_pressure':'hPa', 'cloud_cover':'%', 'wind_speed_10m':'km/h'}
    if response.get('utc_offset_seconds') != 0 or any(units.get(v) != expected[v] for v in variables):
        raise ValueError('Unexpected units or timezone')
    df = pd.DataFrame({k:h[k] for k in ['time', *variables]})
    df['time'] = pd.to_datetime(df.time, utc=True)
    if df.time.duplicated().any():
        raise ValueError('Duplicate provider timestamps')
    return df.set_index('time')

def main(month):
    days = dates(month)
    cache = ROOT / 'data' / 'raw' / month
    reference = download('https://archive-api.open-meteo.com/v1/archive', {**BASE, 'models':'era5', 'start_date':days[0].strftime('%Y-%m-%d'), 'end_date':days[-1].strftime('%Y-%m-%d'), 'hourly':'precipitation'}, cache/'era5.json', lambda r:frame(r,['precipitation']))
    ref = frame(reference['response'], ['precipitation'])
    rows = []
    for day in days:
        run = day - pd.Timedelta(days=1)
        value = download('https://single-runs-api.open-meteo.com/v1/forecast', {**BASE, 'models':'ecmwf_ifs', 'run':run.strftime('%Y-%m-%dT%H:%M'), 'forecast_days':3, 'hourly':','.join(VARIABLES)}, cache/f'{run:%Y-%m-%d}.json', lambda r:frame(r,VARIABLES))
        forecast = frame(value['response'], VARIABLES)
        for target in pd.date_range(day, periods=24, freq='h'):
            f = forecast.loc[target]
            rain = ref.loc[target, 'precipitation']
            if not np.isfinite(rain) or not np.isfinite(f.precipitation):
                raise ValueError(f'Missing rainfall at {target}')
            local_hour = (target.hour + 8) % 24
            rows.append(dict(target_time=target.isoformat(), initialization=run.isoformat(), assumed_available_at=(run+pd.Timedelta(hours=6)).isoformat(), latitude=BASE['latitude'], longitude=BASE['longitude'], forecast_model='ecmwf_ifs', reference_model='era5', forecast_retrieved_at=value['retrieved_at'], reference_retrieved_at=reference['retrieved_at'], rainfall_unit='mm', raw_precipitation=f.precipitation, reference_precipitation=rain, **{v:f[v] for v in VARIABLES[1:]}, lead_hours=(target-run).total_seconds()/3600, hour_sin=np.sin(local_hour*np.pi/12), hour_cos=np.cos(local_hour*np.pi/12)))
        print(f'Downloaded {day:%Y-%m-%d}', flush=True)
    df = pd.DataFrame(rows)
    path = paths(month)[0]
    path.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(path, index=False)
    write_json(ROOT/'reports'/f'{month}-quality.json', dict(expected_rows=len(days)*24, matched_rows=len(df), missing_features=df[FEATURES].isna().sum().to_dict(), rainy_hours=int((df.reference_precipitation>0).sum()), heavy_5_hours=int((df.reference_precipitation>=5).sum()), heavy_10_hours=int((df.reference_precipitation>=10).sum())))

if __name__ == '__main__':
    main(arguments())
