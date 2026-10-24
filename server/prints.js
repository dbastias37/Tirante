// Uploaded artwork is normalized to a small PNG by the client and validated
// again here. Immutable content IDs keep images out of PvP tick payloads.
export const MAX_PRINT_BYTES=1_100_000,MAX_PRINT_SIDE=768;
export function validatePrint(bytes) {
  const signature=[137,80,78,71,13,10,26,10];
  if(bytes.length<45||bytes.length>MAX_PRINT_BYTES||!signature.every((v,i)=>bytes[i]===v))throw new Error('El estampado debe ser una imagen PNG válida.');
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  if(view.getUint32(8)!==13||String.fromCharCode(...bytes.slice(12,16))!=='IHDR')throw new Error('El archivo PNG no es válido.');
  const width=view.getUint32(16),height=view.getUint32(20);
  if(!width||!height||width>MAX_PRINT_SIDE||height>MAX_PRINT_SIDE)throw new Error('El estampado supera el tamaño permitido.');
  return {width,height};
}
export async function readPrintBody(request) {
  if(Number(request.headers.get('content-length'))>MAX_PRINT_BYTES)throw new Error('El estampado es demasiado grande.');
  if(!request.body)throw new Error('No llegó una imagen.');
  const reader=request.body.getReader(),chunks=[];let size=0;
  try{while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>MAX_PRINT_BYTES){await reader.cancel();throw new Error('El estampado es demasiado grande.');}chunks.push(value);}}finally{reader.releaseLock();}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}return bytes;
}
export async function putPrint(bucket,bytes) {
  validatePrint(bytes);
  const hash=await crypto.subtle.digest('SHA-256',bytes),id=Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('');
  await bucket.put(`prints/${id}.png`,bytes,{httpMetadata:{contentType:'image/png'}});
  return id;
}
