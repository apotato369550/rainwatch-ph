import { NextRequest, NextResponse } from "next/server";
import { findMunicipality } from "@/lib/tanom/geography";
import { environmentSchema } from "@/lib/tanom/contracts";
export async function POST(request:NextRequest){
  try {
    const {lat,lon,ceb}=await request.json();
    if(typeof lat!=="number"||typeof lon!=="number"||!Number.isFinite(lat)||!Number.isFinite(lon)||!findMunicipality({lat,lon}))return NextResponse.json({error:"Select a Cebu land location."},{status:400});
    const key=process.env.OPENROUTER_API_KEY,model=process.env.OPENROUTER_MODEL;
    if(!key||!model)return NextResponse.json({error:"Configure OPENROUTER_API_KEY and OPENROUTER_MODEL on the server."},{status:503});
    const weatherResponse=await fetch(new URL(`/api/environment?lat=${lat}&lon=${lon}`,request.url));
    const weather=environmentSchema.parse(await weatherResponse.json());
    const response=await fetch("https://openrouter.ai/api/v1/chat/completions",{method:"POST",headers:{Authorization:`Bearer ${key}`,"Content-Type":"application/json"},signal:AbortSignal.timeout(30000),body:JSON.stringify({model,max_tokens:900,messages:[{role:"system",content:`Give concise growing context in ${ceb?"Cebuano":"English"}. Use only supplied modeled weather. Separate summary, suggestions, limitations. Do not invent soil properties, crop suitability, measurements or flood predictions. Climate and field data are unavailable; state this. This is not planting advice.`},{role:"user",content:JSON.stringify(weather)}]})});
    if(!response.ok)throw new Error();
    const body=await response.json();const analysis=body.choices?.[0]?.message?.content;
    if(typeof analysis!=="string"||!analysis.trim())throw new Error();
    return NextResponse.json({analysis,model,observedAt:weather.observedAt});
  }catch{return NextResponse.json({error:"Analysis unavailable. Please retry."},{status:502});}
}
