import assert from 'node:assert/strict';
import {KitePhysics} from '../game/physics.js';
import {Vector3,PerspectiveCamera} from '../game/vendor/three.module.js';
import {ROPE_DRAW_SEGMENTS} from '../game/rope.js';
import {foregroundLine,canvasReelOutlet} from '../game/reel-view.js';
import {displayStrands,LOOSE_SUBDIVISIONS} from '../game/rope-view.js';
const dt=1/240;
// Compressed loose links must never push themselves back into rigid rods.
const p=new KitePhysics();p.launch();p.cutLine(12,.4);const r=p.rope;r.dt=dt;
for(let i=1;i<r.points.length-1;i++)r.points[i].copy(p.anchor).add(new Vector3(i*.001,0,0));
const before=r.points[5].distanceTo(r.points[6]);r.lambda.fill(0);r.solve(1);assert.ok(r.points[5].distanceTo(r.points[6])<=before+1e-9);
for(const capacity of [30,150,274.32,914.4]){
 const p=new KitePhysics();p.lineCapacity=capacity;p.launch();p.lineLength=capacity;p.position.set(capacity*.4,10,-capacity*.5);p.rope.reset();const r=p.rope,point=r.points[12].clone().lerp(r.points[13],.4),total=r.rest.reduce((a,b)=>a+b,0);p.cutLine(12,.4);
 assert.ok(r.points.length<=ROPE_DRAW_SEGMENTS+1);assert.ok(r.points.length>31);assert.ok(r.breakPoint.distanceTo(point)<1e-9);assert.ok(r.points[r.broken].distanceTo(point)<1e-9);assert.ok(r.points[r.broken+1].distanceTo(point)<1e-9);assert.ok(Math.abs(r.rest.reduce((a,b)=>a+b,0)-total)<1e-8);
 for(let n=0;n<240*8;n++)p.step(dt);
 assert.ok(r.points.every(q=>Number.isFinite(q.length())));assert.ok(r.points.slice(1,-1).every(q=>q.y>=.035-1e-9));assert.ok(r.points[r.broken].distanceTo(r.points[r.broken+1])>.1);
 const drawn=displayStrands(r);assert.ok(drawn.points.length<=ROPE_DRAW_SEGMENTS*LOOSE_SUBDIVISIONS+2);assert.ok(drawn.points[drawn.broken].distanceTo(r.points[r.broken])<1e-9);assert.ok(drawn.points[drawn.broken+1].equals(r.points[r.broken+1]));assert.ok(drawn.points.at(-1).distanceTo(r.points.at(-1))<1e-9);assert.ok(drawn.points.every(q=>Number.isFinite(q.length())));
}
for(const [w,h]of[[1920,1080],[977,928],[390,844]])for(const altitude of [3,10,30]){
 const p=new KitePhysics();p.launch();p.lineLength=altitude+8;p.position.set(0,altitude,-8);p.rope.reset();
 const camera=new PerspectiveCamera(54,w/h,.15,4000);camera.position.set(0,1.72,1.1);camera.lookAt(p.position);camera.updateProjectionMatrix();camera.updateMatrixWorld();
 const raw=p.rope.points.map(q=>q.clone()),outlet=canvasReelOutlet(w,h),points=foregroundLine(p.rope,camera,w,h,outlet),project=q=>{const n=q.clone().project(camera);return {x:(n.x*.5+.5)*w,y:(.5-n.y*.5)*h,z:n.z};};
 const start=project(points[0]);assert.ok(Math.hypot(start.x-outlet.x,start.y-outlet.y)<1e-6);assert.ok(raw.every((q,i)=>q.equals(p.rope.points[i])));assert.ok(points.at(-1).equals(raw.at(-1)));
 let join=1;while(join<points.length-1&&!points[join].equals(raw[join]))join++;let priorY=outlet.y;
 for(let i=0;i<=join;i++){const q=project(points[i]);assert.ok(q.z>-1&&q.z<1,'Foreground stays in front of the eye');assert.ok(q.y<=priorY+1e-7,'No hook or backward exit toward the bottom of the screen');priorY=q.y;}
 for(let i=1;i<join;i++){
  const a=project(points[i-1]),b=project(points[i]),c=project(points[i+1]);
  const incoming=new Vector3(b.x-a.x,b.y-a.y,0),outgoing=new Vector3(c.x-b.x,c.y-b.y,0);
  assert.ok(incoming.angleTo(outgoing)<18*Math.PI/180,'Perspective must not leave an elbow at the foreground join');
 }
 // A taut reference line must stay straight, rather than receive a decorative arc.
 for(let i=0;i<p.rope.points.length;i++)p.rope.points[i].copy(raw[0]).lerp(raw.at(-1),i/(raw.length-1));
 const taut=foregroundLine(p.rope,camera,w,h,outlet),a=project(taut[0]),b=project(taut.at(-1));
 for(const point of taut){const q=project(point);assert.ok(Math.abs((q.x-a.x)*(b.y-a.y)-(q.y-a.y)*(b.x-a.x))/Math.hypot(b.x-a.x,b.y-a.y)<1e-5,'Taut thread has no imposed bow');}
}
console.log('PASS: loose links do not resist compression, bounded joint count, exact independent cut tips, gravity/ground support and a monotonic reel outlet at desktop/mobile sizes.');
