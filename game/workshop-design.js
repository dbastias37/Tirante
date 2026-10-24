import {mountSettings,bridleAnchors,bridleJunction} from './kite-shape.js';
import {appearance,paperColor,PRINT_ID} from './appearance.js';
import {cachedSailArt,artKey,normalizeUpload} from './sail-art.js';
const $=id=>document.getElementById(id),all=s=>[...document.querySelectorAll(s)];
const svgPoint=([x,y])=>[210+x*350,175-y*350];
export class WorkshopDesign {
  constructor(setup,apply,toast){
    this.setup=setup;this.apply=apply;this.toast=toast;this.reverse=false;this.drag=null;
    for(const side of ['Left','Right']){
      const id='anchor-'+side.toLowerCase();$(id).addEventListener('input',e=>{setup['anchor'+side]=Number(e.target.value);apply();});
      const handle=$('mount-'+side.toLowerCase());
      handle.addEventListener('pointerdown',e=>{if(this.reverse)return;e.preventDefault();this.drag={id:e.pointerId,side,x:e.clientX,start:setup['anchor'+side]};$('blueprint').setPointerCapture(e.pointerId);});
      handle.addEventListener('keydown',e=>{if(this.reverse)return;let value=setup['anchor'+side];const sign=side==='Left'?-1:1;
        if(e.key==='Home')value=0;else if(e.key==='End')value=95;else if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))value+=(e.key==='ArrowLeft'?-sign:e.key==='ArrowRight'?sign:e.key==='ArrowUp'?1:-1)*(e.shiftKey?5:1);else return;
        e.preventDefault();setup['anchor'+side]=Math.max(0,Math.min(95,value));apply();
      });
    }
    $('blueprint').addEventListener('pointermove',e=>{if(!this.drag||e.pointerId!==this.drag.id)return;
      const matrix=$('blueprint').getScreenCTM();if(!matrix)return;
      const delta=(e.clientX-this.drag.x)/matrix.a/140*100*(this.drag.side==='Left'?-1:1);
      setup['anchor'+this.drag.side]=Math.round(Math.max(0,Math.min(95,this.drag.start+delta)));apply();
    });
    for(const type of ['pointerup','pointercancel','lostpointercapture'])$('blueprint').addEventListener(type,()=>this.drag=null);
    all('[data-mounts]').forEach(b=>b.addEventListener('click',()=>{setup.anchorLeft=setup.anchorRight=Number(b.dataset.mounts);apply();}));
    $('mount-balance').addEventListener('click',()=>{setup.anchorLeft=setup.anchorRight=Math.round((setup.anchorLeft+setup.anchorRight)/2);apply();});
    for(const back of [false,true])$('preview-'+(back?'back':'front')).addEventListener('click',()=>{this.reverse=back;this.updateView();});
    all('[data-sail-style]').forEach(b=>b.addEventListener('click',()=>{if(b.dataset.sailStyle==='image'&&!setup.printId){$('print-file').click();return;}setup.sailStyle=b.dataset.sailStyle;apply(false);}));
    all('[data-color]').forEach(b=>b.addEventListener('click',()=>{setup.color=b.dataset.color;setup.paperColor=null;apply(false);}));
    $('paper-color').addEventListener('input',e=>{setup.paperColor=e.target.value;apply(false);});
    $('image-fit').addEventListener('change',e=>{setup.imageFit=e.target.value;apply(false);});
    $('image-scale').addEventListener('input',e=>{setup.imageScale=Number(e.target.value);apply(false);});
    $('print-upload').addEventListener('click',()=>$('print-file').click());
    $('print-file').addEventListener('change',e=>{const file=e.target.files[0];e.target.value='';if(file)this.upload(file);});
    $('print-remove').addEventListener('click',()=>{setup.printId='';setup.sailStyle='solid';this.previewKey=null;$('print-status').textContent='Estampado quitado del volantín.';apply(false);});
  }
  updateView(){
    $('blueprint').classList.toggle('rear-view',this.reverse);
    $('preview-front').setAttribute('aria-pressed',String(!this.reverse));$('preview-back').setAttribute('aria-pressed',String(this.reverse));
    $('preview-face').textContent=this.reverse?'REVERSO · PALILLOS':'FRENTE · TIRANTES';
    $('preview-note').textContent=this.reverse?'Los dos palillos están detrás del papel. Los tirantes salen por el frente.':$('blueprint').classList.contains('design-view')?'Vista del estampado sobre el papel. Abre Tirantes para ajustar los puntos de anclaje.':'Arrastra I y D sobre la guía del arco, o usa los deslizadores. Los palillos quedan detrás.';
    for(const side of ['left','right'])$('mount-'+side).setAttribute('tabindex',this.reverse||$('blueprint').classList.contains('design-view')?'-1':'0');
  }
  update(trim){
    const s=this.setup,m=mountSettings(s),anchors=bridleAnchors(s).map(svgPoint),joint=svgPoint(bridleJunction(trim));
    const [cx,cy]=joint;
    ['left','right','lower'].forEach((key,i)=>{
      $('bridle-'+key).setAttribute('d',`M${anchors[i][0]} ${anchors[i][1]} ${cx} ${cy}`);
      $('anchor-point-'+key).setAttribute('cx',anchors[i][0]);$('anchor-point-'+key).setAttribute('cy',anchors[i][1]);
    });
    $('bridle-main').setAttribute('d',`M${cx} ${cy} 260 355`);$('bridle-junction').setAttribute('cx',cx);$('bridle-junction').setAttribute('cy',cy);
    $('blueprint-knots').innerHTML=['knotsLeft','knotsRight','knotsLower'].map((key,i)=>Array.from({length:s[key]},(_,k)=>{const t=.38+k*.11;return `<circle cx="${anchors[i][0]+(cx-anchors[i][0])*t}" cy="${anchors[i][1]+(cy-anchors[i][1])*t}" r="3.6"/>`;}).join('')).join('');
    const close=anchors[1][0]-anchors[0][0]<64,mid=(anchors[0][0]+anchors[1][0])/2;
    ['left','right'].forEach((side,i)=>{
      const value=m[side],a=anchors[i],x=close?mid+(i?32:-32):a[0],y=a[1]-20;
      $('mount-'+side).setAttribute('transform',`translate(${x} ${y})`);
      $('mount-'+side).setAttribute('aria-valuenow',value);$('mount-'+side).setAttribute('aria-valuetext',value===0?'En el centro':`${value}% hacia el extremo ${side==='left'?'izquierdo':'derecho'}`);
      $('mount-lead-'+side).setAttribute('d',`M${a[0]} ${a[1]} ${x} ${y}`);
      $('anchor-'+side).value=value;$('anchor-'+side+'-value').textContent=value===0?'Centro':value+'%';
    });
    $('anchor-separation').textContent=((m.left+m.right)*.4).toFixed(1)+' cm';
    $('anchor-offset').textContent=Math.abs(m.center)<.001?'Centrado':Math.abs(m.center*100).toFixed(1)+' cm a la '+(m.center>0?'derecha':'izquierda');
    const a=appearance(s),color=paperColor(s);
    $('paper-base').setAttribute('fill',a.sailStyle==='classic'?'#f8efd8':color);
    for(const id of ['paper-patch-a','paper-patch-b']){$(id).setAttribute('fill',color);$(id).style.display=a.sailStyle==='classic'?'':'none';}
    $('blueprint-tail').style.display=s.tail?'':'none';$('blueprint-tail').setAttribute('stroke',color);$('blueprint-tail').querySelectorAll('[fill]').forEach(e=>e.setAttribute('fill',color));
    all('[data-color]').forEach(el=>{const selected=!a.paperColor&&el.dataset.color===a.color;el.classList.toggle('selected',selected);el.setAttribute('aria-pressed',selected);});
    all('[data-sail-style]').forEach(el=>el.setAttribute('aria-pressed',el.dataset.sailStyle===a.sailStyle));
    $('paper-color').value=color;$('image-fit').value=a.imageFit;$('image-scale').value=a.imageScale;$('image-scale-value').textContent=a.imageScale.toFixed(1)+'×';
    $('print-adjustments').classList.toggle('hidden',!a.printId);$('print-remove').disabled=!a.printId||this.uploading;
    const key=artKey(s);
    if(key!==this.previewKey){this.previewKey=key;$('paper-image').classList.add('hidden');
      if(a.sailStyle==='image'&&a.printId)cachedSailArt(a).ready.then(canvas=>{if(this.previewKey!==key)return;$('paper-image').setAttribute('href',canvas.toDataURL('image/png'));$('paper-image').classList.remove('hidden');}).catch(()=>{if(this.previewKey===key)$('print-status').textContent='No se pudo cargar el estampado. Puedes volver a subirlo.';});
    }
    this.updateView();
  }
  async upload(file){
    if(this.uploading)return;this.uploading=true;$('print-upload').disabled=true;$('print-remove').disabled=true;$('print-status').textContent='Preparando imagen…';
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),30000);
    try{
      const body=await normalizeUpload(file);$('print-status').textContent='Guardando estampado…';
      const res=await fetch('/api/prints',{method:'POST',headers:{'Content-Type':'image/png'},body,signal:controller.signal});
      const result=await res.json();if(!res.ok||!PRINT_ID.test(result.id))throw new Error(result.error||'No pudimos guardar la imagen.');
      this.setup.printId=result.id;this.setup.sailStyle='image';this.setup.imageScale=1;this.apply(false);
      $('print-status').textContent='Estampado guardado. Lo verás al volar y también lo verá tu rival online.';
    }catch(error){$('print-status').textContent=error.name==='AbortError'?'La carga tardó demasiado. Intenta otra vez.':error.message;}
    finally{clearTimeout(timeout);this.uploading=false;$('print-upload').disabled=false;$('print-remove').disabled=!this.setup.printId;}
  }
}
