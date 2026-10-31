"use client";
import { useEffect, useState } from "react";
import type { z } from "zod";
export function useResource<T>(url:string|null,schema:z.ZodType<T>,refreshMs=0) {
  const [state,setState]=useState<{url:string;data:T|null;error:boolean;loading:boolean}>({url:"",data:null,error:false,loading:true});
  const [revision,setRevision]=useState(0);
  useEffect(()=>{
    if(!url)return;
    const controller=new AbortController();
    async function load() {
      try {
        const response=await fetch(url!,{signal:controller.signal,cache:"no-store"});
        if(!response.ok)throw Error("Unavailable");
        const data=schema.parse(await response.json());
        if(!controller.signal.aborted)setState({url:url!,data,error:false,loading:false});
      }catch{
        if(!controller.signal.aborted)setState(previous=>({url:url!,data:previous.url===url?previous.data:null,error:true,loading:false}));
      }
    }
    void load();
    const timer=refreshMs?window.setInterval(()=>{if(document.visibilityState==="visible")void load();},refreshMs):undefined;
    return()=>{controller.abort();if(timer)clearInterval(timer);};
  },[url,schema,revision,refreshMs]);
  return {...(state.url===url?state:{data:null,error:false,loading:!!url}),retry:()=>setRevision(n=>n+1)};
}
