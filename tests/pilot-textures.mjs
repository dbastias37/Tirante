import assert from 'node:assert/strict';
import {rasterTriangle} from '../game/software-raster.js';
import {PILOT_KIT} from '../game/pilot-kit-data.js';
import {PilotModel} from '../game/pilot-model.js';
import {KitePhysics} from '../game/physics.js';
import {pilotFaces,rasterPilot} from '../game/pilot-canvas.js';
import {PerspectiveCamera,Vector3} from '../game/vendor/three.module.js';

for(const item of [...PILOT_KIT.heads,PILOT_KIT.shoe])for(const g of item.levels){
 assert.equal(g.uv.length,g.vertices.length/3*2);
 for(let i=0;i<g.indices.length;i+=3){
  const tiles=g.indices.slice(i,i+3).map(j=>Math.floor(g.uv[j*2]*2)+Math.floor((1-g.uv[j*2+1])*2)*2);
  assert.ok(tiles.every(t=>t===tiles[0]),'A reduced triangle cannot bridge unrelated atlas materials');
 }
}
const target=()=>({width:8,height:8,data:new Uint8ClampedArray(256),depth:new Float32Array(64).fill(Infinity)});
const texture={width:2,height:2,data:new Uint8ClampedArray([255,0,0,255,0,255,0,255,0,0,255,255,255,255,255,0])};
const a={x:0,y:0,z:.2,u:0,v:1,w:1},b={x:8,y:0,z:.2,u:1,v:1,w:1},c={x:0,y:8,z:.2,u:0,v:0,w:1};
let t=target();rasterTriangle(t,a,b,c,[255,255,255],[255,255,255],[255,255,255],texture);
const rgb=(x,y)=>Array.from(t.data.slice((y*8+x)*4,(y*8+x)*4+3));
assert.deepEqual(rgb(0,0),[255,0,0]);assert.deepEqual(rgb(6,0),[0,255,0]);assert.deepEqual(rgb(0,6),[0,0,255],'V orientation agrees with the WebGL texture');
t=target();rasterTriangle(t,a,{...b,w:.1},c,[255,255,255],[255,255,255],[255,255,255],texture);assert.deepEqual(rgb(6,0),[255,0,0],'Oblique faces use perspective-correct UV interpolation');
t=target();const transparent={width:1,height:1,data:new Uint8ClampedArray([255,255,255,0])};rasterTriangle(t,a,b,c,[255,255,255],null,null,transparent);assert.ok(t.depth.every(x=>x===Infinity),'Cutout hair pixels do not hide the skin behind them');rasterTriangle(t,{...a,z:.5},{...b,z:.5},{...c,z:.5},[30,50,70]);assert.deepEqual(rgb(1,1),[30,50,70]);
// The same model must remain visible before its asynchronous image finishes,
// after pixels arrive and after an LOD change; the geometry is shared.
const p=new KitePhysics(),m=new PilotModel(1);p.launch();m.update(p,0);const camera=new PerspectiveCamera(45,1,.1,100);camera.position.copy(m.group.position).add(new Vector3(0,1.7,-.6));camera.lookAt(m.head.getWorldPosition(new Vector3()).add(new Vector3(0,.12,0)));camera.updateMatrixWorld();
const buffer={width:128,height:192,data:new Uint8ClampedArray(128*192*4),depth:new Float32Array(128*192)};
for(const level of [0,1]){
 m.setDetail(level);m.update(p,.1);m.face.material.vertexColors=true;delete m.face.material.userData.pixels;rasterPilot(pilotFaces(m,camera,200,300),buffer);assert.ok(buffer.data.some(x=>x));
 m.face.material.userData.pixels=texture;m.face.material.vertexColors=false;const view=pilotFaces(m,camera,200,300);assert.ok(view.faces.some(f=>f.texture===texture));rasterPilot(view,buffer);assert.ok(buffer.data.some(x=>x));
}
console.log('PASS: atlas isolation, UV orientation, perspective interpolation, alpha/depth, asynchronous texture fallback and both mesh detail levels.');
