import assert from 'node:assert/strict';
import {Vector3,Quaternion} from '../game/vendor/three.module.js';
import {segmentTOI,guardRopeMotion,solveRopeSystem} from '../game/rope-system.js';
import {closestSegments,Tether,CONTACT_RADIUS} from '../game/rope.js';
import {KitePhysics} from '../game/physics.js';
import {PartyCommission} from '../game/party.js';
import {Commission} from '../game/commission.js';
import {packMatch,unpackMatch} from '../server/online-match.js';
const v=(x=0,y=0,z=0)=>new Vector3(x,y,z),dt=1/240;
function fixture(old,current=old){return {previous:old.map(p=>v(...p)),points:current.map(p=>v(...p)),broken:-1,owner:{anchor:v(...old[0]),position:v(...old.at(-1)),velocity:v()},weights:old.map(()=>1)};}
const horizontal=[[-2,5,0],[2,5,0]],above=[[0,4,.5],[0,6,.5]],below=[[0,4,-.5],[0,6,-.5]];
for(const depth of [.5,5,50]){
 const a=fixture(horizontal),b=fixture(above.map(p=>[p[0],p[1],depth]),below.map(p=>[p[0],p[1],-depth]));
 const hit=segmentTOI(...a.previous,...b.previous,...a.points,...b.points);assert.ok(hit&&hit.time>0&&hit.time<.5,'High speed finite-edge crossing is swept, not sampled');
 const f=guardRopeMotion([a,b]);assert.ok(f<.5);assert.ok(b.points[0].z>a.points[0].z,'Crossing retains the original relative side');
 for(let n=0;n<=80;n++){const t=n/80,aa=a.previous.map((p,i)=>p.clone().lerp(a.points[i],t)),bb=b.previous.map((p,i)=>p.clone().lerp(b.points[i],t));assert.ok(closestSegments(...aa,...bb).distance>CONTACT_RADIUS*.49,'Every part of the accepted movement remains separated');}
}
// Parallel sliding and tangent contact are missed by a simple separating-plane flip.
const barrier=fixture(horizontal);barrier.weights.fill(0);
const parallel=fixture([[-2,5,.3],[2,5,.3]],[[-2,5,-.3],[2,5,-.3]]);assert.ok(guardRopeMotion([barrier,parallel])<1);assert.ok(parallel.points[0].z>0);
const tangent=fixture([[-3,5,.1],[-2,5,.1]],[[1,5,.00001],[2,5,.00001]]);assert.ok(guardRopeMotion([fixture(horizontal),tangent])<1);
const miss=fixture([[0,8,.5],[0,9,.5]],[[0,8,-.5],[0,9,-.5]]);assert.equal(guardRopeMotion([fixture(horizontal),miss]),1,'Depth alone cannot invent finite-edge contact');
const close=fixture([[0,4,.001],[0,6,.001]],below);guardRopeMotion([barrier,close]);assert.ok(close.points[0].z>0,'A close pair still cannot change sides');
// One strand folding through itself and two independent simultaneous crossings.
const loop=fixture([[-2,5,0],[2,5,0],[0,6,.5],[0,4,.5]],[[-2,5,0],[2,5,0],[0,6,-.5],[0,4,-.5]]);assert.ok(guardRopeMotion([loop])<1);{const h=closestSegments(loop.points[0],loop.points[1],loop.points[2],loop.points[3]);assert.ok(h.b.z>h.a.z&&h.distance>CONTACT_RADIUS*.49,'Self contact preserves relative strand ordering');}
const a=fixture(horizontal),b=fixture(above,below),c=fixture(horizontal.map(p=>[p[0]+8,p[1],p[2]])),d=fixture(above.map(p=>[p[0]+8,p[1],p[2]]),below.map(p=>[p[0]+8,p[1],p[2]]));assert.ok(guardRopeMotion([a,b,c,d])<1);assert.ok(b.points[0].z>a.points[0].z&&d.points[0].z>c.points[0].z);
// Hand-side edge and low contacts are included; no special nonphysical exclusion.
const floor=fixture(horizontal.map(p=>[p[0],.04,p[2]])),low=fixture([[0,.01,.1],[0,.1,.1]],[[0,.01,-.1],[0,.1,-.1]]);floor.weights.fill(0);guardRopeMotion([floor,low]);assert.ok(low.points[0].z>0);
const cut=fixture(above,below);cut.broken=0;assert.equal(guardRopeMotion([fixture(horizontal),cut]),1,'Fracture releases the obstruction');
// Actual XPBD system: corrections and length passes must pass the final guard.
function pilot(from,to){const p=new KitePhysics();p.anchor.copy(from);p.orientation=new Quaternion();p.position.copy(to).add(v(0,.06,-.23));p.lineLength=from.distanceTo(to);p.tension=2;p.state='flying';p.rope=new Tether(p);p.rope.dt=dt;return p;}
const pa=pilot(v(-2,5,0),v(2,5,0)),pb=pilot(v(0,4,.1),v(0,6,.1));for(const q of pb.rope.points)q.z=-.1;pb.position.z-=.2;
const contacts=solveRopeSystem([pa.rope,pb.rope],dt);assert.ok(contacts.every(c=>c.hit.distance<=CONTACT_RADIUS*2.21),'Only touching final segments are reported');assert.ok(pa.rope.integrity===100&&pb.rope.integrity===100,'Blocking never creates a cut or wear');
let minimum=Infinity;for(let i=0;i<28;i++)for(let j=0;j<28;j++)minimum=Math.min(minimum,closestSegments(pa.rope.points[i],pa.rope.points[i+1],pb.rope.points[j],pb.rope.points[j+1]).distance);assert.ok(minimum>CONTACT_RADIUS*.49,'Final XPBD corrections cannot undo collision separation');
// A contact-rich online state survives process serialization without hidden caches.
const duel=new Commission(new KitePhysics());duel.start();for(let n=0;n<240*10;n++){duel.player.step(dt);duel.step(dt);}duel.controlRival=()=>{};const resumed=unpackMatch(JSON.parse(JSON.stringify(packMatch(duel))));
for(let n=0;n<120;n++)for(const d of [duel,resumed]){d.player.setControls(n%24<12?'release':'reel',true);d.player.step(dt);d.step(dt);}assert.deepEqual(packMatch(duel),packMatch(resumed));
// Natural four-way flight: check separation as well as finite state under boost.
const party=new PartyCommission(new KitePhysics());party.startParty(3);let checked=0;
for(let tick=0;tick<240*18&&party.active;tick++){
 if(party.state==='playing'){party.player.sawing=true;party.player.boost=true;}
 party.player.step(dt);party.step(dt);
 if(tick%24)continue;
 const ropes=party.roster.map(e=>e.pilot.rope).filter(r=>r.broken<0);
 for(let a=0;a<ropes.length;a++)for(let b=a;b<ropes.length;b++)for(let i=0;i<28;i++)for(let j=a===b?i+2:0;j<28;j++){
  const r=ropes[a],s=ropes[b],dist=closestSegments(r.points[i],r.points[i+1],s.points[j],s.points[j+1]).distance;
  assert.ok(dist>1e-7,'Intact edges never intersect in the simulated party');checked++;
 }
}
console.log(`PASS: continuous crossings, parallel/grazing/near-miss motion, self contact, hand/floor edges, multiple contacts, XPBD final guard, intact wear, fracture release, serialization and ${checked} natural edge pairs.`);
// Rendering interpolated network snapshots must not reintroduce tunnelling.
const {OnlineGame}=await import('../game/online.js'),{snapshot}=await import('../server/online-match.js');
const server=new Commission(pilot(v(-2,5,0),v(2,5,0)));server.rival=pilot(v(0,4,.2),v(0,6,.2));server.state='playing';
const room={code:'ABCDEFGH',round:1,settings:{},players:[{name:'A',lastSeen:0,seq:0,tugSeq:0},{name:'B',lastSeen:0,seq:0,tugSeq:0}],match:packMatch(server)};
const client=Object.create(OnlineGame.prototype),view=new Commission(new KitePhysics());client.received=0;client.interval=100;client.latest=snapshot(room,0,0);client.render(view.player,view,0);
for(const p of server.rival.rope.points)p.z-=.4;server.rival.position.z-=.4;room.match=packMatch(server);client.latest=snapshot(room,0,0);client.render(view.player,view,10);client.render(view.player,view,110);
assert.ok(view.rival.rope.points[14].z>view.player.rope.points[14].z,'Visual interpolation retains strand order despite a crossing candidate');
server.rival.rope.breakAt(12,.5);room.match=packMatch(server);client.latest=snapshot(room,0,0);client.render(view.player,view);assert.equal(view.rival.rope.broken,13);assert.ok(view.rival.rope.points[14].z<0,'A network fracture releases the rendered loose end');
console.log('PASS: online render guard preserves strand order and releases after authoritative fracture.');
