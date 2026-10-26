import {appearance} from '../game/appearance.js';
import {cleanEquipment} from '../game/equipment.js';
import {mountSettings} from '../game/kite-shape.js';
import {KitePhysics,DEFAULT_SETUP,clamp} from '../game/physics.js';
import {Commission} from '../game/commission.js';
import {mixSeed} from '../game/line-stress.js';
import {PILOT_SPACING,climbControls} from '../game/battle-rules.js';
import {Vector3,Quaternion} from '../game/vendor/three.module.js';

export const STEP=1/240, STALE_MS=3500, GRACE_MS=25000;
export function cleanSetup(value={}){
  if(!value||typeof value!=='object')value={};
  const s={...DEFAULT_SETUP};
  for(const [k,a,b] of [['left',34,54],['right',34,54],['lower',42,62],['mass',22,70],['knotsLeft',0,5],['knotsRight',0,5],['knotsLower',0,5]])if(Number.isFinite(value[k]))s[k]=k.startsWith('knots')?Math.round(clamp(value[k],a,b)):clamp(value[k],a,b);
  if(typeof value.tail==='boolean')s.tail=value.tail;
  const mounts=mountSettings(value);s.anchorLeft=mounts.left;s.anchorRight=mounts.right;
  Object.assign(s,appearance(value),cleanEquipment(value));
  return s;
}
export function cleanInput(value={}){if(!value||typeof value!=='object')value={};return {action:['hold','release','reel'].includes(value.action)?value.action:'hold',boost:value.boost===true,saw:value.saw===true,x:clamp(Number(value.x)||0,-1,1),z:clamp(Number(value.z)||0,-1,1)};}
export const idleInput=()=>cleanInput();
// Persist all integrator variables, including previous cord positions and wear.
// Temporary work vectors are reconstructed; physics never depends on a Worker isolate.
function packObject(obj,skip=[]){
  const out={};for(const [k,v] of Object.entries(obj)){
    if(k.startsWith('_')||skip.includes(k)||typeof v==='function')continue;
    if(v===null||['string','number','boolean'].includes(typeof v))out[k]=v;
    else if(v?.isVector3||v?.isQuaternion)out[k]={vector:v.toArray()};
    else if(v instanceof Float64Array)out[k]={sparse:Array.from(v).flatMap((n,i)=>n?[[i,n]]:[]),length:v.length};
    else if(Array.isArray(v))out[k]=v.map(n=>n?.isVector3?{vector:n.toArray()}:n);
  }return out;
}
function unpackObject(obj,data){for(const [k,v] of Object.entries(data)){
  if(v?.vector)obj[k]=(v.vector.length===4?new Quaternion():new Vector3()).fromArray(v.vector);
  else if(v?.sparse){obj[k]=new Float64Array(v.length);for(const [i,n] of v.sparse)obj[k][i]=n;}
  else if(Array.isArray(v))obj[k]=v.map(n=>n?.vector?new Vector3().fromArray(n.vector):n);
  else obj[k]=v;
}return obj;}
function packPilot(p){return {setup:p.setup,body:packObject(p,['rope','trim','setup']),rope:packObject(p.rope,['owner'])};}
function unpackPilot(p,data){p.configure(data.setup);unpackObject(p,data.body);unpackObject(p.rope,data.rope);}
function disableAI(duel){duel.controlRival=()=>{};return duel;}
export function createMatch(room){
  const seed=Array.from(room.code||'TIRANTE').reduce((n,c)=>mixSeed(n^c.charCodeAt(0)),room.round||1);
  const p=new KitePhysics(room.players[0].setup,{seed}),duel=disableAI(new Commission(p));
  p.profile=room.settings.profile;p.windSpeed=room.settings.wind;p.lineCapacity=room.settings.capacity;
  duel.rival.configure(room.players[1].setup);duel.start();
  for(const [i,k] of [p,duel.rival].entries()){k.anchor.set((i?1:-1)*PILOT_SPACING/2,1.35,0);k.launch();k.time=0;k.spinSign=i?-1:1;}
  return duel;
}
export function packMatch(duel){return {pilots:[packPilot(duel.player),packPilot(duel.rival)],duel:packObject(duel,['player','rival','playerStroke','rivalStroke','lastHit','result']),strokes:[packObject(duel.playerStroke),packObject(duel.rivalStroke)],lastHit:duel.lastHit?{i:duel.lastHit.i,j:duel.lastHit.j,s:duel.lastHit.s,t:duel.lastHit.t}:null,result:duel.result};}
export function unpackMatch(data){
  const duel=disableAI(new Commission(new KitePhysics()));unpackPilot(duel.player,data.pilots[0]);unpackPilot(duel.rival,data.pilots[1]);unpackObject(duel,data.duel);unpackObject(duel.playerStroke,data.strokes[0]);unpackObject(duel.rivalStroke,data.strokes[1]);duel.lastHit=data.lastHit;duel.result=data.result;return duel;
}
export function beginRound(room,now){room.round++;room.match=packMatch(createMatch(room));room.lastTick=now;room.carry=0;room.paused=null;for(const p of room.players){p.ready=false;p.input=idleInput();p.pendingTug=false;}}
export function applyCommand(room,slot,command,now){
  const p=room.players[slot];p.lastSeen=now;
  if(command.op==='input'&&Number.isSafeInteger(command.seq)&&command.seq>p.seq){p.seq=command.seq;p.input=cleanInput(command.input);}
  if(command.op==='input'&&Number.isSafeInteger(command.tugSeq)&&command.tugSeq>p.tugSeq){p.tugSeq=command.tugSeq;if(room.match?.duel.state==='playing')p.pendingTug={double:command.tugDouble===true};}
  if(command.op==='ready'&&(!room.match||room.match.duel.state==='finished')){
    p.setup=cleanSetup(command.setup);p.ready=command.ready===true;
    if(room.players.every(s=>s&&!s.left&&s.ready&&now-s.lastSeen<STALE_MS))beginRound(room,now);
  }
  if(command.op==='leave'){p.left=true;p.ready=false;p.input=idleInput();if(room.match){const d=unpackMatch(room.match);d.finish(slot===0?'loss':'win','El rival abandonó la sala.');room.match=packMatch(d);}room.paused=null;}
}
export function advance(room,now){
  if(!room.match){room.lastTick=now;return;}
  const active=room.match.duel.state!=='finished';
  const missing=room.players.map((p,i)=>!p||p.left||now-p.lastSeen>STALE_MS?i:-1).filter(i=>i>=0);
  if(active&&missing.length){
    room.paused??={since:now,slots:missing};room.paused.slots=missing;room.lastTick=now;
    if(now-room.paused.since>=GRACE_MS){const d=unpackMatch(room.match);d.finish(missing.length===2?'draw':missing[0]===0?'loss':'win',missing.length===2?'Ambos jugadores se desconectaron.':'Terminó el plazo de reconexión.');room.match=packMatch(d);room.paused=null;}
    return;
  }
  if(room.paused){room.paused=null;room.lastTick=now;room.carry=0;return;}
  // Never simulate a long inactive gap or count the same interval twice.
  const elapsed=clamp((now-room.lastTick)/1000,0,.25);room.lastTick=Math.max(now,room.lastTick);room.carry=(room.carry||0)+elapsed;
  if(room.carry<STEP)return;
  const d=unpackMatch(room.match),ps=[d.player,d.rival];
  while(room.carry>=STEP){
    for(let i=0;i<2;i++){
      const seat=room.players[i],p=ps[i],input=d.state==='playing'&&!p.eliminated&&now-seat.lastSeen<700?seat.input:idleInput();
      if(d.state==='preparing')climbControls(p,d.elapsed);else{p.sawing=input.saw;p.setControls(input.action,input.boost);}
      if(p.eliminated)seat.pendingTug=false;
      if(d.state==='playing'&&!p.eliminated){
        const norm=Math.max(1,Math.hypot(input.x,input.z)),pace=(p.energy>5?.7:.3)*STEP;
        const home=(i?1:-1)*PILOT_SPACING/2;p.anchor.x=clamp(p.anchor.x+input.x/norm*pace,home-3,home+3);p.anchor.z=clamp(p.anchor.z+input.z/norm*pace,-3,3);
        p.energy=Math.max(0,p.energy-Math.hypot(input.x,input.z)*STEP);
        if(seat.pendingTug){p.tug(seat.pendingTug.double);seat.pendingTug=false;}
      }
    }
    ps[0].step(STEP);d.step(STEP);room.carry-=STEP;
  }
  room.match=packMatch(d);
}
function viewPilot(p){const rope=p.rope;return {setup:p.setup,body:packObject(p,['rope','trim','setup','aero','force']),rope:{points:rope.points.map(v=>v.toArray()),broken:rope.broken,breakPoint:rope.breakPoint?.toArray()||null,breakAge:rope.breakAge,contactPoint:rope.contactPoint.toArray(),contactEdge:rope.contactEdge,contactAge:rope.contactAge,contactLoad:rope.contactLoad,integrity:rope.integrity,stressLoad:rope.stressLoad,strength:rope.strength,stressRatio:rope.stressRatio,jamTime:rope.jamTime,cutReason:rope.cutReason,wear:Array.from(rope.wear).flatMap((v,i)=>v?[[i,v]]:[])}};}
export function snapshot(room,slot,now){
  const d=room.match?unpackMatch(room.match):null;
  return {code:room.code,slot,round:room.round,serverTime:now,settings:room.settings,paused:room.paused,phase:d?.state||'waiting',players:room.players.map((p,i)=>p?{name:p.name,ready:p.ready,online:!p.left&&now-p.lastSeen<STALE_MS,left:p.left,slot:i}:null),ack:room.players[slot].seq,tugAck:room.players[slot].tugSeq,match:d?{pilots:[viewPilot(d.player),viewPilot(d.rival)],lastHit:d.lastHit?{i:d.lastHit.i,j:d.lastHit.j,s:d.lastHit.s,t:d.lastHit.t}:null,state:d.state,elapsed:d.elapsed,remaining:d.remaining,playerHealth:d.playerHealth,rivalHealth:d.rivalHealth,contact:d.contact,contactPoint:d.contactPoint.toArray(),pressure:d.pressure,sliding:d.sliding,reversals:d.reversals,engagements:d.engagements,message:d.message,result:d.result}:null};
}
