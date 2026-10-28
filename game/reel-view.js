import {Vector3} from './vendor/three.module.js';
// Centered FPS equipment, immediately above the existing controls.
export function reelViewport(width,height){
 const compact=width<=760||height<=560,size=Math.round(Math.max(150,Math.min(300,width*.40,height*.30))),clearance=compact?(height>560?235:120):185;
 return {size,x:Math.round((width-size)/2),y:Math.round(Math.max(15,height-clearance-size*.82))};
}
export function canvasReelOutlet(width,height,time=0){
 const box=reelViewport(width,height),scale=box.size/145,angle=-.15,x=0,y=-48;
 return {x:box.x+box.size*.48+(x*Math.cos(angle)-y*Math.sin(angle))*scale,y:box.y+box.size*.56+Math.sin(time*1.6)*1.2+(x*Math.sin(angle)+y*Math.cos(angle))*scale};
}
export class ReelMotion{
 constructor(){this.angle=0;this.velocity=0;this.length=null;this.time=null;this.life=null;}
 update(p,paused=false){
  const dt=this.time===null?0:Math.min(.1,Math.max(0,p.time-this.time)),delta=this.length===null?0:this.length-p.lineLength;
  const reset=this.life!==p.lifeSerial||Math.abs(delta)>2||p.time<this.time;
  this.time=p.time;this.length=p.lineLength;this.life=p.lifeSerial;
  if(paused||!dt)return this.angle;
  const radius=(p.equipment?.reel.diameter||15.2)/100*.40,target=reset?0:Math.max(-45,Math.min(45,delta/dt/radius));
  this.velocity+=(target-this.velocity)*(1-Math.exp(-dt*35));this.angle+=this.velocity*dt;return this.angle;
 }
}
export function foregroundLine(rope,camera,width,height,outlet,cache=[]){
 // The view-model covers the hand-side prefix below its outlet. Join it to the
 // unchanged physical strand just above the reel, never translate the airborne
 // rope. If that prefix is in contact, draw its physical geometry as well.
 if(rope.handContact||rope.points.length<2)return rope.points;
 camera.updateMatrixWorld();const project=q=>{const n=q.clone().project(camera);return {x:(n.x*.5+.5)*width,y:(.5-n.y*.5)*height,z:n.z};};
 const top=outlet.y-Math.min(70,height*.07),limit=rope.broken<0?rope.points.length-1:rope.broken;let edge=-1;
 for(let i=0;i<limit;i++){const a=project(rope.points[i]),b=project(rope.points[i+1]);if(a.y>=top&&b.y<=top&&b.z>-1&&b.z<1){edge=i;break;}}
 if(edge<0||[rope.contactMinEdge,rope.contactEdge].some(i=>i>=0&&i<=edge))return rope.points;
 let lo=0,hi=1;const start=rope.points[edge],end=rope.points[edge+1],join=new Vector3();
 for(let i=0;i<32;i++){const t=(lo+hi)/2;join.copy(start).lerp(end,t);if(project(join).y>top)lo=t;else hi=t;}
 join.copy(start).lerp(end,(lo+hi)/2);const q=project(join),next=project(end),dy=Math.max(1,q.y-next.y),dx=q.x-next.x,reach=outlet.y-q.y;
 // A short screen-space curve exits upward and matches the physical tangent.
 // Depth is interpolated only within this occluded/view-model transition.
 const cx=q.x+Math.max(-reach,Math.min(reach,dx/dy*reach*.3)),cy=q.y+reach*.3,depth=join.distanceTo(camera.position);let at=0;const steps=12;
 const put=p=>(cache[at++]||=new Vector3()).copy(p);
 for(let i=0;i<steps;i++){const t=i/steps,u=1-t,x=u*u*u*outlet.x+3*u*u*t*outlet.x+3*u*t*t*cx+t*t*t*q.x,y=u*u*u*outlet.y+3*u*u*t*(outlet.y-reach*.4)+3*u*t*t*cy+t*t*t*q.y;
  put(new Vector3(x/width*2-1,1-y/height*2,0).unproject(camera).sub(camera.position).normalize().multiplyScalar(.65+(depth-.65)*t).add(camera.position));}
 put(join);for(let i=edge+1;i<rope.points.length;i++)put(rope.points[i]);cache.length=at;
 cache.sourceEdges=Array.from({length:at-1},(_,i)=>i<steps?-1:edge+i-steps);cache.joinEdge=edge;cache.physicalStart=steps;
 cache.broken=rope.broken<0?-1:rope.broken-edge+steps;return cache;
}
