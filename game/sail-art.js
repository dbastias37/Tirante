import {appearance,paperColor,printURL} from './appearance.js';
const prints=new Map(),art=new Map();
export function loadPrint(id) {
  const url=printURL(id);if(!url)return Promise.reject(new Error('Estampado no válido.'));
  if(prints.has(id))return prints.get(id);
  const pending=new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>{prints.delete(id);reject(new Error('No pudimos cargar el estampado.'));};image.src=url;});
  prints.set(id,pending);return pending;
}
export function artKey(setup) {return JSON.stringify(appearance(setup));}
export function makeSailArt(setup,image,size=512) {
  const a=appearance(setup),canvas=document.createElement('canvas');canvas.width=canvas.height=size;
  const c=canvas.getContext('2d'),color=paperColor(a);c.fillStyle=a.sailStyle==='classic'?'#f8efd8':color;c.fillRect(0,0,size,size);
  if(a.sailStyle==='classic'){
    c.fillStyle=color;c.beginPath();c.moveTo(size/2,0);c.lineTo(size,size/2);c.lineTo(size/2,size/2);c.closePath();c.fill();
    c.beginPath();c.moveTo(0,size/2);c.lineTo(size/2,size);c.lineTo(size/2,size/2);c.closePath();c.fill();
  }else if(a.sailStyle==='image'&&image){
    // Contain fits the whole rectangular image INSIDE the diamond, not just
    // its square bounding box. Cover fills the paper and clips its corners.
    const w=image.naturalWidth||image.width,h=image.naturalHeight||image.height;
    const scale=(a.imageFit==='contain'?size/(w+h):Math.max(size/w,size/h))*a.imageScale;
    c.drawImage(image,(size-w*scale)/2,(size-h*scale)/2,w*scale,h*scale);
  }
  return canvas;
}
export function cachedSailArt(setup) {
  const key=artKey(setup);let entry=art.get(key);
  if(!entry){entry={canvas:makeSailArt(setup),ready:null};art.set(key,entry);const a=appearance(setup);
    entry.ready=a.sailStyle==='image'&&a.printId?loadPrint(a.printId).then(img=>{entry.canvas=makeSailArt(a,img);return entry.canvas;}):Promise.resolve(entry.canvas);
    entry.ready.catch(()=>{});if(art.size>16)art.delete(art.keys().next().value);
  }
  return entry;
}
export async function normalizeUpload(file) {
  if(!['image/png','image/jpeg','image/webp'].includes(file.type))throw new Error('Elige una imagen PNG, JPG o WebP.');
  if(!file.size||file.size>12*1024*1024)throw new Error('La imagen debe pesar menos de 12 MB.');
  const url=URL.createObjectURL(file),img=new Image();
  try{
    await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(new Error('No pudimos leer esa imagen.'));img.src=url;});
    if(img.naturalWidth*img.naturalHeight>40_000_000)throw new Error('La imagen es demasiado grande. Reduce su resolución.');
    const c=document.createElement('canvas');
    for(const side of [768,512]){
      const scale=Math.min(1,side/Math.max(img.naturalWidth,img.naturalHeight));c.width=Math.max(1,Math.round(img.naturalWidth*scale));c.height=Math.max(1,Math.round(img.naturalHeight*scale));
      c.getContext('2d').drawImage(img,0,0,c.width,c.height);const blob=await new Promise(resolve=>c.toBlob(resolve,'image/png'));
      if(blob&&blob.size<=1_100_000)return blob;
    }
    throw new Error('No pudimos reducir la imagen. Prueba con otra.');
  }finally{URL.revokeObjectURL(url);}
}

// Affine mapping of a small projected sail triangle for Canvas fallback.
export function texturedTriangle(c,image,src,dst) {
  const [a,b,d]=src,[p,q,r]=dst,x1=b.x-a.x,y1=b.y-a.y,x2=d.x-a.x,y2=d.y-a.y,det=x1*y2-x2*y1;
  if(Math.abs(det)<1e-8||dst.some(v=>v.z>1||!Number.isFinite(v.x+v.y)))return;
  const ax=((q.x-p.x)*y2-(r.x-p.x)*y1)/det,bx=((q.y-p.y)*y2-(r.y-p.y)*y1)/det;
  const ay=((r.x-p.x)*x1-(q.x-p.x)*x2)/det,by=((r.y-p.y)*x1-(q.y-p.y)*x2)/det;
  c.save();c.beginPath();c.moveTo(p.x,p.y);c.lineTo(q.x,q.y);c.lineTo(r.x,r.y);c.closePath();c.clip();
  c.transform(ax,bx,ay,by,p.x-ax*a.x-ay*a.y,p.y-bx*a.x-by*a.y);c.drawImage(image,0,0);c.restore();
}
