# Run the Cebu experiment

Requires Python 3.11+ and outbound HTTPS access. No credentials, Supabase, NASA
account, or app server required.

## Setup

From the repository root:

```bash
cd ml
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
```

On Debian/Ubuntu, if creating the environment fails, install `python3-venv`
using your system package manager first.

## Download → train → test

```bash
python fetch_training_data.py --month 2025-06
python train.py --month 2025-06
python evaluate.py --month 2025-06
python -m unittest discover -s tests
```

The download saves each successful API response and resumes from cache when rerun.
It can take several minutes, particularly when the provider rate-limits requests.
Do not start training until download finishes successfully.

## Read the results

- `reports/2025-06-quality.json`: expected/matched rows (720 for June), missing features, rain-event counts.
- `reports/2025-06.json`: raw-versus-Ridge MAE/RMSE/R² and heavy-rain event metrics.
- `reports/2025-06-predictions.csv`: held-out hourly predictions and reference values.
- `models/2025-06.json`: training settings, dates, dependency versions and data fingerprint.
- `models/2025-06.joblib`: saved local Ridge pipeline; load only trusted artifacts.

Positive `mae_improvement_percent` means lower Ridge error; negative means worse.
`null` marks undefined metrics. ERA5 is a **modeled rainfall reference**, not gauge
truth: better agreement with ERA5 does not establish improved measured forecasting.
This small experiment is not automatically deployed to the dashboard.

## Troubleshooting

- **Network/429/timeout:** allow HTTPS to Open-Meteo; wait and rerun the same download.
- **Missing run/hour or unexpected units:** keep the error and cached inputs for inspection;
  do not replace sources or fill missing rain with zero.
- **Dataset changed:** rerun training, then evaluation.
- **Missing model/data file:** run all commands above in order with the same month.
- **Different month:** replace `2025-06` in all three commands; archive availability varies.
- **Deactivate environment:** run `deactivate` when finished.

Generated data, reports, models and `.venv/` are ignored by Git. Paths are resolved
relative to `ml/`, so running the scripts by absolute path also works.
