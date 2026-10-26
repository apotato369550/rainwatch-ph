Extend the existing **RainWatch PH** Next.js project. Do NOT rebuild the app from scratch or replace working features. Preserve the existing UI, Open-Meteo integration, rainfall calculations, map, and heuristic Rainfall Stress Score.

The goal of this phase is to add **Supabase persistence + scheduled data collection + a lightweight machine-learning rainfall correction pipeline**.

## Goal

Turn RainWatch PH from a live weather dashboard into a small real-time ML/data-science system that:

1. Collects rainfall forecasts over time.
2. Stores forecasts and later observed weather in Supabase.
3. Builds a historical dataset suitable for ML.
4. Trains a simple model to estimate/correct forecast rainfall.
5. Displays the ML prediction alongside the original Open-Meteo forecast.
6. Measures whether ML actually improves prediction accuracy.

Keep everything deployable with:

* Next.js on Vercel
* Supabase
* Python used only for offline/model training if necessary

Do NOT add authentication.

---

# 1. Add Supabase

Install and configure `@supabase/supabase-js`.

Use environment variables:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

Never expose the service-role key to client-side code.

Add a reusable server-side Supabase client.

## Database schema

Create SQL migrations for:

### locations

```sql
id uuid primary key
slug text unique
name text
province text
region text
latitude double precision
longitude double precision
created_at timestamptz
```

Seed the existing supported Philippine cities.

### weather_forecasts

```sql
id uuid primary key
location_id uuid references locations(id)

forecast_generated_at timestamptz
forecast_for timestamptz

precipitation double precision
precipitation_probability double precision
humidity double precision
surface_pressure double precision
cloud_cover double precision
wind_speed double precision
cape double precision
soil_moisture double precision

created_at timestamptz
```

Add indexes for:

```text
location_id
forecast_for
forecast_generated_at
```

Prevent obvious duplicate observations when possible.

### weather_observations

```sql
id uuid primary key
location_id uuid references locations(id)
observed_at timestamptz

precipitation double precision
humidity double precision
surface_pressure double precision
cloud_cover double precision
wind_speed double precision
cape double precision
soil_moisture double precision

created_at timestamptz
```

### ml_predictions

```sql
id uuid primary key
location_id uuid references locations(id)
forecast_for timestamptz

raw_forecast double precision
ml_forecast double precision

model_name text
model_version text

created_at timestamptz
```

---

# 2. Scheduled weather ingestion

Create a Supabase Edge Function or equivalent server-side ingestion function.

Its job:

```text
For every supported location
    ↓
Fetch Open-Meteo
    ↓
Store upcoming hourly forecast
    ↓
Store latest/current observed weather
```

Design it so Supabase Cron can run it approximately once per hour.

Do NOT depend on Vercel Cron.

Make ingestion idempotent so repeated runs do not create large numbers of duplicate rows.

Document how to configure the Supabase Cron job.

---

# 3. Historical ML dataset

Add a Python directory:

```text
ml/
├── requirements.txt
├── fetch_training_data.py
├── train.py
├── evaluate.py
├── predict.py
├── models/
└── README.md
```

Use:

* pandas
* numpy
* scikit-learn
* joblib
* optionally XGBoost if practical

Do not introduce TensorFlow/PyTorch.

The ML task is **rainfall forecast correction**, not direct flood prediction.

Given a weather forecast and atmospheric conditions, predict the observed rainfall.

Target:

```text
actual precipitation for the forecast hour
```

Features should include, when available:

```text
raw precipitation forecast
precipitation probability
humidity
surface pressure
cloud cover
wind speed
CAPE
soil moisture

hour of day
month
latitude
longitude

recent accumulated rainfall
```

Create useful engineered features such as:

```text
previous 3h rainfall
previous 6h rainfall
previous 24h rainfall

forecast lead time

month encoded cyclically
hour encoded cyclically
```

Use appropriate safeguards against data leakage.

---

# 4. Train multiple simple models

Implement and evaluate:

1. Baseline:
   `prediction = raw Open-Meteo precipitation forecast`

2. Linear Regression or Ridge Regression

3. Random Forest Regressor

4. Gradient Boosting / HistGradientBoostingRegressor

Optionally add XGBoost only if it does not significantly complicate setup.

Split the data chronologically rather than randomly.

For example:

```text
oldest 70% → training
next 15%   → validation
newest 15% → test
```

Do not leak future observations into training.

---

# 5. Evaluation

Calculate:

```text
MAE
RMSE
R²
```

Also add metrics specifically for heavy-rain events.

Define configurable thresholds such as:

```text
>= 5 mm/hour
>= 10 mm/hour
```

Calculate:

```text
precision
recall
F1
```

for detecting heavy-rain events.

Print a comparison like:

```text
MODEL                     MAE     RMSE    HEAVY RAIN RECALL

Raw Open-Meteo            4.82    8.91          0.71
Ridge                     4.51    8.22          0.72
Random Forest             4.09    7.44          0.78
Gradient Boosting         3.88    7.12          0.82
```

Automatically select the best-performing model using validation performance.

Save the selected model with metadata including:

```text
model name
version
training date
features
training rows
MAE
RMSE
heavy-rain recall
```

Important:

Do NOT imply that the ML model is better unless evaluation actually demonstrates it.

---

# 6. Production inference

Integrate the trained model into RainWatch PH.

Prefer the simplest maintainable approach.

Acceptable approaches:

### Preferred

Export model parameters or prediction logic into a lightweight format that can be executed server-side within the existing Next.js application.

### Alternative

Create a small serverless Python inference endpoint compatible with Vercel.

Do NOT create a permanently running FastAPI server.

Expose something similar to:

```ts
interface RainfallPrediction {
  rawForecast: number
  correctedForecast: number | null

  modelName: string | null
  modelVersion: string | null

  improvementKnown: boolean
}
```

Gracefully fall back to the raw forecast whenever ML inference is unavailable.

The application must remain useful even if the ML layer fails.

---

# 7. Update the RainWatch dashboard

Preserve the current UI but add an ML forecast section.

Example:

```text
RAINFALL FORECAST

Open-Meteo
Next 6h             31.2 mm

ML-adjusted
Next 6h             36.8 mm

Difference          +5.6 mm
```

Clearly label the ML value:

> Experimental ML-adjusted rainfall forecast

Add a tooltip/explanation:

> The ML model learns systematic differences between previous weather forecasts and later observed rainfall. It does not independently simulate weather.

Do not call this:

```text
AI flood prediction
```

or:

```text
AI weather prediction
```

Prefer:

```text
ML forecast correction
```

---

# 8. Model performance panel

Add a small Data Science / Model Performance panel.

Example:

```text
MODEL PERFORMANCE

Model               Gradient Boosting
Version             v0.1
Test observations   18,420

MAE
Raw forecast        4.82 mm
ML corrected        3.88 mm

Improvement         19.5%

Heavy-rain recall
Raw                 71%
ML                  82%
```

Load these metrics from model metadata rather than hardcoding them.

If insufficient training data exists, display:

```text
ML model is still collecting sufficient historical data.
Raw Open-Meteo forecasts are being shown.
```

---

# 9. Historical observation UI

Add a simple page:

```text
/history
```

Allow users to choose a city and inspect:

```text
Forecast rainfall
Actual rainfall
ML-adjusted rainfall
```

on a time-series chart.

This is important because users should be able to visually see when:

```text
the original forecast was correct
the ML correction helped
the ML correction made things worse
```

Keep it simple.

---

# 10. Preserve the existing Rainfall Stress Score

Do NOT replace the existing heuristic Rainfall Stress Score with ML.

Keep these concepts separate:

```text
Rainfall Stress Score
        =
interpretable risk indicator

ML rainfall correction
        =
forecasting experiment
```

The Stress Score may consume the ML-adjusted rainfall prediction when available, but clearly indicate whether its rainfall input came from:

```text
raw forecast
```

or:

```text
ML-adjusted forecast
```

Always retain the disclaimer:

> Rainfall Stress is an experimental indicator and is NOT a flood prediction.

---

# 11. Developer/data-science tooling

Add scripts such as:

```bash
npm run ingest
npm run db:seed
npm run ml:evaluate
```

where practical.

Python commands should be documented separately:

```bash
cd ml

python fetch_training_data.py
python train.py
python evaluate.py
```

Include `.env.example`.

Update the README with:

```text
Architecture
Supabase setup
Database migration
Cron setup
Training pipeline
Evaluation methodology
Model deployment
Vercel deployment
Limitations
```

---

# 12. Important scientific constraints

Do not make unsupported claims.

RainWatch PH predicts or estimates **rainfall**, not flooding.

Flooding also depends on:

* drainage capacity
* topography
* waterways
* tides
* soil conditions
* urbanization
* infrastructure
* previous rainfall

Avoid language implying causality.

Make model limitations visible.

Treat Open-Meteo forecasts as the forecasting baseline.

The purpose of ML is to test:

> Can locally trained statistical post-processing reduce rainfall forecast error for selected Philippine locations?

That is the core data-science question.

---

# 13. Architecture target

The resulting architecture should roughly be:

```text
                 Open-Meteo
                     │
              ┌──────┴──────┐
              │             │
              ▼             ▼
          Live API      Scheduled ingestion
              │             │
              │             ▼
              │          Supabase
              │             │
              │        historical data
              │             │
              │             ▼
              │       Python training
              │             │
              │             ▼
              │        trained model
              │             │
              └──────┬──────┘
                     ▼
                Next.js app
                     │
             raw + ML forecast
                     │
                     ▼
                   Vercel
```

Keep the system intentionally simple.

Do not introduce:

* Kubernetes
* Docker orchestration
* Kafka
* Redis
* microservices
* dedicated Python servers
* authentication
* unnecessary queues

---

# Final requirements

After implementation:

1. Run all Supabase migrations.
2. Ensure TypeScript compiles.
3. Ensure lint passes.
4. Ensure production build passes.
5. Verify existing RainWatch functionality still works.
6. Verify app works when Supabase is temporarily unavailable.
7. Verify app works when no trained ML model exists.
8. Add useful error handling.
9. Update README.
10. Do not leave major functionality as TODO placeholders.

Most importantly: **extend the existing implementation rather than rewriting working code.**
