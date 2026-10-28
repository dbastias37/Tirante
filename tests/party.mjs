import assert from 'node:assert/strict';
import {Vector3,Quaternion,PerspectiveCamera} from '../game/vendor/three.module.js';
import {KitePhysics} from '../game/physics.js';
import {climbControls,LAUNCH_SECONDS} from '../game/battle-rules.js';
import {PartyCommission} from '../game/party.js';
import {Tether,CONTACT_RADIUS} from '../game/rope.js';
import {frameDuel,positionView,handViewOffset,PILOT_EYE} from '../game/duel-camera.js';
const dt=1/240,v=(x=0,y=0,z=0)=>new Vector3(x,y,z);
function party(count=3){const p=new KitePhysics(),d=new PartyCommission(p);d.startParty(count);return d;}
function step(d,seconds){for(let i=0;i<seconds/dt;i++){d.player.step(dt);d.step(dt);}}
for(const count of [1,2,3]){
 const d=party(count);assert.equal(d.roster.length,count+1);assert.equal(d.rivals.length,count);assert.equal(new Set(d.roster.map(e=>e.pilot.anchor.x)).size,count+1);
 assert.ok(d.rivals.every(p=>p.lineCapacity===d.player.lineCapacity&&p.windSpeed===d.player.windSpeed&&p.energy===100));
 const times=d.roster.map(e=>e.pilot.time);step(d,.5);d.roster.forEach((e,i)=>assert.ok(Math.abs(e.pilot.time-times[i]-.5)<1e-9,'Every pilot advances exactly once per fixed tick'));
 step(d,LAUNCH_SECONDS-.4);assert.equal(d.state,'playing');assert.equal(d.duration,count===1?180:240);
}
assert.equal(party(99).npcCount,3);assert.equal(party(-1).npcCount,1);
// Every unordered pair can contact, including the three NPC/NPC pairs.
function fixture(e,a,b){const p=e.pilot;p.anchor.copy(a);p.orientation=new Quaternion();p.position.copy(b).add(v(0,.06,-.23));p.lineLength=a.distanceTo(b);p.tension=2;p.wind.set(0,0,0);p.rope=new Tether(p);p.rope.dt=dt;p.state='flying';}
for(let i=0;i<4;i++)for(let j=i+1;j<4;j++){
 const d=party();d.state='playing';d.elapsed=5;d.roster.forEach((e,n)=>e.alive=n===i||n===j);const a=d.roster[i],b=d.roster[j];fixture(a,v(-2,5,0),v(2,5,0));fixture(b,v(0,5,-2),v(0,5,2));
 const beforeA=a.pilot.rope.points.map(p=>p.clone()),beforeB=b.pilot.rope.points.map(p=>p.clone());d.resolveContacts(dt);
 assert.equal(d.contacts.length,1);assert.equal(d.contact,i===0,'NPC-only collisions do not pretend the player is touching');assert.equal(a.pilot.rope.integrity,100,'Static contact does not abrade');assert.equal(b.pilot.rope.integrity,100);
 assert.ok(a.pilot.rope.points.some((p,n)=>p.distanceTo(beforeA[n])>CONTACT_RADIUS*.5));assert.ok(b.pilot.rope.points.some((p,n)=>p.distanceTo(beforeB[n])>CONTACT_RADIUS*.5));
 // Repeated physical strokes under load wear this pair, independent of others.
 for(let n=0;n<180;n++){for(const e of [a,b]){const points=e.pilot.rope.points;for(let k=0;k<points.length;k++)points[k].copy(e.pilot.anchor).lerp(e.pilot.position.clone().add(v(0,-.06,.23)),k/(points.length-1));e.pilot.rope.previous=points.map(p=>p.clone());}a.pilot.rope.feedDelta=Math.floor(n/30)%2?.015:-.015;b.pilot.rope.feedDelta=0;d.elapsed+=dt;d.resolveContacts(dt);}
 assert.ok(b.pilot.rope.integrity<99,'Sawing wears a physical NPC/NPC or player/NPC crossing');
}
const multi=party();multi.state='playing';const calls=[0,0,0,0];multi.roster.forEach((e,i)=>{const original=e.stroke.step.bind(e.stroke);e.stroke.step=(...args)=>{calls[i]++;return original(...args);};});multi.resolveContacts(dt);assert.deepEqual(calls,[1,1,1,1],'Pair count must not multiply stroke time/travel');
const noContact=party();noContact.state='playing';noContact.roster.forEach((e,i)=>fixture(e,v(i*20,2,0),v(i*20,10,-5)));for(let n=0;n<100;n++){noContact.roster.forEach(e=>e.pilot.rope.feedDelta=n%2?.02:-.02);noContact.elapsed+=dt;noContact.resolveContacts(dt);}assert.ok(noContact.roster.every(e=>e.pilot.rope.integrity===100),'No remote damage');
const knockout=party();knockout.roster.forEach(e=>e.pilot.lives=1);knockout.state='playing';const first=knockout.roster[1];first.hit={edge:12,fraction:.4};const expected=first.pilot.rope.points[12].clone().lerp(first.pilot.rope.points[13],.4);knockout.eliminate(first,'Hilo cortado');knockout.checkOutcome();assert.equal(knockout.state,'playing');assert.equal(knockout.aliveRivals.length,2);assert.ok(first.pilot.rope.breakPoint.distanceTo(expected)<1e-9);assert.equal(first.pilot.rope.points.length,31);
knockout.eliminate(knockout.roster[2],'En tierra');knockout.checkOutcome();assert.equal(knockout.state,'playing');knockout.eliminate(knockout.roster[3],'Hilo cortado');knockout.checkOutcome();assert.equal(knockout.result.outcome,'win');assert.equal(knockout.result.eliminated,3);
const lose=party();lose.roster.forEach(e=>e.pilot.lives=1);lose.state='playing';lose.eliminate(lose.roster[0],'En tierra');lose.checkOutcome();assert.equal(lose.result,null);assert.equal(lose.spectating,true);assert.equal(lose.survivors.length,3);lose.eliminate(lose.roster[1],'En tierra');lose.eliminate(lose.roster[2],'En tierra');lose.checkOutcome();assert.equal(lose.result.outcome,'loss');assert.equal(lose.result.winner,'Nico');assert.equal(lose.result.standings.length,4);
const draw=party();draw.roster.forEach(e=>e.pilot.lives=1);draw.state='playing';draw.roster.forEach(e=>draw.eliminate(e,'Hilo cortado'));draw.checkOutcome();assert.equal(draw.result.outcome,'draw');
for(const [wears,outcome] of [[[0,.2,.3,.4],'win'],[[.2,.1,.3,.4],'loss'],[[0,0,.3,.4],'draw']]){const d=party();d.state='playing';d.remaining=0;wears.forEach((wear,i)=>d.roster[i].pilot.rope.abrade(12,.5,wear));d.checkOutcome();assert.equal(d.result.outcome,outcome);}
knockout.startParty(2,'hard');assert.equal(knockout.roster.length,3);assert.equal(knockout.result,null);assert.equal(knockout.events.length,0);assert.ok(knockout.roster.every(e=>e.alive&&e.pilot.rope.broken===-1&&e.pilot.rope.integrity===100&&e.pilot.energy===100));knockout.stop();assert.equal(knockout.visible,false);assert.equal(knockout.partyMode,false);assert.equal(knockout.rivals.length,1);assert.equal(knockout.rival,knockout.pool[0]);assert.equal(knockout.rival.partyTint,undefined,'Online inherits no local-party tint');
// Complete natural rounds prove contacts and sequential eliminations are reachable.
for(const count of [1,2,3])for(const strategy of ['idle','saw']){
 const d=party(count);let survivedElimination=false;const clock=performance.now();
 for(let tick=0;tick<240*250&&d.active;tick++){
  if(d.state==='playing'&&!d.player.eliminated){if(d.player.lineLength<32)climbControls(d.player,d.player.flightTime);else {d.player.setControls('hold');d.player.sawing=strategy==='saw';}}d.player.step(dt);d.step(dt);
  if(d.state==='playing'&&d.aliveRivals.length<count)survivedElimination=true;
  if(tick%240===0)for(const e of d.roster){assert.ok(Number.isFinite(e.pilot.position.length()+e.pilot.energy+e.pilot.tension));assert.ok(e.pilot.position.length()<300);assert.ok(e.pilot.energy>=0&&e.pilot.energy<=100);assert.ok(e.pilot.rope.points.every(p=>Number.isFinite(p.length())));}
 }
 assert.equal(d.state,'finished');assert.ok(d.engagements>0);assert.ok(['win','loss','draw'].includes(d.result.outcome));assert.ok(d.roster.every(e=>e.lives>=0&&e.lives<=3));
 console.log(`Party ${count} NPC, ${strategy}: ${d.result.outcome}, ${d.result.seconds}s, ${d.engagements} contacts (${Math.round(performance.now()-clock)}ms CPU)`);
}
for(const aspect of [1.78,1.25,390/844]){
 const camera=new PerspectiveCamera(54,aspect,.05,350);camera.position.copy(PILOT_EYE);for(let i=0;i<180;i++)positionView(camera,true,1/60,3);
 for(const positions of [[v(0,10,-6),v(4,11,-8),v(-4,9,-6),v(7,10,-8)],[v(0,8,-5),v(-5,8,-4),v(6,9,-6),v(2,11,-7)]]){
  const d=party();d.roster.forEach((e,i)=>e.pilot.position.copy(positions[i]));const f=frameDuel(camera,d);camera.lookAt(f.target);camera.fov=f.fov;camera.updateProjectionMatrix();camera.updateMatrixWorld();
  for(const p of positions){const q=p.clone().project(camera);assert.ok(Math.abs(q.x)<.84&&Math.abs(q.y)<.48&&q.z<1,'All four kites remain inside the flight area');}
  const local=v(.29,-.255,-.57),expected=local.clone().applyQuaternion(camera.quaternion).add(PILOT_EYE),actual=local.clone().add(handViewOffset(camera)).applyQuaternion(camera.quaternion).add(camera.position);assert.ok(actual.distanceTo(expected)<1e-9,'Party camera never moves the rope anchor');
 }
}
console.log('PASS: 1–3 NPCs, all six collision pairs, physical wear and fracture, isolated strokes, sequential elimination, result rules, rematch, online reset and four-kite camera.');
