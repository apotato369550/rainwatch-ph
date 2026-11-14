"""Compare held-out Ridge forecasts with raw forecasts against ERA5."""
import joblib
import numpy as np
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from common import FEATURES, arguments, paths, load, split, fingerprint, write_json

def metrics(y, p):
    out = dict(mae=float(mean_absolute_error(y,p)), rmse=float(mean_squared_error(y,p)**.5), r2=float(r2_score(y,p)) if len(y)>1 and np.var(y)>0 else None)
    for threshold in (5,10):
        truth, predicted = y>=threshold, p>=threshold
        tp = int((truth & predicted).sum()); positive = int(predicted.sum()); events = int(truth.sum())
        out[f'heavy_{threshold}'] = dict(events=events, predicted_events=positive, precision=tp/positive if positive else None, recall=tp/events if events else None, f1=2*tp/(positive+events) if positive+events else None)
    return out

def main(month):
    path, model_path, report = paths(month)
    artifact = joblib.load(model_path)
    if artifact['metadata']['dataset_sha256'] != fingerprint(path):
        raise ValueError('Dataset changed; retrain first')
    _, test = split(load(month))
    test = test.copy()
    test['ridge_precipitation'] = np.maximum(0, artifact['model'].predict(test[FEATURES]))
    y = test.reference_precipitation.to_numpy()
    raw = metrics(y,test.raw_precipitation.to_numpy()); ridge = metrics(y,test.ridge_precipitation.to_numpy())
    change = 100*(raw['mae']-ridge['mae'])/raw['mae'] if raw['mae'] else None
    result = dict(reference='ERA5 modeled proxy, not gauge observations', rows=len(test), raw=raw, ridge=ridge, mae_improvement_percent=change, improved=ridge['mae']<raw['mae'])
    write_json(report,result)
    test.to_csv(report.with_name(report.stem+'-predictions.csv'),index=False)
    print(__import__('json').dumps(result,indent=2))
    print('Ridge improved agreement with ERA5.' if result['improved'] else 'Ridge did not improve agreement with ERA5.')

if __name__ == '__main__':
    main(arguments())
