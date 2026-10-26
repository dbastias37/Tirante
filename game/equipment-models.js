import * as T from './vendor/three.module.js';
import {THREADS,REELS,BEARINGS,equipmentStats} from './equipment.js';
const TAU=Math.PI*2;
function part(group,geometry,color,position=[0,0,0],rotation=[0,0,0],metal=0){const material=new T.MeshStandardMaterial({color,roughness:metal?.28:.76,metalness:metal,side:T.DoubleSide}),m=new T.Mesh(geometry,material);m.position.set(...position);m.rotation.set(...rotation);group.add(m);return m;}
function ring(outer,inner,depth){const s=new T.Shape();s.absarc(0,0,outer,0,TAU,false);const h=new T.Path();h.absarc(0,0,inner,0,TAU,true);s.holes.push(h);return new T.ExtrudeGeometry(s,{depth,bevelEnabled:false,curveSegments:32});}
function cylinder(r1,r2,h){const g=new T.CylinderGeometry(r1,r2,h,48);g.rotateX(Math.PI/2);return g;}
function torus(r,t){return new T.TorusGeometry(r,t,3,32);}
function wooden(group,g,color,p=[0,0,0]){const m=part(group,g,color,p),a=g.attributes.position,colors=[],base=new T.Color(color);for(let i=0;i<a.count;i++){const x=a.getX(i),y=a.getY(i),z=a.getZ(i),grain=.88+.08*Math.sin(x*90+Math.sin(y*7)*2+z*14)+.025*Math.sin(x*240+y*6);colors.push(base.r*grain,base.g*grain,base.b*grain);}g.setAttribute('color',new T.Float32BufferAttribute(colors,3));m.material.color.set(0xffffff);m.material.vertexColors=true;return m;}
function bake(group){const positions=[],normals=[],colors=[],p=new T.Vector3(),normal=new T.Vector3();group.updateMatrixWorld(true);group.traverse(m=>{if(!m.isMesh)return;const g=m.geometry,a=g.attributes.position,n=g.attributes.normal,c=g.attributes.color,index=g.index,matrix=new T.Matrix3().getNormalMatrix(m.matrixWorld);for(let i=0;i<(index?index.count:a.count);i++){const k=index?index.getX(i):i;p.fromBufferAttribute(a,k).applyMatrix4(m.matrixWorld);normal.fromBufferAttribute(n,k).applyMatrix3(matrix).normalize();positions.push(p.x,p.y,p.z);normals.push(normal.x,normal.y,normal.z);colors.push(m.material.color.r*(c?c.getX(k):1),m.material.color.g*(c?c.getY(k):1),m.material.color.b*(c?c.getZ(k):1));}});disposeModel(group);group.clear();const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('normal',new T.Float32BufferAttribute(normals,3));geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));const metallic=group.userData.kind==='bearing';group.add(new T.Mesh(geometry,new T.MeshStandardMaterial({vertexColors:true,side:T.DoubleSide,roughness:metallic?.32:.78,metalness:metallic?.65:.03})));return group;}
export function createReelModel(spec=REELS[0],bearing=BEARINGS[1],thread=THREADS[1]){
  const g=new T.Group(),front=new T.Shape();front.absarc(0,0,1,0,TAU,false);
  for(let i=0;i<spec.holes;i++){const angle=(i/spec.holes+.25)*TAU,hole=new T.Path();hole.absarc(Math.cos(angle)*.56,Math.sin(angle)*.56,spec.holes===8?.145:.205,0,TAU,true);front.holes.push(hole);}
  const center=new T.Path();center.absarc(0,0,.035,0,TAU,true);front.holes.push(center);
  wooden(g,new T.ExtrudeGeometry(front,{depth:.055,bevelEnabled:true,bevelSegments:1,steps:1,bevelSize:.008,bevelThickness:.008,curveSegments:20}),spec.color,[0,0,.33]);
  wooden(g,ring(1,.79,.06),spec.color,[0,0,-.39]);
  wooden(g,ring(.86,.80,.66),spec.color,[0,0,-.33]);
  for(const z of [-.405,.405])part(g,new T.TorusGeometry(.974,.014,6,64),spec.rim,[0,0,z]);
  // Thin wound strands on the outside; the hollow drum and rear handle remain
  // open and visible when the carousel turns through the reverse view.
  for(let i=0;i<25;i++)part(g,torus(.869,.009),i%3?'#ece5d5':'#c8bea6',[0,0,-.29+i*.024]);
  wooden(g,cylinder(.105,.12,.76),'#b38b56',[0,0,-.02]);
  wooden(g,cylinder(.12,.14,.54),spec.color,[0,0,-.57]);
  part(g,ring(.18,.11,.045),bearing.id==='bushing'?'#b79a65':'#929b9d',[0,0,-.32],[0,0,0],bearing.id==='bushing'?0:.7);
  g.userData={kind:'reel',id:spec.id,holes:spec.holes,openBack:true};return bake(g);
}
export function createThreadModel(spec=THREADS[1]){
  const g=new T.Group();part(g,cylinder(.62,.62,1.48),'#f0ecdf');
  for(let i=0;i<34;i++)part(g,torus(.625,.0045),i%4?'#e1ddcf':'#cfcaba',[0,0,-.68+i*.041]);
  for(const z of [-.77,.77]){part(g,cylinder(.70,.70,.055),spec.color,[0,0,z]);part(g,cylinder(.656,.656,.009),'#f3ecdb',[0,0,z+Math.sign(z)*.033]);}
  // Geometric, unbranded labels. No letters, numbers or logos in the textures.
  for(const sign of [-1,1]){const z=sign*.809;
    part(g,new T.CircleGeometry(.63,48,0,Math.PI),spec.color,[0,0,z],[0,sign<0?Math.PI:0,.3]);
    part(g,new T.PlaneGeometry(1.18,.17),spec.accent,[0,-.04,z+sign*.003],[0,sign<0?Math.PI:0,.3]);
    const diamond=new T.Shape();diamond.moveTo(0,.19);diamond.lineTo(.16,0);diamond.lineTo(0,-.19);diamond.lineTo(-.16,0);diamond.closePath();part(g,new T.ShapeGeometry(diamond),'#f8f0d9',[0,.23,z+sign*.005],[0,sign<0?Math.PI:0,0]);
    for(let i=0;i<3;i++)part(g,new T.CircleGeometry(.032,10),spec.accent,[-.15+i*.15,-.33,z+sign*.004]);
  }
  g.userData={kind:'thread',id:spec.id,unbranded:true};return bake(g);
}
export function createBearingModel(spec=BEARINGS[1]){
  const g=new T.Group();
  if(spec.id==='bushing'){wooden(g,ring(.78,.38,.48),'#ac8b54',[0,0,-.24]);part(g,torus(.74,.035),'#d5b57d',[0,0,.24]);}
  else{part(g,ring(.88,.69,.30),'#9ba5a8',[0,0,-.15],[0,0,0],.8);part(g,ring(.46,.30,.32),'#d1d8d6',[0,0,-.16],[0,0,0],.8);
    for(let i=0;i<10;i++){const a=i/10*TAU;part(g,new T.SphereGeometry(.12,12,8),'#b9c5c6',[Math.cos(a)*.575,Math.sin(a)*.575,0],[0,0,0],.95);}
    for(const z of [-.17,.17]){part(g,torus(.83,.018),'#e3e5dc',[0,0,z],[0,0,0],.7);if(spec.id==='sealed')part(g,ring(.70,.45,.015),'#355b66',[0,0,z]);}
  }
  g.userData={kind:'bearing',id:spec.id};return bake(g);
}
export function equipmentModel(category,setup){const s=equipmentStats(setup);return category==='thread'?createThreadModel(s.thread):category==='reel'?createReelModel(s.reel,s.bearing,s.thread):createBearingModel(s.bearing);}
export function disposeModel(model){model.traverse(o=>{o.geometry?.dispose();if(o.material){for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();}});}
