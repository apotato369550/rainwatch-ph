import json, math
from datetime import datetime, timezone
from pathlib import Path
import joblib, numpy as np, pandas as pd
from sklearn.impute import SimpleImputer
from sklearn.linear_model import Ridge
from sklearn.ensemble import RandomForestRegressor, HistGradientBoostingRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
FEATURES=["raw_precipitation","precipitation_probability","humidity","surface_pressure","cloud_cover","wind_speed","cape","soil_moisture","hour_sin","hour_cos","month_sin","month_cos","latitude","longitude","previous_3h_rainfall","previous_6h_rainfall","previous_24h_rainfall","forecast_lead_hours"]
TARGET="actual_precipitation"; THRESHOLDS=(5,10)
def metrics(y,p,raw):
 out={"mae":float(mean_absolute_error(y,p)),"rmse":float(mean_squared_error(y,p)**.5),"r2":float(r2_score(y,p)),"raw_mae":float(mean_absolute_error(y,raw))}
 for t in THRESHOLDS:
  truth=y>=t; hit=p>=t; tp=np.sum(truth&hit); out[f"heavy_{t}_precision"]=float(tp/max(np.sum(hit),1)); out[f"heavy_{t}_recall"]=float(tp/max(np.sum(truth),1)); out[f"heavy_{t}_f1"]=float(2*tp/max(2*tp+np.sum(hit&~truth)+np.sum(~hit&truth),1))
 return out
def nodes_from_tree(tree):
 return [{"feature":int(tree.feature[i]),"threshold":float(tree.threshold[i]),"left":int(tree.children_left[i]),"right":int(tree.children_right[i]),**({"value":float(tree.value[i][0][0])} if tree.children_left[i]<0 else {})} for i in range(tree.node_count)]
def artifact(model, imputer):
 base={"format":"rainwatch-model/v1","feature_names":FEATURES,"imputer":imputer.statistics_.astype(float).tolist()}
 if isinstance(model,Ridge): return {**base,"kind":"linear","intercept":float(model.intercept_),"coefficients":model.coef_.astype(float).tolist()}
 if isinstance(model,RandomForestRegressor): return {**base,"kind":"tree-ensemble","baseline":0,"trees":[nodes_from_tree(t.tree_) for t in model.estimators_]}
 # HistGradientBoosting uses predictor nodes with the same traversal representation.
 trees=[]
 for stage in model._predictors:
  for predictor in stage:
   nodes=[]
   for n in predictor.nodes:
    leaf=bool(n["is_leaf"]); nodes.append({"feature":int(n["feature_idx"]),"threshold":float(n["num_threshold"]),"left":int(n["left"]),"right":int(n["right"]),**({"value":float(n["value"])} if leaf else {})})
   trees.append(nodes)
 return {**base,"kind":"tree-ensemble","baseline":float(model._baseline_prediction[0][0]),"learning_rate":float(model.learning_rate),"trees":trees}
df=pd.read_csv("data/training.csv").sort_values("forecast_generated_at").dropna(subset=[TARGET]); n=len(df)
if n<500: raise SystemExit(f"Need at least 500 matched rows; found {n}.")
a,b=int(n*.7),int(n*.85); train,val,test=df.iloc[:a],df.iloc[a:b],df.iloc[b:]
imp=SimpleImputer(strategy="median").fit(train[FEATURES]); xtrain=imp.transform(train[FEATURES]); xval=imp.transform(val[FEATURES]); xtest=imp.transform(test[FEATURES])
models={"Ridge":Ridge(alpha=2),"Random Forest":RandomForestRegressor(n_estimators=150,max_depth=10,min_samples_leaf=4,n_jobs=-1,random_state=42),"Gradient Boosting":HistGradientBoostingRegressor(max_iter=150,max_leaf_nodes=20,l2_regularization=1,random_state=42)}
for model in models.values(): model.fit(xtrain,train[TARGET])
best_name,best=min(models.items(), key=lambda p: mean_absolute_error(val[TARGET],p[1].predict(xval)))
pred=np.maximum(0,best.predict(xtest)); report=metrics(test[TARGET].to_numpy(),pred,test.raw_precipitation.to_numpy())
version="v"+datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S"); meta={"model_name":best_name,"model_version":version,"trained_at":datetime.now(timezone.utc).isoformat(),"training_rows":int(len(train)),"validation_rows":int(len(val)),"test_rows":int(len(test)),"features":FEATURES,"metrics":report,"artifact":artifact(best,imp)}
Path("models").mkdir(exist_ok=True); Path("models/active-model.json").write_text(json.dumps(meta)); joblib.dump({"model":best,"imputer":imp,"metadata":meta},"models/active-model.joblib")
print(json.dumps({"selected":best_name,**report},indent=2))
