import assert from 'node:assert/strict';
import {rasterTriangle} from '../game/software-raster.js';
import {KitePhysics,DEFAULT_SETUP} from '../game/physics.js';
import {THREADS,REELS,BEARINGS,cleanEquipment,equipmentStats,DEFAULT_EQUIPMENT} from '../game/equipment.js';
import {createThreadModel,createReelModel,createBearingModel,disposeModel} from '../game/equipment-models.js';
import {ArticulatedTail,TAIL_LENGTH,TAIL_SEGMENTS,TAIL_VERTICES} from '../game/tail.js';
import {Landscape,PaperKite} from '../game/scene.js';
import {frameDuel} from '../game/duel-camera.js';
import {spectatorView,onboardFrame} from '../game/spectator-camera.js';
import {PartyCommission} from '../game/party.js';
import {Commission} from '../game/commission.js';
import {cleanSetup,packMatch,unpackMatch} from '../server/online-match.js';
import {remainingStrength} from '../game/line-stress.js';
import {Vector3,Quaternion,PerspectiveCamera,Raycaster,BufferGeometry,Float32BufferAttribute,Mesh} from '../game/vendor/three.module.js';
const step=1/240;
function released(wind,heading=0,mass=34){const p=new KitePhysics({...DEFAULT_SETUP,mass});p.launch();p.profile=wind?'breeze':'calm';p.windSpeed=wind;p.position.set(0,20,-15);p.velocity.set(0,0,0);p.heading=heading;p.updateAttitude(new Vector3(0,0,-1));p.rope.reset();p.cutLine();return p;}
function advance(p,seconds,dt=step){for(let t=0;t<seconds-1e-8;t+=dt)p.step(dt);}
const calm=released(0),breeze=released(5.5),windy=released(9);for(const p of [calm,breeze,windy])advance(p,6);
assert.ok(calm.position.y>8,'A free sheet does not fall ballistically');assert.ok(breeze.position.z<calm.position.z-20,'Wind carries the detached kite downwind');assert.ok(windy.position.z<breeze.position.z-12,'Stronger wind carries it farther');
const flat=released(9),dive=released(9,Math.PI);advance(flat,1);advance(dive,1);assert.ok(dive.position.y<flat.position.y-.5,'Nose-down release dives before recovering into flutter');
const slow=released(9),fast=released(9);advance(slow,4,1/120);advance(fast,4);assert.ok(slow.position.distanceTo(fast.position)<.1,'Free flight converges with the timestep');
for(const mass of [22,34,70])for(const wind of [0,5.5,12]){const p=released(wind,Math.PI/3,mass);let seconds=0;while(p.state==='cut'&&seconds<60){p.step(step);seconds+=step;assert.ok(Number.isFinite(p.position.length()+p.velocity.length()+p.orientation.length()),'Finite release dynamics');assert.ok(p.velocity.length()<40);}assert.equal(p.state,'grounded');assert.equal(p.position.y,.42);assert.equal(p.freeMode,'landed');assert.ok(seconds>4&&seconds<40);}
assert.deepEqual(cleanEquipment({lineType:'bogus',reelType:'../../x',bearingType:NaN}),DEFAULT_EQUIPMENT);
for(const thread of THREADS){const s=cleanSetup({...DEFAULT_SETUP,lineType:thread.id,reelType:'wood-8',bearingType:'sealed'}),p=new KitePhysics(s);assert.equal(p.equipment.thread.id,thread.id);assert.equal(p.equipment.reel.id,'wood-8');assert.equal(p.equipment.bearing.id,'sealed');assert.equal(remainingStrength(p.rope,10),thread.strength);assert.deepEqual(cleanSetup(JSON.parse(JSON.stringify(s))),s);}
const thin=new KitePhysics({...DEFAULT_SETUP,lineType:'cotton-24'}),thick=new KitePhysics({...DEFAULT_SETUP,lineType:'cotton-4'});thin.rope.abrade(14,.5,.5);thick.rope.abrade(14,.5,.5);assert.ok(thick.rope.integrity>thin.rope.integrity);
const normal=new KitePhysics(),smooth=new KitePhysics({...DEFAULT_SETUP,bearingType:'sealed'});for(const p of [normal,smooth]){p.launch();advance(p,2);p.setControls('reel');advance(p,.7);}assert.ok(smooth.lineLength<normal.lineLength);assert.ok(smooth.energy>normal.energy);
const match=new Commission(released(9));match.rival.launch();match.state='finished';advance(match.player,1);const restored=unpackMatch(packMatch(match));for(let i=0;i<300;i++){match.player.step(step);restored.player.step(step);}assert.ok(match.player.position.distanceTo(restored.player.position)<1e-9,'Detached aerodynamics survive authoritative save/restore');
const p=new KitePhysics({...DEFAULT_SETUP,lineType:'cotton-4',reelType:'wood-8',bearingType:'sealed'}),party=new PartyCommission(p);party.startParty(3);assert.ok(party.rivals.every(r=>r.setup.lineType==='cotton-4'&&r.setup.bearingType==='sealed'),'NPCs use the same equipment rules');party.state='playing';p.cutLine();party.eliminate(party.roster[0],'Hilo cortado');assert.equal(spectatorView(p,party).pilot,p);assert.equal(spectatorView(p,party).orbital,true);party.spectatorView='onboard';const camera=new PerspectiveCamera();const frame=onboardFrame(camera,p,.016);assert.ok(camera.position.distanceTo(p.position)<1);assert.ok(Number.isFinite(frame.target.length()));assert.equal(spectatorView(p,party).onboard,true);party.spectatorView='battle';party.spectatorIndex=-1;assert.equal(spectatorView(p,party).pilot,null);party.finish('loss','Test');assert.equal(spectatorView(p,party).active,true);
const tail=new ArticulatedTail(),pos=new Vector3(0,8,0),rotation=new Quaternion(),air=new Vector3(0,0,-6),axis=new Vector3(0,0,1);let max=0;
for(let i=0;i<300;i++){pos.x=Math.sin(i/60)*.5;rotation.setFromAxisAngle(axis,Math.sin(i/30));tail.update(i/60,pos,rotation,air,new Vector3());for(let n=1;n<tail.points.length;n++)max=Math.max(max,tail.points[n].distanceTo(tail.points[n-1]));}
assert.ok(max<TAIL_LENGTH/TAIL_SEGMENTS*1.2,'Articulation keeps the segment lengths bounded');assert.ok(tail.points.at(-1).z<-.5,'Tail responds to wind');const before=tail.points.at(-1).clone();rotation.setFromAxisAngle(axis,2);tail.update(5,pos,rotation,air,new Vector3());assert.ok(tail.points.at(-1).distanceTo(before)<.2,'Tail retains inertia when the kite turns');const frozen=tail.points.map(x=>x.toArray());tail.update(5,pos,rotation,air,new Vector3());assert.deepEqual(tail.points.map(x=>x.toArray()),frozen,'Pause freezes the tail');
const paper=new PaperKite();paper.configure(DEFAULT_SETUP);paper.group.position.set(0,8,0);for(let i=0;i<60;i++)paper.animate(i/60,.4,7);assert.equal(paper.tail.geometry.attributes.position.count,TAIL_VERTICES);assert.ok([...paper.tail.geometry.attributes.normal.array].every(Number.isFinite));
for(const [list,factory] of [[THREADS,createThreadModel],[REELS,createReelModel],[BEARINGS,createBearingModel]])for(const item of list){const m=factory(item);assert.equal(m.children.length,1,'Equipment is merged into one draw call');const geometry=m.children[0].geometry;assert.ok([...geometry.attributes.position.array,...geometry.attributes.normal.array,...geometry.attributes.color.array].every(Number.isFinite));assert.ok(geometry.attributes.position.count/3<12000);m.updateMatrixWorld(true);if(item.holes){const ray=new Raycaster(new Vector3(0,.56,2),new Vector3(0,0,-1));assert.equal(ray.intersectObject(m,true).length,0,'The circular holes pass through the wooden reel');}disposeModel(m);}

// Width changes without moving the physical rope, including after a fracture.
const geometry=n=>new BufferGeometry().setAttribute('position',new Float32BufferAttribute(new Float32Array(n*3),3)).setAttribute('color',new Float32BufferAttribute(new Float32Array(n*3),3));
const rendered=new Mesh(geometry(80));rendered.userData.fray=new Mesh(geometry(120));rendered.userData.tips=new Mesh(geometry(2));rendered.userData.ribbon=new Mesh(geometry(240));
const fixture=new KitePhysics();fixture.launch();for(let i=0;i<fixture.rope.points.length;i++)fixture.rope.points[i].set(0,2+i*.2,-2-i);
const scene={physics:fixture,_temp:new Vector3(),camera,height:900};camera.position.set(2,2,2);camera.fov=65;
const drawWidth=id=>{fixture.configure({...fixture.setup,lineType:id});Landscape.prototype.updateTether.call(scene,rendered,fixture);const a=rendered.userData.ribbon.geometry.attributes.position;return new Vector3().fromBufferAttribute(a,0).distanceTo(new Vector3().fromBufferAttribute(a,1));};
assert.ok(Math.abs(drawWidth('cotton-4')/drawWidth('cotton-24')-.65/.35)<1e-4,'The visible line uses the selected diameter');
fixture.cutLine();Landscape.prototype.updateTether.call(scene,rendered,fixture);assert.equal(rendered.userData.ribbon.geometry.drawRange.count,(fixture.rope.points.length-2)*6,'No ribbon bridges the cut');
assert.ok([...rendered.userData.ribbon.geometry.attributes.position.array].every(Number.isFinite));
for(const e of party.roster)e.alive=false;const emptyBattle=frameDuel(camera,party);assert.ok(Number.isFinite(emptyBattle.target.length()+emptyBattle.fov),'Finished battles keep a valid spectator camera');


const pixels={width:32,height:32,data:new Uint8ClampedArray(32*32*4),depth:new Float32Array(32*32)};pixels.depth.fill(Infinity);
const triangle=z=>[{x:1,y:1,z},{x:30,y:1,z},{x:1,y:30,z}];
rasterTriangle(pixels,...triangle(.2),[220,0,0]);rasterTriangle(pixels,...triangle(.7),[0,220,0]);
assert.deepEqual([...pixels.data.slice((4*32+4)*4,(4*32+4)*4+4)],[220,0,0,255],'Near surfaces survive later rear triangles');
pixels.data.fill(0);pixels.depth.fill(Infinity);rasterTriangle(pixels,...triangle(.7),[0,220,0]);rasterTriangle(pixels,...triangle(.2).reverse(),[220,0,0]);
assert.deepEqual([...pixels.data.slice((4*32+4)*4,(4*32+4)*4+4)],[220,0,0,255],'Occlusion is independent of face order and winding');
assert.equal(pixels.data[(31*32+31)*4+3],0,'Empty space stays transparent');
console.log('PASS: wind-driven flutter/glide/dive, landing and timestep stability, live equipment tradeoffs, online persistence, fair NPC equipment, cut/onboard/battle cameras, articulated tail inertia/pause and single-draw 3D models with open holes.');
