# Standalone Cebu Ridge experiment

Python 3.11+; no application services, credentials, NASA account, cron, or database required.
All generated paths resolve relative to this folder, regardless of the working directory.

```bash
cd ml
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python fetch_training_data.py --month 2025-06
python train.py --month 2025-06
python evaluate.py --month 2025-06
python -m unittest discover -s tests
```

## Data contract

Cebu City: 10.3157, 123.8854. One previous-day 00 UTC ECMWF IFS initialization
from the [Single Runs API](https://open-meteo.com/en/docs/single-runs-api) supplies
24 target timestamps per UTC date (initialization leads 24–47 hours). We assume
six hours publication latency; all selected intervals begin after availability.
Older IFS archives may be hindcasts rather than original operational runs.
The reference is explicitly ERA5 precipitation from the
[Historical Weather API](https://open-meteo.com/en/docs/historical-weather-api),
not current forecasts, gauges, or independent ground truth. Both precipitation
series are mm accumulated over the preceding hour ending at the target timestamp.
No automatic model substitution occurs. June should produce 720 unique paired hours.

Inputs: forecast rainfall, temperature, humidity, pressure, cloud cover, wind speed,
lead time, and cyclic Philippine-local hour. No historical-reference features enter
training inputs. Optional atmospheric values may be median-imputed; missing rainfall,
missing hours, duplicate timestamps and unexpected units stop the download.

Raw API responses, request parameters and retrieval times are cached in
`data/raw/YYYY-MM/`; reruns reuse validated responses. Delete that month's cache
only when intentionally refreshing data. Network timeouts and transient errors have
three attempts; rate-limit Retry-After is respected. Permanent errors fail immediately.

Outputs: `data/YYYY-MM.csv`, `reports/YYYY-MM-quality.json`,
`models/YYYY-MM.joblib` plus metadata JSON, and evaluation JSON/hourly CSV in `reports/`.
Generated files and the virtual environment are ignored by Git. Dependency versions
are pinned in requirements and recorded in model metadata. Only load trusted joblib files.

## Experiment

Days 1–20 train; day 21 is excluded; days 22 onward test. Preprocessing is fit only
on training data: median imputation, scaling, Ridge(alpha=1). Predictions are clipped
to nonnegative rainfall. There is no hyperparameter search or automatic promotion.
Evaluation refuses a changed dataset; retrain after downloading different data.

Compare raw and corrected MAE, RMSE, R² and 5/10 mm/h event precision, recall and F1.
Undefined metrics are null, event counts accompany rates, and zero raw MAE yields no
percentage change. Lower test error means only better agreement with ERA5. One month,
a short held-out period, different grid resolutions and shared model ancestry do not
establish improved measured rainfall forecasting. This is a next-day-lead experiment,
not next-six-hour inference, flood prediction, or an application-ready model export.

Other months can be selected with the same `--month` argument on all three commands;
availability is subject to the archive. Keep attribution to Open-Meteo and its data
providers when publishing outputs. The parent application's old deployment instructions
are not applicable to this isolated experiment.
