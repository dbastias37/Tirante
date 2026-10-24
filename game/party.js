import {solveRopeSystem} from './rope-system.js';
import {mixSeed} from './line-stress.js';
import {Commission} from './commission.js';
import {KitePhysics,DEFAULT_SETUP,clamp} from './physics.js';
import {closestSegments,SawStroke} from './rope.js';
import {appearance} from './appearance.js';
import {controlNPC} from './npc-pilot.js';

export const PARTY_NPCS=Object.freeze([
  {name:'Mateo',color:'teal',tint:'#397f80',x:6,z:0,phase:0,style:'Lee el cruce'},
  {name:'Alma',color:'saffron',tint:'#be932d',x:-6,z:0,phase:1.35,style:'Busca tu flanco'},
  {name:'Nico',color:'plum',tint:'#92709b',x:12,z:0,phase:2.6,style:'Presiona el hilo'}
]);
export function cleanPartyOptions(value={}){
  if(!value||typeof value!=='object')value={};
  return {rules:value.rules==='last-man'?'last-man':'timed',
    profile:['breeze','gusts','strong'].includes(value.profile)?value.profile:'breeze',
    wind:[5.5,7,9,12].includes(Number(value.wind))?Number(value.wind):5.5,
    npcs:PARTY_NPCS.map((npc,i)=>{const s=value.npcs?.[i]||{};return {name:String(s.name||npc.name).replace(/[\u0000-\u001f]/g,'').trim().slice(0,24)||npc.name,...appearance({color:npc.color,...s})};})};
}
export const escapeHTML=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// A separate local controller leaves the two-seat network protocol unchanged.
export class PartyCommission extends Commission{
  constructor(player){
    super(player);this.pool=[this.rival,new KitePhysics(undefined,{seed:mixSeed(player.flightSeed^2)}),new KitePhysics(undefined,{seed:mixSeed(player.flightSeed^3)})];
    this.partyMode=false;this.roster=[];this.contacts=[];this.events=[];this.eventId=0;this.npcCount=1;this.duration=90;
  }
  get rivals(){return this.partyMode?this.roster.slice(1).map(e=>e.pilot):[this.rival];}
  get aliveRivals(){return this.roster.slice(1).filter(e=>e.alive);}
  get focusEntry(){return this.roster.find(e=>e.pilot===this.rival);}
  get survivors(){return this.roster.filter(e=>e.alive);}
  get spectating(){return this.partyMode&&this.active&&this.roster[0]?.alive===false;}
  get watched(){return this.roster.find(e=>e.index===this.spectatorIndex&&e.alive)||null;}
  spectateNext(){const alive=this.survivors;this.spectatorIndex=(alive.find(e=>e.index>this.spectatorIndex)||alive[0])?.index??-1;return this.watched;}
  stop(){
    for(const p of this.pool||[]){p.reset();delete p.partyTint;}this.rival=this.pool?.[0]||this.rival;
    this.partyMode=false;this.roster=[];this.contacts=[];this.events=[];super.stop();
  }
  startParty(count=3,difficulty='normal',options={}){
    this.stop();this.winner=null;this.options=cleanPartyOptions(options);this.rules=this.options.rules;this.spectatorIndex=-1;
    this.partyMode=true;this.npcCount=clamp(Math.round(Number(count)||1),1,3);this.duration=this.npcCount===1?180:240;
    this.state='preparing';this.difficulty=difficulty==='hard'?'hard':'normal';this.elapsed=0;this.remaining=this.duration;this.result=null;
    this.playerHealth=this.rivalHealth=100;this.contact=false;this.contactTime=0;this.engagements=0;this.pressure=0;this.sliding=0;this.reversals=0;this.lastHit=null;this.message='Tomando altura · 6';this.eventId=0;
    const p=this.player;if(options.profile!==undefined)p.profile=this.options.profile;if(options.wind!==undefined)p.windSpeed=this.options.wind;p.launch();p.networkControlled=false;
    const entry=(pilot,name,tint,index)=>({pilot,name,tint,index,alive:true,reason:'',eliminatedAt:null,stroke:new SawStroke(),aiWait:0,footworkAt:0,hit:null,cutBy:null});
    this.roster=[entry(p,'Tú','#c96343',0)];this.playerStroke=this.roster[0].stroke;
    PARTY_NPCS.slice(0,this.npcCount).forEach((npc,i)=>{
      const b=this.pool[i],side=Math.sign(npc.x),custom=this.options.npcs[i];b.configure({...DEFAULT_SETUP,...custom,knotsLeft:side>0?1:0,knotsRight:side<0?1:0});
      b.anchor.set(p.anchor.x+npc.x,1.35,p.anchor.z+npc.z);b.lineCapacity=p.lineCapacity;b.windSpeed=p.windSpeed;b.profile=p.profile;b.networkControlled=false;b.launch();b.time=p.time;b.spinSign=-side;b.partyTint=npc.tint;
      this.roster.push({...entry(b,custom.name,npc.tint,i+1),homeX:b.anchor.x,homeZ:b.anchor.z,side,phase:npc.phase,targetIndex:-1,thinkIn:0});
    });
    this.rival=this.pool[0];this.rivalStroke=this.roster[1].stroke;this.pairLastContact=new Map();
  }
  controlNPC(e,dt){controlNPC(this,e,dt);}
  eliminate(e,reason,by=null){
    if(!e.alive)return;e.alive=false;e.reason=reason;e.eliminatedAt=this.elapsed;e.pilot.sawing=false;e.pilot.setControls('hold',false);
    if(reason==='Hilo cortado')e.pilot.cutLine(e.hit?.edge,e.hit?.fraction);
    else if(e.pilot.rope.broken<0){e.pilot.rope.cutReason='ground';e.pilot.rope.breakAt(e.hit?.edge??14,e.hit?.fraction??.5);}
    if(e.index===this.spectatorIndex||e.index===0)this.spectateNext();
    const cause=e.pilot.rope.cutReason,detail=cause==='wind'?' por una ráfaga extrema':cause==='tension'?' por exceso de tensión':'';
    const text=e.index===0?(reason==='Hilo cortado'?`Se cortó tu hilo${detail}.`:'Tu volantín tocó tierra.'):reason==='Hilo cortado'?`${e.name} perdió su hilo${detail|| (by?by==='Tú'?' en el cruce contigo':` en el cruce con ${by}`:'')}.`:`${e.name} tocó tierra.`;
    this.events.push({id:++this.eventId,time:this.elapsed,text});this.events=this.events.slice(-4);
  }
  resolveContacts(dt,physical=solveRopeSystem(this.roster.map(e=>e.pilot.rope),dt)){
    this.contacts=[];this.contact=false;this.pressure=0;this.sliding=0;let focus=null;const strongest=new Map();
    // Each stroke advances once per pilot, even when their cord touches two others.
    for(const e of this.roster)if(e.alive)e.stroke.step(e.pilot.rope.feedDelta,dt,this.elapsed);
    for(const crossing of physical){
      const {a:i,b:j,hit,contact}=crossing,a=this.roster[i],b=this.roster[j];if(!a.alive||!b.alive||a.pilot.rope.integrity<=0||b.pilot.rope.integrity<=0)continue;
      const key=`${i}:${j}`;
      if(this.elapsed-(this.pairLastContact.get(key)??-100)>.35)this.engagements++;this.pairLastContact.set(key,this.elapsed);
      this.contacts.push({a:i,b:j,point:contact.point.clone(),load:contact.load});
      for(const [e,edge,fraction,other]of[[a,hit.i,hit.s,b],[b,hit.j,hit.t,a]]){
        if(!strongest.has(e)||strongest.get(e).load<contact.load)strongest.set(e,{load:contact.load,point:contact.point.clone(),edge});
        e.hit={edge,fraction};e.cutBy=other.name;
      }
      if(a.pilot.tension>.08&&b.pilot.tension>.08){
        const fa=a.stroke.factor(this.elapsed),fb=b.stroke.factor(this.elapsed),work=.36*contact.load*contact.slip*Math.max(fa,fb);
        const pa=Math.abs(a.pilot.rope.feedDelta)*fa,pb=Math.abs(b.pilot.rope.feedDelta)*fb,total=pa+pb;
        a.pilot.rope.abrade(hit.i,hit.s,work*(.2+.8*(total?pb/total:0)));b.pilot.rope.abrade(hit.j,hit.t,work*(.2+.8*(total?pa/total:0)));
      }
      if(i===0&&(!focus||contact.load>focus.contact.load))focus={hit,contact,entry:b};
    }
    // Every crossing deforms the strands. The strongest supplies the reduced
    // flight body's force path on the next step, rather than the last pair.
    for(const [e,h]of strongest){const r=e.pilot.rope;r.contactEdge=h.edge;r.contactAge=0;r.contactPoint.copy(h.point);r.contactLoad=h.load;}
    if(focus){this.contact=true;this.contactTime+=dt;this.rival=focus.entry.pilot;this.rivalStroke=focus.entry.stroke;this.lastHit=focus.hit;this.contactPoint.copy(focus.contact.point);this.pressure=focus.contact.load;this.sliding=focus.contact.slip/dt;}
    this.reversals=this.playerStroke.reversals;
    for(const e of this.roster)if(e.alive&&e.pilot.rope.integrity<=0)this.eliminate(e,'Hilo cortado',e.cutBy);
  }
  finish(outcome,reason){
    if(!this.partyMode)return super.finish(outcome,reason);if(!this.active)return;
    this.state='finished';this.contact=false;this.message=reason;for(const e of this.roster){e.pilot.sawing=false;e.pilot.setControls('hold',false);}
    this.result={outcome,reason,seconds:Math.round(this.elapsed),playerHealth:Math.round(this.player.rope.integrity),rivalHealth:Math.round(Math.max(0,...this.aliveRivals.map(e=>e.pilot.rope.integrity))),rules:this.rules,winner:this.winner?.name||null,npcCount:this.npcCount,eliminated:this.npcCount-this.aliveRivals.length,standings:this.roster.map(e=>({name:e.name,tint:e.tint,alive:e.alive,health:Math.round(e.pilot.rope.integrity),reason:e.reason||'En el aire'}))};
  }
  checkOutcome(){
    const alive=this.survivors;
    if(alive.length<=1){
      this.winner=alive[0]||null;
      this.finish(!this.winner?'draw':this.winner.index===0?'win':'loss',this.winner?`${this.winner.name} ganó: último volantín en el aire.`:'Todos quedaron fuera en el mismo cruce.');return;
    }
    if(this.rules==='timed'&&this.remaining<=0){
      const best=Math.max(...alive.map(e=>e.pilot.rope.integrity)),winners=alive.filter(e=>Math.abs(e.pilot.rope.integrity-best)<1);
      this.winner=winners.length===1?winners[0]:null;
      this.finish(winners.some(e=>e.index===0)?winners.length===1?'win':'draw':'loss',this.winner?`Tiempo cumplido: ${this.winner.name} conservó más hilo.`:'Tiempo cumplido: empate entre los hilos más enteros.');
    }
  }
  step(dt){
    if(!this.partyMode)return super.step(dt);if(!this.visible)return;
    const p=this.player;
    for(const e of this.roster.slice(1)){const b=e.pilot;b.profile=p.profile;b.windSpeed=p.windSpeed;if(this.state==='playing'&&e.alive)this.controlNPC(e,dt);else b.setControls('hold',false);b.step(dt);}
    const physical=solveRopeSystem(this.roster.map(e=>e.pilot.rope),dt);
    if(this.state==='finished')return;
    this.elapsed+=dt;
    if(this.state==='preparing'){p.setControls('hold',false);this.message='Tomando altura · '+Math.max(1,Math.ceil(6-this.elapsed));if(this.elapsed>=6){this.state='playing';this.elapsed=0;}return;}
    this.remaining=Math.max(0,this.duration-this.elapsed);
    for(const e of this.roster)if(e.alive&&e.pilot.state!=='flying')this.eliminate(e,e.pilot.rope.broken>=0&&e.pilot.rope.cutReason!=='ground'?'Hilo cortado':'En tierra');
    this.resolveContacts(dt,physical);this.playerHealth=p.rope.integrity;
    if(!this.contact&&!this.focusEntry?.alive&&this.aliveRivals.length&&this.rival.rope.breakAge>2){this.rival=this.aliveRivals[0].pilot;this.lastHit=null;}
    this.rivalHealth=this.rival.rope.integrity;
    this.message=this.contact?(p.rope.stressRatio>.8?'Tu hilo está al límite · mantén Q para descargar.':`Cruce con ${this.focusEntry.name} · tensa y da un tirón; evita llevar tu hilo al límite.`):`Quedan ${this.aliveRivals.length} de ${this.npcCount} rivales. Busca su hilo y cuida tu energía.`;
    if(this.spectating&&this.spectatorIndex>=0&&!this.watched)this.spectateNext();
    this.checkOutcome();
  }
}
