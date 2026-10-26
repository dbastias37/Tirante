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
  let join=1;const above=1-2*Math.min(height*.74,outlet.y-24)/height;
  for(;join<limit;join++){const q=rope.points[join].clone().project(camera);if(q.z<1&&q.z>-1&&q.y>above&&rope.points[join].distanceTo(camera.position)>2)break;}
  const end=rope.points[join],direction=end.clone().sub(origin),length=direction.length();
  const tangent=join<limit?rope.points[join+1].clone().sub(end).normalize():direction.clone().normalize();
  // Bounded Bézier handles cannot make a loop or displace the kite junction.
  const c1=origin.clone().addScaledVector(direction,.34),c2=end.clone().addScaledVector(tangent,-Math.min(length*.18,.3));
  for(let i=0;i<join;i++){const t=i/join,u=1-t;cache[i].copy(origin).multiplyScalar(u*u*u).addScaledVector(c1,3*u*u*t).addScaledVector(c2,3*u*t*t).addScaledVector(end,t*t*t);}
  return cache;
}
