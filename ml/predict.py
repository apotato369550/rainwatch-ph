"""Promote models/active-model.json to the active Supabase model row."""
import json, os, requests
from pathlib import Path
m=json.loads(Path("models/active-model.json").read_text()); url=os.environ["NEXT_PUBLIC_SUPABASE_URL"].rstrip("/"); key=os.environ["SUPABASE_SERVICE_ROLE_KEY"]; h={"apikey":key,"Authorization":f"Bearer {key}","Content-Type":"application/json"}
requests.patch(url+"/rest/v1/ml_models?active=eq.true",headers=h,json={"active":False},timeout=30).raise_for_status()
payload={"model_name":m["model_name"],"model_version":m["model_version"],"artifact":m["artifact"],"metrics":m["metrics"],"feature_names":m["features"],"training_rows":m["training_rows"],"trained_at":m["trained_at"],"active":True}
r=requests.post(url+"/rest/v1/ml_models",headers={**h,"Prefer":"resolution=merge-duplicates"},json=payload,timeout=30);r.raise_for_status();print("promoted",m["model_version"])
