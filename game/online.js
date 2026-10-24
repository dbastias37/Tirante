import {guardRopeMotion} from './rope-system.js';
import {Vector3} from './vendor/three.module.js';
const $=id=>document.getElementById(id), clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const SESSION='tirante.online.v1';
export class OnlineGame{
  constructor(callbacks){
    this.cb=callbacks;this.session=null;this.latest=null;this.from=null;this.received=0;this.interval=120;this.input={action:'hold',boost:false,saw:false,x:0,z:0};this.queue=[];this.inflight=false;this.timer=null;this.error='';this.lastSuccess=0;this.latency=0;this.shownRound=0;this.resultRound=0;
    try{this.session=JSON.parse(sessionStorage.getItem(SESSION)||'null');}catch{}
    this.seq=this.session?.seq||0;this.tugSeq=this.session?.tugSeq||0;this.tugDouble=false;
    if(this.session)this.session={code:this.session.code,token:this.session.token};
    $('online-create').onclick=()=>this.enter('create');$('online-join').onclick=()=>this.enter('join');
    $('online-ready').onclick=()=>{this.queue.push({op:'ready',ready:!this.latest?.players[this.latest.slot]?.ready,setup:this.cb.setup()});this.wake();};
    $('online-copy').onclick=()=>this.copy();$('online-leave').onclick=()=>this.cb.leave();
    $('online-code-input').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();this.enter('join');}});
    for(const id of ['intro-online','flight-online','pause-online'])$(id).onclick=()=>this.open();
    $('online-return').onclick=()=>this.cb.close();
    const invited=location.hash.match(/sala=([A-Z2-9]{8})/i);if(invited)$('online-code-input').value=invited[1].toUpperCase();
    this.paint();if(this.session){this.cb.open();this.wake();}else if(invited)this.cb.open();
  }
  get active(){return !!this.session;}
  persist(){try{if(this.session)sessionStorage.setItem(SESSION,JSON.stringify({...this.session,seq:this.seq,tugSeq:this.tugSeq}));else sessionStorage.removeItem(SESSION);}catch{}}
  async request(body){const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),7000);try{const start=performance.now(),res=await fetch('/api/pvp',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:controller.signal,cache:'no-store'});this.latency=Math.round(performance.now()-start);let data;try{data=await res.json();}catch{throw new Error('El servidor de salas no está disponible.');}if(!res.ok)throw Object.assign(new Error(data.error||'No pudimos contactar la sala.'),{status:res.status});return data;}finally{clearTimeout(timeout);}}
  async enter(op){
    if(this.inflight||this.active)return;this.inflight=true;this.error='';this.paint();
    try{const d=await this.request({op,name:$('online-name').value,code:$('online-code-input').value,setup:this.cb.setup(),settings:{capacity:Number($('online-capacity').value),profile:$('online-wind').value,wind:Number($('online-strength').value)}});
      this.session={code:d.code,token:d.token};this.seq=0;this.tugSeq=0;this.shownRound=0;this.resultRound=0;this.cb.enter();this.accept(d);this.persist();
    }catch(e){this.error=e.message;}finally{this.inflight=false;this.paint();this.wake();}
  }
  open(){this.cb.open();this.paint();}
  controls(input){this.input={...input};}
  tug(double){if(!this.active||this.latest?.phase!=='playing')return;this.tugSeq++;this.tugDouble=!!double;this.persist();this.wake();}
  wake(){clearTimeout(this.timer);if(this.active&&!this.inflight)this.timer=setTimeout(()=>this.poll(),0);}
  async poll(){
    if(!this.active||this.inflight)return;this.inflight=true;const session=this.session,command=this.queue[0]||{op:'input',seq:++this.seq,input:this.input,tugSeq:this.tugSeq,tugDouble:this.tugDouble};
    try{const d=await this.request({...command,code:session.code,token:session.token});if(this.session!==session)return;if(this.queue[0]===command)this.queue.shift();this.error='';this.accept(d);this.persist();}
    catch(e){if(this.session!==session)return;this.error=e.message;if([401,404].includes(e.status)){this.session=null;this.persist();this.cb.ended();this.cb.open();}}
    finally{this.inflight=false;this.paint();if(this.active)this.timer=setTimeout(()=>this.poll(),this.error?700:document.hidden?700:['playing','preparing'].includes(this.latest?.phase)?90:450);}
  }
  accept(data){
    const now=performance.now();this.interval=this.received?clamp(now-this.received,90,400):120;this.from=this.latest;this.latest=data;this.received=now;this.lastSuccess=now;this.seq=Math.max(this.seq,data.ack||0);this.tugSeq=Math.max(this.tugSeq,data.tugAck||0);
    if(data.match&&data.round!==this.shownRound){this.shownRound=data.round;this.from=null;this.viewRound=null;this.cb.round(data);}
    if(data.phase==='finished'&&this.resultRound!==data.round){this.resultRound=data.round;this.cb.result(data);}
    this.paint();
  }
  async leave(){
    const s=this.session;this.session=null;clearTimeout(this.timer);this.queue=[];this.latest=null;this.from=null;this.persist();this.paint();
    if(s){try{await this.request({op:'leave',...s});}catch{}} // expiry/forfeit still handles a lost connection
  }
  async copy(){const url=new URL(location.href);url.hash='sala='+this.session.code;try{await navigator.clipboard.writeText(url.href);$('online-copy').textContent='Enlace copiado ✓';setTimeout(()=>$('online-copy').textContent='Copiar invitación ↗',2000);}catch{$('online-invite').classList.remove('hidden');$('online-invite').value=url.href;$('online-invite').select();this.cb.toast('Copia el enlace seleccionado y envíaselo a tu rival.');}}
  paint(){
    const d=this.latest,active=this.active;$('online-entry').classList.toggle('hidden',active);$('online-room').classList.toggle('hidden',!active);$('online-error').textContent=this.error;$('online-error').classList.toggle('hidden',!this.error);
    for(const id of ['online-create','online-join'])$(id).disabled=this.inflight;
    $('online-network').classList.toggle('hidden',!active);$('online-network').textContent=this.error?'Reconectando…':d?.paused?'Partida en pausa · reconectando':d?`ONLINE 2P · ${this.latency} ms`:'Conectando…';$('online-network').classList.toggle('is-warning',!!this.error||!!d?.paused);
    if(!active)return;$('online-room-code').textContent=this.session.code;
    for(let i=0;i<2;i++){const p=d?.players[i];$('online-seat-'+i).textContent=p?`${p.name}${i===d.slot?' · tú':''}`:'Esperando rival…';$('online-seat-state-'+i).textContent=!p?'Comparte el enlace':p.left?'Abandonó la sala':!p.online?'Reconectando…':p.ready?'Listo para jugar':'Preparando volantín';$('online-seat-state-'+i).classList.toggle('ready',!!p?.ready);}
    const playing=['preparing','playing'].includes(d?.phase),left=d?.players.some(p=>p?.left);
    $('online-ready').disabled=!d||playing||left;$('online-ready').textContent=d?.players[d.slot]?.ready?'Cancelar listo':d?.phase==='finished'?'Listo para la revancha ↗':'Estoy listo ↗';
    $('online-return').classList.toggle('hidden',!playing);$('online-room-note').textContent=left?'Un jugador salió. Crea otra sala para un nuevo duelo.':d?.paused?'Esperando la reconexión. La física y el reloj están detenidos.':playing?'El duelo sigue mientras tengas el menú abierto.':'La partida comienza cuando ambos pulsen «Estoy listo».';
    $('online-room-rules').textContent=d?`${d.settings.capacity} m de hilo · ${(d.settings.wind*3.6).toFixed(1)} km/h · 90 segundos`:'';
  }
  render(p,duel){
    const d=this.latest;if(!d?.match)return;const m=d.match,old=this.from?.round===d.round?this.from.match:null,t=clamp((performance.now()-this.received)/this.interval,0,1),own=d.slot;
    const anchor=m.pilots[own].body.anchor.vector,prevAnchor=old?.pilots[own].body.anchor.vector||anchor;
    const offset=[prevAnchor[0]+(anchor[0]-prevAnchor[0])*t,0,prevAnchor[2]+(anchor[2]-prevAnchor[2])*t];
    for(const [view,slot] of [[p,own],[duel.rival,1-own]]){
      const k=m.pilots[slot],a=old?.pilots[slot],previous=view.rope.points.map(p=>p.clone());view.networkControlled=true;
      if(JSON.stringify(view.setup)!==JSON.stringify(k.setup))view.configure(k.setup);
      for(const [key,value] of Object.entries(k.body)){
        if(value?.vector){const arr=value.vector,prev=a?.body[key]?.vector||arr;
          if(key==='orientation'){view.orientation.fromArray(prev);view.orientation.slerp(view.orientation.clone().fromArray(arr),t);}
          else{const vals=arr.map((n,i)=>prev[i]+(n-prev[i])*t);if(['anchor','position'].includes(key)){vals[0]-=offset[0];vals[2]-=offset[2];}view[key]?.fromArray?.(vals);}
        }else view[key]=value;
      }
      const r=k.rope,canLerp=a&&a.rope.broken===r.broken&&a.rope.points.length===r.points.length;
      while(view.rope.points.length<r.points.length)view.rope.points.push(new Vector3());view.rope.points.length=r.points.length;
      r.points.forEach((v,i)=>{const prev=canLerp?a.rope.points[i]:v;view.rope.points[i].set(prev[0]+(v[0]-prev[0])*t-offset[0],prev[1]+(v[1]-prev[1])*t,prev[2]+(v[2]-prev[2])*t-offset[2]);});
      view.rope.previous=this.viewRound===d.round&&previous.length===view.rope.points.length?previous:view.rope.points.map(p=>p.clone());
      for(const key of ['broken','breakAge','contactEdge','contactAge','contactLoad','integrity'])view.rope[key]=r[key];
      view.rope.contactPoint.fromArray(r.contactPoint).sub(new Vector3(offset[0],0,offset[2]));view.rope.breakPoint=r.breakPoint?new Vector3().fromArray(r.breakPoint).sub(new Vector3(offset[0],0,offset[2])):null;
      view.rope.wear.fill(0);for(const [i,n] of r.wear)view.rope.wear[i]=n;
    }
    // Snapshot interpolation also obeys non-crossing, independently of the
    // authoritative 240 Hz solver. Camera smoothing cannot undo a collision.
    guardRopeMotion([p.rope,duel.rival.rope]);this.viewRound=d.round;
    for(const key of ['state','elapsed','remaining','contact','pressure','sliding','reversals','engagements'])duel[key]=m[key];
    duel.playerHealth=own?m.rivalHealth:m.playerHealth;duel.rivalHealth=own?m.playerHealth:m.rivalHealth;duel.contactPoint.fromArray(m.contactPoint).sub(new Vector3(offset[0],0,offset[2]));
    duel.lastHit=m.lastHit?(own?{i:m.lastHit.j,j:m.lastHit.i,s:m.lastHit.t,t:m.lastHit.s}:m.lastHit):null;
    duel.message=d.paused?'Esperando reconexión · reloj detenido':m.message.replaceAll('hilo azul','hilo rival');
    duel.result=m.result?{...m.result,outcome:own?{win:'loss',loss:'win',draw:'draw'}[m.result.outcome]:m.result.outcome,playerHealth:Math.round(duel.playerHealth),rivalHealth:Math.round(duel.rivalHealth)}:null;
  }
}
