import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {resolve,extname,sep} from 'node:path';
import {SQLiteRooms,DiskPrints} from './storage.mjs';
import {handleRoom,RoomError,digest} from './rooms.js';
import {putPrint,validatePrint,MAX_PRINT_BYTES} from './prints.js';

const ROOT=fileURLToPath(new URL('../',import.meta.url));
const GAME=resolve(ROOT,'game');
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.woff2':'font/woff2'};
class HttpError extends Error{constructor(status,message){super(message);this.status=status;}}
function json(res,status,body){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(body));}
function body(req,limit){
  if(Number(req.headers['content-length'])>limit){req.resume();return Promise.reject(new HttpError(413,'Solicitud demasiado grande.'));}
  return new Promise((resolve,reject)=>{
    const chunks=[];let size=0,done=false;
    const finish=(error)=>{if(done)return;done=true;req.off('data',onData);req.off('end',onEnd);req.off('error',onError);req.off('aborted',onAbort);if(error){req.resume();reject(error);}else resolve(Buffer.concat(chunks,size));};
    const onData=chunk=>{size+=chunk.length;if(size>limit)finish(new HttpError(413,'Solicitud demasiado grande.'));else chunks.push(chunk);};
    const onEnd=()=>finish(),onError=()=>finish(new HttpError(400,'No se pudo leer la solicitud.')),onAbort=()=>finish(new HttpError(400,'Carga interrumpida.'));
    req.on('data',onData);req.on('end',onEnd);req.on('error',onError);req.on('aborted',onAbort);
  });
}
function sameOrigin(req,required=false){
  const origin=req.headers.origin;if(!origin){if(required)throw new HttpError(403,'Origen no válido.');return;}
  try{const u=new URL(origin);if(!['http:','https:'].includes(u.protocol)||u.host!==req.headers.host)throw new Error();}
  catch{throw new HttpError(403,'Origen no válido.');}
}
function clientIP(req,trustProxy){
  // Trust only the closest forwarded address when behind the Render proxy.
  const forwarded=req.headers['x-forwarded-for'];
  return trustProxy&&typeof forwarded==='string'?forwarded.split(',').at(-1).trim().slice(0,100):req.socket.remoteAddress||'local';
}

export function createApplication({dataDir=resolve(ROOT,'data'),trustProxy=false}={}){
  const rooms=new SQLiteRooms(dataDir),prints=new DiskPrints(dataDir);
  const housekeeping=setInterval(()=>rooms.cleanup(Date.now()).catch(e=>console.error('Storage cleanup failed:',e.message)),60000);housekeeping.unref();
  async function handler(req,res){
    res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');res.setHeader('X-Frame-Options','SAMEORIGIN');
    try{
      const url=new URL(req.url,'http://localhost'),path=url.pathname,method=req.method;
      if(path==='/healthz'&&(method==='GET'||method==='HEAD')){rooms.health();json(res,200,{ok:true,version:'1.7.0',storage:'sqlite+files'});return;}
      if(path==='/api/pvp'){
        if(method!=='POST')throw new HttpError(405,'Usa POST.');sameOrigin(req);
        if(req.headers['content-type']?.split(';')[0]!=='application/json')throw new HttpError(415,'Se requiere JSON.');
        let input;try{input=JSON.parse((await body(req,4096)).toString('utf8'));}catch(e){if(e instanceof SyntaxError)throw new HttpError(400,'Solicitud no válida.');throw e;}
        const result=await handleRoom(rooms,input,Date.now(),clientIP(req,trustProxy));json(res,200,result);return;
      }
      if(path==='/api/prints'){
        if(method!=='POST')throw new HttpError(405,'Usa POST.');sameOrigin(req,true);
        if(req.headers['content-type']!=='image/png')throw new HttpError(415,'Formato no permitido.');
        const now=Date.now(),key=await digest('print:'+clientIP(req,trustProxy)+':'+Math.floor(now/3600000));
        if(!await rooms.limit(key,now))throw new HttpError(429,'Has cargado muchas imágenes. Intenta más tarde.');
        const bytes=await body(req,MAX_PRINT_BYTES);try{validatePrint(bytes);}catch(e){throw new HttpError(400,e.message);}
        const id=await putPrint(prints,bytes);json(res,200,{id});return;
      }
      if(path.startsWith('/api/prints/')){
        if(!['GET','HEAD'].includes(method))throw new HttpError(405,'Usa GET.');
        const id=path.slice('/api/prints/'.length);if(!/^[a-f0-9]{64}$/.test(id))throw new HttpError(404,'No encontrado.');
        const image=await prints.get(id);if(!image)throw new HttpError(404,'No encontrado.');
        const etag=`"${id}"`;res.setHeader('ETag',etag);res.setHeader('Cache-Control','private, max-age=31536000, immutable');res.setHeader('Content-Type','image/png');
        if(req.headers['if-none-match']===etag){res.writeHead(304);res.end();return;}
        res.setHeader('Content-Length',image.length);res.writeHead(200);res.end(method==='HEAD'?undefined:image);return;
      }
      if(path.startsWith('/api/'))throw new HttpError(404,'No encontrado.');
      if(!['GET','HEAD'].includes(method))throw new HttpError(405,'Método no permitido.');
      let name;try{name=decodeURIComponent(path);}catch{throw new HttpError(400,'Ruta no válida.');}
      if(name.includes('\0')||name.includes('\\')||name.split('/').some(s=>s.startsWith('.')))throw new HttpError(404,'No encontrado.');
      const target=resolve(GAME,'.'+(name==='/'?'/index.html':name));
      if(!target.startsWith(GAME+sep)||!MIME[extname(target)])throw new HttpError(404,'No encontrado.');
      let info;try{info=await stat(target);}catch(e){if(e.code==='ENOENT'||e.code==='ENOTDIR')throw new HttpError(404,'No encontrado.');throw e;}
      if(!info.isFile())throw new HttpError(404,'No encontrado.');
      const etag=`W/"${info.size}-${Math.floor(info.mtimeMs)}"`;
      res.setHeader('Cache-Control','no-cache');res.setHeader('ETag',etag);res.setHeader('Content-Type',MIME[extname(target)]);
      if(req.headers['if-none-match']===etag){res.writeHead(304);res.end();return;}
      const content=method==='HEAD'?undefined:await readFile(target);res.setHeader('Content-Length',info.size);res.writeHead(200);res.end(content);
    }catch(error){
      const known=error instanceof HttpError||error instanceof RoomError;
      if(!known)console.error('Request failed:',error.code||error.name);
      if(res.headersSent){res.destroy();return;}
      if(error.status===413)res.setHeader('Connection','close');
      json(res,known?error.status:503,{error:known?error.message:'El servidor no pudo completar la solicitud. Intenta nuevamente.'});
    }
  }
  return {handler,rooms,prints,close(){clearInterval(housekeeping);rooms.close();}};
}

export async function startServer({port=Number(process.env.PORT||3000),host=process.env.HOST||'0.0.0.0',dataDir=resolve(process.env.DATA_DIR||resolve(ROOT,'data')),trustProxy=process.env.TRUST_PROXY==='1'}={}){
  if(!Number.isInteger(port)||port<0||port>65535)throw new Error('PORT debe ser un puerto válido.');
  const app=createApplication({dataDir,trustProxy});
  const server=createServer({requestTimeout:30000,headersTimeout:15000,keepAliveTimeout:5000,maxHeaderSize:16384},app.handler);
  try{await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,host,resolve);});}catch(e){app.close();throw e;}
  return {server,app,port:server.address().port,close:()=>new Promise((resolve,reject)=>server.close(error=>{app.close();error?reject(error):resolve();}))};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  const running=await startServer();console.log(`TIRANTE listo en el puerto ${running.port}`);
  let stopping=false;const shutdown=()=>{if(stopping)return;stopping=true;const timeout=setTimeout(()=>process.exit(1),8000);timeout.unref();running.close().then(()=>{clearTimeout(timeout);process.exit(0);}).catch(()=>process.exit(1));};
  process.once('SIGTERM',shutdown);process.once('SIGINT',shutdown);
}
