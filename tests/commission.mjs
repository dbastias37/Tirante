import assert from 'node:assert/strict';
import {Vector3} from '../game/vendor/three.module.js';
import {KitePhysics,LINE_CAPACITIES} from '../game/physics.js';
import {climbControls,DUEL_SECONDS} from '../game/battle-rules.js';
import {Commission,closestSegments,lineContact} from '../game/commission.js';
const dt=1/240;
const step=(p,seconds)=>{for(let i=0;i<seconds/dt;i++){p.step(dt);assert.ok(Number.isFinite(p.position.length()+p.energy+p.tension));assert.ok(p.energy>=0&&p.energy<=100);}};
for(const cap of LINE_CAPACITIES){const p=new KitePhysics();assert.ok(p.setLineCapacity(cap));p.launch();assert.equal(p.lineCapacity,cap);p.lineLength=cap-.1;p.setControls('release',true);step(p,.25);assert.equal(p.lineLength,cap);assert.equal(p.lineRemaining,0);}
const smaller=new KitePhysics();smaller.lineLength=40;assert.equal(smaller.setLineCapacity(30),false);assert.equal(smaller.lineLength,40);assert.equal(smaller.lineCapacity,65);
const stamina=new KitePhysics();stamina.launch();step(stamina,5);stamina.setControls('reel',true);const e0=stamina.energy;step(stamina,.6);assert.ok(stamina.energy<e0-10,'Boost spends energy');stamina.setControls('hold');step(stamina,3);assert.equal(stamina.energy,100,'Rest restores energy');
stamina.energy=0;stamina.setControls('release',true);step(stamina,.1);assert.equal(stamina.boost,false);assert.equal(stamina.exhausted,true);assert.equal(stamina.tug(true),false,'No free double pull on empty energy');stamina.setControls('hold');step(stamina,4);stamina.setControls('reel',true);assert.equal(stamina.exhausted,false);assert.equal(stamina.boost,true,'Boost returns after recovery');
const pull=new KitePhysics();pull.launch();pull.energy=13;assert.equal(pull.tug(true),false);assert.equal(pull.tug(),true);assert.equal(pull.energy,6);
for(const profile of ['breeze','strong','gusts']){const p=new KitePhysics();p.windSpeed=12;p.profile=profile;p.lineCapacity=150;p.launch();step(p,40);assert.ok(p.position.length()<200,'Maximum wind remains bounded');}
const vec=(x,y,z)=>new Vector3(x,y,z);
const cross=closestSegments(vec(-1,5,0),vec(1,5,0),vec(0,4,0),vec(0,6,0));assert.ok(cross.distance<1e-8);
const depth=closestSegments(vec(-1,5,0),vec(1,5,0),vec(0,4,2),vec(0,6,2));assert.ok(Math.abs(depth.distance-2)<1e-8,'Apparent screen crossings at different depths do not touch');
function match(style='idle',difficulty='normal',wind=5.5){const p=new KitePhysics(),d=new Commission(p);p.windSpeed=wind;d.start(difficulty);for(let i=0;i<240*(DUEL_SECONDS+9)&&d.active;i++){if(d.state==='playing'&&!p.eliminated){if(p.lineLength<32)climbControls(p,p.flightTime);else {p.setControls('hold');p.sawing=style==='saw';}}p.step(dt);d.step(dt);d.sawReversalsSeen=Math.max(d.sawReversalsSeen||0,d.reversals);assert.ok(Number.isFinite(p.position.length()+d.rival.position.length()));assert.ok(d.playerHealth>=0&&d.rivalHealth>=0);}assert.equal(d.state,'finished');assert.ok(d.engagements>0,'NPC finds physical rope contact');return d;}
const idle=match(),counter=match('saw'),hard=match('idle','hard'),strong=match('saw','normal',9);
assert.ok([idle,counter,hard,strong].every(d=>['win','loss','draw'].includes(d.result.outcome)));assert.ok(counter.sawReversalsSeen>0,'Auto-saw performs actual reversals after an airborne crossing');
counter.rival.cutLine(12,.5);
const before=counter.rival.rope.points.map(p=>p.clone());for(let i=0;i<120;i++){counter.player.step(dt);counter.step(dt);}assert.ok(counter.rival.rope.points.some((p,i)=>p.distanceTo(before[i])>.1),'Broken rope keeps simulating after the round');
const restart=new Commission(new KitePhysics());restart.start();restart.playerHealth=10;restart.rivalHealth=20;restart.finish('win','test');restart.start();assert.equal(restart.playerHealth,100);assert.equal(restart.rivalHealth,100);assert.equal(restart.result,null);assert.equal(restart.remaining,DUEL_SECONDS);assert.equal(restart.player.energy,100);assert.equal(restart.rival.energy,100);restart.stop();assert.equal(restart.visible,false);
const absent=new Commission(new KitePhysics());absent.start();absent.state='playing';absent.rival.anchor.x=60;absent.rival.position.x=60;for(let i=0;i<240;i++){absent.player.tug(true);absent.player.step(dt);absent.step(dt);}assert.equal(absent.rivalHealth,100,'Tugs cannot damage a distant rival');
console.log('PASS: all reel capacities, no truncation of deployed line, stamina cost/recovery/exhaustion, paid double pull, maximum wind, 3D depth, reachable NPC contacts and actual sawing strokes, difficulty, stronger-wind duel, animated cut, rematch reset, no remote damage.');
