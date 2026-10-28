import {Vector3} from './vendor/three.module.js';
// Anchor equipment at the bottom, leaving the aiming area unobstructed.
// Compact landscape controls flank the reel, so no legacy HUD clearance is
// needed there. Portrait and desktop retain room for their bottom controls.
export function reelViewport(width,height){
 const landscape=width>height,compact=width<=760||(landscape&&height<=560);
 const size=Math.round(Math.max(120,Math.min(compact?240:220,width*.35,height*(compact?.34:.22))));
 const y=compact&&landscape?height-size*.72:height-(compact?74:185)-size*.95;
 return {size,x:Math.round((width-size)/2),y:Math.round(Math.max(0,y))};
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
 const limit=rope.broken<0?rope.points.length-1:rope.broken,join=new Vector3();let top=outlet.y-Math.min(70,height*.07),edge=-1;
 // In the wide battle camera the kite can be far to either side. Give the
 // outlet transition enough vertical room instead of forming a sharp hook.
 for(let pass=0;pass<2;pass++){
  edge=-1;for(let i=0;i<limit;i++){const a=project(rope.points[i]),b=project(rope.points[i+1]);if(a.y>=top&&b.y<=top&&b.z>-1&&b.z<1){edge=i;break;}}
  if(edge<0)return rope.points;
  let lo=0,hi=1;const start=rope.points[edge],end=rope.points[edge+1];
  for(let i=0;i<32;i++){const t=(lo+hi)/2;join.copy(start).lerp(end,t);if(project(join).y>top)lo=t;else hi=t;}
  join.copy(start).lerp(end,(lo+hi)/2);
  if(pass===0){const q=project(join),tip=project(rope.points[limit]),reach=Math.max(Math.min(70,height*.07),Math.min(220,Math.abs(outlet.x-q.x)*1.2));top=Math.max(outlet.y-reach,tip.y+Math.min(20,(outlet.y-tip.y)*.15));}
 }
 if([rope.contactMinEdge,rope.contactEdge].some(i=>i>=0&&i<=edge))return rope.points;
 const q=project(join),previous=project(rope.points[edge]),next=project(rope.points[edge+1]),dy=Math.max(1e-6,previous.y-next.y),dx=previous.x-next.x,reach=outlet.y-q.y;
 // A short screen-space curve exits upward and matches the physical tangent.
 // Depth is interpolated only within this view-model transition.
 const cx=q.x+Math.max(-reach,Math.min(reach,dx/dy*reach*.3)),cy=q.y+reach*.3,depth=join.distanceTo(camera.position);let at=0;const steps=16;
 const put=p=>(cache[at++]||=new Vector3()).copy(p);
 for(let i=0;i<steps;i++){const t=i/steps,u=1-t,x=u*u*u*outlet.x+3*u*u*t*outlet.x+3*u*t*t*cx+t*t*t*q.x,y=u*u*u*outlet.y+3*u*u*t*(outlet.y-reach*.4)+3*u*t*t*cy+t*t*t*q.y;
  put(new Vector3(x/width*2-1,1-y/height*2,0).unproject(camera).sub(camera.position).normalize().multiplyScalar(.65+(depth-.65)*t).add(camera.position));}
 put(join);for(let i=edge+1;i<rope.points.length;i++)put(rope.points[i]);cache.length=at;
 cache.sourceEdges=Array.from({length:at-1},(_,i)=>i<steps?-1:edge+i-steps);cache.joinEdge=edge;cache.physicalStart=steps;
 cache.broken=rope.broken<0?-1:rope.broken-edge+steps;return cache;
}
