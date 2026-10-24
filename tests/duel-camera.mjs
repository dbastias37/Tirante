import assert from 'node:assert/strict';
import {Vector3,PerspectiveCamera} from '../game/vendor/three.module.js';
import {frameDuel,positionView,handViewOffset,PILOT_EYE} from '../game/duel-camera.js';
const v=(x,y,z)=>new Vector3(x,y,z);
for(const aspect of [1.78,1.25,390/844]){
  const camera=new PerspectiveCamera(54,aspect,.05,350);camera.position.copy(PILOT_EYE);
  for(let i=0;i<120;i++)positionView(camera,true,1/60);
  assert.ok(camera.position.z>PILOT_EYE.z+1,'The commission view retreats from the pilot');
  for(const [a,b] of [[v(-2,10,-6),v(4,11,-8)],[v(-5,8,-4),v(6,9,-6)],[v(0,.5,-4),v(3,10,-5)]]){
    const duel={player:{position:a},rival:{position:b},contact:true,contactPoint:a.clone().lerp(b,.4)};
    const f=frameDuel(camera,duel);camera.lookAt(f.target);camera.fov=f.fov;camera.updateProjectionMatrix();camera.updateMatrixWorld();
    assert.ok(f.fov>=(aspect<.8?82:74)-1e-8&&f.fov<=118);
    for(const point of [a,b,duel.contactPoint]){const screen=point.clone().project(camera);assert.ok(Math.abs(screen.x)<.84&&Math.abs(screen.y)<.48&&screen.z<1,'Both sails and their crossing stay inside the clear flight area');}
    const local=v(.29,-.255,-.57),expected=local.clone().applyQuaternion(camera.quaternion).add(PILOT_EYE);
    const visible=local.clone().add(handViewOffset(camera)).applyQuaternion(camera.quaternion).add(camera.position);
    assert.ok(visible.distanceTo(expected)<1e-9,'Camera retreat must not move the physical hand or pull the line');
  }
  for(let i=0;i<150;i++)positionView(camera,false,1/60);
  assert.ok(camera.position.distanceTo(PILOT_EYE)<1e-5,'Free flight restores the original viewpoint');
}
console.log('PASS: wider commission framing, both sails and contact inside the clear area, camera retreat independent of the rope anchor, return to first-person free flight.');
