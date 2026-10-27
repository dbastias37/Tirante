"""Extract supplied Walk Cycle into small runtime curves and weighted trousers.
Usage: python scripts/assets/export_pilot_walk.py path/to/walk_cycle.glb
Offline dependencies: numpy, scipy. The game needs neither Blender nor a loader.
"""
import json, hashlib, sys
from pathlib import Path
import numpy as np
from gltf_reader import GLB
ROOT=Path(__file__).resolve().parents[2]
g=GLB(sys.argv[1]);j=g.j;frames=[];samples=48
skin=j['skins'][0];bind=np.linalg.inv(g.acc(skin['inverseBindMatrices']).reshape(-1,4,4).transpose(0,2,1))
names={n['name']:i for i,n in enumerate(j['nodes'])}
# This asset faces +Z. Rotate 180 degrees around Y to match Tirante's -Z.
legs=[[38,39,40,41],[33,34,35,36]] # target +X, -X
sy=(.97-.125)/(.9354767-.07133119);oy=.125-.07133119*sy
def conv(p):return np.array([-p[0],p[1]*sy+oy,-p[2]])
rest=[]
for ids in legs:rest.append([conv(bind[skin['joints'].index(n)][:3,3]).tolist() for n in ids[:3]])
raw=g.acc(0); foot_ids=[np.flatnonzero((raw[:,0]*side>0)&(raw[:,1]<.105)) for side in [-1,1]]
for frame in range(samples+1):
 t=frame/samples;world=g.pose(t);mesh,_=g.mesh(t);row=[]
 # Torso lateral sway, vertical pelvis bounce, pelvis twist, shoulder counter-turn.
 hips=[world[n][:3,3]*.01 for n in [38,33]]
 row.extend([-float(world[8][0,3])*.01,(hips[0][1]+hips[1][1])/2,
             float(np.arctan2(hips[1][2]-hips[0][2],hips[1][0]-hips[0][0]))])
 for ids,verts in zip(legs,foot_ids):
  hip,knee,ankle,toe=[world[n][:3,3]*.01 for n in ids]
  rest_ankle=bind[skin['joints'].index(ids[2])][:3,3];rest_toe=bind[skin['joints'].index(ids[3])][:3,3]
  def pitch(v):return np.arctan2(v[1],np.hypot(v[0],v[2]))
  roll=float(pitch(toe-ankle)-pitch(rest_toe-rest_ankle))
  # Horizontal ankle travel and real sole clearance come from the source clip.
  row.extend([-float(ankle[2]-rest_ankle[2]), max(0,float(mesh[verts,1].min())+.005),roll,
              -float(knee[2]),float(knee[1])])
 frames.append(row)
frames=np.array(frames);frames[:,1]=(frames[:,1]-frames[:-1,1].mean())*sy
frames[:,2]-=frames[:-1,2].mean()
# In-place stance travels ~half a stride from front to back over half a cycle.
stride=float(abs(frames[0,3]-frames[samples//2,3])*2)
# Keep only the connected lower body, excluding the source's hands/feet.
p=j['meshes'][0]['primitives'][0];pos=g.acc(p['attributes']['POSITION']);weights=g.acc(p['attributes']['WEIGHTS_0']);joints=g.acc(p['attributes']['JOINTS_0']);indices=g.acc(p['indices']).reshape(-1,3)
# 0 pelvis, 1/2 +X upper/lower, 3/4 -X upper/lower.
mapnodes={6:0,7:0,8:0,38:1,39:2,40:2,41:2,33:3,34:4,35:4,36:4}
w=np.zeros((len(pos),5))
for i in range(len(pos)):
 for k in range(4):
  node=skin['joints'][joints[i,k]]
  if node in mapnodes:w[i,mapnodes[node]]+=weights[i,k]
verts=[];faces=[];colors=[];outweights=[];lookup={}
def clip(poly,bound,above):
 out=[]
 for a,b in zip(poly,poly[1:]+poly[:1]):
  ai=(a[0][1]>=bound) if above else (a[0][1]<=bound);bi=(b[0][1]>=bound) if above else (b[0][1]<=bound)
  if ai:out.append(a)
  if ai!=bi:
   f=(bound-a[0][1])/(b[0][1]-a[0][1]);out.append((a[0]+f*(b[0]-a[0]),a[1]+f*(b[1]-a[1])))
 return out
for tri in indices:
 if min(w[tri].sum(1))<.99:continue
 poly=[(pos[i].astype(float),w[i]) for i in tri];poly=clip(poly,.10,True);poly=clip(poly,.99,False)
 ids=[]
 for v,weight in poly:
  q=conv(v);q[0]*=1.045;q[2]*=1.06
  key=tuple(np.round(q,6))+tuple(np.round(weight,6))
  if key not in lookup:
   lookup[key]=len(verts);verts.append(q.tolist());outweights.append((weight/weight.sum()).tolist())
  ids.append(lookup[key])
 for k in range(1,len(ids)-1):faces.append([ids[0],ids[k],ids[k+1]])
data={'source':j['asset']['extras'],'duration':1,'samples':samples,'stride':round(stride,6),'frames':np.round(frames,6).flatten().tolist(),
      'restLegs':np.round(rest,6).tolist(),'trousers':{'vertices':np.round(verts,6).flatten().tolist(),'indices':np.array(faces).flatten().tolist(),'weights':np.round(outweights,6).flatten().tolist()}}
out=ROOT/'game/pilot-walk-data.js';out.write_text('// Derived from Walk Cycle by skywarrior34niraj, CC BY 4.0. See assets/licenses/walk-cycle.json.\nexport const PILOT_WALK='+json.dumps(data,separators=(',',':'))+';\n')
manifest={**j['asset']['extras'],'file':'walk_cycle.glb','sha256':hashlib.sha256(Path(sys.argv[1]).read_bytes()).hexdigest(),'animation':j['animations'][0]['name'],'sourceTriangles':len(indices),'sampleRate':48,'durationSeconds':1,'strideMeters':stride,'trouserTriangles':len(faces),'modifications':'Coordinate/scale conversion; lower-body mesh extraction and trouser fitting; weight remapping; sampled locomotion curves; adaptive pacing, foot planting and reel-arm override.'}
(ROOT/'game/assets/licenses/walk-cycle.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(json.dumps({'outputBytes':out.stat().st_size,'triangles':len(faces),'stride':stride,'rest':rest}))
