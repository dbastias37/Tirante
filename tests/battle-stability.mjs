import assert from 'node:assert/strict';
import {Vector3,Quaternion} from '../game/vendor/three.module.js';
import {KitePhysics} from '../game/physics.js';
import {Tether} from '../game/rope.js';
import {guardRopeMotion,solveRopeSystem} from '../game/rope-system.js';
import {PartyCommission} from '../game/party.js';
const v=(...a)=>new Vector3(...a),dt=1/240;
function fixture(old,current=old){return {previous:old.map(p=>v(...p)),points:current.map(p=>v(...p)),broken:-1,owner:{anchor:v(...old[0]),position:v(...current.at(-1)),velocity:v(1,0,0)},weights:old.map(()=>1)};}
const a=fixture([[-2,5,0],[2,5,0]]),b=fixture([[0,4,.5],[0,6,.5]],[[0,4,-.5],[0,6,-.5]]),free=fixture([[20,5,0],[24,5,0]],[[21,5,0],[25,5,0]]);
guardRopeMotion([a,b,free]);assert.ok(b._blockedMotion>0);assert.equal(free._blockedMotion,0);assert.equal(free.points[1].x,25,'A distant kite must not freeze because another pair crosses');

// A crossing that starts inside the collision gap used to block movement in
// the final guard but escape contact gathering entirely (zero load forever).
function pilot(from,to){const p=new KitePhysics();p.anchor.copy(from);p.orientation=new Quaternion();p.position.copy(to).add(v(0,.06,-.23));p.lineLength=from.distanceTo(to);p.tension=2;p.state='flying';p.rope=new Tether(p);return p;}
const nearA=pilot(v(-2,5,0),v(2,5,0)),nearB=pilot(v(0,4,.001),v(0,6,.001));for(const point of nearB.rope.points)point.z=-.5;nearB.position.z-=.501;
const contacts=solveRopeSystem([nearA.rope,nearB.rope],dt);assert.ok(contacts.length>0,'Near-start swept crossing participates in the load model');assert.ok(nearA.rope.stressLoad>0);assert.equal(nearA.rope.contactAge,0);

// Reproductions from the release/boost/retrieve stress scan. Version 1.8
// remained stuck until the 120-second round timeout in both of these cases.
for(const [wind,time] of [[9,60],[12,15]]){
  const p=new KitePhysics();p.profile='strong';p.windSpeed=wind;p.time=time;p.lineCapacity=150;
  const d=new PartyCommission(p);d.startParty(3);for(const e of d.roster)e.pilot.extremeGustEligible=false;
  let blocked=0,longest=0,steps=0;
  for(;steps<240*35&&d.active;steps++){
    if(d.state==='playing'){const phase=d.elapsed%4;p.sawing=false;p.setControls(d.elapsed<4||phase<.7?'release':phase<1.2?'reel':'hold',phase<1.2);}
    const before=p.position.clone();p.step(dt);d.step(dt);
    const frozen=d.state==='playing'&&p.state==='flying'&&(p.rope._blockedMotion||0)>.99&&p.position.distanceTo(before)<.0001;
    blocked=frozen?blocked+dt:0;longest=Math.max(longest,blocked);
    for(const e of d.roster)assert.ok([...e.pilot.position.toArray(),e.pilot.tension,e.pilot.rope.stressRatio].every(Number.isFinite));
  }
  assert.equal(d.state,'finished',`Wind ${wind} must resolve without waiting for the round timeout`);assert.ok(longest<.5,`No persistent freeze (${longest.toFixed(3)} s)`);
  console.log(`PASS: abrupt battle at ${wind} m/s, wind phase ${time}: resolved in ${(steps*dt).toFixed(2)} s, longest blocked interval ${longest.toFixed(3)} s.`);
}
console.log('PASS: unrelated motion and near-start contact regressions.');
