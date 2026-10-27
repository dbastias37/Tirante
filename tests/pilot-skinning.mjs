import assert from 'node:assert/strict';
import {Matrix4,Vector3} from '../game/vendor/three.module.js';
import {VolumeSkinning} from '../game/pilot-skinning.js';
const skin=new VolumeSkinning(2),rest=new Float64Array([.7,.2,-.4]),out=new Float64Array(3),bones=new Uint8Array([0,1,0]),weights=new Float32Array([1,0,0]);
const matrix=new Matrix4().makeRotationZ(.9);matrix.setPosition(.5,-.2,.8);skin.setBone(0,matrix);skin.setBone(1,new Matrix4());skin.deform(rest,bones,weights,out);const expected=new Vector3().fromArray(rest).applyMatrix4(matrix);assert.ok(new Vector3().fromArray(out).distanceTo(expected)<1e-12,'One bone remains an exact rigid transform');
// A half-turn matrix blend collapses this ring. Rotation blending must retain
// its radius and circumference, including quaternion sign changes at 180°.
skin.setBone(0,new Matrix4());skin.setBone(1,new Matrix4().makeRotationY(Math.PI));weights.set([.5,.5,0]);
const points=[];
for(let i=0;i<24;i++){
 const a=i/24*Math.PI*2;rest.set([Math.cos(a)*.06,.4,Math.sin(a)*.06]);skin.deform(rest,bones,weights,out);assert.ok(Math.abs(Math.hypot(out[0],out[2])-.06)<1e-12,'A bent/twisted sleeve keeps its cross-section');points.push(new Vector3().fromArray(out));
}
for(let i=0;i<24;i++)assert.ok(Math.abs(points[i].distanceTo(points[(i+1)%24])-2*.06*Math.sin(Math.PI/24))<1e-12);
skin.setBone(0,new Matrix4().makeRotationY(Math.PI-.01));skin.setBone(1,new Matrix4().makeRotationY(Math.PI+.01));rest.set([1,0,0]);skin.deform(rest,bones,weights,out);assert.ok(out[0]<-.99999&&Math.abs(out[2])<1e-10,'Crossing the quaternion sign boundary cannot flip the sleeve');
console.log('PASS: exact rigid transform, sleeve radius/circumference through a half-turn and quaternion sign continuity.');
