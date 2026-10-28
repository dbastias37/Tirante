import assert from 'node:assert/strict';
import {KitePhysics} from '../game/physics.js';
import {Tether,closestSegments,CONTACT_RADIUS} from '../game/rope.js';
import {guardRopeMotion,solveRopeSystem} from '../game/rope-system.js';
import {applyCrossingAbrasion} from '../game/line-stress.js';
import {foregroundLine,ReelMotion,reelViewport} from '../game/reel-view.js';
import {ArticulatedBridle,BRIDLE_SEGMENTS} from '../game/bridle.js';
import {bridleAnchors,bridleJunction,sailZ} from '../game/kite-shape.js';
import {configuration} from '../game/physics.js';
import {Vector3,Quaternion,PerspectiveCamera} from '../game/vendor/three.module.js';
const v=(...a)=>new Vector3(...a),dt=1/240;
// Only closing normal motion is constrained; sliding and distant particles keep
// their full intended travel even when three ropes share one broad-phase box.
const fixture=(old,now=old,weights=old.map(()=>1))=>({points:now.map(p=>v(...p)),previous:old.map(p=>v(...p)),weights,broken:-1,owner:{anchor:v(...old[0]),position:v(...now.at(-1)),velocity:v(2,0,-2)}});
const fixed=fixture([[-3,5,0],[3,5,0]],undefined,[0,0]),moving=fixture([[0,4,.2],[0,6,.2]],[[1,4,-.2],[1,6,-.2]]),clear=fixture([[-2,5,.4],[2,5,.4]],[[-1,5,.4],[3,5,.4]]);
guardRopeMotion([fixed,moving,clear]);assert.ok(Math.abs(moving.points[0].x-1)<1e-8);assert.ok(Math.abs(moving.points[1].x-1)<1e-8);assert.ok(Math.abs(clear.points[1].x-3)<1e-8);assert.ok(moving.points[0].z>0);
for(let i=0;i<=100;i++){const t=i/100,a=moving.previous[0].clone().lerp(moving.points[0],t),b=moving.previous[1].clone().lerp(moving.points[1],t);assert.ok(closestSegments(...fixed.points,a,b).distance>CONTACT_RADIUS*.45);}
// Every collidable airborne point stays on the visible strand in first person,
// above the reel at every capacity and camera angle. A contact in the hidden
// prefix disables the join, even if another contact is stronger farther away.
for(const length of [8,150,274.32,914.4])for(const yaw of [-.8,0,.8]){
 const p=new KitePhysics();p.lineLength=length;p.position.set(0,length*.7,-length*.7);p.rope.reset();p.rope.contactEdge=14;
 const camera=new PerspectiveCamera(74,16/9,.1,4000);camera.position.set(0,1.72,3.65);camera.lookAt(length*Math.sin(yaw),length*.7,-length);camera.updateMatrixWorld();
 const raw=p.rope.points.map(q=>q.clone()),draw=foregroundLine(p.rope,camera,1920,1080,{x:950,y:750});
 const edge=draw.joinEdge??-1,offset=draw.physicalStart===undefined?0:draw.physicalStart-edge;
 for(let i=edge+1;i<raw.length;i++)assert.ok(draw[i+offset].equals(raw[i]));
 for(const i of [7,14,22])if(i>edge)assert.ok(draw[i+offset].clone().lerp(draw[i+offset+1],.37).distanceTo(raw[i].clone().lerp(raw[i+1],.37))<1e-10);
 p.rope.contactMinEdge=0;assert.equal(foregroundLine(p.rope,camera,1920,1080,{x:950,y:750}),p.rope.points);p.rope.contactMinEdge=-1;
 p.rope.handContact=true;assert.equal(foregroundLine(p.rope,camera,1920,1080,{x:950,y:750}),p.rope.points);
}
// Continuous fast friction cuts the opposing patch without a required Q/E
// reversal. Passive and non-contact motion cannot cause an abrasion cut.
for(const reverse of [false,true]){
 const a=new KitePhysics(),b=new KitePhysics();for(const p of [a,b]){p.launch();p.tension=5;}
 const attacker=reverse?b:a,target=reverse?a:b,hit={i:14,j:14,s:.5,t:.5};let ticks=0;
 for(;ticks<dt**-1*3&&target.state==='flying';ticks++){attacker.rope.feedDelta=-4*dt;target.rope.feedDelta=0;applyCrossingAbrasion(a.rope,b.rope,hit,{load:3,slip:4*dt},dt);}
 assert.equal(target.state,'cut');assert.equal(attacker.state,'flying');assert.ok(ticks*dt<2);assert.equal(target.rope.cutReason,'abrasion');
}
const idleA=new KitePhysics(),idleB=new KitePhysics();for(const p of [idleA,idleB]){p.launch();p.tension=5;}
for(let i=0;i<480;i++)applyCrossingAbrasion(idleA.rope,idleB.rope,{i:14,j:14,s:.5,t:.5},{load:3,slip:0},dt);assert.equal(idleA.rope.integrity,100);assert.equal(idleB.rope.integrity,100);
// Real feed distance drives reel rotation, with continuous phase on stop and
// reversal. A life reset cannot turn a refill into a huge animation impulse.
const p=new KitePhysics(),reel=new ReelMotion();p.launch();reel.update(p);for(let i=0;i<60;i++){p.time+=1/60;p.lineLength-=1.75/60;reel.update(p);}assert.ok(reel.angle>20);const stopped=reel.angle;reel.update(p,true);assert.equal(reel.angle,stopped);p.time+=1/60;p.lineLength=150;reel.update(p);assert.ok(Math.abs(reel.angle-stopped)<1);
for(const [w,h]of [[1920,1080],[1363,936],[390,844],[844,390]]){const b=reelViewport(w,h);assert.ok(Math.abs(b.x+b.size/2-w/2)<=.5);}
// Bridles bend under gravity/wind and keep all three mounts and the shared
// tether knot attached while the kite turns. Pausing preserves every point.
const bridle=new ArticulatedBridle(),position=v(0,15,-10),rotation=new Quaternion(),wind=v(2,0,-6),velocity=v();let curves=0;
for(let frame=0;frame<180;frame++){
 const time=frame/120;rotation.setFromAxisAngle(v(0,0,1),Math.sin(time)*.6);const chains=bridle.update(time,p.setup,position,rotation,wind,velocity,.6,1,.15),anchors=bridleAnchors(p.setup,time,.6,wind.length()),knot=v(...bridleJunction(configuration(p.setup)));
 for(let i=0;i<3;i++){const q=chains[i];assert.ok(q[0].distanceTo(v(...anchors[i]))<1e-10);assert.ok(q.at(-1).distanceTo(knot)<1e-10);for(let j=1;j<q.length;j++)assert.ok(q[j].distanceTo(q[j-1])<.12);if(frame>60&&q[4].distanceTo(q[0].clone().lerp(knot,.5))>.003)curves++;}
}
assert.ok(curves>100);const before=bridle.chains.map(c=>c.points.map(q=>q.toArray()));bridle.update(179/120,p.setup,position,rotation,wind,velocity,.6,1,.15);assert.deepEqual(bridle.chains.map(c=>c.points.map(q=>q.toArray())),before);
// Loose bridles cannot cut through the paper when wind pushes from behind.
for(const tension of [0,.15,2,30]){const b=new ArticulatedBridle(),r=new Quaternion(),w=v(5,0,-12);for(let i=0;i<600;i++){r.setFromAxisAngle(v(0,1,0),i*.02);for(const chain of b.update(i/120,p.setup,position,r,w,velocity,.6,1,tension))for(const q of chain)if(Math.abs(q.x)+Math.abs(q.y)<.4)assert.ok(q.z>=sailZ(q.x,q.y,i/120,.6,w.length())+.00099);}}
console.log('PASS: local sliding/no group freeze, exact visible airborne contacts at 4 capacities, fast continuous abrasion, idle safety, feed-driven centered reel and flexible attached/paused bridles.');
