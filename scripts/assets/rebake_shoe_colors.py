"""Rebake the supplied shoe diffuse map without averaging across UV islands.
Usage: python scripts/assets/rebake_shoe_colors.py /path/to/sneakers.blend
The source file and its texture stay local. Only fitted mesh colours are saved.
"""
import io
import json
import sys
from pathlib import Path
import numpy as np
from scipy.spatial import cKDTree
from PIL import Image
from blend_reader import Blend

root = Path(__file__).resolve().parents[2]
path = root/'game/pilot-wardrobe-data.js'
header, payload = path.read_text().split('export const PILOT_WARDROBE=')
data = json.loads(payload.rstrip(';\n'))
source = Blend(sys.argv[1])
vertices, faces, uv = source.mesh('Plane.007')
v, f, uv = np.array(vertices), np.array(faces), np.array(uv)
v = np.stack([v[:,1]*.80, (v[:,2]-v[:,2].min())*.80, -v[:,0]*.80-.076], axis=1)
f, uv = f[:,[0,2,1]], uv[:,[0,2,1]]
tri = v[f]
normal = np.cross(tri[:,1]-tri[:,0],tri[:,2]-tri[:,0])
normal /= np.maximum(np.linalg.norm(normal,axis=1)[:,None],1e-12)
tree = cKDTree(tri.mean(axis=1))
pixels = np.asarray(Image.open(io.BytesIO(source.packed_image('rb_r_black.PNG'))).convert('RGB'))/255

def color_at(point, direction):
    _, ids = tree.query(point,k=48)
    a,b,c = tri[ids,0],tri[ids,1],tri[ids,2]
    e0,e1,d = b-a,c-a,point-a
    aa,ab,bb = (e0*e0).sum(1),(e0*e1).sum(1),(e1*e1).sum(1)
    da,db = (d*e0).sum(1),(d*e1).sum(1)
    denom = aa*bb-ab*ab
    x = (bb*da-ab*db)/np.maximum(denom,1e-18)
    y = (aa*db-ab*da)/np.maximum(denom,1e-18)
    bary = np.stack([1-x-y,x,y],axis=1)
    # Clamp an outside projection to the nearest of the three edges.
    outside = bary.min(1)<0
    choices=[]
    for i,j in [(0,1),(1,2),(2,0)]:
        edge=tri[ids,j]-tri[ids,i]
        t=np.clip(((point-tri[ids,i])*edge).sum(1)/np.maximum((edge*edge).sum(1),1e-18),0,1)
        weights=np.zeros((len(ids),3));weights[:,i]=1-t;weights[:,j]=t
        choices.append(weights)
    closest=np.stack(choices,axis=1)
    distances=(((closest[:,:,:,None]*tri[ids,None]).sum(2)-point)**2).sum(2)
    bary[outside]=closest[np.arange(len(ids)),distances.argmin(1)][outside]
    projected=(bary[:,:,None]*tri[ids]).sum(1)
    score=((projected-point)**2).sum(1)+np.maximum(0,.65-(normal[ids]*direction).sum(1))*.0003
    k=score.argmin();q=(bary[k,:,None]*uv[ids[k]]).sum(0)
    px=np.clip(q[0]*(pixels.shape[1]-1),0,pixels.shape[1]-1)
    py=np.clip((1-q[1])*(pixels.shape[0]-1),0,pixels.shape[0]-1)
    ix,iy=int(px),int(py);tx,ty=px-ix,py-iy;jx,jy=min(ix+1,pixels.shape[1]-1),min(iy+1,pixels.shape[0]-1)
    return pixels[iy,ix]*(1-tx)*(1-ty)+pixels[iy,jx]*tx*(1-ty)+pixels[jy,ix]*(1-tx)*ty+pixels[jy,jx]*tx*ty

for level in data['sneaker']:
    positions=np.array(level['vertices']).reshape(-1,3);indices=np.array(level['indices']).reshape(-1,3)
    normals=np.array(level['normals']).reshape(-1,3) if 'normals' in level else np.zeros_like(positions)
    if 'normals' not in level:
        for face in indices:
            a,b,c=positions[face];n=np.cross(b-a,c-a)
            for i in face:normals[i]+=n
        normals/=np.maximum(np.linalg.norm(normals,axis=1)[:,None],1e-12)
    out=[];shading=[];colors=[]
    for face in indices:
        a,b,c=positions[face];direction=np.cross(b-a,c-a);direction/=max(np.linalg.norm(direction),1e-12)
        for i in face:
            # Sample just inside this face so seams choose their own UV island.
            point=positions[i]*.985+positions[face].mean(0)*.015
            out.extend(positions[i]);shading.extend(normals[i]);colors.extend(np.clip(np.round(color_at(point,direction)*255),0,255).astype(int))
    level['vertices']=np.round(out,5).tolist();level['indices']=list(range(len(out)//3))
    level['normals']=np.round(shading,6).tolist();level['colors']=np.array(colors).tolist()
path.write_text(header+'export const PILOT_WARDROBE='+json.dumps(data,separators=(',',':'))+';\n')
print('Rebaked shoe colours at face corners; UV seams and smooth normals preserved.')
