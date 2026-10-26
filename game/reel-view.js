import {Vector3} from './vendor/three.module.js';
// First-person equipment enters from the lower/right edge like a held object.
// This is presentation only: camera motion must not pull the physical anchor.
export function reelViewport(width,height){
  const compact=width<=760||height<=560;
  const size=Math.round(Math.max(150,Math.min(390,width*.46,height*.48)));
  const clearance=compact?(height>560?200:115):0;
  return {size,x:Math.round(width-size*.66),y:Math.round(Math.max(60,height-clearance-size*.58))};
}
export function canvasReelOutlet(width,height,time=0){
  const box=reelViewport(width,height),scale=box.size/145,angle=-.15,x=-21,y=-48;
  return {x:box.x+box.size*.48+(x*Math.cos(angle)-y*Math.sin(angle))*scale,y:box.y+box.size*.56+Math.sin(time*1.6)*1.2+(x*Math.sin(angle)+y*Math.cos(angle))*scale};
}
export function foregroundLine(rope,camera,width,height,outlet,cache=[]){
  camera.updateMatrixWorld();
  const origin=new Vector3(outlet.x/width*2-1,1-outlet.y/height*2,0).unproject(camera);
  // Keep the foreground outlet at a small, stable viewing distance.
  origin.sub(camera.position).normalize().multiplyScalar(.65).add(camera.position);
  cache.length=rope.points.length;
  for(let i=0;i<rope.points.length;i++)(cache[i]||=new Vector3()).copy(rope.points[i]);
  const limit=rope.broken>=0?rope.broken:rope.points.length-2;
  if(limit<1)return cache;
  // Join in front of the camera. Blending toward the physical anchor behind
  // the eye made the thread dip offscreen and return in a hook at the reel.
  let join=Math.min(limit,8);const above=1-2*Math.min(height*.53,outlet.y-24)/height;
  for(;join<limit;join++){const q=rope.points[join].clone().project(camera);if(q.z<1&&q.z>-1&&q.y>above&&rope.points[join].distanceTo(camera.position)>2)break;}
  const start=origin.clone().project(camera),end=rope.points[join].clone().project(camera);
  if(end.z<=-1||end.z>=1)return cache;
  // Construct the foreground arc in screen space. A world-space handle close
  // to the eye collapses under perspective and leaves a sharp elbow at the join.
  const sx=(start.x*.5+.5)*width,sy=(.5-start.y*.5)*height,ex=(end.x*.5+.5)*width,ey=(.5-end.y*.5)*height;
  const dx=ex-sx,dy=ey-sy,length=Math.hypot(dx,dy);
  const next=rope.points[Math.min(join+1,limit)].clone().project(camera);
  let tx=(next.x-end.x)*width,ty=-(next.y-end.y)*height,n=Math.hypot(tx,ty);
  if(n<1e-6){tx=dx;ty=dy;n=length||1;}
  const handle=Math.min(length*.38,Math.max(0,sy-ey)*.72);
  const c1x=sx+dx*.34,c1y=sy+dy*.34,c2x=ex-tx/n*handle,c2y=ey-ty/n*handle;
  for(let i=0;i<join;i++){
    const t=i/join,u=1-t,x=sx*u*u*u+3*c1x*u*u*t+3*c2x*u*t*t+ex*t*t*t,y=sy*u*u*u+3*c1y*u*u*t+3*c2y*u*t*t+ey*t*t*t;
    cache[i].set(x/width*2-1,1-y/height*2,start.z+(end.z-start.z)*t).unproject(camera);
  }
  return cache;
}
