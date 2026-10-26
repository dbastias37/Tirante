import {PARTY_NPCS,cleanPartyOptions} from './party.js';
import {paperColor,PRINT_ID,printURL,appearance} from './appearance.js';
import {normalizeUpload} from './sail-art.js';
const $=id=>document.getElementById(id);
const node=(tag,text)=>{const el=document.createElement(tag);if(text)el.textContent=text;return el;};
export class PartySettings{
  constructor(saved,player,save){this.value=cleanPartyOptions(saved);this.player=player;this.save=save;this.busy=0;this.locked=false;
    for(const [id,key]of[['party-rules','rules'],['party-wind','profile'],['party-strength','wind'],['party-lives','lives']]){
      $(id).value=this.value[key];$(id).addEventListener('change',()=>{this.value[key]=['wind','lives'].includes(key)?Number($(id).value):$(id).value;this.rulesLabel();this.save();});
    }
  }
  rulesLabel(){
    if(this.value.rules!=='last-man')this.value.lives=3;
    $('party-lives').value=this.value.lives;$('party-lives').disabled=this.locked||this.value.rules!=='last-man';
    $('party-duration').textContent=this.value.rules==='last-man'?'Sin límite de tiempo':`${this.count===1?180:240} segundos`;
    $('party-rule-note').textContent=`${this.value.lives} vidas por participante. Cada corte o caída consume una; vuelves a elevar en 6 segundos. `+(this.value.rules==='last-man'?'Último en pie: gana quien conserve vidas, sin límite de tiempo.':'Al acabar el tiempo gana quien tenga más vidas; desempata el estado del hilo.')+' Sin vidas, puedes seguir como espectador.';
  }
  render(count,locked=false){this.count=count;this.locked=locked;this.rulesLabel();
    for(const id of ['party-rules','party-wind','party-strength'])$(id).disabled=locked;
    const cards=this.value.npcs.slice(0,count).map((s,i)=>{
      const card=node('div');card.className='party-npc-editor';card.style.setProperty('--rival',PARTY_NPCS[i].tint);
      const preview=node('div');preview.className='npc-preview';preview.id=`party-preview-${i}`;card.append(preview);
      const field=(labelText,el)=>{const label=node('label',labelText);label.htmlFor=el.id;label.append(el);card.append(label);};
      const name=node('input');name.id=`party-name-${i}`;name.value=s.name;name.maxLength=24;name.disabled=locked;
      const saveName=()=>{s.name=name.value.replace(/[\u0000-\u001f\u007f]/g,'').trim().slice(0,24)||PARTY_NPCS[i].name;const image=preview.querySelector('img');if(image)image.alt=`Estampado de ${s.name}`;this.save();};
      name.addEventListener('input',saveName);name.addEventListener('change',()=>{saveName();name.value=s.name;});field(`Nombre del NPC ${i+1}`,name);
      const style=node('select');style.id=`party-design-${i}`;
      for(const [value,label]of[['classic','Clásico'],['solid','Color liso'],['image','Imagen propia']]){const option=node('option',label);option.value=value;style.append(option);}
      style.value=s.sailStyle;style.disabled=locked;style.addEventListener('change',()=>{if(style.value==='image'&&!s.printId){style.value=s.sailStyle;file.click();return;}s.sailStyle=style.value;this.save();this.preview(i);});field('Diseño',style);
      const color=node('input');color.type='color';color.id=`party-color-${i}`;color.value=paperColor(s);color.disabled=locked;color.addEventListener('input',()=>{s.paperColor=color.value;this.save();this.preview(i);});field('Color del papel',color);
      const upload=node('button','Subir estampado');upload.id=`party-upload-${i}`;upload.type='button';upload.disabled=locked;upload.className='menu-row';
      const file=node('input');file.id=`party-file-${i}`;file.type='file';file.accept='image/png,image/jpeg,image/webp';file.hidden=true;file.className='hidden';file.disabled=locked;
      upload.addEventListener('click',()=>file.click());file.addEventListener('change',()=>{const f=file.files[0];file.value='';if(f)this.upload(i,f);});
      const copy=node('button','Usar mi diseño');copy.id=`party-copy-${i}`;copy.type='button';copy.className='subtle-link';copy.disabled=locked;copy.addEventListener('click',()=>{Object.assign(s,appearance(this.player));style.value=s.sailStyle;color.value=paperColor(s);this.save();this.preview(i);});
      const status=node('small',s.printId?'Imagen guardada':'PNG, JPG o WebP');status.id=`party-print-status-${i}`;status.setAttribute('role','status');card.append(upload,file,copy,status);return card;
    });$('party-roster').replaceChildren(...cards);for(let i=0;i<count;i++)this.preview(i);this.lockStart();
  }
  preview(i){const s=this.value.npcs[i],el=$(`party-preview-${i}`);if(!el)return;el.replaceChildren();el.style.background=paperColor(s);el.classList.toggle('classic',s.sailStyle==='classic');
    if(s.sailStyle==='image'&&s.printId){const image=node('img');image.src=printURL(s.printId);image.alt=`Estampado de ${s.name}`;image.addEventListener('error',()=>{const status=$(`party-print-status-${i}`);if(status)status.textContent='Imagen no disponible: vuelve a subirla.';});el.append(image);}
  }
  lockStart(){$('commission-start').disabled=this.busy>0;}
  async upload(i,file){
    this.busy++;this.lockStart();const s=this.value.npcs[i],status=$(`party-print-status-${i}`),button=$(`party-upload-${i}`);button.disabled=true;status.textContent='Guardando imagen…';
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),30000);
    try{const body=await normalizeUpload(file),response=await fetch('/api/prints',{method:'POST',headers:{'Content-Type':'image/png'},body,signal:controller.signal}),result=await response.json();
      if(!response.ok||!PRINT_ID.test(result.id))throw Error(result.error||'No se pudo guardar la imagen.');
      Object.assign(s,{printId:result.id,sailStyle:'image',imageFit:'cover',imageScale:1});this.save();this.preview(i);const select=$(`party-design-${i}`);if(select)select.value='image';status.textContent='Estampado listo.';
    }catch(error){status.textContent=error.name==='AbortError'?'La carga tardó demasiado. Intenta otra vez.':error.message;}
    finally{clearTimeout(timeout);this.busy--;button.disabled=this.locked;this.lockStart();}
  }
}
