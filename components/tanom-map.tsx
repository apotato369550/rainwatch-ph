"use client";
import { useEffect, useRef } from "react";
import L from "leaflet";
import type { FeatureCollection } from "geojson";
import places from "@/lib/tanom/cebu-places.json";
import boundaries from "@/lib/tanom/cebu-boundaries.json";
import { findMunicipality } from "@/lib/tanom/geography";
import type { Point } from "@/lib/tanom/contracts";
export default function TanomMap({point,onSelect,ceb}:{point:Point;onSelect:(p:Point)=>void;ceb:boolean}) {
  const container=useRef<HTMLDivElement>(null),map=useRef<L.Map|null>(null),marker=useRef<L.CircleMarker|null>(null);
  const settlementLayer=useRef<L.LayerGroup|null>(null);
  const municipalityId=findMunicipality(point)?.properties.id;
  const callback=useRef(onSelect);
  useEffect(()=>{callback.current=onSelect;},[onSelect]);
  useEffect(()=>{
    if(!container.current)return;
    const instance=L.map(container.current,{center:[10.35,123.8],zoom:8,minZoom:8,maxZoom:15,scrollWheelZoom:false});
    map.current=instance;
    const layer=L.geoJSON(boundaries as FeatureCollection,{
      style:{color:"#47758a",weight:1.4,fillColor:"#e2ded0",fillOpacity:.9},
      onEachFeature(feature,polygon){
        polygon.bindTooltip(feature.properties.name,{sticky:true});
        polygon.on("click",(e:L.LeafletMouseEvent)=>{const p={lat:e.latlng.lat,lon:e.latlng.lng};if(findMunicipality(p))callback.current(p);});
      },
    }).addTo(instance);
    instance.fitBounds(layer.getBounds(),{padding:[12,12]});
    instance.setMaxBounds(layer.getBounds().pad(.25));
    instance.attributionControl.addAttribution('<a href="/cebu-boundaries-LICENSE.md">NAMRIA / PSA / OCHA · geoBoundaries</a>');
    instance.attributionControl.addAttribution('<a href="/cebu-places-LICENSE.md">GeoNames · CC BY 4.0</a>');
    settlementLayer.current=L.layerGroup().addTo(instance);
    marker.current=L.circleMarker([point.lat,point.lon],{radius:8,color:"#173f58",weight:3,fillColor:"#eeb23c",fillOpacity:1}).addTo(instance);
    const observer=new ResizeObserver(()=>instance.invalidateSize());observer.observe(container.current);
    return()=>{observer.disconnect();instance.remove();map.current=null;};
    // Map lifetime is independent of selected point; the following effect moves the marker.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);
  useEffect(()=>{marker.current?.setLatLng([point.lat,point.lon]);if(map.current&&!map.current.getBounds().contains([point.lat,point.lon]))map.current.panTo([point.lat,point.lon]);},[point]);
  useEffect(()=>{
    const instance=map.current,group=settlementLayer.current;
    if(!instance||!group)return;
    const selected=boundaries.features.find(f=>f.properties.id===municipalityId);
    if(selected)instance.fitBounds(L.geoJSON(selected as GeoJSON.Feature).getBounds(),{padding:[20,20],maxZoom:12});
    const draw=()=>{
      group.clearLayers();
      if(instance.getZoom()<10)return;
      places.filter(p=>p.municipalityId===municipalityId).forEach(place=>{
        const dot=L.circleMarker([place.lat,place.lon],{radius:5,color:"#176080",weight:2,fillColor:"#fffdf7",fillOpacity:1,bubblingMouseEvents:false}).addTo(group);
        const label=document.createElement("span");label.textContent=place.name;
        dot.bindTooltip(label);
        const choose=()=>callback.current({lat:place.lat,lon:place.lon});
        dot.on("click",choose);
        const element=dot.getElement();
        if(element){
          element.classList.add("settlement-dot");
          element.setAttribute("tabindex","0");element.setAttribute("role","button");
          element.setAttribute("aria-label",(ceb?"Pilia ang ":"Select ")+place.name);
          element.addEventListener("keydown",event=>{const key=(event as KeyboardEvent).key;if(key==="Enter"||key===" "){event.preventDefault();choose();}});
          element.addEventListener("focus",()=>dot.openTooltip());
          element.addEventListener("blur",()=>dot.closeTooltip());
        }
      });
      marker.current?.bringToFront();
    };
    draw();instance.on("zoomend",draw);
    return()=>{instance.off("zoomend",draw);group.clearLayers();};
  },[municipalityId,ceb]);
  return <div className="cebu-map" ref={container} role="region" aria-label={ceb?"Mapa sa Cebu; gamita ang listahan alang sa keyboard":"Cebu map; use the municipality list for keyboard selection"}/>;
}
