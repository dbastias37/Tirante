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
  const offset=origin.clone().sub(rope.points[0]);
  cache.length=rope.points.length;
  for(let i=0;i<rope.points.length;i++){
    const q=rope.points[i],near=1-Math.min(1,q.distanceTo(rope.points[0])/2),attached=rope.broken<0||i<=rope.broken;
    const blend=i===rope.points.length-1||!attached?0:near*near;
    (cache[i]||=new Vector3()).copy(q).addScaledVector(offset,blend);
  }
  return cache;
}
