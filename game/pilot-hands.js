import * as T from './vendor/three.module.js';
import {PILOT_HAND} from './pilot-hand-data.js';
const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
// HandSwap's continuous palm and finger topology, fitted to the reel. Source
// weights drive the joints; the arm remains the game's closed continuous skin.
export class PilotHand{
 constructor(side,skin){
  this.side=side;this.level=0;this.curl=null;this.group=new T.Group();this.group.scale.x=side;
  const material=skin.clone();material.vertexColors=true;
  this.levels=PILOT_HAND.levels.map(source=>{
   const geometry=new T.BufferGeometry(),rest=new Float32Array(source.vertices);
   geometry.setAttribute('position',new T.BufferAttribute(rest.slice(),3));geometry.setIndex(source.indices);geometry.computeVertexNormals();
   const colors=new Float32Array(rest.length);
   for(let i=0;i<rest.length/3;i++){
    // Subtle knuckle colour; never paint a nail across an entire finger.
    const shade=1-.025*Math.sin(rest[i*3+2]*180)**2;
    colors.set([shade,shade*.985,shade*.97],i*3);
   }
   geometry.setAttribute('color',new T.BufferAttribute(colors,3));geometry.attributes.position.setUsage(T.DynamicDrawUsage);geometry.boundingSphere=new T.Sphere(V(0,-.02,-.07),.18);
   return {geometry,rest,bones:source.bones,weights:source.weights};
  });
  this.matrices=PILOT_HAND.rig.map(()=>new T.Matrix4());this.local=new T.Matrix4();this.shift=new T.Matrix4();
  this.mesh=new T.Mesh(this.levels[0].geometry,material);this.mesh.name='articulated-hand';this.group.add(this.mesh);
 }
 setDetail(level){if(level===this.level)return;this.level=level;this.mesh.geometry=this.levels[level].geometry;this.mesh.userData.canvasVertices=null;this.lastPose=null;}
 pose(target,dt=0){
  if(this.curl===null)this.curl=target;else this.curl+=(target-this.curl)*(1-Math.exp(-dt*16));
  const curl=this.curl;if(this.lastPose===curl)return;this.lastPose=curl;
  for(let i=0;i<PILOT_HAND.rig.length;i++){
   const {name,head,parent}=PILOT_HAND.rig[i],matrix=this.matrices[i];matrix.identity();if(!i)continue;
   const angle=name.includes('Thumb')?-.42*curl:name==='TwistTh'?-.25*curl:name.includes('In')?-.70*curl:name.includes('Mid')?-1.05*curl:-.82*curl;
   this.local.makeTranslation(...head).multiply(this.shift.makeRotationX(angle));
   if(name==='TwistTh')this.local.multiply(this.shift.makeRotationY(.70*curl));
   this.local.multiply(this.shift.makeTranslation(-head[0],-head[1],-head[2]));matrix.multiplyMatrices(this.matrices[parent],this.local);
  }
  const {geometry:g,rest,bones,weights}=this.levels[this.level],out=g.attributes.position.array;
  for(let i=0;i<rest.length/3;i++){
   const x=rest[i*3],y=rest[i*3+1],z=rest[i*3+2];let px=0,py=0,pz=0;
   for(let j=0;j<4;j++){
    const w=weights[i*4+j];if(!w)continue;const e=this.matrices[bones[i*4+j]].elements;
    px+=w*(e[0]*x+e[4]*y+e[8]*z+e[12]);py+=w*(e[1]*x+e[5]*y+e[9]*z+e[13]);pz+=w*(e[2]*x+e[6]*y+e[10]*z+e[14]);
   }
   out.set([px,py,pz],i*3);
  }
  g.attributes.position.needsUpdate=true;g.computeVertexNormals();
 }
}
