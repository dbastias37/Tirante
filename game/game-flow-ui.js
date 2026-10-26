import {GameFlow,GAME_MODES} from './game-flow.js';
import {equipmentStats} from './equipment.js';
import {configuration} from './physics.js';
import {artKey,cachedSailArt} from './sail-art.js';
import {PAPER_OPACITY} from './render-settings.js';
import {bridleAnchors,bridleJunction} from './kite-shape.js';
import {paperColor} from './appearance.js';
import {distanceHTML,populateCapacities} from './units.js';
const $=id=>document.getElementById(id);
export class GameFlowUI extends GameFlow{
  constructor(callbacks){super();this.cb=callbacks;
    $('title-enter').onclick=()=>this.show('menu');$('menu-new').onclick=()=>this.show('modes');$('menu-settings').onclick=()=>this.show('settings');$('menu-help').onclick=()=>this.cb.edit('help');$('menu-title').onclick=()=>this.show('title');
    for(const button of document.querySelectorAll('[data-flow-back]'))button.onclick=()=>{super.back();this.paint();};
    const cards=GAME_MODES.map((mode,index)=>{const button=document.createElement('button');button.className='mode-card';button.dataset.gameMode=mode.id;button.innerHTML=`<span class="mode-number">0${index+1}</span><small>${mode.tag}</small><strong>${mode.name}</strong><p>${mode.description}</p><span class="mode-arrow" aria-hidden="true">↗</span>`;button.onclick=()=>this.select(mode.id);return button;});$('mode-grid').replaceChildren(...cards);
    for(const kind of ['kite','equipment','conditions'])$('prep-'+kind).onclick=()=>this.cb.edit(kind,this.choice);
    $('prep-start').onclick=()=>this.cb.begin(this.choice);$('settings-audio').onclick=()=>this.cb.audio();$('settings-assists').onclick=()=>this.cb.assists();
    populateCapacities($('prep-capacity'));$('prep-capacity').onchange=e=>{this.cb.capacity(Number(e.target.value));this.refresh();};this.paint();
  }
  show(page){super.go(page);this.paint();}
  select(id){super.choose(id);this.cb.choose(id);this.paint();}
  hide(){super.hide();this.paint();}
  paint(){document.body.classList.toggle('preparing-trail',this.preparing&&this.choice==='trail');document.body.classList.toggle('front-end-open',this.state!=='hidden');for(const section of document.querySelectorAll('[data-flow-page]'))section.classList.toggle('hidden',section.dataset.flowPage!==this.state);this.refresh();const page=document.querySelector(`[data-flow-page="${this.state}"]`);if(page){page.scrollTop=0;requestAnimationFrame(()=>{if(!page.classList.contains('hidden'))page.querySelector('button')?.focus({preventScroll:true});});}}
  key(event){if(this.state==='hidden')return false;if(event.key==='Enter'&&this.state==='title'){event.preventDefault();this.show('menu');return true;}if(event.key==='Escape'){event.preventDefault();super.back();this.paint();return true;}return false;}
  refresh(){
    const s=this.cb.snapshot(this.choice);$('settings-audio').textContent=s.audio?'Sonido: activado':'Sonido: apagado';$('settings-audio').setAttribute('aria-pressed',s.audio);$('settings-assists').textContent=s.assists?'Ayudas visuales: activadas':'Ayudas visuales: desactivadas';$('settings-assists').setAttribute('aria-pressed',s.assists);
    if(!this.preparing)return;const mode=GAME_MODES.find(m=>m.id===this.choice),trim=configuration(s.setup),e=equipmentStats(s.setup);
    $('prep-mode').textContent=mode.name;$('prep-description').textContent=mode.description;
    $('prep-paper-summary').textContent=`${(trim.mass*1000).toFixed(1).replace('.',',')} g · ${s.setup.tail?'con cola':'sin cola'}`;
    $('prep-trim').textContent=Math.abs(trim.bias)>.08?'Tirantes con giro preferente':trim.spread<.25?'Tirantes centrados · giro ágil':'Tirantes equilibrados';
    $('prep-material').textContent=s.setup.sailStyle==='image'?'Estampado personalizado':s.setup.sailStyle==='solid'?'Papel de color liso':'Papel de diseño clásico';
    $('prep-thread').textContent=e.thread.name;$('prep-reel').textContent=e.reel.name;$('prep-bearing').textContent=e.bearing.name;
    $('prep-equipment-stats').textContent=`${e.thread.diameter.toFixed(2).replace('.',',')} mm · recogida ${e.speed.toFixed(2).replace('.',',')}× · esfuerzo ${Math.round(e.effort*100)} %`;
    $('prep-weather').textContent=`${s.weather} · ${(s.wind*3.6).toFixed(1).replace('.',',')} km/h`;$('prep-opponents').textContent=s.opponents;
    $('prep-capacity').value=s.capacity;$('prep-capacity').disabled=s.fixed;$('prep-capacity-detail').innerHTML=distanceHTML(s.capacity);
    $('prep-equipment').disabled=s.fixed;$('prep-conditions').disabled=s.fixed;$('prep-conditions').textContent=this.choice==='online'?'Condiciones de la sala →':['party','last-man'].includes(this.choice)?'Viento y rivales →':'Elegir viento →';
    $('prep-note').textContent=s.fixed?'Rastro de luz usa el mismo equipo equilibrado, brisa y longitud en cada intento. Puedes personalizar el diseño.':this.choice==='online'?'Al continuar, podrás crear una sala o unirte. El anfitrión elige el viento y la longitud compartidos.':'Revisa el volantín, el equipo y las condiciones. La partida empieza solo cuando pulses «Comenzar partida».';
    $('prep-start').textContent=this.choice==='online'?'Continuar a la sala ↗':'Comenzar partida ↗';$('prep-kite').textContent=s.fixed?'Cambiar diseño →':'Preparar volantín →';
    const key=artKey(s.setup)+JSON.stringify([s.setup.tail,s.setup.left,s.setup.right,s.setup.lower,s.setup.anchorLeft,s.setup.anchorRight,s.setup.knotsLeft,s.setup.knotsRight,s.setup.knotsLower]);if(key!==this.previewKey){this.previewKey=key;const art=cachedSailArt(s.setup);this.drawPreview(s.setup,art.canvas);art.ready.then(canvas=>{if(this.previewKey===key)this.drawPreview(s.setup,canvas);}).catch(()=>{});}
  }
  drawPreview(setup,art){const canvas=$('prep-preview'),c=canvas.getContext('2d'),color=paperColor(setup);c.clearRect(0,0,360,370);c.strokeStyle='#31564b12';c.lineWidth=1;for(let i=12;i<360;i+=24){c.beginPath();c.moveTo(i,0);c.lineTo(i,370);c.moveTo(0,i);c.lineTo(360,i);c.stroke();}
    c.strokeStyle='#94744f';c.lineWidth=3;c.beginPath();c.moveTo(180,32);c.lineTo(180,292);c.moveTo(50,162);c.quadraticCurveTo(180,84,310,162);c.stroke();
    c.save();c.beginPath();c.moveTo(180,32);c.lineTo(310,162);c.lineTo(180,292);c.lineTo(50,162);c.closePath();c.clip();c.globalAlpha=PAPER_OPACITY;c.drawImage(art,50,32,260,260);c.restore();c.lineWidth=1;c.strokeStyle='#466b5877';c.stroke();
    const project=([x,y,z])=>[180+x*325+z*170,162-y*325+z*100],junction=project(bridleJunction(configuration(setup)));c.strokeStyle='#35594d';c.beginPath();for(const anchor of bridleAnchors(setup)){c.moveTo(...project(anchor));c.lineTo(...junction);}c.moveTo(...junction);c.lineTo(295,320);c.stroke();
    if(setup.tail){c.strokeStyle=color;c.lineWidth=2;c.beginPath();c.moveTo(180,292);c.bezierCurveTo(150,316,204,331,174,356);c.stroke();for(const [x,y]of[[170,309],[184,329],[178,347]]){c.fillStyle=color;c.beginPath();c.moveTo(x-8,y-4);c.lineTo(x+8,y+4);c.lineTo(x+8,y-4);c.lineTo(x-8,y+4);c.closePath();c.fill();}}
  }
}
