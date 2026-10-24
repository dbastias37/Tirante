import assert from 'node:assert/strict';
import * as THREE from '../game/vendor/three.module.js';
import {KitePhysics} from '../game/physics.js';
import {Landscape} from '../game/scene.js';
import {CanvasLandscape} from '../game/canvas-scene.js';
const v=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const player=new KitePhysics();player.launch();const rope=player.rope;
const hand=v(.3,1.6,.55),unchanged=rope.points.slice(1).map(p=>p.clone());rope.moveAnchor(hand);
assert.ok(player.anchor.equals(hand));assert.ok(rope.points[0].equals(hand),'The visible hand and the physics boundary must coincide');
assert.ok(rope.points.slice(1).every((p,i)=>p.equals(unchanged[i])),'Moving the hand does not teleport the airborne or contact vertices');
// A taut fixture reproduces the reported camera/hand offset. Rendering may not
// add a bend at node 3, even when an obsolete view-model offset is supplied.
const tip=v(0,9,-8);for(let i=0;i<rope.points.length;i++)rope.points[i].copy(hand).lerp(tip,i/(rope.points.length-1));
const makeLine=n=>new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(Array.from({length:n},()=>v())),new THREE.LineBasicMaterial());
const line=makeLine(80);line.geometry.setAttribute('color',new THREE.Float32BufferAttribute(new Float32Array(240),3));line.userData.fray=makeLine(120);line.userData.tips=makeLine(2);
Landscape.prototype.updateTether.call({physics:player,_temp:v()},line,player,v(.7,1.9,1.2));
const vertices=line.geometry.attributes.position;
for(let edge=0;edge<28;edge++)for(let end=0;end<2;end++)assert.ok(v().fromBufferAttribute(vertices,edge*2+end).distanceTo(rope.points[edge+end])<1e-6,'WebGL draws the collision geometry without an extra hand join');
const before=v().fromBufferAttribute(vertices,5).sub(v().fromBufferAttribute(vertices,4)),after=v().fromBufferAttribute(vertices,6).sub(v().fromBufferAttribute(vertices,7));assert.ok(Math.abs(before.angleTo(after)-Math.PI)<1e-5,'No artificial corner at the former join');
const camera=new THREE.PerspectiveCamera(54,1.9,.05,350);camera.position.set(0,1.72,1.1);camera.lookAt(tip);camera.updateMatrixWorld(true);
const paths=[],ctx={beginPath(){},moveTo(x,y){paths.push([x,y]);},lineTo(x,y){paths.push([x,y]);},stroke(){}};
const project=q=>{const a=q.clone().project(camera);return {x:a.x,y:a.y,z:a.z};};
CanvasLandscape.prototype.drawTether.call({ctx,project},player,'#fff');
assert.equal(paths.length,56);for(let i=0;i<paths.length;i++){const edge=Math.floor(i/2),point=project(rope.points[edge+i%2]);assert.ok(Math.hypot(paths[i][0]-point.x,paths[i][1]-point.y)<1e-8,'Canvas also draws the physical geometry directly');}
// Exercise camera-directed hand movement at the reported strong-wind setting.
const p=new KitePhysics();p.profile='strong';p.windSpeed=12;p.launch();
const rig=new THREE.Group();rig.position.set(.29,-.255,-.57);rig.rotation.set(.08,-.38,-.2);rig.scale.setScalar(.85);camera.add(rig);const outlet=new THREE.Object3D();outlet.position.set(0,.085,0);rig.add(outlet);
for(let frame=0;frame<360;frame++){
  for(let n=0;n<4;n++)p.step(1/240);
  camera.lookAt(p.position.clone().add(v(0,-.7,0)));camera.updateMatrixWorld(true);p.rope.moveAnchor(outlet.getWorldPosition(v()));
  assert.ok(p.rope.points.every(q=>Number.isFinite(q.length())));assert.ok(p.rope.points[0].equals(p.anchor));
}
assert.equal(p.state,'flying');assert.ok(p.rope.contactEdge<0,'Free flight cannot invent a snag');
const cutPoint=p.rope.points[15].clone();p.rope.breakAt(14,1);p.rope.moveAnchor(v(.5,1.5,.3));assert.ok(p.rope.points[p.rope.broken+1].distanceTo(cutPoint)<1e-9,'The detached strand is not pulled to the hand');
console.log('PASS: one physical/visible hand anchor, no airborne teleport, exact WebGL and Canvas vertices, no third-node elbow, moving-hand strong-wind flight and independent cut strand.');
