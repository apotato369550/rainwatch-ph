"""Build catalog from pinned geoBoundaries 9469f09 ADM2/ADM3 simplified inputs.
Usage: python3 scripts/build-national-geography.py /tmp/ph-adm2.json /tmp/ph-adm3.json
Source attribution: public/philippines-boundaries-LICENSE.md.
"""
import json, sys
from collections import Counter
from pathlib import Path
def polys(g): return [g['coordinates']] if g['type']=='Polygon' else g['coordinates']
def ring(p,r):
 x,y=p;inside=False
 for a,b in zip(r,r[1:]+r[:1]):
  if (a[1]>y)!=(b[1]>y) and x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0]:inside=not inside
 return inside
def contains(g,p):return any(ring(p,r[0]) and not any(ring(p,h) for h in r[1:]) for r in polys(g))
def bounds(g):
 pts=[p for poly in polys(g) for r in poly for p in r]
 return [min(p[0] for p in pts),min(p[1] for p in pts),max(p[0] for p in pts),max(p[1] for p in pts)]
def representative(g):
 for poly in sorted(polys(g),key=lambda p:len(p[0]),reverse=True):
  box=bounds({'type':'Polygon','coordinates':poly})
  for n in [20,100]:
   for i in sorted(range(1,n),key=lambda x:abs(x-n/2)):
    for j in sorted(range(1,n),key=lambda x:abs(x-n/2)):
     p=[box[0]+(box[2]-box[0])*i/n,box[1]+(box[3]-box[1])*j/n]
     if contains(g,p):return p
 raise ValueError('No interior point')
adm2=json.load(open(sys.argv[1]))['features']
adm3=json.load(open(sys.argv[2]))['features']
areas=[]
for f in adm2:
 f['bbox']=bounds(f['geometry'])
 areas.append({'id':f['properties']['shapeID'],'name':f['properties']['shapeName'],'bbox':f['bbox']})
features=[];catalog=[]
for f in adm3:
 g=f['geometry'];p=representative(g)
 candidates=[a for a in adm2 if a['bbox'][0]<=p[0]<=a['bbox'][2] and a['bbox'][1]<=p[1]<=a['bbox'][3] and contains(a['geometry'],p)]
 if len(candidates)!=1:raise ValueError((f['properties'],[a['properties'] for a in candidates]))
 a=candidates[0]
 props={'id':f['properties']['shapeID'],'name':f['properties']['shapeName'],'areaId':a['properties']['shapeID']}
 features.append({'type':'Feature','properties':props,'geometry':g,'bbox':bounds(g)})
 catalog.append({**props,'point':{'lat':p[1],'lon':p[0]},'bbox':bounds(g)})
Path('lib/tanom/national-boundaries.json').write_text(json.dumps({'type':'FeatureCollection','features':features},separators=(',',':')))
Path('lib/tanom/location-catalog.json').write_text(json.dumps({'areas':areas,'municipalities':catalog},separators=(',',':')))
print(len(features),'municipalities',len(areas),'areas')
