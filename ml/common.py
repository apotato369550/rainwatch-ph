"""Shared contracts for the standalone Cebu experiment."""
import argparse
import calendar
import hashlib
import json
from pathlib import Path
import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent
FEATURES = ['raw_precipitation', 'temperature_2m', 'relative_humidity_2m', 'surface_pressure', 'cloud_cover', 'wind_speed_10m', 'lead_hours', 'hour_sin', 'hour_cos']
VARIABLES = ['precipitation', *FEATURES[1:6]]

def arguments():
    p = argparse.ArgumentParser()
    p.add_argument('--month', default='2025-06')
    args = p.parse_args()
    try:
        start = pd.Timestamp(args.month + '-01', tz='UTC')
        if start.strftime('%Y-%m') != args.month:
            raise ValueError()
    except (ValueError, TypeError):
        p.error('month must be YYYY-MM')
    return args.month

def dates(month):
    return pd.date_range(month + '-01', periods=calendar.monthrange(int(month[:4]), int(month[5:]))[1], tz='UTC')

def paths(month):
    return ROOT / 'data' / f'{month}.csv', ROOT / 'models' / f'{month}.joblib', ROOT / 'reports' / f'{month}.json'

def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, allow_nan=False) + '\n')

def fingerprint(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def load(month):
    path = paths(month)[0]
    df = pd.read_csv(path)
    df['target_time'] = pd.to_datetime(df.target_time, utc=True)
    expected = pd.date_range(dates(month)[0], periods=len(dates(month))*24, freq='h')
    if df.target_time.duplicated().any() or set(df.target_time) != set(expected):
        raise ValueError('Dataset must contain every target hour exactly once')
    if not np.isfinite(df[['raw_precipitation', 'reference_precipitation']]).all().all():
        raise ValueError('Missing/nonfinite rainfall')
    return df.sort_values('target_time')

def split(df):
    day = df.target_time.dt.day
    return df[day <= 20], df[day >= 22]
