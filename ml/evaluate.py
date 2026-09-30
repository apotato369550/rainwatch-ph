import json
from pathlib import Path
m=json.loads(Path("models/active-model.json").read_text()); x=m["metrics"]
print(f"MODEL{'':22} MAE     RMSE    HEAVY RAIN RECALL")
print(f"Raw Open-Meteo{'':12} {x['raw_mae']:.2f}    -       -")
print(f"{m['model_name'][:24]:24} {x['mae']:.2f}    {x['rmse']:.2f}    {x['heavy_5_recall']:.2f}")
