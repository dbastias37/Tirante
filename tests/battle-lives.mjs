import assert from 'node:assert/strict';
import {KitePhysics} from '../game/physics.js';
import {PartyCommission,cleanPartyOptions} from '../game/party.js';
import {Commission} from '../game/commission.js';
import {LIFE_OPTIONS,PILOT_SPACING,LAUNCH_SECONDS,RESPAWN_SECONDS} from '../game/battle-rules.js';
import {createMatch,packMatch,unpackMatch,snapshot} from '../server/online-match.js';
const dt=1/240;
const tick=(d,seconds)=>{for(let n=0;n<seconds/dt;n++){d.player.step(dt);d.step(dt);}};
for(const lives of LIFE_OPTIONS){
 const d=new PartyCommission(new KitePhysics());d.startParty(3,'normal',{lives,rules:'last-man'});
 assert.ok(d.roster.every(e=>e.lives===lives));
 for(let i=0;i<4;i++)for(let j=i+1;j<4;j++)assert.ok(d.roster[i].pilot.anchor.distanceTo(d.roster[j].pilot.anchor)>=PILOT_SPACING);
 tick(d,LAUNCH_SECONDS+.02);assert.equal(d.state,'playing');assert.equal(d.engagements,0);assert.ok(d.roster.every(e=>e.lives===lives));
 const p=d.player;p.cutLine(12,.4);tick(d,dt);assert.equal(p.lives,lives-1);assert.equal(d.spectating,true);assert.equal(d.result,null);
 tick(d,RESPAWN_SECONDS-.1);assert.equal(p.lives,lives-1,'A fallen kite cannot consume another life every frame');assert.equal(p.eliminated,true);
 tick(d,.12);assert.equal(p.state,'flying');assert.equal(p.eliminated,false);assert.equal(p.rope.broken,-1);assert.equal(p.rope.integrity,100);assert.equal(p.lives,lives-1);assert.equal(p.lifeSerial,2);assert.equal(d.spectating,false);
 // Every participant temporarily down still has a future launch.
 d.roster.forEach(e=>d.eliminate(e,'En tierra'));d.checkOutcome();assert.equal(d.result,null,'Pending launches count toward contention');
 d.elapsed=900;d.remaining=0;d.checkOutcome();assert.equal(d.result,null,'Last man standing has no timer victory');
 // Exhaust reserves, rather than treating the first cut as final elimination.
 d.roster.forEach((e,i)=>{e.pilot.lives=i===2?1:0;e.alive=i===2;});d.checkOutcome();assert.equal(d.result.winner,d.roster[2].name);assert.equal(d.result.outcome,'loss');
}
assert.equal(cleanPartyOptions({rules:'last-man',lives:999}).lives,3);assert.equal(cleanPartyOptions({rules:'last-man',lives:'5'}).lives,5);assert.equal(cleanPartyOptions({rules:'timed',lives:10}).lives,3);
const timed=new PartyCommission(new KitePhysics());timed.startParty(2);timed.state='playing';timed.remaining=0;timed.player.lives=2;timed.rivals[0].lives=3;timed.rivals[0].rope.integrity=2;timed.rivals[1].lives=1;timed.checkOutcome();assert.equal(timed.result.winner,timed.roster[1].name,'Lives rank before line condition');
const duel=new Commission(new KitePhysics());duel.start();duel.state='playing';duel.controlRival=()=>{};
for(let loss=1;loss<=3;loss++){duel.player.state='grounded';tick(duel,dt);assert.equal(duel.player.lives,3-loss);if(loss<3){assert.equal(duel.result,null);tick(duel,RESPAWN_SECONDS+.02);assert.equal(duel.player.state,'flying');}else assert.equal(duel.result.outcome,'loss');}
const room={code:'LIVES123',round:1,settings:{capacity:914.4,profile:'breeze',wind:5.5},players:[{setup:{},seq:0},{setup:{},seq:0}]};
const online=createMatch(room);online.state='playing';online.player.cutLine(10,.3);tick(online,dt);const restored=unpackMatch(packMatch(online));assert.equal(restored.player.lives,2);assert.equal(restored.player.respawnAt,online.player.respawnAt);assert.equal(restored.player.eliminated,true);
tick(online,RESPAWN_SECONDS+.1);tick(restored,RESPAWN_SECONDS+.1);assert.equal(restored.player.lifeSerial,2);assert.ok(restored.player.position.distanceTo(online.player.position)<1e-9);assert.equal(restored.player.lives,2);room.match=packMatch(restored);assert.deepEqual(snapshot(room,0,0).match,snapshot(room,1,0).match);
console.log('PASS: 24 m spacing, 3/5/10 lives, one loss per fall/cut, 6 s respawn, no early victory, timed/lms rules, spectator return and online persistence.');
