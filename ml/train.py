"""Fit a fixed Ridge pipeline; never tune on the held-out dates."""
import importlib.metadata
import joblib
from sklearn.pipeline import make_pipeline
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import Ridge
from common import FEATURES, arguments, paths, load, split, fingerprint, write_json

def fit(train):
    if train[FEATURES].isna().all().any():
        raise ValueError('Entirely missing feature column')
    return make_pipeline(SimpleImputer(strategy='median'), StandardScaler(), Ridge(alpha=1.0)).fit(train[FEATURES], train.reference_precipitation)

def main(month):
    path, model_path, _ = paths(month)
    train, test = split(load(month))
    model = fit(train)
    metadata = dict(month=month, dataset_sha256=fingerprint(path), features=FEATURES, training_rows=len(train), test_rows=len(test), train_start=str(train.target_time.min()), train_end=str(train.target_time.max()), test_start=str(test.target_time.min()), test_end=str(test.target_time.max()), excluded_day=21, alpha=1.0, preprocessing=['median imputation', 'standard scaling'], forecast_model='ecmwf_ifs', reference_model='era5', dependencies={n:importlib.metadata.version(n) for n in ['requests','pandas','numpy','scikit-learn','joblib']})
    model_path.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(dict(model=model, metadata=metadata), model_path)
    write_json(model_path.with_suffix('.json'), metadata)
    print(f'Trained Ridge on {len(train)} rows; held out {len(test)} rows')

if __name__ == '__main__':
    main(arguments())
