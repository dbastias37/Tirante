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
  // Translate the real rope toward the foreground outlet, fading linearly to
  // the exact kite junction. This keeps the physical sag and contact shape;
  // no screen-space arc is imposed on a taut line.
  const end=rope.broken>=0?rope.broken:rope.points.length-1;
  if(end<1)return cache;
  const offset=origin.clone().sub(rope.points[0]);
  let total=0;const lengths=[0];
  for(let i=1;i<=end;i++){total+=rope.points[i].distanceTo(rope.points[i-1]);lengths.push(total);}
  for(let i=0;i<end;i++)cache[i].addScaledVector(offset,1-(total>1e-8?lengths[i]/total:i/end));
  return cache;
}
