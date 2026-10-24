import assert from 'node:assert/strict';
import {KitePhysics} from '../game/physics.js';
import {Commission} from '../game/commission.js';
import {LINE_STRENGTH,flightGust,extremeGust,resolveLineStress,updateWindStress} from '../game/line-stress.js';
import {packMatch,unpackMatch,snapshot} from '../server/online-match.js';
const dt=1/240;
function pilot(tension=50,wear=0){const p=new KitePhysics();p.launch();p.tension=tension;p.rope.wear[Math.round(p.rope.materialAt(14,.5)/.125)]=wear;return p;}
function crossing(a,b){return {ra:a.rope,rb:b.rope,i:14,j:14,s:.5,t:.5};}
function run(a,b,{pull=false,seconds=.5,duplicates=1}={}){const c=crossing(a,b);for(let n=0;n<seconds/dt&&a.state==='flying'&&b.state==='flying';n++){a.rope.feedDelta=pull&&(n===0||n===53)?-.3:0;resolveLineStress([a.rope,b.rope],Array(duplicates).fill(c),dt);}return [a,b];}

// The same near-limit crossing survives passive contact and fails under a
// deliberate double pull. Swapping the worn line must swap the losing player.
for(const ownWear of [false,true]){
  let a=pilot(50,ownWear?.5:0),b=pilot(50,ownWear?0:.5);run(a,b);assert.equal(a.state,'flying');assert.equal(b.state,'flying');
  a=pilot(50,ownWear?.5:0);b=pilot(50,ownWear?0:.5);const weak=ownWear?a:b,strong=ownWear?b:a,point=weak.rope.points[14].clone().lerp(weak.rope.points[15],.5);
  run(a,b,{pull:true});assert.equal(weak.state,'cut');assert.equal(strong.state,'flying');assert.equal(weak.rope.cutReason,'tension');assert.equal(weak.rope.integrity,0);assert.ok(weak.rope.breakPoint.distanceTo(point)<1e-10);assert.equal(weak.rope.points.length,31);
  assert.ok(weak.rope.velocities[15].distanceTo(weak.rope.velocities[16])>0,'Fracture retains recoil at both free ends');
}
// Contact density and participant order cannot turn one tug into extra damage.
const single=run(pilot(),pilot(50,.5),{pull:true}),dense=run(pilot(),pilot(50,.5),{pull:true,duplicates:12});
assert.deepEqual(single.map(p=>[p.state,p.rope.overload]),dense.map(p=>[p.state,p.rope.overload]));
for(const reverse of [false,true]){const a=pilot(120),b=pilot(160),c=crossing(a,b);for(let n=0;n<120&&b.state==='flying';n++)resolveLineStress(reverse?[b.rope,a.rope]:[a.rope,b.rope],[c],dt);assert.equal(b.state,'cut');assert.equal(a.state,'flying','The more overloaded strand breaks first, regardless of seat order');}
const equalA=pilot(150),equalB=pilot(150);run(equalA,equalB);assert.equal(equalA.state,'cut');assert.equal(equalB.state,'cut','Exactly equal simultaneous failures have no seat advantage');

const spikeA=pilot(160),spikeB=pilot(160);resolveLineStress([spikeA.rope,spikeB.rope],[crossing(spikeA,spikeB)],dt);assert.equal(spikeA.state,'flying');spikeA.tension=spikeB.tension=4;run(spikeA,spikeB);assert.equal(spikeA.rope.overload,0,'A momentary spike recovers without a delayed break');
const distantA=pilot(160),distantB=pilot(160);for(let n=0;n<240;n++)resolveLineStress([distantA.rope,distantB.rope],[],dt);assert.equal(distantB.state,'flying','No cutting an opponent without a physical crossing');
const slackA=pilot(0),slackB=pilot(0);run(slackA,slackB,{seconds:3});assert.equal(slackA.rope.integrity,100);assert.equal(slackB.rope.integrity,100,'Idle contact is not an arbitrary timeout cut');

// Rejected endpoint travel stores elastic load. Payout releases that load;
// continuing to push a snag eventually fractures the weakest strand.
function snag(release){const a=pilot(5),b=pilot(5,.3),c=crossing(a,b);let ticks=0;
  for(;ticks<480&&b.state==='flying';ticks++){
    a.rope._blockedMotion=b.rope._blockedMotion=1;a.rope._blockedTravel=b.rope._blockedTravel=.008;
    a.rope.feedDelta=b.rope.feedDelta=release?.02:0;
    resolveLineStress([a.rope,b.rope],[c],dt);
  }return {a,b,seconds:ticks*dt};}
const jam=snag(false),relieved=snag(true);assert.equal(jam.b.state,'cut');assert.ok(jam.seconds<2);assert.equal(jam.a.state,'flying');assert.equal(relieved.b.state,'flying');assert.ok(relieved.b.rope.stressRatio<.1);
const self=pilot(180);for(let n=0;n<120&&self.state==='flying';n++)resolveLineStress([self.rope],[crossing(self,self)],dt);assert.equal(self.state,'cut','An overloaded self-contact also releases');

// A rare gust is sampled once per flight, not each tick or each network poll.
let eligible=0;for(let seed=0;seed<10000;seed++)eligible+=flightGust(seed,1).eligible;
assert.ok(eligible>=900&&eligible<=1100,`10% flight sample: ${eligible}/10000`);
const seed=Array.from({length:100},(_,i)=>i).find(s=>flightGust(s,1).eligible),wind=new KitePhysics(undefined,{seed});wind.profile='strong';wind.windSpeed=9;wind.launch();const gust=flightGust(seed,1);assert.equal(wind.extremeGustEligible,true);wind.flightTime=gust.at+1.2;assert.ok(extremeGust(wind)>2);wind.windSpeed=7;assert.equal(extremeGust(wind),1);wind.windSpeed=12;wind.profile='calm';assert.equal(extremeGust(wind),1);wind.launch();assert.deepEqual({eligible:wind.extremeGustEligible,at:wind.extremeGustAt},flightGust(seed,2));

// Actual flight integrator: strong gust can break a taut line, while payout
// at the warning threshold saves this same seeded flight.
function gustFlight(release=false){const p=new KitePhysics(undefined,{seed});p.windSpeed=9;p.profile='strong';p.lineCapacity=150;p.launch();let warning=false;
  for(let i=0;i<40/dt&&p.state==='flying';i++){if(release&&p.flightTime>3&&p.rope.stressRatio>.75)warning=true;p.setControls(warning?'release':'hold',warning);p.step(dt);}
  return p;}
const taut=gustFlight(),saved=gustFlight(true);assert.equal(taut.rope.cutReason,'wind');assert.equal(saved.rope.broken,-1,'Fast payout can save the strand during the same extreme gust');
const mild=pilot();mild.flightTime=5;mild.windSpeed=5.5;mild.wind.set(0,0,-5.5);mild.tension=LINE_STRENGTH*.99;for(let n=0;n<480;n++)updateWindStress(mild,dt);assert.equal(mild.state,'flying');

// An in-progress load and the seeded gust survive server serialization exactly.
const d=new Commission(pilot());d.rival.launch();d.player.rope.jamStrain=.6;d.rival.rope.jamStrain=.8;d.player.rope.overload=.02;d.rival.rope.overload=.015;d.player.rope.shock=20;d.rival.tension=60;
const resumed=unpackMatch(JSON.parse(JSON.stringify(packMatch(d))));
for(let n=0;n<120;n++)for(const match of [d,resumed])resolveLineStress([match.player.rope,match.rival.rope],[crossing(match.player,match.rival)],dt);
assert.deepEqual(JSON.parse(JSON.stringify(packMatch(d))),JSON.parse(JSON.stringify(packMatch(resumed))));
const room={code:'STRESS00',round:1,settings:{},players:[{name:'A',seq:1,tugSeq:0,lastSeen:0},{name:'B',seq:1,tugSeq:0,lastSeen:0}],match:packMatch(d)};
assert.deepEqual(snapshot(room,0,0).match,snapshot(room,1,0).match,'Both seats see the same strain and cut reason');
d.player.cutLine(14,.5,'tension');d.state='playing';d.rival.state='flying';d.controlRival=()=>{};d.step(dt);assert.equal(d.result.outcome,'loss');assert.match(d.result.reason,/tensión/);assert.equal(d.playerHealth,0);
console.log(`PASS: tug technique, own-line risk, load priority, symmetric ties, no remote cuts, transient recovery, snag relief in ${jam.seconds.toFixed(2)} s, seeded gust ${eligible}/10000, payout rescue and authoritative persistence.`);
