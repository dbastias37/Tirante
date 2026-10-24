import {cleanSetup,idleInput,applyCommand,advance,snapshot} from './online-match.js';
const TTL=30*60*1000, ALPHABET='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export class RoomError extends Error{constructor(message,status=400){super(message);this.status=status;}}
export async function digest(value){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),x=>x.toString(16).padStart(2,'0')).join('');}
function seat(name,hash,setup,now){return {name:typeof name==='string'?name.replace(/[\x00-\x1f<>]/g,'').trim().slice(0,20)||'Piloto':'Piloto',hash,setup:cleanSetup(setup),ready:false,lastSeen:now,left:false,seq:-1,tugSeq:0,pendingTug:false,input:idleInput()};}
export class D1Rooms{
  constructor(db){this.db=db;}
  async get(code){return this.db.prepare('SELECT revision,data,expires_at FROM pvp_rooms WHERE code=?').bind(code).first();}
  async insert(room){const r=await this.db.prepare('INSERT OR IGNORE INTO pvp_rooms(code,data,expires_at) VALUES(?,?,?)').bind(room.code,JSON.stringify(room),room.lastTick+TTL).run();return r.meta.changes===1;}
  async cas(code,revision,room,now){const r=await this.db.prepare('UPDATE pvp_rooms SET data=?,revision=revision+1,expires_at=? WHERE code=? AND revision=?').bind(JSON.stringify(room),now+TTL,code,revision).run();return r.meta.changes===1;}
  async limit(key,now){
    const r=await this.db.prepare('INSERT INTO pvp_limits(key,count,expires_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count').bind(key,now+3600000).first();return r.count<=30;
  }
  async cleanup(now){await this.db.batch([this.db.prepare('DELETE FROM pvp_rooms WHERE code IN (SELECT code FROM pvp_rooms WHERE expires_at<? LIMIT 100)').bind(now),this.db.prepare('DELETE FROM pvp_limits WHERE expires_at<?').bind(now)]);}
}
export async function handleRoom(store,body,now=Date.now(),ip='local'){
  if(!body||!['create','join','input','ready','leave'].includes(body.op))throw new RoomError('Acción no válida.');
  if(['create','join'].includes(body.op)){
    const key=await digest(ip+':'+Math.floor(now/3600000));if(!(await store.limit(key,now)))throw new RoomError('Demasiados intentos. Espera un rato antes de crear o buscar otra sala.',429);
  }
  if(body.op==='create'){
    await store.cleanup(now);const token=crypto.randomUUID()+crypto.randomUUID(),hash=await digest(token),s=body.settings||{};
    for(let attempt=0;attempt<4;attempt++){
      const code=Array.from(crypto.getRandomValues(new Uint8Array(8)),n=>ALPHABET[n%ALPHABET.length]).join('');
      const room={code,players:[seat(body.name,hash,body.setup,now),null],settings:{capacity:[30,65,100,150].includes(s.capacity)?s.capacity:65,profile:['breeze','gusts','strong'].includes(s.profile)?s.profile:'breeze',wind:Math.max(4,Math.min(12,Number(s.wind)||6.5))},round:0,match:null,lastTick:now,carry:0,paused:null};
      if(await store.insert(room))return {token,...snapshot(room,0,now)};
    }throw new RoomError('No pudimos crear la sala. Intenta de nuevo.',503);
  }
  const code=String(body.code||'').toUpperCase().replace(/[\s-]/g,'');
  if(!/^[A-HJ-NP-Z2-9]{8}$/.test(code))throw new RoomError('Escribe el código de 8 caracteres.');
  const joining=body.op==='join'&&!body.token;
  if(!joining&&(typeof body.token!=='string'||body.token.length>100))throw new RoomError('Esta sesión ya no es válida. Vuelve a entrar.',401);
  const token=joining?crypto.randomUUID()+crypto.randomUUID():body.token,hash=await digest(token);
  for(let retry=0;retry<7;retry++){
    const row=await store.get(code);if(!row||row.expires_at<now)throw new RoomError('No encontramos esa sala. Revisa el código o crea otra.',404);
    const room=JSON.parse(row.data);let slot=room.players.findIndex(p=>p?.hash===hash);
    if(joining){if(room.players[1])throw new RoomError('La sala ya tiene dos jugadores.',409);slot=1;room.players[1]=seat(body.name,hash,body.setup,now);}
    else if(slot<0||room.players[slot].left)throw new RoomError('Tu asiento ya no está disponible. Crea otra sala.',401);
    // Advance the previous controls before applying the arriving command.
    advance(room,now);applyCommand(room,slot,body,now);
    if(await store.cas(code,row.revision,room,now))return {...(joining?{token}:{}),...snapshot(room,slot,now)};
  }throw new RoomError('La sala está sincronizando. Reintentando…',503);
}
