export const PILOT_SPACING=18;
export const LAUNCH_SECONDS=8;
export const RESPAWN_SECONDS=6;
export const DUEL_SECONDS=180;
export const LIFE_OPTIONS=Object.freeze([3,5,10]);
export const cleanLives=value=>LIFE_OPTIONS.includes(Number(value))?Number(value):3;

export function prepareLives(p,lives=3){p.lives=lives;p.maxLives=lives;p.eliminated=false;p.respawnAt=-1;p.lifeSerial=0;}
export function launchLife(p){p.launch();p.lifeSerial=(p.lifeSerial||0)+1;p.eliminated=false;p.respawnAt=-1;}
export function loseLife(p,clock,reason='En tierra'){
  if(p.eliminated||p.lives<=0)return false;
  p.eliminated=true;p.lives=Math.max(0,p.lives-1);p.respawnAt=p.lives>0?clock+RESPAWN_SECONDS:-1;
  p.sawing=false;p.setControls('hold',false);
  if(reason==='Hilo cortado'&&p.state!=='cut')p.cutLine();
  else if(p.rope.broken<0){p.rope.cutReason='ground';p.rope.breakAt(14,.5);}
  return true;
}
export function respawnLife(p,clock){if(!p.eliminated||p.lives<=0||clock<p.respawnAt)return false;launchLife(p);return true;}
export function climbControls(p,clock){
  // Small ordinary Q pulses followed by a catch: the same rate, energy and
  // flight response as the player, without teleporting or adding lift.
  const upright=Math.cos(p.heading)>.94;
  p.sawing=false;p.setControls(p.position.y>5&&upright&&clock%.24<.04&&p.lineRemaining>.5?'release':'hold',false);
}
export function comparePilots(a,b){return b.lives-a.lives||b.rope.integrity-a.rope.integrity;}
