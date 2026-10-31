import boundaries from "./cebu-boundaries.json";
import type { Point } from "./contracts";
type Ring = number[][];
type Geometry = { type: string; coordinates: unknown };
export const municipalities = boundaries.features;
function onSegment(x: number,y: number,a:number[],b:number[]) {
  return Math.abs((y-a[1])*(b[0]-a[0])-(x-a[0])*(b[1]-a[1]))<1e-10 &&
    x>=Math.min(a[0],b[0])-1e-10 && x<=Math.max(a[0],b[0])+1e-10 &&
    y>=Math.min(a[1],b[1])-1e-10 && y<=Math.max(a[1],b[1])+1e-10;
}
function inRing({lat:y,lon:x}:Point, ring:Ring) {
  let inside=false;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++) {
    const a=ring[i],b=ring[j];
    if(onSegment(x,y,a,b))return true;
    if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])inside=!inside;
  }
  return inside;
}
export function inGeometry(point:Point, geometry:Geometry) {
  const polygons = (geometry.type==="Polygon" ? [geometry.coordinates] : geometry.coordinates) as Ring[][];
  return polygons.some(p=>inRing(point,p[0])&&!p.slice(1).some(h=>inRing(point,h)));
}
export function findMunicipality(point:Point) {
  if(!Number.isFinite(point.lat)||!Number.isFinite(point.lon))return undefined;
  return municipalities.find(f=>inGeometry(point,f.geometry));
}
export function representativePoint(feature:typeof municipalities[number]):Point {
  const polygons = (feature.geometry.type==="Polygon"?[feature.geometry.coordinates]:feature.geometry.coordinates) as Ring[][];
  const ring = [...polygons].sort((a,b)=>b[0].length-a[0].length)[0][0];
  const minX=Math.min(...ring.map(p=>p[0])),maxX=Math.max(...ring.map(p=>p[0]));
  const minY=Math.min(...ring.map(p=>p[1])),maxY=Math.max(...ring.map(p=>p[1]));
  const order=[10,9,11,8,12,7,13,6,14,5,15,4,16,3,17,2,18,1,19];
  for(const i of order)for(const j of order){
    const point={lat:minY+(maxY-minY)*i/20,lon:minX+(maxX-minX)*j/20};
    if(inGeometry(point,feature.geometry))return point;
  }
  return {lat:ring[0][1],lon:ring[0][0]};
}
export const defaultPoint:Point={lat:9.8127,lon:123.4624};
