import {Vector3,Quaternion} from './vendor/three.module.js';
import {bridleAnchors,bridleJunction,sailZ} from './kite-shape.js';
import {configuration} from './physics.js';
export const BRIDLE_SEGMENTS=8;
const v=()=>new Vector3();
// Three lightweight tension-only chains. Endpoints are the actual sail mounts
// and the very same knot used by Tether.endpoint(), in both renderers.
export class ArticulatedBridle{
 constructor(){this.chains=Array.from({length:3},()=>({points:Array.from({length:BRIDLE_SEGMENTS+1},v),previous:Array.from({length:BRIDLE_SEGMENTS+1},v),local:Array.from({length:BRIDLE_SEGMENTS+1},v)}));this.lastTime=null;this.lastPosition=v();this.inverse=new Quaternion();}
 update(time,setup,position,rotation,wind,velocity,bend,scale=1,tension=0){
  const anchors=bridleAnchors(setup,time,bend,wind.length()).map(p=>new Vector3(...p).multiplyScalar(scale).applyQuaternion(rotation).add(position));
  const knot=new Vector3(...bridleJunction(configuration(setup))).multiplyScalar(scale).applyQuaternion(rotation).add(position);
  const reset=this.lastTime===null||time<this.lastTime||position.distanceTo(this.lastPosition)>2;
  if(reset)for(let k=0;k<3;k++)for(let i=0;i<=BRIDLE_SEGMENTS;i++){const c=this.chains[k];c.points[i].copy(anchors[k]).lerp(knot,i/BRIDLE_SEGMENTS);c.previous[i].copy(c.points[i]);}
  const dt=reset?0:Math.min(.05,Math.max(0,time-this.lastTime)),steps=Math.ceil(dt*120),h=steps?dt/steps:0,relative=wind.clone().sub(velocity||v()).clampLength(0,16);
  this.inverse.copy(rotation).invert();const surfacePoint=v();
  for(let k=0;k<3;k++){
   const c=this.chains[k],span=anchors[k].distanceTo(knot),rest=span*(1+.004+.10/(1+Math.max(0,tension)*8))/BRIDLE_SEGMENTS;
   for(let step=0;step<steps;step++){
    for(let i=1;i<BRIDLE_SEGMENTS;i++){const p=c.points[i],old=c.previous[i],motion=p.clone().sub(old).multiplyScalar(Math.exp(-h*6));old.copy(p);p.add(motion).addScaledVector(relative,h*h*.7);p.y-=9.81*h*h;}
    for(let pass=0;pass<14;pass++){
     c.points[0].copy(anchors[k]);c.points[BRIDLE_SEGMENTS].copy(knot);
     for(let j=0;j<BRIDLE_SEGMENTS;j++){const i=pass%2?BRIDLE_SEGMENTS-1-j:j,a=c.points[i],b=c.points[i+1],d=b.clone().sub(a),length=d.length(),wa=i?1:0,wb=i+1===BRIDLE_SEGMENTS?0:1;if(length<=rest||wa+wb===0)continue;d.multiplyScalar((length-rest)/length/(wa+wb));a.addScaledVector(d,wa);b.addScaledVector(d,-wb);}
     // The cord is on the front of the paper. Keep loose interior nodes out
     // of the sail during fast rotations, without moving either attachment.
     for(let i=1;i<BRIDLE_SEGMENTS;i++){
      surfacePoint.copy(c.points[i]).sub(position).applyQuaternion(this.inverse).multiplyScalar(1/scale);
      if(Math.abs(surfacePoint.x)+Math.abs(surfacePoint.y)<.4){const front=sailZ(surfacePoint.x,surfacePoint.y,time,bend,wind.length())+.001;if(surfacePoint.z<front){surfacePoint.z=front;c.points[i].copy(surfacePoint).multiplyScalar(scale).applyQuaternion(rotation).add(position);}}
     }
    }
   }
   c.points[0].copy(anchors[k]);c.points[BRIDLE_SEGMENTS].copy(knot);
   this.inverse.copy(rotation).invert();for(let i=0;i<=BRIDLE_SEGMENTS;i++)c.local[i].copy(c.points[i]).sub(position).applyQuaternion(this.inverse).multiplyScalar(1/scale);
  }
  this.lastTime=time;this.lastPosition.copy(position);return this.chains.map(c=>c.local);
 }
}
export function bridlePoint(points,t){const f=Math.max(0,Math.min(1,t))*BRIDLE_SEGMENTS,i=Math.min(BRIDLE_SEGMENTS-1,Math.floor(f));return points[i].clone().lerp(points[i+1],f-i);}
