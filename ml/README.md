# RainWatch ML pipeline

This is offline forecast post-processing, not flood prediction. `fetch_training_data.py` joins each forecast snapshot with a later Open-Meteo Historical Weather API proxy and only calculates rainfall lags available at forecast issuance. It needs at least 500 matched rows; more seasonal coverage is preferable.

```bash
pip install -r requirements.txt
python fetch_training_data.py
python train.py
python evaluate.py
python predict.py # promotes the selected portable JSON artifact
```

The training split is chronological (70/15/15). The selected model minimizes validation MAE; test metrics are descriptive and must not be used to claim improvement unless ML test MAE is lower than raw Open-Meteo MAE. Historical-weather precipitation is modeled weather, not a local rain gauge.
