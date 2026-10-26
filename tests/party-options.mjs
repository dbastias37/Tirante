import assert from 'node:assert/strict';
import {KitePhysics} from '../game/physics.js';
import {PartyCommission,cleanPartyOptions,escapeHTML} from '../game/party.js';
import {Commission} from '../game/commission.js';
import {solveRopeSystem} from '../game/rope-system.js';
import {PerspectiveCamera,Vector3} from '../game/vendor/three.module.js';
import {frameDuel} from '../game/duel-camera.js';
const dt=1/240;
const custom={rules:'last-man',profile:'strong',wind:9,npcs:[{name:'Luna <azul>',sailStyle:'image',printId:'ab'.repeat(32),paperColor:'#2367ab'},{name:'Sol',sailStyle:'solid',paperColor:'#bc6523'},{name:'Sur'}]};
const p=new KitePhysics(),d=new PartyCommission(p);d.startParty(3,'hard',custom);
assert.equal(d.rules,'last-man');assert.equal(d.roster[1].name,'Luna <azul>');assert.equal(d.roster[1].pilot.setup.printId,custom.npcs[0].printId);assert.equal(d.roster[2].pilot.setup.sailStyle,'solid');
assert.ok(d.roster.every(e=>e.pilot.windSpeed===9&&e.pilot.profile==='strong'));
for(let i=0;i<4;i++)for(let j=i+1;j<4;j++)assert.ok(d.roster[i].pilot.anchor.distanceTo(d.roster[j].pilot.anchor)>=6,'Six metres of initial clearance for every pair');
assert.equal(escapeHTML('<img src=x onerror="bad">'),'&lt;img src=x onerror=&quot;bad&quot;&gt;');
assert.deepEqual(cleanPartyOptions(JSON.parse(JSON.stringify(custom))),cleanPartyOptions(custom),'Saved customization round-trips');
const invalid=cleanPartyOptions({rules:'no',wind:-100,profile:'no',npcs:[{name:'\n',printId:'../../secret',sailStyle:'bad',paperColor:'red'}]});assert.equal(invalid.npcs[0].name,'Mateo');assert.equal(invalid.npcs[0].printId,'');assert.equal(invalid.wind,5.5);

// Taking the player down keeps the round alive and controls a live spectator
// target. NPCs retarget each other; the eliminated player is never selected.
d.state='playing';d.eliminate(d.roster[0],'En tierra');d.checkOutcome();assert.equal(d.spectating,true);assert.equal(d.result,null);assert.equal(d.watched.index,1);
assert.equal(d.spectateNext().index,2);d.eliminate(d.roster[2],'En tierra');assert.equal(d.watched.index,3);
for(const e of d.survivors){e.pilot.position.y=8;d.controlNPC(e,.2);assert.ok(d.roster[e.targetIndex].alive);assert.notEqual(e.targetIndex,0);assert.notEqual(e.targetIndex,e.index);}
d.remaining=0;d.elapsed=600;d.checkOutcome();assert.equal(d.state,'playing','Last man standing cannot end by timeout or score');
d.spectatorIndex=-1;const camera=new PerspectiveCamera(54,16/9,.05,1200);camera.position.set(0,2,4);p.position.set(1000,0,1000);const frame=frameDuel(camera,d);assert.ok(frame.target.length()<30,'Spectator overview excludes the eliminated player');
d.eliminate(d.roster[1],'Hilo cortado');d.checkOutcome();assert.equal(d.result.winner,'Sur');assert.equal(d.result.outcome,'loss');assert.equal(d.state,'finished');assert.equal(d.spectating,true,'The end of the round still permits watching the falling kite');
d.startParty(2,'normal',custom);assert.equal(d.result,null);assert.equal(d.spectatorIndex,-1);assert.equal(d.roster[1].name,'Luna <azul>');assert.ok(d.roster.every(e=>e.pilot.rope.broken===-1));

// The AI protects overload, manages energy, and attacks only a live opponent.
d.state='playing';d.elapsed=20;const bot=d.roster[1],enemy=d.roster[0];bot.pilot.position.y=8;bot.pilot.rope.contactAge=0;bot.pilot.rope.stressRatio=.95;bot.thinkIn=0;d.controlNPC(bot,dt);assert.equal(bot.pilot.action,'release');assert.equal(bot.pilot.sawing,false);
bot.pilot.rope.stressRatio=.3;bot.pilot.energy=10;bot.thinkIn=0;d.controlNPC(bot,dt);assert.equal(bot.pilot.action,'hold');
bot.pilot.energy=100;bot.pilot.rope.stressRatio=.3;enemy.pilot.position.copy(bot.pilot.position);enemy.pilot.rope.stressRatio=.9;bot.thinkIn=0;const pulls=bot.pilot.tugCount;d.controlNPC(bot,dt);assert.ok(bot.pilot.tugCount>pulls,'AI uses a tug when opponent is near the limit and its own strand has margin');

// Grounded strands release before collision projection and retain grounded
// state, so neither geometry nor the result falsely describes another cut.
const live=new KitePhysics(),fallen=new KitePhysics();live.launch();fallen.launch();fallen.state='grounded';fallen.rope.points.forEach((point,i)=>point.copy(live.rope.points[i]));
solveRopeSystem([live.rope,fallen.rope],dt);assert.equal(fallen.state,'grounded');assert.equal(fallen.rope.cutReason,'ground');assert.equal(fallen.rope.points.length,31);assert.equal(live.rope.broken,-1);assert.equal(live.rope._blockedMotion,0);
solveRopeSystem([live.rope,fallen.rope],dt);assert.equal(fallen.rope.points.length,31,'Cleanup fractures a fallen strand only once');
const duel=new Commission(new KitePhysics());duel.start();duel.state='playing';duel.rival.state='grounded';duel.controlRival=()=>{};duel.step(dt);assert.equal(duel.result.outcome,'win');assert.match(duel.result.reason,/tierra/);
console.log('PASS: Party names/designs/wind, saved configuration, safe names, launch spacing, survivor camera, spectator retargeting, last-man victory, AI defense/attack and grounded-strand release.');
