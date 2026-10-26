import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {KitePhysics,DEFAULT_SETUP} from '../game/physics.js';
import {LINE_CAPACITIES,MAX_LINE_CAPACITY,cleanHeightRecord} from '../game/line-config.js';
import {solveRopeSystem} from '../game/rope-system.js';
import {PaperKite} from '../game/scene.js';
import {foregroundLine,reelViewport} from '../game/reel-view.js';
import {Vector3,PerspectiveCamera} from '../game/vendor/three.module.js';
import {createMatch,packMatch,unpackMatch} from '../server/online-match.js';
import {CAMERA_FAR,FOG_NEAR,FIELD_SIZE,terrainHeight} from '../game/render-settings.js';
import {distanceText} from '../game/units.js';
const dt=1/240;
let peak=0,excursion=0;
// Before this fix, 22 g/no tail/12 m/s reached 420 m/s before one second.
// Vary wind phase too: a new game starts at whichever time the menu is left.
for(const mass of [22,34,70])for(const tail of [true,false])for(const wind of [5.5,7,9,12])for(const phase of [0,7,23]){
 const p=new KitePhysics({...DEFAULT_SETUP,mass,tail});p.profile='gusts';p.windSpeed=wind;p.lineCapacity=150;p.time=phase;p.launch();
 for(let n=0;n<240*20;n++){
  const t=n*dt;p.setControls(t<2?'hold':t<7?'release':t<9?'reel':t<15?'release':'hold',true);if(n%187===0&&n>500)p.tug(true);p.step(dt);
  const speed=p.velocity.length(),distance=p.position.distanceTo(p.anchor);peak=Math.max(peak,speed);if(p.state==='flying')excursion=Math.max(excursion,distance-p.lineLength);
  assert.ok(Number.isFinite(speed+distance+p.tension+p.orientation.length()),'Finite flight during repeated payout/catch/tugs');assert.ok(speed<40,'No explosive numerical velocity');
  if(p.state==='flying')assert.ok(distance<p.lineLength+4,'The elastic tether remains bounded');
 }
}
// Exercise the actual local sequence, including continuous self-contact.
for(const capacity of [150,274.32,914.4]){
 const p=new KitePhysics();p.profile='gusts';p.windSpeed=9;p.setLineCapacity(capacity);p.launch();let worst=0;
 for(let n=0;n<240*12;n++){p.setControls(n<480?'hold':n%720<480?'release':'reel',true);const before=p.position.clone();p.step(dt);solveRopeSystem([p.rope],dt);worst=Math.max(worst,before.distanceTo(p.position));assert.ok(p.rope.points.every(q=>Number.isFinite(q.length())));}
 assert.ok(worst<.25,'Payout does not teleport the kite');
 // The far end of a long reel remains destructible, rather than silently
 // ignoring wear beyond the old 150 m array.
 p.reset();p.lineLength=capacity;p.position.set(0,capacity*.7,-capacity*.7);p.rope.reset();const patch=p.rope.materialAt(0,.5);assert.ok(patch>capacity*.95);p.rope.abrade(0,.5,.8);assert.ok(p.rope.wearAt(0,.5)>0);
}
for(const capacity of [274.32,914.4]){
 const p=new KitePhysics();assert.equal(p.setLineCapacity(capacity),true);p.launch();p.lineLength=capacity-.05;p.position.set(0,capacity*.7,-capacity*.7);p.velocity.set(0,0,0);p.rope.reset();p.setControls('release',true);
 for(let i=0;i<240;i++)p.step(dt);assert.equal(p.lineLength,capacity);assert.ok(p.position.distanceTo(p.anchor)<capacity+4);assert.ok(p.rope.points.every(q=>Number.isFinite(q.length())));
 const room={code:'ABCDEFGH',round:1,settings:{capacity,profile:'breeze',wind:7},players:[{setup:{...DEFAULT_SETUP,anchorLeft:10,anchorRight:95}},{setup:DEFAULT_SETUP}]},match=createMatch(room),stored=unpackMatch(packMatch(match));
 assert.equal(stored.player.lineCapacity,capacity);assert.equal(stored.rival.lineCapacity,capacity);assert.ok(stored.player.rope.wear.length*0.125>MAX_LINE_CAPACITY);
}
assert.equal(distanceText(274.32),'300,0 yd (274,3 m)');assert.equal(distanceText(914.4),'1000,0 yd (914,4 m)');
const html=await readFile(new URL('../game/index.html',import.meta.url),'utf8');
for(const id of ['prep-capacity','line-capacity','online-capacity']){const select=html.match(new RegExp(`<select[^>]*id="${id}"[^>]*>(.*?)</select>`,'s'))[1];assert.deepEqual([...select.matchAll(/value="([\d.]+)"/g)].map(m=>Number(m[1])),LINE_CAPACITIES,`${id} offers every reel`);}
assert.equal(cleanHeightRecord(2.609617702473091e58),0);assert.equal(cleanHeightRecord(Infinity),0);assert.equal(cleanHeightRecord(55),55);assert.equal(cleanHeightRecord(914),914);
assert.ok(FIELD_SIZE/2>MAX_LINE_CAPACITY);assert.ok(CAMERA_FAR>MAX_LINE_CAPACITY*3&&FOG_NEAR>MAX_LINE_CAPACITY);assert.equal(terrainHeight(MAX_LINE_CAPACITY,0),0);
// One shared knot in physics and rendering, including unequal mounts and knots.
for(const anchors of [[0,95],[95,0],[30,30],[55,80]]){
 const p=new KitePhysics({...DEFAULT_SETUP,anchorLeft:anchors[0],anchorRight:anchors[1],knotsLeft:2,knotsRight:4,lower:57});p.launch();p.heading=1.3;p.updateAttitude(new Vector3(.2,0,-1).normalize());p.rope.pin();
 const kite=new PaperKite();kite.configure(p.setup);kite.group.position.copy(p.position);kite.group.quaternion.copy(p.orientation);kite.group.updateMatrixWorld();const joint=kite.group.localToWorld(kite.junction.clone());assert.ok(joint.distanceTo(p.rope.points.at(-1))<1e-10,'Main line meets the common three-bridle knot');
 for(const string of kite.strings){const end=new Vector3().fromBufferAttribute(string.geometry.attributes.position,1);assert.ok(end.distanceTo(kite.junction)<1e-7);}
 // The first-person representation may blend only near the reel; the kite and
 // cut free strand stay on their physical points, in any camera direction.
 const camera=new PerspectiveCamera(54,16/9,.15,4000);camera.position.set(0,1.72,1.1);camera.lookAt(p.position);const raw=p.rope.points.map(q=>q.clone()),outlet={x:900,y:850},drawn=foregroundLine(p.rope,camera,1000,900,outlet);
 const projected=drawn[0].clone().project(camera);assert.ok(Math.abs((projected.x*.5+.5)*1000-outlet.x)<1e-7);assert.ok(Math.abs((.5-projected.y*.5)*900-outlet.y)<1e-7);assert.ok(drawn.at(-1).distanceTo(joint)<1e-10);assert.ok(raw.every((q,i)=>q.equals(p.rope.points[i])));
 p.cutLine(5,.5);const cut=foregroundLine(p.rope,camera,1000,900,outlet);for(let i=p.rope.broken+1;i<cut.length;i++)assert.ok(cut[i].equals(p.rope.points[i]),'Presentation cannot reconnect a cut');
}
console.log(`PASS: 72 payout/catch cases, peak ${peak.toFixed(2)} m/s, max stretch ${excursion.toFixed(2)} m; 300/1000 yd wear, full-length stability, exact bridle junction, foreground connection and corrupted-record recovery.`);
