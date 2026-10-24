import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Vector3,PerspectiveCamera} from '../game/vendor/three.module.js';
import {KitePhysics,DEFAULT_SETUP} from '../game/physics.js';
import {LightTrail,segmentSphere,formatTrailTime} from '../game/trail.js';
import {OrbitCamera} from '../game/orbit-camera.js';
import {solveRopeSystem} from '../game/rope-system.js';
const dt=1/240,v=(x=0,y=0,z=0)=>new Vector3(x,y,z);
assert.equal(segmentSphere(v(-5),v(5),v(),.1),true,'A fast pass collects without landing on the target at a tick');assert.equal(segmentSphere(v(-5,2),v(5,2),v(),.9),false);
const p=new KitePhysics({...DEFAULT_SETUP,left:40,color:'teal'});p.profile='gusts';p.windSpeed=8;p.lineCapacity=100;const saved={...p.setup},trail=new LightTrail(p);trail.start();assert.equal(p.lineCapacity,65);assert.equal(p.profile,'breeze');
// Future markers do not count, pausing means no step and thus no clock change.
trail.state='playing';p.position.copy(trail.points[7]);trail.previous.copy(p.position);trail.step(dt);assert.equal(trail.index,0);
p.position.copy(trail.points[0]);trail.previous.copy(p.position);trail.step(dt);assert.equal(trail.index,1);assert.ok(trail.remaining>91);
trail.start();assert.equal(trail.index,0);assert.equal(trail.remaining,90);assert.equal(trail.result,null);
const sequence=[['hold',5],['release',.45],['hold',3],['release',.45],['hold',3],['release',.45],['hold',3],['release',.45],['hold',3],['reel',1],['hold',3],['release',.45],['hold',3],['release',.8],['hold',3],['reel',1.5],['hold',3]];
for(const [action,seconds]of sequence){p.setControls(action,false);for(let i=0;i<seconds/dt&&trail.active;i++){p.step(dt);solveRopeSystem([p.rope],dt);trail.step(dt);}}
assert.equal(trail.result?.won,true,'The published route is reachable with real Q/E maneuvers, no position edits or autopilot');assert.equal(trail.index,8);assert.equal(trail.result.medal,'Plata');const completed=trail.elapsed;trail.step(20);assert.equal(trail.elapsed,completed);
trail.stop();assert.deepEqual(p.setup,saved);assert.equal(p.windSpeed,8);assert.equal(p.profile,'gusts');assert.equal(p.lineCapacity,100);
trail.start();trail.state='playing';trail.remaining=.001;p.position.set(100,100,100);trail.previous.copy(p.position);trail.step(dt);assert.equal(trail.result.won,false);assert.ok(trail.result.reason.includes('tiempo'));
trail.start();trail.state='playing';p.state='grounded';trail.step(dt);assert.equal(trail.result.won,false);assert.ok(trail.result.reason.includes('tierra'));
trail.start();for(let i=0;i<110/dt&&trail.active;i++){p.step(dt);solveRopeSystem([p.rope],dt);trail.step(dt);}assert.equal(trail.result.won,false,'Holding still cannot complete the course');assert.ok(trail.index<8);
// Orbit sweeps every side and elevation without moving the physical pilot.
p.launch();const anchor=p.anchor.clone(),points=p.rope.points.map(p=>p.clone()),cam=new PerspectiveCamera(54,16/9,.05,350),orbit=new OrbitCamera();orbit.active=true;
for(let n=0;n<200;n++){orbit.drag(15,n%2?8:-8);orbit.zoom(n%2?15:-15);const frame=orbit.frame(cam,p.position,1/60);assert.ok(frame.target.equals(p.position));cam.lookAt(frame.target);cam.updateMatrixWorld();assert.ok(Math.abs(p.position.clone().project(cam).x)<1e-8);}
assert.ok(p.anchor.equals(anchor));assert.ok(p.rope.points.every((p,i)=>p.equals(points[i])));for(let i=0;i<20;i++)orbit.zoom(-1000);assert.equal(orbit.distance,2);for(let i=0;i<20;i++)orbit.zoom(1000);assert.equal(orbit.distance,24);orbit.drag(0,1e6);assert.ok(orbit.pitch<Math.PI/2);orbit.drag(0,-1e6);assert.ok(orbit.pitch>-Math.PI/2);orbit.reset();assert.equal(orbit.distance,6);
// Renderers must remain pure observers of the hand boundary in either mode.
for(const name of ['scene.js','canvas-scene.js'])assert.ok(!readFileSync(new URL('../game/'+name,import.meta.url),'utf8').includes('.moveAnchor('));
console.log(`PASS: ordered swept pickups, time bonus, complete reachable course (${completed.toFixed(2)} s), timeout, landing, no idle win, settings restored, orbit bounds/centering and stationary physical hand.`);
// WebGL trail geometry (without requiring a GPU): target halo matches pickup
// radius; future markers stay dim; consumed targets disappear; bursts expire.
const {Scene}=await import('../game/vendor/three.module.js'),{TrailView}=await import('../game/trail-view.js');
globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>({createRadialGradient:()=>({addColorStop(){}}),fillRect(){}})})};
const scene=new Scene(),visual=new TrailView(scene);delete globalThis.document;trail.start();visual.update(trail,cam,p.time);assert.equal(visual.rings.filter(r=>r.group.visible).length,3);assert.equal(visual.rings[0].ring.scale.x,trail.radius);assert.ok(visual.rings[0].ring.material.opacity>visual.rings[1].ring.material.opacity);
trail.state='playing';p.position.copy(trail.points[0]);trail.previous.copy(p.position);trail.step(dt);visual.update(trail,cam,p.time);assert.equal(visual.rings[0].group.visible,false);assert.equal(visual.rings[1].core.visible,true);assert.equal(visual.bursts[0].visible,true);visual.update(trail,cam,p.time+2);assert.equal(visual.bursts[0].visible,false);
console.log('PASS: WebGL trail pickup radius, future markers, collection visibility and burst expiry.');

assert.equal(formatTrailTime(59.999,true),'01:00.0');assert.equal(formatTrailTime(90),'01:30');assert.equal(formatTrailTime(0,true),'00:00.0');
