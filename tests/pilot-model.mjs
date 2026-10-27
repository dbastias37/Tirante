import assert from 'node:assert/strict';
import {PilotModel} from '../game/pilot-model.js';
import {pilotFaces,rasterPilot} from '../game/pilot-canvas.js';
import {pilotFocusTarget} from '../game/duel-camera.js';
import {KitePhysics} from '../game/physics.js';
import {PerspectiveCamera,Vector3,Box3} from '../game/vendor/three.module.js';

for(let i=0;i<3;i++){
 const p=new KitePhysics(),m=new PilotModel(i);p.launch();p.anchor.set(i*18,1.35,0);p.position.set(i*18+4,18,-15);m.update(p,1);
 const count=m.parts.reduce((sum,p)=>sum+p.geometry.index.count/3,0);assert.ok(count<13000,'Bounded fitted clothes and shoes, not the full editor scene');
 const bounds=new Box3().setFromObject(m.group);assert.ok(bounds.min.y>=-.001&&bounds.max.y<1.95);assert.ok(bounds.max.y-bounds.min.y>1.6);
 const actual=m.outlet.getWorldPosition(new Vector3());assert.ok(actual.distanceTo(p.anchor)<1e-8,'The visible reel outlet is the actual rope anchor');
 for(const part of m.parts){assert.ok([...part.geometry.attributes.position.array].every(Number.isFinite));assert.ok([...part.geometry.attributes.normal.array].every(Number.isFinite));}
 const shoulder=m.arms[1].upper.position.clone(),hand=m.arms[0].palm.position.clone();p.setControls('reel',true);m.update(p,1.1);assert.ok(m.spool.rotation.x!==0);assert.ok(m.arms[0].palm.position.distanceTo(hand)>.001);
 const spin=m.spool.rotation.x,cloth=m.garment.mesh.geometry.attributes.position.array.slice();m.update(p,1.1);assert.equal(m.spool.rotation.x,spin,'Pausing cannot advance animation');assert.deepEqual(m.garment.mesh.geometry.attributes.position.array,cloth,'Clothing stops with simulation time');
 p.lastTug=1.1;m.update(p,1.2);assert.ok(m.arms[1].upper.position.distanceTo(shoulder)>.001,'Tug shifts the upper body');
 const before=m.legs[0].shoe.position.clone();p.anchor.x+=.08;m.update(p,1.3);assert.ok(m.legs[0].shoe.position.distanceTo(before)>.001,'Footwork follows real movement');
 p.eliminated=true;p.state='cut';m.update(p,1.4);assert.ok(m.arms[0].palm.position.y<1.1,'Elimination relaxes the free arm');assert.ok(m.outlet.getWorldPosition(new Vector3()).distanceTo(p.anchor)<1e-8);
 m.setDetail(1);m.update(p,1.4);const distant=m.parts.reduce((sum,p)=>sum+p.geometry.index.count/3,0);assert.ok(distant<6000&&distant<count*.55,'Distant pilots use the fitted low detail clothes, shoes and face');m.setDetail(0);m.update(p,1.4);
 const camera=new PerspectiveCamera(45,2/3,.1,100);camera.position.copy(p.anchor).add(new Vector3(2,.2,-3));camera.lookAt(p.anchor.clone().setY(.9));camera.updateMatrixWorld();
 const view=pilotFaces(m,camera,300,450),target={width:128,height:192,data:new Uint8ClampedArray(128*192*4),depth:new Float32Array(128*192)};rasterPilot(view,target);
 assert.ok(target.data.filter((v,i)=>i%4===3&&v===255).length>4000,'The fallback renders the actual clothed mesh');
 const first=target.data.slice();view.faces.reverse();rasterPilot(view,target);let changed=0;for(let j=0;j<first.length;j++)if(first[j]!==target.data[j])changed++;assert.ok(changed<first.length*.003,'Depth testing resolves the arms, reel and body independent of face order');
 assert.ok(pilotFocusTarget({visible:true,rivals:[p]},0).distanceTo(p.anchor.clone().setY(.95))<1e-9);assert.equal(pilotFocusTarget({visible:false,rivals:[p]},0),null);
}
console.log('PASS: clothed articulated pilots, bounded geometry, exact reel anchor, reel/tug/walk/elimination poses, paused animation and depth-tested Canvas parity.');
