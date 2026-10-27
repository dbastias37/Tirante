import assert from 'node:assert/strict';
import {PilotModel} from '../game/pilot-model.js';
import {sampleWalk} from '../game/pilot-locomotion.js';
import {PILOT_WALK} from '../game/pilot-walk-data.js';
import {KitePhysics} from '../game/physics.js';
import {advanceNPC} from '../game/npc-pilot.js';
import {Vector3,Box3} from '../game/vendor/three.module.js';

assert.equal(PILOT_WALK.source.author,'skywarrior34niraj (https://sketchfab.com/skywarrior34niraj)');
assert.ok(PILOT_WALK.stride>.9&&PILOT_WALK.stride<1.2);
const seamA=sampleWalk(1-1e-8),seamB=sampleWalk(1e-8);for(let i=0;i<seamA.length;i++)assert.ok(Math.abs(seamA[i]-seamB[i])<1e-5,'The imported cycle loops without a pop');
let totalLocks=0,maxSlip=0,maxReach=0;
for(const [dx,dz] of [[0,-1],[0,1],[1,0],[-1,0],[.707,-.707]]){
 const p=new KitePhysics(),m=new PilotModel();p.launch();p.position.set(0,25,-25);m.update(p,0);
 for(let n=1;n<=360;n++){
  const dt=1/60;if(n<280){p.anchor.x+=dx*.65*dt;p.anchor.z+=dz*.65*dt;}p.position.set(p.anchor.x,25,p.anchor.z-25);m.update(p,n*dt);
  if(n%6===0){const bounds=new Box3().setFromObject(m.group,true);assert.ok(bounds.min.y>=-1e-5,'Actual tilted soles stay above the ground');assert.ok(bounds.max.y<1.95);}
  for(const f of m.locomotion.feet){
   maxReach=Math.max(maxReach,f.hip.distanceTo(f.ankle));assert.ok(f.hip.distanceTo(f.ankle)<.865,'Steps remain within leg reach');
   if(f.lock){totalLocks++;const slip=Math.hypot(f.contactWorld.x-f.lock.x,f.contactWorld.z-f.lock.z);maxSlip=Math.max(maxSlip,slip);assert.ok(slip<1e-7,'The supporting contact does not slide across the ground');}
  }
 }
 assert.ok(m.locomotion.blend<1e-5,'A stopped NPC settles into its idle pose');
 const pose=m.trousers.mesh.geometry.attributes.position.array.slice(),shoes=m.legs.map(l=>l.shoe.position.toArray());m.update(p,6);assert.deepEqual(m.trousers.mesh.geometry.attributes.position.array,pose);assert.deepEqual(m.legs.map(l=>l.shoe.position.toArray()),shoes,'Pause freezes feet and clothing');
 p.anchor.x+=30;p.position.x+=30;m.update(p,6.0167);assert.equal(m.locomotion.blend,0,'Respawn/teleport resets planted contacts');
}
for(const side of [-1,1]){
 const p=new KitePhysics(),m=new PilotModel();p.launch();p.position.set(0,20,-25);m.update(p,0);
 for(let n=1;n<=60;n++){p.anchor.x+=side*.65/60;p.position.set(p.anchor.x,20,-25);m.update(p,n/60);}
 for(const leg of m.legs){const toe=new Vector3(0,0,-1).applyQuaternion(leg.shoe.quaternion);assert.ok(toe.z<-.8&&toe.x*side>0,'Side steps orient both feet toward travel instead of the opposite side');}
}
assert.ok(totalLocks>500);
// Phase follows distance, not refresh rate.
const phases=[];for(const fps of [30,60,120]){
 const p=new KitePhysics(),m=new PilotModel();p.launch();p.position.set(0,20,-20);m.update(p,0);
 for(let n=1;n<=fps*3;n++){p.anchor.z=-n/fps*.65;p.position.z=p.anchor.z-20;m.update(p,n/fps);}phases.push(m.locomotion.phase);
}
assert.ok(Math.max(...phases)-Math.min(...phases)<1e-8);
// Movement preserves speed, energy and personal space between decisions.
const p=new KitePhysics(),other=new KitePhysics();other.anchor.set(30,1.35,0);const e={pilot:p,homeX:0,homeZ:0,walkDirection:new Vector3(0,0,-1)},party={roster:[e,{pilot:other}]};
for(let n=0;n<120;n++){const before=p.anchor.clone();advanceNPC(party,e,1/120);assert.ok(Math.abs(p.anchor.distanceTo(before)-.65/120)<1e-10);}
assert.ok(Math.abs(p.anchor.z+.65)<1e-9);assert.ok(Math.abs(p.energy-(100-.65*.8))<1e-8);
other.anchor.copy(p.anchor).add(new Vector3(0,0,-13));const before=p.anchor.clone();advanceNPC(party,e,1/60);assert.ok(p.anchor.distanceTo(before)<1e-9,'NPCs keep the existing 13 m separation');
console.log('PASS: imported cycle, loop continuity, grounded soles, planted contacts, forward/back/sideways motion, starts/stops, paused skinning, respawns, frame-independent pacing and continuous NPC anchors.',JSON.stringify({totalLocks,maxSlip,maxReach}));
