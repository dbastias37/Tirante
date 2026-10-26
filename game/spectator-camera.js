import {Vector3} from './vendor/three.module.js';
export function spectatorView(player,duel){
  const active=!!duel?.spectating||!!(player.freeMode&&player.rope.broken>=0);
  let mode=duel?.spectatorView||'kite';if(mode==='battle'&&!duel?.visible)mode='kite';
  const pilot=!active?null:mode==='battle'?duel.watched?.pilot||null:player;
  return {active,mode,pilot,onboard:active&&mode==='onboard',orbital:active&&!!pilot&&mode!=='onboard'};
}
export function onboardFrame(camera,p,dt){
  const eye=p.position.clone().addScaledVector(p.nose,.43).addScaledVector(p.normal,.08);
  if(camera.position.distanceTo(eye)>6)camera.position.copy(eye);else camera.position.lerp(eye,1-Math.exp(-dt*12));
  return {target:eye.clone().addScaledVector(p.nose,12).add(new Vector3(0,.6,0)),fov:68};
}
