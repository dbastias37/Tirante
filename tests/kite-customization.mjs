import assert from 'node:assert/strict';
import {KitePhysics,DEFAULT_SETUP,configuration} from '../game/physics.js';
import {bridleAnchors,bowHeight,sailZ,SPAR_OFFSET,BRIDLE_OFFSET} from '../game/kite-shape.js';
import {PaperKite} from '../game/scene.js';
import {appearance} from '../game/appearance.js';
import {cleanSetup,createMatch,packMatch,unpackMatch} from '../server/online-match.js';
import {LightTrail} from '../game/trail.js';
import {PartyCommission} from '../game/party.js';
const dt=1/240,near=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);
function flown(left,right,seconds=12){const p=new KitePhysics({...DEFAULT_SETUP,anchorLeft:left,anchorRight:right});p.launch();for(let n=0;n<seconds/dt;n++)p.step(dt);return p;}
const central=flown(0,0),normal=flown(55,55),wide=flown(90,90);
for(const p of [central,normal,wide]){assert.equal(p.state,'flying');assert.ok(p.position.y>7);assert.ok(Math.abs(p.position.x)<.1);assert.equal(p.trim.bias,0);}
assert.ok(wide.trim.stability>normal.trim.stability&&normal.trim.stability>central.trim.stability);
for(const p of [central,normal,wide]){p.setControls('release');for(let n=0;n<240;n++)p.step(dt);}
assert.ok(central.spin>normal.spin*1.2&&normal.spin>wide.spin*1.2,'Center mounts turn faster under identical payout, yet hold a stable flight');
const left=flown(55,15,3),right=flown(15,55,3);
assert.ok(left.heading<-.4&&right.heading>.4&&left.position.x<-2&&right.position.x>2,'Mirroring unequal mount positions reverses the physical turn');
const balanced=configuration({...DEFAULT_SETUP,anchorLeft:35,anchorRight:35});assert.equal(balanced.bias,0);
near(configuration({...DEFAULT_SETUP,anchorLeft:55,anchorRight:15,knotsRight:4}).bias,0);

// Test actual WebGL geometry, including deformed sail, rather than source strings.
const visual=new PaperKite();
for(const [l,r] of [[0,0],[95,95],[10,85]]){
 const setup={...DEFAULT_SETUP,anchorLeft:l,anchorRight:r,knotsLeft:2,knotsRight:1,knotsLower:1};visual.configure(setup);
 for(const [time,bend,wind] of [[0,0,0],[1.4,.75,9],[4,1,12]]){
  visual.animate(time,bend,wind);
  const anchors=bridleAnchors(setup,time,bend,wind);
  for(const spar of [visual.spine,visual.bow]){const p=spar.geometry.attributes.position;for(let i=0;i<p.count;i++){near(p.getZ(i)-sailZ(p.getX(i),p.getY(i),time,bend,wind),SPAR_OFFSET);assert.ok(SPAR_OFFSET<0);}}
  visual.strings.forEach((s,i)=>{const p=s.geometry.attributes.position;near(p.getX(0),anchors[i][0]);near(p.getY(0),anchors[i][1]);near(p.getZ(0)-sailZ(p.getX(0),p.getY(0),time,bend,wind),BRIDLE_OFFSET);assert.ok(p.getZ(1)>0);if(i<2)near(p.getY(0),bowHeight(p.getX(0)));});
  for(const knot of visual.knots.children){const a=anchors[knot.userData.anchor],t=knot.userData.t;near(knot.position.x,a[0]+(visual.junction.x-a[0])*t);near(knot.position.z,a[2]+(visual.junction.z-a[2])*t);}
 }
}
for(const panel of visual.panels){const p=panel.geometry.attributes.position,uv=panel.geometry.attributes.uv;assert.equal(uv.count,p.count);for(let i=0;i<uv.count;i++){near(uv.getX(i),(p.getX(i)+.4)/.8);near(uv.getY(i),(p.getY(i)+.4)/.8);}}
visual.configure({...DEFAULT_SETUP,sailStyle:'solid',paperColor:'#123456'});assert.ok(visual.materials.every(m=>m.color.getHexString()==='123456'));

const custom={...DEFAULT_SETUP,anchorLeft:25,anchorRight:70,sailStyle:'image',paperColor:'#aabbcc',color:'sky',printId:'ab'.repeat(32),imageFit:'contain',imageScale:1.5};
const normalized=cleanSetup(custom);assert.deepEqual(normalized,custom);assert.equal(cleanSetup({}).anchorLeft,55);
assert.deepEqual(appearance(null),appearance());assert.equal(cleanSetup(null).anchorLeft,55);
const unsafe=cleanSetup({anchorLeft:-30,anchorRight:Infinity,printId:'https://untrusted.example/p.png',paperColor:'url(x)',sailStyle:'x',imageScale:999});assert.equal(unsafe.anchorLeft,0);assert.equal(unsafe.anchorRight,55);assert.equal(unsafe.printId,'');assert.equal(unsafe.paperColor,null);assert.equal(unsafe.imageScale,2.5);
const match=createMatch({players:[{setup:normalized},{setup:{...DEFAULT_SETUP}}],settings:{profile:'breeze',wind:5.5,capacity:65}}),restored=unpackMatch(JSON.parse(JSON.stringify(packMatch(match))));
assert.deepEqual(restored.player.setup,normalized);assert.equal(restored.player.trim.bias,configuration(custom).bias);assert.ok(JSON.stringify(normalized).length<800,'Image bytes are absent from multiplayer setup');
const player=new KitePhysics(custom),trail=new LightTrail(player);trail.start();assert.deepEqual(appearance(player.setup),appearance(custom));assert.equal(player.setup.anchorLeft,55);trail.stop();assert.deepEqual(player.setup,custom);
const party=new PartyCommission(player);party.startParty(3);assert.deepEqual(player.setup,custom);assert.ok(party.rivals.every(p=>p.setup.sailStyle==='classic'&&!p.setup.printId));party.stop();
console.log('PASS: stable symmetric mounts, faster centered turns, directional imbalance, compensating knots, rear spars/front bridles under flex, knot attachment, continuous UVs, solid colors, online setup roundtrip, Party and trail appearance.');
