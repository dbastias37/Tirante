"""Offline reader for the supplied uncompressed glTF 2.0 animation.
Reads data only; supports indexed triangle meshes, TRS/matrix hierarchies,
strided accessors and linear quaternion animation. No browser dependency.
"""
import numpy as np, struct, json
from scipy.spatial.transform import Rotation as R, Slerp
from pathlib import Path
class GLB:
 def __init__(self,path):
  b=Path(path).read_bytes(); assert b[:4]==b'glTF' and struct.unpack_from('<I',b,4)[0]==2; n,t=struct.unpack_from('<II',b,12); self.j=json.loads(b[20:20+n]); off=20+n; n,t=struct.unpack_from('<II',b,off);self.b=b[off+8:off+8+n]
 def acc(self,i):
  a=self.j['accessors'][i]; assert 'sparse' not in a;v=self.j['bufferViews'][a['bufferView']];d={5126:'<f4',5123:'<u2',5125:'<u4',5121:'u1'}[a['componentType']];k={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}[a['type']];s=np.dtype(d).itemsize
  return np.ndarray((a['count'],k),d,self.b,v.get('byteOffset',0)+a.get('byteOffset',0),(v.get('byteStride',s*k),s)).copy()
 def pose(self,t=None):
  nd=[dict(n) for n in self.j['nodes']]
  if t is not None:
   a=self.j['animations'][0]
   for c in a['channels']:
    s=a['samplers'][c['sampler']]; assert s.get('interpolation','LINEAR')=='LINEAR';ts=self.acc(s['input'])[:,0];vs=self.acc(s['output']);path=c['target']['path'];tt=np.clip(t,ts[0],ts[-1]);
    if len(ts)==1:v=vs[0]
    elif path=='rotation':v=Slerp(ts,R.from_quat(vs))([tt]).as_quat()[0]
    else:v=np.array([np.interp(tt,ts,vs[:,i]) for i in range(vs.shape[1])])
    nd[c['target']['node']][path]=v
  out={}
  def visit(i,parent):
   n=nd[i]
   if 'matrix' in n:m=np.array(n['matrix']).reshape(4,4).T
   else:
    m=np.eye(4);m[:3,:3]=R.from_quat(n.get('rotation',[0,0,0,1])).as_matrix()@np.diag(n.get('scale',[1,1,1]));m[:3,3]=n.get('translation',[0,0,0])
   out[i]=parent@m
   for ch in n.get('children',[]):visit(ch,out[i])
  for i in self.j['scenes'][0]['nodes']:visit(i,np.eye(4))
  return out
 def mesh(self,t):
  p=self.j['meshes'][0]['primitives'][0];a=p['attributes'];pos=self.acc(a['POSITION']);joints=self.acc(a['JOINTS_0']);w=self.acc(a['WEIGHTS_0']);skin=self.j['skins'][0];ib=self.acc(skin['inverseBindMatrices']).reshape(-1,4,4).transpose(0,2,1);nodes=self.pose(t);m=np.array([nodes[b]@i for b,i in zip(skin['joints'],ib)]);v=np.c_[pos,np.ones(len(pos))];out=np.zeros_like(v)
  for k in range(4):out+=np.einsum('nij,nj->ni',m[joints[:,k]],v)*w[:,k,None]
  return out[:,:3]*.01,self.acc(p['indices']).reshape(-1,3)
