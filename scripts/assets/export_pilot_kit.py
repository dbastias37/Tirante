"""Offline, data-only adaptation of the user-supplied character kit.
python scripts/assets/export_pilot_kit.py /path/to/clothing-and-character-kit.blend
Requires numpy, scipy, Pillow and fast-simplification==0.1.12.
"""
import sys,io,json,struct,hashlib
from pathlib import Path
import numpy as np
from scipy.spatial import cKDTree
from PIL import Image,ImageDraw,ImageFilter
import fast_simplification
from blend_reader import Blend
ROOT=Path(__file__).resolve().parents[2]
b=Blend(sys.argv[1])

def source(name):
 m=next(x for x in b.records('Mesh') if b.name(x,'Mesh')==name)
 v,f,uv=b.mesh(name);v,f,uv=np.array(v),np.array(f),np.array(uv)
 addresses=struct.unpack('<'+'Q'*(b.addresses[b.field(m,'Mesh','mat')]['size']//8),b.addresses[b.field(m,'Mesh','mat')]['data'])
 mats=[b.name(b.addresses[a]['data'],'Material') for a in addresses]
 ids=[]
 for p in b.rows(b.field(m,'Mesh','mpoly'),'MPoly'):ids.extend([b.field(p,'MPoly','mat_nr')]*(b.field(p,'MPoly','totloop')-2))
 return v,f,uv,np.array(ids),mats

def image_for(name):
 m=next(x for x in b.records('Material') if b.name(x,'Material')==name)
 tree=b.field(m,'Material','nodetree')
 if not tree:return None
 node=b.field(b.field(b.addresses[tree]['data'],'bNodeTree','nodes'),'ListBase','first')
 while node:
  d=b.addresses[node]['data'];a=b.field(d,'bNode','id')
  if a and b.structs[b.addresses[a]['sdna']]['name']=='Image':
   return Image.open(io.BytesIO(b.packed_image(b.name(b.addresses[a]['data'],'Image')))).convert('RGBA')
  node=b.field(d,'bNode','next')
 return None

def project_uv(points,directions,v,f,uv):
 tri=v[f];norm=np.cross(tri[:,1]-tri[:,0],tri[:,2]-tri[:,0]);norm/=np.maximum(np.linalg.norm(norm,axis=1)[:,None],1e-12)
 ids=cKDTree(tri.mean(1)).query(points,k=min(40,len(f)))[1];t=tri[ids];a=t[:,:,0];e0=t[:,:,1]-a;e1=t[:,:,2]-a;d=points[:,None]-a
 aa=(e0*e0).sum(2);ab=(e0*e1).sum(2);bb=(e1*e1).sum(2);da=(d*e0).sum(2);db=(d*e1).sum(2);den=np.maximum(aa*bb-ab*ab,1e-20)
 x=(bb*da-ab*db)/den;y=(aa*db-ab*da)/den;weights=np.stack([1-x-y,x,y],2);outside=weights.min(2)<0
 choices=[]
 for i,j in [(0,1),(1,2),(2,0)]:
  edge=t[:,:,j]-t[:,:,i];amount=np.clip(((points[:,None]-t[:,:,i])*edge).sum(2)/np.maximum((edge*edge).sum(2),1e-20),0,1);w=np.zeros_like(weights);w[:,:,i]=1-amount;w[:,:,j]=amount;choices.append(w)
 choices=np.stack(choices,2);dist=(((choices[:,:,:,:,None]*t[:,:,None]).sum(3)-points[:,None,None])**2).sum(3);nearest=choices[np.arange(len(points))[:,None],np.arange(ids.shape[1])[None],dist.argmin(2)];weights[outside]=nearest[outside]
 projected=(weights[:,:,:,None]*t).sum(2);score=((projected-points[:,None])**2).sum(2)+np.maximum(0,.5-(norm[ids]*directions[:,None]).sum(2))*.00008
 k=score.argmin(1);return (weights[np.arange(len(points)),k,:,None]*uv[ids[np.arange(len(points)),k]]).sum(1)

def uv_charts(f,uv):
 parent=list(range(len(f)));edges={}
 def root(a):
  while parent[a]!=a:parent[a]=parent[parent[a]];a=parent[a]
  return a
 for i,face in enumerate(f):
  for k in range(3):
   a,b=k,(k+1)%3
   if face[a]>face[b]:a,b=b,a
   key=(int(face[a]),int(face[b]),*np.round(uv[i,a],5),*np.round(uv[i,b],5))
   if key in edges:parent[root(i)]=root(edges[key])
   else:edges[key]=i
 return np.array([root(i) for i in range(len(f))])

def chart_uv(points,directions,v,f,uv):
 charts=uv_charts(f,uv);tri=v[f];norm=np.cross(tri[:,1]-tri[:,0],tri[:,2]-tri[:,0]);norm/=np.maximum(np.linalg.norm(norm,axis=1)[:,None],1e-12)
 centers=points.reshape(-1,3,3).mean(1);dirs=directions[::3]
 ids=cKDTree(tri.mean(1)).query(centers,k=min(12,len(f)))[1]
 score=((tri[ids].mean(2)-centers[:,None])**2).sum(2)+np.maximum(0,.5-(norm[ids]*dirs[:,None]).sum(2))*.0001
 chosen=charts[ids[np.arange(len(ids)),score.argmin(1)]];out=np.empty((len(points),2))
 for chart in set(chosen):
  select=np.repeat(chosen==chart,3);mask=charts==chart
  if mask.sum()==1:
   # A tiny isolated island retains that face's original corner UVs.
   out[select]=np.tile(uv[mask][0],(select.sum()//3,1))
  else:out[select]=project_uv(points[select],directions[select],v,f[mask],uv[mask])
 return out

def mesh_normals(v,f):
 n=np.zeros_like(v);t=v[f];fn=np.cross(t[:,1]-t[:,0],t[:,2]-t[:,0])
 for k in range(3):np.add.at(n,f[:,k],fn)
 return n/np.maximum(np.linalg.norm(n,axis=1)[:,None],1e-20)

def clip_bottom(v,f,uv,mi,height):
 vertices=v.tolist();faces=[];coords=[];materials=[];intersections={}
 for face,tex,mat in zip(f,uv,mi):
  poly=[]
  for k in range(3):
   a,c=int(face[k]),int(face[(k+1)%3]);pa,pc=v[a],v[c];qa,qc=tex[k],tex[(k+1)%3]
   if pa[1]>=height:poly.append((a,qa))
   if (pa[1]>=height)!=(pc[1]>=height):
    t=(height-pa[1])/(pc[1]-pa[1]);key=tuple(sorted((a,c)))
    if key not in intersections:intersections[key]=len(vertices);vertices.append((pa+(pc-pa)*t).tolist())
    poly.append((intersections[key],qa+(qc-qa)*t))
  for k in range(1,len(poly)-1):
   ids=[0,k,k+1];faces.append([poly[j][0] for j in ids]);coords.append([poly[j][1] for j in ids]);materials.append(mat)
 return np.array(vertices),np.array(faces),np.array(coords),np.array(materials)

def close_throat(v,f,uv,mi,height):
 # The kit's cut bust is open. A real skin cap blocks views up into the
 # mouth cavity when the head pitches, even before the neck overlaps it.
 edges={}
 for face,tex,mat in zip(f,uv,mi):
  if mat!=0:continue
  for k in range(3):
   a,c=int(face[k]),int(face[(k+1)%3]);key=tuple(sorted((a,c)))
   if key in edges:del edges[key]
   else:edges[key]=(a,c,tex[k])
 border=[e for e in edges.values() if max(v[e[0],1],v[e[1],1])<.080]
 if not border:return v,f,uv,mi
 ids=np.unique([[a,c] for a,c,_ in border]);center=len(v);v=np.vstack([v,v[ids].mean(0)])
 sample=max(border,key=lambda e:v[e[0],2])[2]
 f=np.vstack([f,[[c,a,center] for a,c,_ in border]]);uv=np.concatenate([uv,np.tile(sample,(len(border),3,1))]);mi=np.r_[mi,np.zeros(len(border),dtype=int)]
 return v,f,uv,mi

def scalp_underlay(tile,v,f,uv,lo,size):
 # Hair cards retain their transparency, over a matching scalp rather than
 # bald skin. This UV bake adds no runtime mesh or draw call.
 mask=Image.new('L',tile.size,0);draw=ImageDraw.Draw(mask)
 def threshold(p):
  back=np.clip((p[2]+.025)/.070,0,1);back=back*back*(3-2*back)
  temple=np.clip((abs(p[0])-.040)/.040,0,1);temple=temple*temple*(3-2*temple)
  return p[1]-(.184+.010*np.exp(-(p[0]/.04)**2)-.064*back-.032*temple)
 for face,tex in zip(f,uv):
  poly=[]
  for k in range(3):
   a,c=v[face[k]],v[face[(k+1)%3]];qa,qc=tex[k],tex[(k+1)%3];fa,fc=threshold(a),threshold(c)
   if fa>=0:poly.append(qa)
   if (fa>=0)!=(fc>=0):poly.append(qa+(qc-qa)*fa/(fa-fc))
  if len(poly)>2:
   q=(np.array(poly)-lo)/size;draw.polygon([(float(u*(tile.width-1)),float((1-w)*(tile.height-1))) for u,w in q],fill=255)
 mask=mask.filter(ImageFilter.GaussianBlur(.65));dark=Image.new('RGBA',tile.size,(56,35,25,255));return Image.composite(dark,tile,mask)

def export(name,tag,kind):
 v,f,uv,mi,mats=source(name)
 if kind=='head':
  # Discard the bust under the collar and invisible teeth/tongue. The neck
  # remains the game's continuous animated neck, overlapped inside the jaw.
  keep=np.array([not ('teeth' in mats[i].lower() or 'tongue' in mats[i].lower()) for i in mi])
  f,uv,mi=f[keep],uv[keep],mi[keep]
  v,f,uv,mi=clip_bottom(v,f,uv,mi,-.107)
  neck_ids=np.unique(f[mi==0]);neck_ids=neck_ids[abs(v[neck_ids,1]+.107)<1e-6];neck_center=v[neck_ids].mean(0)
  v=np.stack([(v[:,0]-neck_center[0])*.88,(v[:,1]+.112)*.88,-(v[:,2]-neck_center[2])*.88+.012],1)
  # Preserve the chin/jaw in front of the neck. Only the posterior neck and
  # the very bottom of the discarded bust blend into the animated neck tube.
  t=np.clip((.067-v[:,1])/.057,0,1);t=t*t*(3-2*t)
  front=np.clip((v[:,2]+.075)/.040,0,1);front=front*front*(3-2*front);t*=front
  angle=np.arctan2(v[:,2]-.012,v[:,0])
  v[:,0]=v[:,0]*(1-t)+np.cos(angle)*.046*t
  v[:,2]=v[:,2]*(1-t)+(.012+np.sin(angle)*.044)*t
  v,f,uv,mi=close_throat(v,f,uv,mi,(.112-.107)*.88)
  budgets=[{'skin':2200,'eye':320,'hair':650},{'skin':650,'eye':120,'hair':200}]
 else:
  # Shoe source has toe along -Z after Blender's object rotation.
  v=np.stack([(v[:,0]+.007)*.85,(v[:,1]-v[:,1].min())*.92,-v[:,2]*.94-.071],1)
  # The kit's shoe is tilted in its local object coordinates: orient by its
  # sole plane below, then fit the existing 28 cm foot and ankle location.
  budgets=[{'skin':1100},{'skin':400}]
 f,uv=f[:,[0,2,1]],uv[:,[0,2,1]]
 used=sorted(set(mi));atlas=Image.new('RGBA',(1024,1024),(120,100,85,255));regions={}
 for slot,i in enumerate(used):
  image=image_for(mats[i]) or Image.new('RGBA',(16,16),(185,175,160,255));q=uv[mi==i].reshape(-1,2);lo=np.clip(q.min(0),0,1);hi=np.clip(q.max(0),0,1)
  size=np.maximum(hi-lo,.001);crop=(int(lo[0]*image.width),int((1-hi[1])*image.height),int(np.ceil(hi[0]*image.width)),int(np.ceil((1-lo[1])*image.height)))
  if 'eye_brown' in mats[i].lower():
   rgba=np.array(image);red=(rgba[:,:,0]>rgba[:,:,1]*1.35)&(rgba[:,:,0]<170);rgba[red,0]=(rgba[red,0]*.68).astype('uint8');image=Image.fromarray(rgba)
  tile=image.crop(crop).resize((508,508),Image.Resampling.LANCZOS)
  if name=='make5' and i==0:tile=scalp_underlay(tile,v,f[mi==i],uv[mi==i],lo,size)
  x=(slot%2)*512+2;y=(slot//2)*512+2;atlas.paste(tile,(x,y));regions[i]=(lo,size,x,y)
 path=ROOT/'game/assets/pilots';path.mkdir(exist_ok=True)
 atlas.save(path/(tag+'.webp'),quality=88,method=6)
 pixels=np.asarray(atlas)
 levels=[]
 for budget in budgets:
  positions=[];normals=[];coords=[];colors=[];indices=[];lookup={}
  for i in used:
   ff=f[mi==i];uu=uv[mi==i];label='hair' if 'ponytail' in mats[i] else 'eye' if 'eye' in mats[i].lower() else 'skin'
   usedverts,inv=np.unique(ff,return_inverse=True);vv=v[usedverts];fflocal=inv.reshape(-1,3)
   pp,ii=fast_simplification.simplify(vv,fflocal,target_count=min(budget.get(label,400),len(ff)),agg=5)
   # Keep QEM's reduced surface within the source silhouette.
   pp=np.clip(pp,vv.min(0),vv.max(0));nn=mesh_normals(pp,ii)
   if kind=='head' and label=='skin':
    blend=np.clip((.065-pp[:,1])/.030,0,1);radial=np.stack([pp[:,0],np.zeros(len(pp)),pp[:,2]-.012],1);radial/=np.maximum(np.linalg.norm(radial,axis=1)[:,None],1e-12);nn=nn*(1-blend[:,None])+radial*blend[:,None];nn/=np.maximum(np.linalg.norm(nn,axis=1)[:,None],1e-12)
   tri=pp[ii];directions=np.cross(tri[:,1]-tri[:,0],tri[:,2]-tri[:,0]);directions/=np.maximum(np.linalg.norm(directions,axis=1)[:,None],1e-20)
   sample=tri.reshape(-1,3)
   q=chart_uv(sample,np.repeat(directions,3,axis=0),v,ff,uu)
   lo,size,x,y=regions[i];q=np.clip((q-lo)/size,0,1);qx=(x+q[:,0]*507+.5)/1024;qy=1-(y+(1-q[:,1])*507+.5)/1024;q=np.stack([qx,qy],1)
   cc=pixels[np.clip(((1-q[:,1])*1024).astype(int),0,1023),np.clip((q[:,0]*1024).astype(int),0,1023),:3]
   for point,normal,tex,col in zip(tri.reshape(-1,3),nn[ii].reshape(-1,3),q,cc):
    p=np.round(point,5).tolist();n=np.round(normal,5).tolist();t=np.round(tex,4).tolist();key=tuple(p+n+t)
    at=lookup.get(key)
    if at is None:at=len(positions)//3;lookup[key]=at;positions.extend(p);normals.extend(n);coords.extend(t);colors.extend(col.tolist())
    indices.append(at)
  levels.append(dict(vertices=positions,normals=normals,uv=coords,colors=colors,indices=indices))
 print(tag,[len(x['indices'])//3 for x in levels])
 return dict(texture='assets/pilots/'+tag+'.webp',levels=levels)

def sweater():
 v,f,_,_,_=source('low_poly_shirt.001_Retopo_Mesh_Plane.001');x=np.abs(v[:,0]);sign=np.sign(v[:,0]);y=v[:,1];z=-v[:,2]*.10
 bodyx=x*.19;bodyy=1.425+(y-.9)*np.where(y>.9,.10,.19)
 angle=.76;dx=x-1.15;dy=y-.9
 armx=.185+(np.cos(angle)*dx-np.sin(angle)*dy)*.23;army=1.425+(np.sin(angle)*dx+np.cos(angle)*dy)*.19
 t=np.clip((x-.75)/.65,0,1);t=t*t*(3-2*t)
 armz=-(v[:,2]-np.interp(x,[1.15,1.7,2.2,2.55,2.9],[-.12,-.245,-.20,0,.15]))*.14
 lower=np.clip((1.4-bodyy)/.3,0,1);bodyz=(z+.025*lower)*(1.25+.35*lower)
 v=np.stack([sign*(bodyx*(1-t)+armx*t),bodyy*(1-t)+army*t,bodyz*(1-t)+armz*t],1);f=f[:,[0,2,1]]
 levels=[]
 for budget in [1320,460]:
  p,ii=fast_simplification.simplify(v,f,target_count=min(budget,len(f)),agg=5)
  shade=.88+.045*np.sin(p[:,0]*240)*np.sin(p[:,1]*260)
  # Collar, cuffs and hem have a restrained knitted rib rather than a logo.
  rib=(p[:,1]<.99)|(np.abs(p[:,0])>.66)|((p[:,1]>1.46)&(np.abs(p[:,0])<.09));shade[rib]*=.83
  levels.append(dict(vertices=np.round(p,5).reshape(-1).tolist(),indices=ii.reshape(-1).tolist(),colors=np.round(np.repeat(shade[:,None],3,1)*255).astype(int).reshape(-1).tolist()))
 return levels

heads=[export('make3','mateo-face','head'),export('make5','alma-face','head'),export('make1','nico-face','head')]
shoe=export('make6.001','sport-shoe','shoe')
(ROOT/'game/pilot-kit-data.js').write_text('// Adapted from the user-supplied clothing and character kit. Source files stay offline.\nexport const PILOT_KIT='+json.dumps(dict(heads=heads,shoe=shoe,sweater=sweater()),separators=(',',':'))+';\n')
(ROOT/'game/assets/licenses/character-kit.json').write_text(json.dumps(dict(sourceName=Path(sys.argv[1]).name,sha256=hashlib.sha256(Path(sys.argv[1]).read_bytes()).hexdigest(),sourceLicense='No explicit license or author credit embedded in the supplied file. User supplied for this game.',heads=['make3','make5','make1'],shoe='make6.001',sweater='low_poly_shirt.001_Retopo_Mesh_Plane.001',adaptations=['Each head registered to its own neck center; original chin and jaw retained', 'Lower throat opening closed after deformation; normals blended at the neck', 'Two geometry detail levels', 'Original UV islands retained in cropped texture atlases; scalp underlay beneath hair cards', 'Invisible teeth and tongue omitted', 'Sweater rest pose fitted to the game shoulders and forearms', 'Anatomical left sports shoe mirrored for the right foot; existing planted-foot animation retained']),indent=2)+'\n')
