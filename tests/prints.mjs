import assert from 'node:assert/strict';
import {validatePrint,readPrintBody,putPrint,MAX_PRINT_BYTES} from '../server/prints.js';
const png=new Uint8Array(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=','base64'));
assert.deepEqual(validatePrint(png),{width:1,height:1});
assert.throws(()=>validatePrint(new TextEncoder().encode('<svg><script>alert(1)</script></svg>')));
assert.throws(()=>validatePrint(new Uint8Array(MAX_PRINT_BYTES+1)));
for(const size of [0,769,0xffffffff]){const bad=png.slice();new DataView(bad.buffer).setUint32(16,size);assert.throws(()=>validatePrint(bad));}
const uploaded=[];const bucket={put:async(...args)=>uploaded.push(args)};
const id=await putPrint(bucket,png);assert.match(id,/^[a-f0-9]{64}$/);assert.equal(await putPrint(bucket,png),id);assert.equal(uploaded[0][0],`prints/${id}.png`);assert.deepEqual(uploaded[0][1],png);assert.equal(uploaded[0][2].httpMetadata.contentType,'image/png');
assert.deepEqual(await readPrintBody(new Request('https://example.test',{method:'POST',body:png})),png);
let cancelled=false;const stream=new ReadableStream({start(c){c.enqueue(new Uint8Array(MAX_PRINT_BYTES));c.enqueue(new Uint8Array(1));},cancel(){cancelled=true;}});
await assert.rejects(readPrintBody(new Request('https://example.test',{method:'POST',body:stream,duplex:'half'})));assert.equal(cancelled,true,'Chunked oversized uploads are cancelled before storage');
await assert.rejects(readPrintBody(new Request('https://example.test',{method:'POST',body:png,headers:{'Content-Length':String(MAX_PRINT_BYTES+1)}})));
console.log('PASS: PNG type/dimension limits, immutable image IDs, durable bucket writes, streamed body limit and early cancellation.');
