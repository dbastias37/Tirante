import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {handleRoom} from '../server/rooms.js';
import {packMatch,unpackMatch,advance,snapshot,cleanSetup} from '../server/online-match.js';
class MemoryStore{
  rows=new Map();async limit(){return true;}async cleanup(){}
  async get(k){await Promise.resolve();return this.rows.has(k)?structuredClone(this.rows.get(k)):null;}
  async insert(r){if(this.rows.has(r.code))return false;this.rows.set(r.code,{data:JSON.stringify(r),revision:0,expires_at:r.lastTick+1800000});return true;}
  async cas(k,rev,r,now){await Promise.resolve();const row=this.rows.get(k);if(row.revision!==rev)return false;this.rows.set(k,{data:JSON.stringify(r),revision:rev+1,expires_at:now+1800000});return true;}
}
const db=new MemoryStore();let now=100000;
const a=await handleRoom(db,{op:'create',name:'Uno',settings:{wind:7}},now);
const b=await handleRoom(db,{op:'join',code:a.code,name:'Dos',setup:{color:'teal'}},now);
const commands=[a,b].map(p=>({code:p.code,token:p.token}));
assert.equal(a.code.length,8);assert.equal(b.slot,1);assert(!JSON.stringify(b.players).includes(a.token));
await assert.rejects(handleRoom(db,{op:'join',code:a.code},now),e=>e.status===409);
await assert.rejects(handleRoom(db,{op:'input',code:a.code,token:'fake'},now),e=>e.status===401);
assert.equal(cleanSetup({mass:-8,knotsLeft:99}).mass,22);
await Promise.all(commands.map(c=>handleRoom(db,{...c,op:'ready',ready:true},now)));
let seq=0;
async function tick(inputA={action:'hold'},inputB={action:'hold'},ms=100,extra={}){
  now+=ms;seq++;return Promise.all(commands.map((c,i)=>handleRoom(db,{...c,op:'input',seq,input:i?inputB:inputA,...(i?{}:extra)},now)));
}
let frames;const start=performance.now();for(let n=0;n<32;n++)frames=await tick();
assert.equal(frames[0].phase,'playing');assert.equal(frames[0].round,1);
assert(Math.abs(frames[0].match.pilots[0].body.time-3.2)<.005,'concurrent requests advance once, not twice');
assert.equal(frames[0].match.pilots[0].body.time,frames[1].match.pilots[0].body.time);
// Physical integrator can move between processes without drift.
const row=db.rows.get(a.code),room=JSON.parse(row.data),copy=structuredClone(room);
for(let n=0;n<3;n++){const t=now+n*100;room.players.forEach(p=>p.lastSeen=t);copy.players.forEach(p=>p.lastSeen=t);advance(room,t);copy.match=packMatch(unpackMatch(JSON.parse(JSON.stringify(copy.match))));advance(copy,t);}
assert.deepEqual(room.match,copy.match,'serialized resume matches continuously restored simulation');
frames=await tick({action:'release',boost:true},{action:'reel',boost:true});
frames=await tick({action:'release',boost:true},{action:'reel',boost:true});
assert(frames[0].match.pilots[0].body.lineLength>frames[0].match.pilots[1].body.lineLength,'both seats use their own human commands');
const pulls=frames[0].match.pilots[0].body.tugCount;
await tick({}, {},100,{tugSeq:1,tugDouble:true});
for(let n=0;n<4;n++)frames=await tick({}, {},100,{tugSeq:1,tugDouble:true});
assert.equal(frames[0].match.pilots[0].body.tugCount-pulls,2,'replayed double tug triggers exactly two pulls');
assert.equal(frames[0].match.pilots[1].body.tugCount,0,'no AI actions for second seat');
// Physical cut and inserted free ends survive persistence and are identical for both views.
let r=JSON.parse(db.rows.get(a.code).data),d=unpackMatch(r.match);d.player.rope.breakAt(12,.4);d.player.state='cut';r.match=packMatch(d);
const s0=snapshot(r,0,now),s1=snapshot(r,1,now);assert.deepEqual(s0.match,s1.match);assert.equal(s0.match.pilots[0].rope.points.length,31);assert.equal(s0.match.pilots[0].rope.broken,13);
// Reconnection freezes physics; the live opponent gets the same pause and forfeit.
now+=4000;let paused=await handleRoom(db,{...commands[0],op:'input',seq:++seq,input:{}},now);assert(paused.paused);
let pausedTime=paused.match.pilots[0].body.time;
now+=500;paused=await handleRoom(db,{...commands[0],op:'input',seq:++seq,input:{}},now);assert.equal(paused.match.pilots[0].body.time,pausedTime);
await handleRoom(db,{...commands[1],op:'input',seq:++seq,input:{}},now);
frames=await tick();assert.equal(frames[0].paused,null,'same seat token reconnects');
now+=4000;await handleRoom(db,{...commands[0],op:'input',seq:++seq,input:{}},now);
for(let n=0;n<26;n++){now+=1000;paused=await handleRoom(db,{...commands[0],op:'input',seq:++seq,input:{}},now);}
assert.equal(paused.phase,'finished');assert.equal(paused.match.result.outcome,'win');
await handleRoom(db,{...commands[1],op:'input',seq:++seq,input:{}},now);
await Promise.all(commands.map(c=>handleRoom(db,{...c,op:'ready',ready:true},now)));
frames=await tick();assert.equal(frames[0].round,2);assert.equal(frames[0].phase,'preparing');
await handleRoom(db,{...commands[1],op:'leave'},now);frames=await handleRoom(db,{...commands[0],op:'input',seq:++seq,input:{}},now);assert.equal(frames.phase,'finished');assert.equal(frames.match.result.outcome,'win');
// Concurrent joins cannot overbook a room.
const fresh=await handleRoom(db,{op:'create'},now);const racers=await Promise.allSettled([1,2].map(()=>handleRoom(db,{op:'join',code:fresh.code},now)));assert.equal(racers.filter(r=>r.status==='fulfilled').length,1);
console.log(`Online: shared physics, serialization, concurrent joins/ticks, authorization, human controls, deduplicated double tug, cut geometry, reconnect, forfeit and rematch passed (${Math.round(performance.now()-start)} ms).`);
// Restored session metadata must never overwrite the new outgoing input counters.
const {OnlineGame}=await import('../game/online.js');
const client=Object.create(OnlineGame.prototype);let sent;
Object.assign(client,{session:{code:'ABCDEFGH',token:'seat',seq:2,tugSeq:1},seq:14,tugSeq:8,tugDouble:true,input:{action:'reel'},queue:[],inflight:false,request:async body=>(sent=body,{}),accept(){this.session=null;},paint(){},persist(){}});
await client.poll();assert.equal(sent.seq,15);assert.equal(sent.tugSeq,8);assert.equal(sent.input.action,'reel');
console.log('Online client: restored sessions preserve fresh input and tug sequences.');
