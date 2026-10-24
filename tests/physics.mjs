import assert from 'node:assert/strict';
import {KitePhysics,DEFAULT_SETUP,configuration,LINE_BOOST} from '../game/physics.js';
function run(p,seconds,dt=1/240){for(let i=0;i<seconds/dt;i++){p.step(dt);assert.ok(Number.isFinite(p.position.x+p.position.y+p.position.z+p.tension));assert.ok(p.tension>=0);}return p;}
const normal=new KitePhysics();normal.launch();run(normal,30);
console.log('Baseline',normal.state,normal.position.toArray().map(v=>v.toFixed(2)),normal.tension.toFixed(2),normal.heading.toFixed(2));
assert.equal(normal.state,'flying','Balanced kite should sustain flight in a breeze');
assert.ok(normal.position.y>4,'Balanced kite should gain altitude');
const still=new KitePhysics();still.profile='calm';still.launch();run(still,8);assert.equal(still.state,'grounded','No stationary-wind free energy');
const a=new KitePhysics(),b=new KitePhysics();a.profile=b.profile='gusts';a.launch();b.launch();run(a,12);run(b,12);assert.deepEqual(a.position.toArray(),b.position.toArray(),'Wind is deterministic');
const coarse=new KitePhysics();coarse.launch();run(coarse,30,1/120);assert.ok(coarse.position.distanceTo(normal.position)<.4,'Integration converges at supported timesteps');
assert.ok(configuration({...DEFAULT_SETUP,knotsRight:2}).bias>0,'Right knots shorten right bridle and change trim');
assert.equal(configuration(DEFAULT_SETUP).bias,0);
const loose=new KitePhysics();loose.launch();run(loose,3);loose.lineLength+=8;loose.step(1/240);assert.equal(loose.tension,0,'Slack rope cannot push');
const stress=new KitePhysics({...DEFAULT_SETUP,tail:false,knotsLeft:4,mass:22});stress.profile='gusts';stress.windSpeed=8;stress.launch();run(stress,60);
const release=new KitePhysics();release.launch();run(release,8);release.setControls('release');run(release,4.4);assert.ok(release.turns>=2&&release.state==='flying','Giving line allows multiple complete turns');
const catchUp=new KitePhysics();catchUp.launch();run(catchUp,8);catchUp.setControls('release');for(let i=0;i<960&&catchUp.heading<Math.PI*2-.6;i++)catchUp.step(1/240);const catchHeight=catchUp.position.y;catchUp.setControls('reel',true);run(catchUp,.6);catchUp.setControls('hold');run(catchUp,4);assert.ok(catchUp.state==='flying'&&catchUp.position.y>catchHeight+3,'Catching the upward heading recovers altitude');
const dive=action=>{const p=new KitePhysics();p.launch();run(p,8);p.heading=Math.PI+.35;p.spin=0;p.velocity.set(0,0,0);if(action==='tug')p.tug();else p.setControls(action,true);run(p,.45);return p;};
const driftDown=dive('hold'),reelDown=dive('reel'),pullDown=dive('tug');
assert.ok(reelDown.velocity.y<driftDown.velocity.y-2,'Boosted retrieval accelerates a downward-pointing kite into a dive');
assert.ok(pullDown.position.y<driftDown.position.y-.2,'A short pull also acts downward');
for(const p of [reelDown,pullDown])assert.ok(Math.abs(p.heading-(Math.PI+.35))<.04,'Active line control does not forcibly turn a dive upward');
for(const action of ['release','reel']){const slow=new KitePhysics(),fast=new KitePhysics();for(const p of [slow,fast]){p.launch();run(p,8);}slow.setControls(action,false);fast.setControls(action,true);const s0=slow.lineLength,f0=fast.lineLength;run(slow,.5);run(fast,.5);assert.ok(Math.abs((fast.lineLength-f0)/(slow.lineLength-s0)-LINE_BOOST)<1e-7,'Shift multiplies either line speed by 2.5');}
const switching=new KitePhysics();switching.launch();run(switching,8);switching.setControls('release');const switchStart=switching.lineLength;run(switching,.4);switching.setControls('release',true);run(switching,.4);switching.setControls('release',false);run(switching,.4);assert.ok(Math.abs(switching.lineLength-switchStart-1.8*.4*(2+LINE_BOOST))<1e-7,'Shift can enter and leave a held action without another release impulse');
const double=new KitePhysics();double.launch();run(double,8);const originalLine=double.lineLength;assert.ok(double.tug(true));assert.equal(double.tugCount,1);assert.equal(double.tug(true),false,'Held/repeated input cannot stack pulse sequences');run(double,.15);assert.ok(Math.abs(double.lineLength-(originalLine-.3))<1e-9,'First pull is separate');run(double,.1);assert.equal(double.tugCount,2);assert.ok(Math.abs(double.lineLength-(originalLine-.6))<1e-9,'Second pull occurs after the gap');run(double,1);assert.equal(double.tugCount,2,'Exactly two pulls, no repeated auto-pulses');
const cancelled=new KitePhysics();cancelled.launch();cancelled.tug(true);cancelled.reset();cancelled.launch();run(cancelled,.5);assert.equal(cancelled.tugCount,0,'Restart discards the pending second tug');assert.equal(cancelled.lineLength,8);
const bounded=new KitePhysics();bounded.launch();bounded.lineLength=64.9;bounded.setControls('release',true);run(bounded,.5);assert.equal(bounded.lineLength,65,'Boost respects the maximum line length');

const left=new KitePhysics({...DEFAULT_SETUP,knotsLeft:2}),right=new KitePhysics({...DEFAULT_SETUP,knotsRight:2});left.launch();right.launch();run(left,15);run(right,15);assert.ok(right.position.x>left.position.x+.5,'Opposite bridle knots produce opposite lateral trim');
assert.ok(normal.nose.dot(normal.wind)<0,'Leading tip points upwind rather than presenting the sail edge to the pilot');
console.log('PASS: baseline flight, calm landing, deterministic wind, timestep convergence, slack rope, trim, multiple turns, manual recovery, downward control, both boost speeds, modifier transitions, exactly two timed pulls, reset cancellation, line limit.');
