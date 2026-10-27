import assert from 'node:assert/strict';
import {PilotModel} from '../game/pilot-model.js';
import {KitePhysics} from '../game/physics.js';
import {PILOT_KIT} from '../game/pilot-kit-data.js';
import {Vector3,PerspectiveCamera,Box3} from '../game/vendor/three.module.js';
import {pilotFaces,rasterPilot} from '../game/pilot-canvas.js';
import {rasterTriangle} from '../game/software-raster.js';

// Actual shoes have a grounded sole, original diffuse colours, left/right shape
// and a bounded silhouette at both detail levels.
for(const source of PILOT_KIT.shoe.levels){
 const x=[],y=[],z=[];for(let i=0;i<source.vertices.length;i+=3){x.push(source.vertices[i]);y.push(source.vertices[i+1]);z.push(source.vertices[i+2]);}
 assert.ok(Math.min(...y)>=0&&Math.max(...y)<.18);
 assert.ok(Math.max(...z)-Math.min(...z)>.27&&Math.max(...z)-Math.min(...z)<.29);
 assert.ok(Math.max(...x)-Math.min(...x)<.12);
 assert.ok(Math.max(...source.colors)>170&&Math.min(...source.colors)<35,'Light fabric and dark rubber remain distinct');
}
const counts=[];
for(let i=0;i<3;i++){
 const p=new KitePhysics(),m=new PilotModel(i);p.launch();p.anchor.set(i*18,1.35,0);
 assert.equal(m.garment.kind,['sweater','tee','hoodie'][i]);
 for(const level of m.garment.levels)for(let j=0;j<level.weights.length;j+=3){assert.ok(Math.abs(level.weights[j]+level.weights[j+1]+level.weights[j+2]-1)<1e-6);}
 // A free arm after elimination, reeling, strong pulls and changing heading
 // exercise the actual game rig, rather than a static asset preview.
 for(let pose=0;pose<12;pose++){
  const t=2+pose*.1;p.position.set(p.anchor.x+Math.sin(pose*.5)*25,5+pose*8,-25);p.action=pose%2?'reel':'release';p.rope.stressRatio=pose/12;p.lastTug=t-.12;p.boost=true;p.eliminated=pose===11;p.state=pose===11?'cut':'flying';
  for(const level of [0,1]){
   m.setDetail(level);m.update(p,t);
   const cloth=m.garment.levels[level],positions=cloth.geometry.attributes.position.array,normals=cloth.geometry.attributes.normal.array;
   assert.ok([...positions,...normals].every(Number.isFinite));
   for(let j=0;j<positions.length;j+=3){
    assert.ok(Math.abs(positions[j])<.7&&positions[j+1]>.86&&positions[j+1]<1.98&&Math.abs(positions[j+2])<.8,'Clothes stay on the articulated character');
    if(cloth.rest[j+1]<.98){const waist=new Vector3(cloth.rest[j],cloth.rest[j+1],cloth.rest[j+2]).applyMatrix4(m.locomotion.pelvis);assert.ok(Math.hypot(positions[j]-waist.x,positions[j+1]-waist.y,positions[j+2]-waist.z)<1e-6,'Hem remains attached to the waist through a tug');}
   }
   if(m.garment.kind==='hoodie')for(const arm of m.arms){
    const center=new Vector3();let n=0;for(let j=0;j<cloth.rest.length;j+=3)if(cloth.rest[j]*arm.s>.733){center.add(new Vector3(positions[j],positions[j+1],positions[j+2]));n++;}
    assert.ok(n>4);center.divideScalar(n);assert.ok(center.distanceTo(arm.palm.position)<.075,'Sleeve cuff follows its wrist, including the relaxed arm');
   }
   assert.ok(m.outlet.getWorldPosition(new Vector3()).distanceTo(p.anchor)<1e-8);
   const box=new Box3().setFromObject(m.group,true);assert.ok(box.min.y>=-.001&&box.max.y<1.98);
  }
 }
 // Camera distance drives LOD with hysteresis; each switch rebuilds projection
 // caches. Both versions must remain renderable with their baked colours.
 const camera=new PerspectiveCamera(45,2/3,.1,1000);camera.position.copy(p.anchor).add(new Vector3(2,.2,-3));camera.lookAt(p.anchor.clone().setY(.95));camera.updateMatrixWorld();
 m.update(p,4,camera);assert.equal(m.detail,0);
 const view=pilotFaces(m,camera,300,450),target={width:128,height:192,data:new Uint8ClampedArray(128*192*4),depth:new Float32Array(128*192)};rasterPilot(view,target);assert.ok(target.data.some(v=>v===255));
 camera.position.copy(p.anchor).add(new Vector3(0,0,20));camera.lookAt(p.anchor.clone().setY(.95));camera.updateMatrixWorld();m.update(p,4.1,camera);assert.equal(m.detail,1);rasterPilot(pilotFaces(m,camera,300,450),target);assert.ok(target.data.some(v=>v===255));
 camera.position.copy(p.anchor).add(new Vector3(0,0,9));m.update(p,4.2,camera);assert.equal(m.detail,1);camera.position.z-=2;m.update(p,4.3,camera);assert.equal(m.detail,0);
 const near=m.parts.reduce((s,p)=>s+p.geometry.index.count/3,0);m.setDetail(1);const far=m.parts.reduce((s,p)=>s+p.geometry.index.count/3,0);counts.push({pilot:i,near,far,batches:m.parts.length});
}
// Smooth vertex colours are interpolated without changing the existing depth
// behaviour used by equipment previews and the NPC fallback renderer.
const t={width:8,height:8,data:new Uint8ClampedArray(8*8*4),depth:new Float32Array(8*8)};t.depth.fill(Infinity);
const a={x:0,y:0,z:.2},b={x:8,y:0,z:.2},c={x:0,y:8,z:.2};rasterTriangle(t,a,b,c,[255,0,0],[0,255,0],[0,0,255]);
const at=(x,y)=>Array.from(t.data.slice((y*8+x)*4,(y*8+x)*4+3));assert.ok(at(0,0)[0]>at(0,0)[1]);assert.ok(at(6,0)[1]>at(6,0)[0]);assert.ok(at(0,6)[2]>at(0,6)[0]);
const pixels=t.data.slice();rasterTriangle(t,{...a,z:.5},{...b,z:.5},{...c,z:.5},[255,255,255]);assert.deepEqual(t.data,pixels);
console.log('PASS: supplied clothing, shoe colours and silhouette, 72 animated fit cases, waist/cuff anchoring, distance LOD, projection cache switches and shaded Canvas depth.',JSON.stringify(counts));
