import {Vector3} from './vendor/three.module.js';
export const PILOT_EYE=new Vector3(0,1.72,1.1);
const backEye=PILOT_EYE.clone().add(new Vector3(0,0,1.15));
// Moving the view must not move the pilot or pull their physical line.
export function positionView(camera,inDuel,dt,rivalCount=1){
  const eye=inDuel?backEye.clone().add(new Vector3(0,0,Math.max(0,rivalCount-1)*.7)):PILOT_EYE;
  camera.position.lerp(eye,1-Math.exp(-dt*5));
}
export function handViewOffset(camera){
  return PILOT_EYE.clone().sub(camera.position).applyQuaternion(camera.quaternion.clone().invert());
}
export function frameDuel(camera,duel){
  const eye=camera.position,points=duel.partyMode?duel.roster.filter(e=>e.alive||(!duel.spectating&&(e.index===0||duel.elapsed-e.eliminatedAt<2))).map(e=>e.pilot.position):[duel.player.position,duel.rival.position];
  if(!points.length)points.push(duel.player.position,...duel.rivals.map(p=>p.position));
  const center=points.reduce((sum,p)=>sum.add(p),new Vector3()).multiplyScalar(1/points.length);
  if(duel.contact)center.lerp(duel.contactPoint,.15);
  const forward=center.clone().sub(eye).normalize();
  const right=new Vector3().crossVectors(forward,new Vector3(0,1,0)).normalize();
  if(right.lengthSq()<.001)right.set(1,0,0);
  const up=right.clone().cross(forward).normalize();
  // Keep sails and their tails inside the unobstructed middle of the screen.
  const portrait=camera.aspect<.8,minFov=portrait?82:74;
  let tangent=Math.tan(minFov*Math.PI/360);
  const focus=duel.partyMode?[...points,...duel.contacts.map(c=>c.point)]:duel.contact?[...points,duel.contactPoint]:points;
  for(const position of focus){
    const v=position.clone().sub(eye),depth=Math.max(.4,v.dot(forward));
    tangent=Math.max(tangent,(Math.abs(v.dot(right))+.65)/(depth*camera.aspect*(portrait?.82:.6)),(Math.abs(v.dot(up))+1.1)/(depth*(portrait?.36:.43)));
  }
  return {target:center,fov:Math.min(118,2*Math.atan(tangent)*180/Math.PI)};
}
