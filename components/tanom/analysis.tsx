"use client";
import { useState } from "react";
import type { Point } from "@/lib/tanom/contracts";
export function Analysis({point,ceb}:{point:Point;ceb:boolean}) {
  const [result,setResult]=useState("");
  const [busy,setBusy]=useState(false);
  async function generate(){setBusy(true);try{const response=await fetch("/api/analysis",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...point,ceb})});const body=await response.json();setResult(response.ok?body.analysis:body.error);}catch{setResult("Analysis unavailable. Please retry.");}finally{setBusy(false);}}
  return <section className="tanom-panel"><h2>AI analysis</h2><p>Generating sends selected coordinates and modeled weather to OpenRouter. Guidance is experimental, not a farm assessment.</p><button disabled={busy} onClick={generate}>{busy?"Generating…":"Generate analysis"}</button><p role="status" style={{whiteSpace:"pre-wrap"}}>{result}</p></section>;
}
