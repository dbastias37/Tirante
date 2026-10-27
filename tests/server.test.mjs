import assert from 'node:assert/strict';
import test from 'node:test';
import {request} from 'node:http';
import {mkdtemp,rm,readdir} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {startServer} from '../server/index.mjs';
import {SQLiteRooms} from '../server/storage.mjs';

const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=','base64');

test('Servidor portable: archivos, dos jugadores, estampados y persistencia',async t=>{
  const dataDir=await mkdtemp(join(tmpdir(),'tirante-http-'));
  let running=await startServer({port:0,host:'127.0.0.1',dataDir,trustProxy:false});
  let base=`http://127.0.0.1:${running.port}`;
  t.after(async()=>{try{if(running)await running.close();}finally{await rm(dataDir,{recursive:true,force:true});}});
  const post=async payload=>{const res=await fetch(base+'/api/pvp',{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify(payload)});return {status:res.status,body:await res.json()};};
  const upload=(bytes=png,headers={})=>fetch(base+'/api/prints',{method:'POST',headers:{'Content-Type':'image/png',Origin:base,...headers},body:bytes});
  let host,guest,printId,previousTime;

  await t.test('Publica el juego y bloquea archivos internos',async()=>{
    const root=await fetch(base);assert.equal(root.status,200);assert.match(root.headers.get('content-type'),/text\/html/);assert.match(await root.text(),/TIRANTE/i);
    for(const [path,type] of [['/app.js?v=1.21.0','javascript'],['/style.css','css'],['/pilot-wardrobe-data.js','javascript'],['/pilot-walk-data.js','javascript'],['/pilot-locomotion.js','javascript'],['/pilot-appearance.js','javascript'],['/pilot-fabric.js','javascript'],['/pilot-hands.js','javascript'],['/pilot-surface.js','javascript'],['/pilot-skinning.js','javascript'],['/pilot-kit-data.js','javascript'],['/pilot-hand-data.js','javascript'],['/pilot-textures.js','javascript'],['/assets/pilots/alma-face.webp','image/webp'],['/assets/pilots/mateo-face.webp','image/webp'],['/assets/pilots/nico-face.webp','image/webp'],['/assets/pilots/sport-shoe.webp','image/webp'],['/credits.html','html'],['/assets/licenses/sneakers-original.html','html'],['/vendor/three.module.js','javascript']]){
      const res=await fetch(base+path);assert.equal(res.status,200,path);assert.match(res.headers.get('content-type'),new RegExp(type));await res.arrayBuffer();
    }
    const head=await fetch(base,{method:'HEAD'});assert.equal(head.status,200);assert(Number(head.headers.get('content-length'))>0);assert.equal(await head.text(),'');
    const cached=await fetch(base,{headers:{'If-None-Match':head.headers.get('etag')}});assert.equal(cached.status,304);
    const health=await fetch(base+'/healthz');assert.deepEqual(await health.json(),{ok:true,version:'1.21.0',storage:'sqlite+files'});
    for(const path of ['/.env','/%2eenv','/data/tirante.sqlite','/server/index.mjs','/package.json','/unknown.js','/api/missing','/%2e%2e%2fserver%2frooms.js']){
      const res=await fetch(base+path);assert.equal(res.status,404,path);await res.arrayBuffer();
    }
  });

  await t.test('Valida solicitudes sin romper el servicio',async()=>{
    assert.equal((await post(null)).status,400);
    assert.equal((await post({op:'not-an-operation'})).status,400);
    const malformed=await fetch(base+'/api/pvp',{method:'POST',headers:{'Content-Type':'application/json'},body:'{'});assert.equal(malformed.status,400);await malformed.text();
    const tooLarge=await post({op:'create',name:'a'.repeat(5000)});assert.equal(tooLarge.status,413);
    const foreign=await fetch(base+'/api/pvp',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://example.org'},body:'{"op":"create"}'});assert.equal(foreign.status,403);await foreign.text();
    const wrongType=await fetch(base+'/api/pvp',{method:'POST',headers:{'Content-Type':'text/plain'},body:'{}'});assert.equal(wrongType.status,415);await wrongType.text();
  });

  await t.test('Crea una sala con dos asientos y autorización por jugador',async()=>{
    const a=await post({op:'create',name:'Uno',settings:{capacity:150,wind:8}});assert.equal(a.status,200);host=a.body;
    const b=await post({op:'join',code:host.code,name:'Dos'});assert.equal(b.status,200);guest=b.body;
    assert.equal(host.slot,0);assert.equal(guest.slot,1);assert.equal(host.code,guest.code);assert.equal(host.settings.capacity,150);
    assert(!JSON.stringify(guest).includes(host.token));assert(!JSON.stringify(guest.players).includes('hash'));
    assert.equal((await post({op:'join',code:host.code,name:'Tres'})).status,409);
    assert.equal((await post({op:'input',code:host.code,token:'incorrecto',seq:1,input:{}})).status,401);
    const separate=await post({op:'create'});
    const racers=await Promise.all([1,2].map(i=>post({op:'join',code:separate.body.code,name:`Rival ${i}`})));
    assert.deepEqual(racers.map(r=>r.status).sort(),[200,409],'SQLite conserva un solo segundo asiento ante solicitudes simultáneas');
  });

  await t.test('Acepta carretes de 300 y 1000 yardas para la sala',async()=>{
    for(const capacity of [274.32,914.4]){const response=await post({op:'create',name:'Carrete largo',settings:{capacity,wind:7}});assert.equal(response.status,200);assert.equal(response.body.settings.capacity,capacity);}
  });

  await t.test('Guarda y sirve estampados con su identificador estable',async()=>{
    const res=await upload();assert.equal(res.status,200);printId=(await res.json()).id;assert.match(printId,/^[a-f0-9]{64}$/);
    const duplicate=await upload();assert.equal((await duplicate.json()).id,printId);
    const art=await fetch(base+'/api/prints/'+printId);assert.equal(art.status,200);assert.equal(art.headers.get('content-type'),'image/png');assert.deepEqual(Buffer.from(await art.arrayBuffer()),png);
    const head=await fetch(base+'/api/prints/'+printId,{method:'HEAD'});assert.equal(head.status,200);assert.equal(Number(head.headers.get('content-length')),png.length);assert.equal(await head.text(),'');
    const cache=await fetch(base+'/api/prints/'+printId,{headers:{'If-None-Match':head.headers.get('etag')}});assert.equal(cache.status,304);
    const missing=await fetch(base+'/api/prints/'+'0'.repeat(64));assert.equal(missing.status,404);await missing.text();
    assert.equal((await readdir(join(dataDir,'prints'))).length,1,'No quedan archivos temporales ni duplicados');
  });

  await t.test('Rechaza estampados inválidos y cargas demasiado grandes',async()=>{
    const foreign=await upload(png,{Origin:'https://example.org'});assert.equal(foreign.status,403);await foreign.text();
    const absent=await fetch(base+'/api/prints',{method:'POST',headers:{'Content-Type':'image/png'},body:png});assert.equal(absent.status,403);await absent.text();
    const svg=await upload(Buffer.from('<svg/>'),{'Content-Type':'image/svg+xml'});assert.equal(svg.status,415);await svg.text();
    const invalid=await upload(Buffer.from('invalid'));assert.equal(invalid.status,400);await invalid.text();
    const wide=Buffer.from(png);wide.writeUInt32BE(769,16);const dimension=await upload(wide);assert.equal(dimension.status,400);await dimension.text();
    const big=await upload(Buffer.alloc(1_100_001));assert.equal(big.status,413);await big.text();
    const streamed=await new Promise((resolve,reject)=>{
      const req=request(base+'/api/prints',{method:'POST',headers:{'Content-Type':'image/png',Origin:base,'Transfer-Encoding':'chunked'}},res=>{res.resume();res.on('end',()=>resolve(res.statusCode));res.on('error',reject);});
      req.on('error',reject);req.write(Buffer.alloc(600000));req.end(Buffer.alloc(600000));
    });assert.equal(streamed,413,'El límite también aplica sin Content-Length');
    const health=await fetch(base+'/healthz');assert.equal(health.status,200);await health.text();
  });

  await t.test('Inicia el duelo con tirantes y estampados propios',async()=>{
    const setup={anchorLeft:25,anchorRight:75,sailStyle:'image',printId,imageFit:'contain',imageScale:1.2};
    const ready=await Promise.all([host,guest].map(p=>post({op:'ready',code:p.code,token:p.token,ready:true,setup})));
    ready.forEach(r=>assert.equal(r.status,200));
    await new Promise(resolve=>setTimeout(resolve,35));
    const state=await post({op:'input',code:host.code,token:host.token,seq:1,input:{action:'reel',boost:true}});
    assert.equal(state.status,200);assert.equal(state.body.round,1);assert.equal(state.body.phase,'preparing');assert.equal(state.body.ack,1);
    for(const p of state.body.match.pilots){assert.equal(p.setup.anchorLeft,25);assert.equal(p.setup.anchorRight,75);assert.equal(p.setup.sailStyle,'image');assert.equal(p.setup.printId,printId);assert.equal(p.setup.imageFit,'contain');}
    previousTime=state.body.match.pilots[0].body.time;assert(previousTime>0);
  });

  await t.test('Recupera sala, asiento, física y estampado después de reiniciar',async()=>{
    await running.close();running=null;
    running=await startServer({port:0,host:'127.0.0.1',dataDir,trustProxy:false});base=`http://127.0.0.1:${running.port}`;
    const art=await fetch(base+'/api/prints/'+printId);assert.equal(art.status,200);assert.deepEqual(Buffer.from(await art.arrayBuffer()),png);
    const restored=await post({op:'input',code:host.code,token:host.token,seq:2,input:{action:'hold'}});
    assert.equal(restored.status,200);assert.equal(restored.body.slot,0);assert.equal(restored.body.round,1);assert.equal(restored.body.ack,2);
    assert.equal(restored.body.match.pilots[0].setup.printId,printId);assert(restored.body.match.pilots[0].body.time>=previousTime);
    const other=await post({op:'input',code:guest.code,token:guest.token,seq:1,input:{action:'release'}});assert.equal(other.status,200);assert.equal(other.body.slot,1);
  });
});

test('SQLite rechaza revisiones viejas y elimina salas vencidas',async()=>{
  const dataDir=await mkdtemp(join(tmpdir(),'tirante-store-'));const store=new SQLiteRooms(dataDir);
  try{
    const room={code:'ABCDEFGH',lastTick:1000,value:'original'};
    assert.equal(await store.insert(room),true);assert.equal(await store.insert(room),false);
    const saved=await store.get(room.code);assert.equal(saved.revision,0);
    assert.equal(await store.cas(room.code,0,{...room,value:'nuevo'},2000),true);
    assert.equal(await store.cas(room.code,0,{...room,value:'viejo'},2000),false);
    assert.equal(JSON.parse((await store.get(room.code)).data).value,'nuevo');
    for(let i=0;i<30;i++)assert.equal(await store.limit('client-hour',1000),true);
    assert.equal(await store.limit('client-hour',1000),false);
    await store.cleanup(4_000_000);assert.equal(await store.get(room.code),null);assert.equal(await store.limit('client-hour',4_000_000),true);
  }finally{store.close();await rm(dataDir,{recursive:true,force:true});}
});
