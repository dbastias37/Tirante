"""Adapt the supplied HandSwap mesh/weights; no Blender scripts or rigs execute.
python scripts/assets/export_pilot_hands.py /path/to/HandSwap.blend
"""
import sys,json,hashlib
from pathlib import Path
import numpy as np
from scipy.spatial import cKDTree
import fast_simplification
from blend_reader import Blend
ROOT=Path(__file__).resolve().parents[2];b=Blend(sys.argv[1])
o=next(x for x in b.records('Object') if b.name(x,'Object')=='Arm_Mesh');arm=next(x for x in b.records('Object') if b.name(x,'Object')=='Arm_Armature')
m=next(x for x in b.records('Mesh') if b.name(x,'Mesh')=='Arm_Mesh');v,f,_=b.mesh('Arm_Mesh');v=np.array(v);f=np.array(f)
world=np.array(b.field(o,'Object','obmat')).reshape(4,4).T;armworld=np.array(b.field(arm,'Object','obmat')).reshape(4,4).T;transform=np.linalg.inv(armworld)@world
v=(np.c_[v,np.ones(len(v))]@transform.T)[:,:3]
names=[];group=b.field(b.field(o,'Object','defbase'),'ListBase','first')
while group:
 d=b.addresses[group]['data'];names.append(b.field(d,'bDeformGroup','name'));group=b.field(d,'bDeformGroup','next')
bones={b.field(d,'Bone','name'):d for d in b.records('Bone')}
ordered=['Hand_R','TwistTh_R','ThumbIn_R','ThumbOut_R']+[digit+part+'_R' for digit in ['Index','Long','Ring','Pink'] for part in ['In','Mid','Out']]
origin=np.array(b.field(bones['Hand_R'],'Bone','arm_head'))
def fit(p):
 q=np.array(p)-origin;return np.stack([-q[...,2]*.085,-q[...,0]*.10,q[...,1]*.11],axis=-1)
v=fit(v)
weights=np.zeros((len(v),len(ordered)))
for i,d in enumerate(b.rows(b.field(m,'Mesh','dvert'),'MDeformVert')):
 for w in b.rows(b.field(d,'MDeformVert','dw'),'MDeformWeight'):
  n=names[b.field(w,'MDeformWeight','def_nr')];weights[i,ordered.index(n) if n in ordered else 0]+=b.field(w,'MDeformWeight','weight')
weights/=np.maximum(weights.sum(1)[:,None],1e-20)
# Use one anatomically right hand; mirror it at runtime for the left hand.
keep=(v[f,1].min(1)>-.08)&(v[f,2].max(1)<.012)
f=f[keep];used,idx=np.unique(f,return_inverse=True);v,weights,f=v[used],weights[used],idx.reshape(-1,3)
levels=[]
for budget in [1200,380]:
 for attempt in [budget,budget-50,budget-100,budget-200]:
  p,faces=fast_simplification.simplify(v,f,target_count=min(attempt,len(f)),agg=5)
  _,inverse,counts=np.unique(np.sort(faces,axis=1),axis=0,return_inverse=True,return_counts=True);faces=faces[counts[inverse]==1]
  edges0=np.sort(np.concatenate([faces[:,[0,1]],faces[:,[1,2]],faces[:,[2,0]]]),axis=1);_,count=np.unique(edges0,axis=0,return_counts=True)
  if count.max()<=2:break
 else:raise ValueError('Simplifier introduced a non-manifold finger edge')
 dist,near=cKDTree(v).query(p,k=3);w=1/np.maximum(dist,1e-6)**3;ww=(weights[near]*w[:,:,None]).sum(1)/w.sum(1)[:,None]
 # Close the cut wrist; continuous game forearm overlaps this cap.
 edges={}
 for face in faces:
  for a,c in zip(face,np.roll(face,-1)):
   key=tuple(sorted((int(a),int(c))))
   if key in edges:del edges[key]
   else:edges[key]=(int(a),int(c))
 if edges:
  boundary=np.unique(list(edges.values()));center=p[boundary].mean(0);at=len(p);p=np.vstack([p,center]);ww=np.vstack([ww,ww[boundary].mean(0)]);faces=np.vstack([faces,[[c,a,at] for a,c in edges.values()]])
 ids=np.argsort(ww,axis=1)[:,-4:];w=np.take_along_axis(ww,ids,axis=1);w/=w.sum(1)[:,None]
 levels.append(dict(vertices=np.round(p,6).reshape(-1).tolist(),indices=faces.reshape(-1).tolist(),bones=ids.reshape(-1).tolist(),weights=np.round(w,6).reshape(-1).tolist()))
 print('hand',len(p),len(faces))
rig=[]
for name in ordered:
 d=bones[name];parent=b.field(d,'Bone','parent');parentname=b.field(b.addresses[parent]['data'],'Bone','name') if parent else ''
 rig.append(dict(name=name.removesuffix('_R'),head=np.round(fit(b.field(d,'Bone','arm_head')),6).tolist(),parent=ordered.index(parentname) if parentname in ordered else 0))
(ROOT/'game/pilot-hand-data.js').write_text('// Derived mesh/weights from user-provided HandSwap, Axel (EAFG). No source texture supplied.\nexport const PILOT_HAND='+json.dumps(dict(levels=levels,rig=rig),separators=(',',':'))+';\n')
(ROOT/'game/assets/licenses/handswap.json').write_text(json.dumps(dict(sourceName=Path(sys.argv[1]).name,author='Axel (EAFG), from embedded model notes',sha256=hashlib.sha256(Path(sys.argv[1]).read_bytes()).hexdigest(),sourceLicense='No explicit license text embedded. User supplied for this game.',texture='Not supplied; author explicitly excludes original skin texture. Game uses its own skin material.',adaptations=['Right hand coordinate basis corrected without anatomical inversion; mirrored for the left hand', 'Original mesh and finger deformation weights', 'Guide fingers aligned with the forearm; support hand surrounds the fixed reel axle', 'Game-specific reel grip; no punch animation or editor constraints', 'Closed wrist and two detail levels']),indent=2)+'\n')
