import {Vector3,Quaternion} from './vendor/three.module.js';
export const TAIL_SEGMENTS=24,TAIL_LENGTH=1.3,TAIL_VERTICES=(TAIL_SEGMENTS+5)*6;
const v=()=>new Vector3();
// A small independent Verlet chain for the ribbon. World-space inertia lets the
// tail lag behind a turn instead of rotating rigidly with the kite's body.
export class ArticulatedTail{
  constructor(){this.points=Array.from({length:TAIL_SEGMENTS+1},v);this.previous=this.points.map(v);this.root=v();this.lastRoot=v();this.local=this.points.map(v);this.delta=v();this.velocity=v();this.inverse=new Quaternion();this.lastTime=null;}
  reset(time,position,rotation,scale){for(let i=0;i<this.points.length;i++){this.points[i].set(0,-.4-i/TAIL_SEGMENTS*TAIL_LENGTH,0).multiplyScalar(scale).applyQuaternion(rotation).add(position);this.previous[i].copy(this.points[i]);}this.lastTime=time;this.lastRoot.copy(this.points[0]);}
  update(time,position,rotation,wind,velocity,scale=1){
    this.root.set(0,-.4,0).multiplyScalar(scale).applyQuaternion(rotation).add(position);
    if(this.lastTime===null||time<this.lastTime||this.root.distanceTo(this.lastRoot)>5)this.reset(time,position,rotation,scale);
    const dt=Math.min(.06,Math.max(0,time-this.lastTime));this.lastTime=time;this.lastRoot.copy(this.root);
    const steps=Math.ceil(dt/(1/120)),h=steps?dt/steps:0,rest=TAIL_LENGTH*scale/TAIL_SEGMENTS;
    for(let step=0;step<steps;step++){
      for(let i=1;i<this.points.length;i++){
        const q=this.points[i],old=this.previous[i];this.velocity.subVectors(q,old).multiplyScalar(Math.exp(-h*2.1));old.copy(q);
        const flutter=Math.sin(time*8-i*.65)*Math.min(2,wind.length()*.16)*i/TAIL_SEGMENTS;
        q.add(this.velocity);q.x+=(wind.x*2.1+flutter)*h*h;q.y+=(-9.81+Math.sin(time*5-i*.7)*.8)*h*h;q.z+=wind.z*2.1*h*h;
      }
      for(let iteration=0;iteration<7;iteration++){
        this.points[0].copy(this.root);
        for(let i=0;i<TAIL_SEGMENTS;i++){const a=this.points[i],b=this.points[i+1];this.delta.subVectors(b,a);const len=this.delta.length();if(len<1e-8)continue;this.delta.multiplyScalar((len-rest)/len);if(i){a.addScaledVector(this.delta,.5);b.addScaledVector(this.delta,-.5);}else b.sub(this.delta);}
        for(let i=1;i<this.points.length;i++)this.points[i].y=Math.max(.035,this.points[i].y);
      }
    }
    this.inverse.copy(rotation).invert();for(let i=0;i<this.points.length;i++)this.local[i].copy(this.points[i]).sub(position).applyQuaternion(this.inverse).multiplyScalar(1/scale);
    return this.local;
  }
  fill(attribute,time){let k=0;const put=(p,x,y,z)=>attribute.setXYZ(k++,p.x+x,p.y+y,p.z+z);
    for(let i=0;i<TAIL_SEGMENTS;i++){const a=this.local[i],b=this.local[i+1],width=.017*(1-i/(TAIL_SEGMENTS*1.5)),twist=Math.sin(time*4-i*.6),x=Math.cos(twist)*width,z=Math.sin(twist)*width;put(a,-x,0,-z);put(a,x,0,z);put(b,x,0,z);put(a,-x,0,-z);put(b,x,0,z);put(b,-x,0,-z);}
    for(let i=4;i<=20;i+=4){const p=this.local[i],w=.047,twist=Math.sin(time*4-i*.6),x=Math.cos(twist)*w,z=Math.sin(twist)*w;put(p,0,0,0);put(p,-x,.023,-z);put(p,-x,-.023,-z);put(p,0,0,0);put(p,x,.023,z);put(p,x,-.023,z);}
    return k;
  }
}
