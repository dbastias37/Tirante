import {WorkshopDesign} from './workshop-design.js';
import {appearance} from './appearance.js';
import {mountSettings} from './kite-shape.js';
import {CompactFlightUI} from './compact-ui.js';
import {LightTrail,TRAIL_VERSION,formatTrailTime as formatTime} from './trail.js';
import {solveRopeSystem} from './rope-system.js';
import {KitePhysics,DEFAULT_SETUP,configuration,clamp} from './physics.js';
import {PartyCommission,escapeHTML} from './party.js';
import {PartySettings} from './party-settings.js';
import {drawContact} from './contact-view.js';
import {Landscape} from './scene.js';
import {OnlineGame} from './online.js';
import {CanvasLandscape} from './canvas-scene.js';
import {GameFlowUI} from './game-flow-ui.js';
import {distanceHTML,distanceText,yardsValue,metersValue,populateCapacities} from './units.js';
import {LINE_CAPACITIES,cleanHeightRecord} from './line-config.js';
import {cleanEquipment} from './equipment.js';
import {EquipmentUI} from './equipment-ui.js';
import {spectatorView} from './spectator-camera.js';

const $=id=>document.getElementById(id), all=s=>[...document.querySelectorAll(s)];
const STORAGE='tirante.v1';let storageAvailable=true;
function readSaved(){try{return JSON.parse(localStorage.getItem(STORAGE)||'{}');}catch{return {};}}
const saved=readSaved();
const setup={...DEFAULT_SETUP};
for(const key of ['left','right','lower'])if(Number.isFinite(saved.setup?.[key]))setup[key]=clamp(saved.setup[key],key==='lower'?42:34,key==='lower'?62:54);
for(const key of ['knotsLeft','knotsRight','knotsLower'])if(Number.isInteger(saved.setup?.[key]))setup[key]=clamp(saved.setup[key],0,5);
if(Number.isFinite(saved.setup?.mass))setup.mass=clamp(saved.setup.mass,22,70);
if(typeof saved.setup?.tail==='boolean')setup.tail=saved.setup.tail;
Object.assign(setup,appearance(saved.setup),cleanEquipment(saved.setup));
const savedMounts=mountSettings(saved.setup);setup.anchorLeft=savedMounts.left;setup.anchorRight=savedMounts.right;
const physics=new KitePhysics(setup,{seed:crypto.getRandomValues(new Uint32Array(1))[0]});
if(LINE_CAPACITIES.includes(saved.lineCapacity))physics.setLineCapacity(saved.lineCapacity);
let partyCount=[1,2,3].includes(saved.partyCount)?saved.partyCount:3;
const duel=new PartyCommission(physics),duelStats={wins:0,losses:0,draws:0};
for(const key of Object.keys(duelStats))if(Number.isInteger(saved.duelStats?.[key])&&saved.duelStats[key]>=0)duelStats[key]=saved.duelStats[key];
let duelRecorded=false,resultAt=0,resultShown=false;
if(['breeze','gusts','strong','calm'].includes(saved.profile))physics.profile=saved.profile;
if(Number.isFinite(saved.windSpeed))physics.windSpeed=clamp(saved.windSpeed,1,12);
let record=cleanHeightRecord(saved.record),assists=saved.assists!==false;
const trail=new LightTrail(physics);let trailBest=saved.trailVersion===TRAIL_VERSION&&Number.isFinite(saved.trailBest)&&saved.trailBest>0?saved.trailBest:null,trailResultShown=false,trailFinishedAt=0,trailNewBest=false;
let online=null,compactUI=null,workshopDesign=null,partyUI=null,equipmentUI=null,flow=null;
let landscape, mode='intro',modal=null,previousFocus=null,setupChanged=false,onlineSettingsReturn=false,toastTimeout,drag=null,audio=null,shiftDown=false,boostLatched=false;
const keys=new Set(),pointers=new Map();let zoom=false,graphTime=0,lastUi=0,windHistory=Array(48).fill(14),accumulator=0,lastTime=0;
function save(){try{localStorage.setItem(STORAGE,JSON.stringify({setup,profile:trail.saved?.profile||physics.profile,windSpeed:trail.saved?.windSpeed??physics.windSpeed,record,assists,lineCapacity:trail.saved?.lineCapacity??physics.lineCapacity,duelStats,partyCount,npcLevel:$('npc-level').value,partyOptions:partyUI?.value||saved.partyOptions,trailBest,trailVersion:TRAIL_VERSION}));storageAvailable=true;}catch{storageAvailable=false;}}
function toast(message){$('toast').textContent=message;$('toast').classList.remove('hidden');clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>$('toast').classList.add('hidden'),4200);}
function releaseAll(){keys.clear();pointers.clear();shiftDown=false;boostLatched=false;if(!online?.active){physics.sawing=false;physics.setControls('hold',false);}updateControlState();}
const spectator=()=>spectatorView(physics,duel);
function updateControlState(){
  const releasing=[...pointers.values()].includes('release')||keys.has('q'),reeling=[...pointers.values()].includes('reel')||keys.has('e');
  const active=!spectator().active&&!modal&&mode==='flight'&&duel.state!=='preparing'&&duel.state!=='finished'&&trail.state!=='preparing'&&trail.state!=='finished',requested=active&&(shiftDown||boostLatched),boost=requested&&!physics.exhausted&&physics.energy>0;
  const saw=active&&duel.state==='playing'&&(keys.has('f')||[...pointers.values()].includes('saw')),action=!active?'hold':reeling?'reel':releasing?'release':'hold';
  if(online?.active)online.controls({action,boost:requested,saw,x:active?Number(keys.has('d')||[...pointers.values()].includes('right'))-Number(keys.has('a')||[...pointers.values()].includes('left')):0,z:active?Number(keys.has('s')||[...pointers.values()].includes('back'))-Number(keys.has('w')||[...pointers.values()].includes('forward')):0});else{physics.sawing=saw;physics.setControls(saw?physics.action:action,requested);}
  $('saw-button').classList.toggle('pressed',physics.sawing);$('saw-button').setAttribute('aria-pressed',physics.sawing);$('saw-button').disabled=duel.state!=='playing'||duel.spectating;
  $('release-button').classList.toggle('pressed',physics.action==='release');$('reel-button').classList.toggle('pressed',physics.action==='reel');
  $('action-label').textContent={hold:'MANTENER',release:'SOLTANDO',reel:'RECOGIENDO'}[physics.action];
  $('action-line').style.width=physics.action==='release'?'24px':physics.action==='reel'?'52px':'38px';
  $('line-speed-label').textContent=requested&&!boost?'recuperando energía':boost?'velocidad ×2,5':physics.energy<20?'ritmo suave':'velocidad normal';
  $('boost-button').classList.toggle('exhausted',requested&&!boost);
  $('boost-button').classList.toggle('active',boost);$('boost-button').setAttribute('aria-pressed',requested);
  $('boost-button').setAttribute('aria-label',requested?'Desactivar boost':'Activar boost');
  $('control-dock').classList.toggle('boosting',boost&&physics.action!=='hold');
  $('tug-label').textContent=requested?'Tirón ×2':'Tirón';
}
function setMode(next){mode=next;landscape.pilotFocus=-1;compactUI?.setFlight(next==='flight');releaseAll();$('intro').classList.toggle('hidden',next!=='intro');if(next==='flight')flow?.hide();else if(flow?.state==='hidden')flow.show('menu');$('flight-ui').classList.toggle('hidden',next!=='flight');document.querySelector('.topbar').classList.toggle('flight-mode',next==='flight');if(next==='flight'){landscape.follow=true;updateFollow();}updateUI();}
function openModal(id){compactUI?.setCameraTools(false);if(id==='trail-modal'&&online?.active){online.open();return;}if(id==='trail-modal')updateTrailMenu();if(trail.visible&&['workshop','wind-modal','equipment-modal'].includes(id)){toast('Termina el recorrido para cambiar el volantín o el viento.');return;}if(online?.active&&id==='commission-modal')id='online-modal';if(online?.active&&['workshop','wind-modal','equipment-modal'].includes(id)){toast('Sal de la sala para cambiar tus ajustes.');return;}if(duel.active&&['workshop','wind-modal','equipment-modal'].includes(id)){toast('Termina la comisión para cambiar el volantín o el viento.');return;}releaseAll();if(id==='commission-modal')updateCommissionMenu();previousFocus=document.activeElement;if(id==='workshop'){setupChanged=false;updateWorkshop();}modal=id;all('#overlay>.modal').forEach(el=>el.classList.toggle('hidden',el.id!==id));$('overlay').classList.remove('hidden');$(id).scrollTop=0;if(id==='equipment-modal')equipmentUI.paint();if(id==='wind-modal')updateWindSettings();if(id==='pause-modal')$('resume-button').innerHTML=mode==='intro'?'Volver al inicio <span>↗</span>':'Continuar <span>↗</span>';requestAnimationFrame(()=>$(id).querySelector('button')?.focus({preventScroll:true}));}
function closeModal(){const old=modal;modal=null;if(old==='online-settings-modal'&&onlineSettingsReturn){onlineSettingsReturn=false;openModal('online-modal');flow?.refresh();return;}$('overlay').classList.add('hidden');if(['workshop','equipment-modal'].includes(old)&&setupChanged){physics.reset();setupChanged=false;if(mode==='flight')toast('Ajustes guardados. Prueba un nuevo lanzamiento.');}previousFocus?.focus?.({preventScroll:true});flow?.refresh();updateUI();}
function goFlying(){if(online?.active){leaveCommission();return;}stopTrail();duel.stop();closeModal();physics.reset();landscape.orbit.active=false;setMode('flight');toast(compactUI?.query.matches?'Mantén Soltar o Recoger. Activa Boost para acelerar.':'Q / E: soltar y recoger · Shift: boost · Shift + Espacio: doble tirón.');}
function launch(){if(modal||mode!=='flight'||duel.visible||trail.visible)return;physics.launch();updateControlState();landscape.follow=true;updateFollow();if(physics.windSpeed<1.8||physics.profile==='calm')toast('Puedes probar, pero sin suficiente viento volverá a tierra.');updateUI();}
function tug(double=physics.boost){if(spectator().active)return;if(mode!=='flight'||modal||duel.state==='preparing'||duel.state==='finished'||trail.state==='preparing'||trail.state==='finished')return;if(physics.state!=='flying'){launch();return;}if(online?.active){online.tug(double);return;}if(physics.tug(double))updateUI();else if(physics.energy<(double?14:7))toast('Falta energía para ese tirón. Suelta los controles para descansar.');}

function showFront(page='menu'){leaveCommission();setMode('intro');flow.show(page);accumulator=0;}
function beginPreparation(choice){showFront('modes');flow.select(choice);}
function chooseGameMode(choice){
  if(online?.active){online.leave();duel.stop();physics.networkControlled=false;duel.rival.networkControlled=false;physics.anchor.set(0,1.35,0);physics.configure(setup);physics.reset();landscape.configure(setup);}
  if(['party','last-man'].includes(choice)){partyUI.value.rules=choice==='last-man'?'last-man':'timed';if(choice==='party')partyUI.value.lives=3;$('party-rules').value=partyUI.value.rules;}
  if(choice==='online')$('online-capacity').value=physics.lineCapacity;
  save();
}
function preparationSnapshot(choice){
  const fixed=choice==='trail',party=['party','last-man'].includes(choice),net=choice==='online';
  const profile=fixed?'breeze':party?partyUI.value.profile:net?$('online-wind').value:physics.profile;
  return {setup:fixed?{...DEFAULT_SETUP,...appearance(setup)}:setup,fixed,capacity:fixed?65:net?Number($('online-capacity').value):physics.lineCapacity,wind:fixed?5.5:party?partyUI.value.wind:net?Number($('online-strength').value):physics.profile==='calm'?0:physics.windSpeed,weather:{breeze:'Brisa constante',gusts:'Entre ráfagas',strong:'Viento firme',calm:'En calma'}[profile],opponents:party?`${partyUI.value.lives} vidas · ${partyCount} rivales · ${partyUI.value.npcs.slice(0,partyCount).map(n=>n.name).join(', ')} · ${$('npc-level').value==='hard'?'Competitivo':'Hábil'}`:net?'Rival humano · 3 vidas · puestos a 19,7 yd (18 m)':fixed?'8 destellos · 90 segundos · equipo equilibrado':'Un vuelo sin rivales ni límite de tiempo',audio:!!audio?.enabled,assists};
}
function editPreparation(kind,choice){
  if(kind==='help'){openModal('help-modal');return;}
  if(kind==='kite'){openModal('workshop');if(choice==='trail')setWorkshopTab('design');return;}
  if(kind==='equipment'){openModal('equipment-modal');return;}
  if(choice==='online'){onlineSettingsReturn=false;openModal('online-settings-modal');return;}
  openModal(['party','last-man'].includes(choice)?'commission-modal':'wind-modal');
}
function beginPreparedGame(choice){if(choice==='online'){online.open();return;}if(choice==='trail')startTrail();else if(['party','last-man'].includes(choice))startCommission();else goFlying();}

function updateTrailMenu(){
  $('trail-start').textContent=trail.visible?'Empezar de nuevo ↺':'Comenzar recorrido ↗';
  $('trail-resume').classList.toggle('hidden',!trail.active);$('trail-leave').classList.toggle('hidden',!trail.visible);
  $('trail-menu-best').textContent=trailBest?`Tu mejor vuelta: ${formatTime(trailBest,true)}`:'Tu primera marca está por volar.';
}
function stopTrail(){if(!trail.visible)return;trail.stop();landscape.configure(physics.setup);trailResultShown=false;trailFinishedAt=0;}
function startTrail(){
  if(online?.active){online.open();return;}if(duel.active)duel.finish('loss','Abandonaste la comisión.');recordCommission();duel.stop();releaseAll();trail.start();landscape.configure(physics.setup);closeModal();setMode('flight');landscape.orbit.active=true;landscape.orbit.reset();landscape.zoom=false;zoom=false;landscape.follow=true;trailResultShown=false;trailFinishedAt=0;trailNewBest=false;updateFollow();updateUI();
}
function showTrailResult(){
  const r=trail.result;if(!r)return;trailResultShown=true;$('trail-medal').textContent=r.won?`MEDALLA DE ${r.medal.toUpperCase()}`:'RASTRO DE LUZ';$('trail-result-title').textContent=r.won?'El recorrido es tuyo.':'Queda cielo por descubrir.';$('trail-result-time').textContent=formatTime(r.seconds,true);$('trail-result-captures').textContent=`${r.collected} DE ${r.total} DESTELLOS`;$('trail-result-reason').textContent=r.reason;$('trail-new-best').textContent=trailNewBest?'Nueva mejor vuelta en este navegador.':trailBest?`Tu mejor vuelta: ${formatTime(trailBest,true)}`:'Prueba soltadas cortas y espera la respuesta del volantín.';openModal('trail-result-modal');
}
function viewPilot(){
  if(!duel.visible)return;
  const rivals=duel.rivals||[duel.rival];landscape.pilotFocus=(Number.isInteger(landscape.pilotFocus)?landscape.pilotFocus:-1)+1;
  if(landscape.pilotFocus>=rivals.length){landscape.pilotFocus=-1;landscape.orbit.active=false;}
  else{landscape.orbit.active=true;landscape.orbit.reset();landscape.orbit.distance=3.3;landscape.orbit.pitch=.09;const p=rivals[landscape.pilotFocus];landscape.orbit.yaw=Math.atan2(p.position.x-p.anchor.x,p.position.z-p.anchor.z)+.5;}
  landscape.follow=true;updateFollow();
}
function updateCamera(){
  const pilot=landscape.pilotFocus>=0&&duel.visible,name=duel.roster?.[landscape.pilotFocus+1]?.name||'Rival';
  $('pilot-view').classList.toggle('hidden',!duel.visible);$('pilot-view').setAttribute('aria-pressed',!!pilot);$('pilot-view').textContent=pilot?`${name} · siguiente →`:'Ver jugadores · P';

  const orbit=!spectator().onboard&&(landscape.orbit.active||spectator().orbital);document.body.classList.toggle('orbiting',orbit&&mode==='flight');$('camera-button').innerHTML=`Cámara: ${spectator().onboard?'a bordo':orbit?'orbital':'1ª persona'} <kbd>V</kbd>`;$('camera-button').setAttribute('aria-pressed',orbit);$('orbit-zoom').classList.toggle('hidden',!orbit);$('orbit-distance').innerHTML=distanceHTML(landscape.orbit.distance);
}
function toggleCamera(){if(landscape.pilotFocus>=0){landscape.pilotFocus=-1;landscape.orbit.active=false;landscape.follow=true;updateFollow();return;}if(spectator().active){duel.spectatorView=spectator().mode==='kite'?'onboard':spectator().mode==='onboard'?'battle':'kite';landscape.orbit.active=false;landscape.follow=true;updateFollow();return;}landscape.orbit.active=!landscape.orbit.active;landscape.follow=true;updateFollow();}
function centerCamera(){if(landscape.pilotFocus>=0){landscape.pilotFocus=-1;landscape.orbit.active=false;landscape.follow=true;updateFollow();return;}if(spectator().onboard)return;if(landscape.orbit.active||spectator().orbital)landscape.orbit.reset();else{landscape.follow=!landscape.follow;if(!landscape.follow){landscape.camera.getWorldDirection(landscape.forward);landscape.yaw=Math.atan2(landscape.forward.x,-landscape.forward.z);landscape.pitch=Math.asin(landscape.forward.y);}}updateFollow();}

const counted=(n,one,many)=>`${n} ${n===1?one:many}`;
function updatePartyRoster(){
  partyUI?.render(partyCount,duel.active);
  $('party-count').value=partyCount;
  $('commission-start').innerHTML=flow?.preparing?'Guardar condiciones <span>→</span>':`Jugar 1 vs ${partyCount} NPC <span>↗</span>`;if(flow?.preparing)$('party-rules').disabled=true;
}
function updateCommissionMenu(){
  updatePartyRoster();if(flow?.preparing){$('commission-start').textContent='Guardar condiciones →';$('party-rules').disabled=true;}$('party-count').disabled=duel.active;

  $('match-record').textContent=`${counted(duelStats.wins,'victoria','victorias')} · ${counted(duelStats.losses,'derrota','derrotas')} · ${counted(duelStats.draws,'empate','empates')}`;
  $('commission-start').classList.toggle('hidden',duel.active);$('commission-resume').classList.toggle('hidden',!duel.active);$('commission-leave').classList.toggle('hidden',!duel.active);$('match-active-note').classList.toggle('hidden',!duel.active);$('npc-level').disabled=duel.active;
}
function startCommission(){
  if(online?.active){online.open();return;}if(partyUI.busy)return;
  stopTrail();physics.networkControlled=false;duel.rival.networkControlled=false;physics.configure(setup);landscape.configure(setup);landscape.rivalKite?.configure({...setup,color:'teal'});
  closeModal();if(physics.profile==='calm'){physics.profile='breeze';physics.windSpeed=6.5;save();}
  setMode('flight');duel.startParty(partyCount,$('npc-level').value,partyUI.value);landscape.configureRivals?.(duel.rivals);duelRecorded=false;resultShown=false;resultAt=0;landscape.follow=true;zoom=false;landscape.zoom=false;$('zoom-button').innerHTML='Acercar <span>＋</span>';$('zoom-button').setAttribute('aria-pressed','false');$('contact-detail').open=false;updateFollow();updateControlState();updateUI();
}
function recordCommission(){if(online?.active)return;if(!duel.result||duelRecorded)return;duelRecorded=true;duelStats[{win:'wins',loss:'losses',draw:'draws'}[duel.result.outcome]]++;save();}
function leaveCommission(){stopTrail();if(online?.active){online.leave();duel.stop();physics.networkControlled=false;duel.rival.networkControlled=false;physics.anchor.set(0,1.35,0);physics.configure(setup);landscape.configure(setup);physics.reset();closeModal();setMode('flight');return;}if(duel.active)duel.finish('loss','Abandonaste la comisión.');recordCommission();duel.stop();closeModal();physics.reset();setMode('flight');}
function showCommissionResult(){
  const r=duel.result;if(!r)return;resultShown=true;renderPartyResults(r);$('result-title').textContent=r.winner?`${r.winner} ganó la Party`:'El cielo queda parejo.';$('result-reason').textContent=r.reason;$('result-player').textContent=(r.playerLives??physics.lives??0)+' vidas';$('result-rival').textContent=(r.rivalLives??duel.rival.lives??0)+' vidas';$('result-detail').textContent=`${r.seconds} segundos · ${duel.engagements} cruces · ${counted(duelStats.wins,'victoria','victorias')}`;openModal('result-modal');
}

function renderPartyResults(r){
  $('party-results').innerHTML=r.standings.map(e=>`<div style="--rival:${e.tint}"><strong>${escapeHTML(e.name)}</strong><span>${escapeHTML(e.reason)}</span><b>${e.lives} vidas</b></div>`).join('');
  $('party-result-summary').textContent=`1 vs ${r.npcCount} NPC · ${r.eliminated} de ${r.npcCount} rivales fuera`;
}
function buildWorkshop(){
  $('bridle-inputs').innerHTML=[['left','Izquierdo','knotsLeft'],['right','Derecho','knotsRight'],['lower','Inferior','knotsLower']].map(([key,label,knot])=>`<div class="bridle-setting"><label class="slider-label" for="${key}-input">${label}<strong><span id="${key}-output"></span> cm <small>útiles</small></strong></label><div class="bridle-control"><input id="${key}-input" type="range" min="${key==='lower'?42:34}" max="${key==='lower'?62:54}" step="0.5" value="${setup[key]}" aria-label="Longitud del tirante ${label.toLowerCase()}"><div class="knot-controls"><button data-unknot="${knot}" aria-label="Deshacer un nudo del tirante ${label.toLowerCase()}">−</button><span id="${key}-knots"></span><button data-knot="${knot}" aria-label="Hacer un nudo en el tirante ${label.toLowerCase()}">+</button></div></div></div>`).join('');
  for(const key of ['left','right','lower'])$(key+'-input').addEventListener('input',e=>{setup[key]=Number(e.target.value);applySetup();});
  all('[data-knot]').forEach(el=>el.addEventListener('click',()=>{setup[el.dataset.knot]=Math.min(5,setup[el.dataset.knot]+1);applySetup();}));
  all('[data-unknot]').forEach(el=>el.addEventListener('click',()=>{setup[el.dataset.unknot]=Math.max(0,setup[el.dataset.unknot]-1);applySetup();}));
}
function applySetup(physical=true){setupChanged=setupChanged||physical;physics.configure(setup);landscape.configure(setup);save();updateWorkshop();}
function updateWorkshop(){
  const trim=configuration(setup);
  for(const [key,knot] of [['left','knotsLeft'],['right','knotsRight'],['lower','knotsLower']]){$(key+'-output').textContent=trim[key].toFixed(1);$(key+'-input').value=setup[key];$(key+'-knots').textContent=setup[knot]+' nudo'+(setup[knot]===1?'':'s');document.querySelector(`[data-knot="${knot}"]`).disabled=setup[knot]>=5;document.querySelector(`[data-unknot="${knot}"]`).disabled=setup[knot]<=0;}
  $('mass-output').textContent=setup.mass;$('mass-input').value=setup.mass;$('tail-input').checked=setup.tail;$('paper-weight').textContent=(trim.mass*1000).toFixed(1)+' g';
  workshopDesign?.update(trim);
  $('radar-shape').setAttribute('d',`M95 ${91-66*trim.stability} ${95+60*trim.agility} ${91+34*trim.agility} ${95-60*trim.climb} ${91+34*trim.climb}Z`);
  $('bias-indicator').style.left=(50+trim.bias*45)+'%';
  if(Math.abs(trim.bias)>.005){$('trim-title').textContent=(Math.abs(trim.bias)>.17?'Busca la ':'Leve sesgo a la ')+(trim.bias>0?'derecha':'izquierda');$('trim-description').textContent='La posición de los anclajes y la longitud de los tirantes desplazan el equilibrio hacia ese lado.';}
  else if(trim.spread<.25){$('trim-title').textContent='Centrado y ágil';$('trim-description').textContent='Los anclajes cercanos al centro conservan el equilibrio y permiten girar más rápido.';}
  else if(trim.stability>.74){$('trim-title').textContent='Sereno y equilibrado';$('trim-description').textContent='Mantiene el rumbo y perdona pequeños errores.';}
  else{$('trim-title').textContent='Ágil y sensible';$('trim-description').textContent='Gira con más libertad. Presta atención al momento de tensar.';}
  $('save-note').innerHTML=storageAvailable?'<span class="live-dot"></span> Tus ajustes se guardan en este navegador':'Los ajustes se mantendrán durante esta sesión';
}
function setWorkshopTab(value){const tab=value===true?'material':value===false?'bridles':value;for(const name of ['bridles','material','design']){const selected=name===tab;$(name==='bridles'?'tab-bridles':'tab-'+name).classList.toggle('active',selected);$(name==='bridles'?'tab-bridles':'tab-'+name).setAttribute('aria-selected',selected);$(name==='bridles'?'bridle-settings':name+'-settings').classList.toggle('hidden',!selected);}$('blueprint').classList.toggle('design-view',tab==='design');workshopDesign?.updateView();}

function updateWindSettings(){all('[data-wind]').forEach(el=>el.classList.toggle('selected',el.dataset.wind===physics.profile));$('wind-strength').value=physics.windSpeed;$('wind-strength-output').textContent=(physics.windSpeed*3.6).toFixed(1);$('wind-strength-setting').classList.toggle('inactive',physics.profile==='calm');$('wind-strength').disabled=physics.profile==='calm';}
function updateFollow(){updateCamera();$('follow-button').disabled=spectator().onboard;if(spectator().onboard){$('follow-button').classList.remove('active');$('follow-button').setAttribute('aria-pressed','false');$('follow-button').innerHTML='Vista de la punta';return;}if(landscape.orbit.active||spectator().orbital){$('follow-button').classList.add('active');$('follow-button').setAttribute('aria-pressed','true');$('follow-button').innerHTML='Centrar órbita <kbd>C</kbd>';return;}$('follow-button').classList.toggle('active',landscape.follow);$('follow-button').setAttribute('aria-pressed',landscape.follow);$('follow-button').innerHTML=`<span class="follow-dot"></span> ${landscape.follow?(duel.visible?(duel.partyMode?'Ver todos':'Ver ambos'):'Seguir volantín'):'Mirada libre'} <kbd>C</kbd>`;}
function toggleZoom(){if(duel.visible)return;zoom=!zoom;landscape.zoom=zoom;$('zoom-button').innerHTML=zoom?'Alejar <span>−</span>':'Acercar <span>＋</span>';$('zoom-button').setAttribute('aria-pressed',zoom);}
function toggleAssist(){assists=!assists;$('assist-toggle').textContent='Ayudas visuales: '+(assists?'sí':'no');save();}
function setStatus(title,description,color='#5a8068'){$('status-title').textContent=title;$('status-description').textContent=description;$('status-dot').style.background=color;}
function updateUI(){
  const p=physics,wind=p.windKmh;
  $('online-footwork').classList.toggle('hidden',!online?.active||!duel.active||mode!=='flight');
  document.querySelector('.control-caption>span').textContent=online?.active?'W A S D · Pasos cortos para alinear el cruce':landscape.orbit.active?'Arrastra para orbitar · Rueda para acercar · V cambia la cámara':trail.visible?'Q / E para seguir la luz · V cámara orbital':'Arrastra para mirar · V cámara orbital · R para volver a lanzar';
  flow?.refresh();
  $('wind-value').textContent=wind.toFixed(1);$('wind-profile-label').textContent={breeze:'BRISA',gusts:'RÁFAGAS',strong:'FIRME',calm:'CALMA'}[p.profile];
  const strain=p.rope.broken>=0?0:Math.max(0,p.rope.stressRatio||p.tension/(p.rope.strength||90)),strainPercent=Math.round(strain*100);
  $('height-value').textContent=yardsValue(p.position.y);$('height-meters').textContent=`(${metersValue(p.position.y)} m)`;$('line-value').textContent=yardsValue(p.lineLength);$('line-meters').textContent=`(${metersValue(p.lineLength)} m)`;$('tension-fill').style.width=clamp(strainPercent,0,100)+'%';
  const tensionColor=strain>=.8?'#b94f37':strain>=.6?'#b78b3e':p.tension<.1?'#bb9450':'#5b826b';$('tension-fill').style.background=tensionColor;$('tension-label').style.color=tensionColor;$('tension-label').textContent=strain>=1?`AL LÍMITE · ${strainPercent}%`:strain>=.8?`Alta · ${strainPercent}%`:strain<.01?'Suelto':`${strainPercent}% del límite`;
  const secs=Math.floor(p.flightTime);$('flight-timer').textContent=String(Math.floor(secs/60)).padStart(2,'0')+':'+String(secs%60).padStart(2,'0');
  $('turns-value').textContent=p.turns;
  $('line-capacity').value=p.lineCapacity;$('line-capacity').disabled=duel.active||trail.visible||!!online?.active;
  $('line-remaining').innerHTML=distanceHTML(p.lineRemaining);
  $('energy-value').textContent=Math.round(p.energy)+'%';$('energy-fill').style.width=p.energy+'%';$('energy-fill').style.background=p.energy<20?'#bd744a':p.energy<45?'#b69c57':'#64866a';$('energy-meter').setAttribute('aria-valuenow',Math.round(p.energy));
  $('energy-state').textContent=p.exhausted?'Recupera hasta 20%':p.energy>99.5?'Listo para jugar':p.action==='hold'?'Recuperando':p.boost?'Esfuerzo alto':p.action==='reel'?'Esfuerzo suave':'Respirando';
  document.body.classList.toggle('dueling',duel.visible&&mode==='flight');document.body.classList.toggle('partying',duel.partyMode&&duel.visible);$('duel-mode-label').textContent=duel.partyMode?(duel.rules==='last-man'?'ÚLTIMO EN PIE':'PARTY'):'COMISIÓN';$('duel-hud').classList.toggle('hidden',!duel.visible||mode!=='flight');
  for(const id of ['wind-settings','flight-workshop','pause-wind','pause-workshop'])$(id).disabled=duel.active||trail.visible||!!online?.active;
  document.body.classList.toggle('trailing',trail.visible&&mode==='flight');$('trail-hud').classList.toggle('hidden',!trail.visible||mode!=='flight');updateFollow();
  if(trail.visible){$('trail-clock').textContent=trail.state==='preparing'?String(Math.max(1,Math.ceil(trail.countdown))):formatTime(trail.remaining);$('trail-state').textContent={preparing:'PREPARACIÓN',playing:'CONTRARRELOJ',finished:'TERMINADO'}[trail.state];$('trail-count').textContent=`${trail.index} / ${trail.points.length}`;$('trail-best').textContent=trailBest?formatTime(trailBest,true):'—';$('trail-bonus').textContent=p.time-trail.lastPickup<1?'¡+2 segundos!':'+2 s por captura';$('trail-hud').classList.toggle('pickup',p.time-trail.lastPickup<1);$('trail-hud').classList.toggle('urgent',trail.remaining<15);all('#trail-dots i').forEach((el,i)=>{el.classList.toggle('done',i<trail.index);el.classList.toggle('current',i===trail.index);});}
  if(duel.partyMode&&duel.visible){
    $('party-alive').textContent=`${duel.contenders.length} de ${duel.npcCount+1} con vidas`;
    for(let i=0;i<4;i++){const row=$('party-player-'+i),e=duel.roster[i];row.classList.toggle('hidden',!e);if(!e)continue;row.style.setProperty('--rival',e.tint);row.classList.toggle('is-out',e.lives===0);row.classList.toggle('is-respawning',!e.alive&&e.lives>0);row.querySelector('strong').textContent=e.name;row.querySelector('b').textContent=`${e.lives} / ${e.pilot.maxLives} vidas`+(e.alive?` · ${Math.ceil(e.pilot.rope.integrity)}%`:'');row.querySelector('em').style.width=Math.max(0,e.pilot.rope.integrity)+'%';row.querySelector('small').textContent=e.alive?'Energía '+Math.round(e.pilot.energy)+'%'+(e.intent?' · '+e.intent:''):e.lives>0?`Vuelve en ${Math.max(1,Math.ceil(e.pilot.respawnAt-duel.elapsed))} s`:'Sin vidas · espectador';}
    const event=duel.events.at(-1);$('party-feed').textContent=event&&duel.elapsed-event.time<7?event.text:'';
  }
  if(!online?.active){$('rival-name').textContent='Mateo · NPC';$('rival-marker').querySelector('span').textContent='MATEO · NPC';$('result-rival-name').textContent='Mateo';}
  if(duel.visible){const sec=duel.partyMode&&duel.rules==='last-man'?Math.floor(duel.elapsed):Math.ceil(duel.remaining);$('duel-timer').textContent=String(Math.floor(sec/60)).padStart(2,'0')+':'+String(sec%60).padStart(2,'0');$('duel-state').textContent={preparing:'PREPARACIÓN',playing:duel.spectating?'ESPECTANDO':duel.contact?'EN CONTACTO':'EN JUEGO',finished:'TERMINADA'}[duel.state];$('duel-hint').textContent=duel.message;$('duel-hud').classList.toggle('in-contact',duel.contact);for(const [id,val] of [['player',duel.playerHealth],['rival',duel.rivalHealth]]){$(id+'-integrity').textContent=`${(id==='player'?p:duel.rival).lives??3} vidas · ${Math.ceil(val)}%`;$(id+'-integrity-fill').style.width=val+'%';}}
  $('contact-load').textContent=duel.contact?`Carga ${strainPercent}% · ${duel.reversals} pasadas`:duel.state==='finished'?'TERMINADO':'SIN CONTACTO';
  updateControlState();
  const pulseAge=p.time-p.lastTug,tugRecent=p.state==='flying'&&pulseAge<.65;
  $('tug-button').classList.toggle('pressed',p.state==='flying'&&pulseAge<.18);
  $('tug-progress').textContent=tugRecent?(p.tugSequence===2?`${p.tugIndex} / 2`:'TIRÓN'):(p.boost?'SHIFT + ESPACIO':'ESPACIO');
  if(cleanHeightRecord(p.position.y)>record+.1&&p.position.y<=p.lineLength+p.anchor.y+10&&mode==='flight'&&p.state==='flying'){record=p.position.y;save();}$('record-value').innerHTML=distanceHTML(record);
  $('flight-state-label').textContent={ready:'EN TIERRA',flying:'EN EL AIRE',cut:'CORTADO',grounded:'ATERRIZÓ'}[p.state];
  $('launch-button').classList.toggle('hidden',p.state==='flying'||trail.visible||duel.visible);$('launch-button').innerHTML=p.state==='grounded'?'Otra vez <span>↗</span>':'Lanzar <span>↗</span>';
  if(p.state==='ready'){
    if(wind<6.5)setStatus('Falta un poco de viento.','Puedes probar el lanzamiento o elegir una brisa más firme.','#b28d50');
    else if(wind>23)setStatus('El viento viene con fuerza.','Lanza con cuidado y suelta hilo poco a poco.','#bb794e');
    else setStatus('El viento está a favor.','Da el primer tirón y mira hacia arriba.');
  }else if(p.state==='grounded')setStatus('De vuelta en la tierra.','Cada intento enseña algo. Ajusta el viento o vuelve a lanzar.','#b18b54');
  else if(p.state==='cut')setStatus(p.rope.cutReason==='wind'?'La ráfaga superó el límite del hilo.':p.rope.cutReason==='tension'?'El hilo cedió por tensión.':'El hilo se cortó.','Los dos extremos quedaron libres y el volantín sigue al viento.','#b18b54');
  else if(duel.state==='preparing')setStatus(duel.message,'Los volantines están tomando altura.');
  else if(strain>=.8)setStatus(strain>=1?'¡Hilo al límite!':`Tensión alta · ${strainPercent}% del límite.`,'Mantén Q para descargar; Shift acelera. Otro tirón puede cortar tu hilo.','#b94f37');
  else if(p.exhausted)setStatus('Toma un respiro.','Recupera un 20% de energía para volver a usar boost.','#b18b54');
  else if(duel.contact)setStatus('El cruce transmite la tensión.','Tensa con E y da un tirón: cede el hilo más exigido. Q descarga; F desgasta.','#b18b54');
  else if(p.profile==='calm'||wind<5.5)setStatus('El viento se apagó.','Sin brisa perderá altura. Puedes cambiar el viento.','#b18b54');
  else if(tugRecent)setStatus(p.tugSequence===2?`Doble tirón · ${p.tugIndex} de 2.`:'Tirón en la dirección de la nariz.',Math.cos(p.heading)<-.2?'Apunta abajo: el tirón acompaña la picada.':'La tensión frena el giro y sostiene el rumbo que elegiste.');
  else if(p.action==='reel'&&Math.cos(p.heading)<-.2)setStatus(p.boost?'Recogiendo en picada · boost.':'Recogiendo hacia abajo.','La nariz manda. Suelta hilo para volver a dejarlo girar.','#b18b54');
  else if(p.action==='release'&&p.lineRemaining<.02)setStatus('Llegaste al final del carrete.','Recoge hilo o elige un carrete más largo para seguir soltando.','#b18b54');
  else if(p.action==='release')setStatus(p.boost?'Giro libre · hilo a velocidad ×2,5.':'Dale vueltas al volantín.','Recoge o tironea cuando apunte en la dirección que quieras seguir.');
  else if(p.slack>.15&&p.tension<.1)setStatus('El hilo quedó flojo.','Recoge para recuperar respuesta; Shift acelera la recogida.','#b18b54');
  else if(Math.cos(p.heading)<-.2)setStatus('La nariz apunta hacia abajo.','Recoge para entrar en picada o suelta para seguir girando.','#b18b54');
  else if(p.position.y<2.7&&p.velocity.y<-.25)setStatus('Está cerca del suelo.','Para remontar, deja que apunte arriba antes de tensar.','#b18b54');
  else if(strain>.6)setStatus('El hilo está cargado.','Tienes menos margen para un tirón. Mantén Q para bajar la tensión.','#b96a45');
  else if(p.action==='reel')setStatus(p.boost?'Recogiendo hilo · velocidad ×2,5.':'Siente cómo responde el hilo.','Recoger acerca el volantín y mantiene la dirección de su nariz.');
  else if(Math.abs(p.velocity.y)>.5)setStatus(p.velocity.y>0?'Está encontrando su altura.':'El vuelo cambia de ritmo.','Mantén el hilo y observa. El viento también hace su parte.');
  else setStatus('Encontraste el equilibrio.','Suelta un poco para explorar más cielo, o disfruta el momento.');
  if(trail.visible)setStatus(trail.state==='preparing'?'Prepárate para seguir la luz.':trail.state==='finished'?(trail.result.won?'¡Recorrido completo!':'El recorrido terminó.'):`Destello ${trail.index+1} de ${trail.points.length}`,trail.state==='finished'?trail.result.reason:trail.hint(),'#b2934e');
  $('kite-marker').style.color=tensionColor;
  $('direction-label').textContent=(p.action==='release'?'GIRA · ':'APUNTA ')+(Math.cos(p.heading)<-.35?'ABAJO':Math.sin(p.heading)>.45?'DERECHA':Math.sin(p.heading)<-.45?'IZQUIERDA':'ARRIBA');
  $('assist-toggle').textContent='Ayudas visuales: '+(assists?'sí':'no');
  $('wind-compass').querySelector('.arrow').style.transformOrigin='32px 32px';$('wind-compass').querySelector('.arrow').style.transform=`rotate(${Math.atan2(p.wind.x,-p.wind.z)*180/Math.PI}deg)`;
  const view=spectator();if(view.active)setStatus(p.eliminated&&p.lives>0?`Vuelves en ${Math.max(1,Math.ceil(p.respawnAt-duel.elapsed))} s · ${p.lives} vidas`:'El vuelo continúa sin hilo.',view.mode==='battle'?'Observando la batalla.':'El aire y la orientación deciden el planeo.');
  document.body.classList.toggle('spectating',view.active);$('spectator-controls').classList.toggle('hidden',!view.active||mode!=='flight');$('spectator-name').textContent=p.eliminated&&p.lives>0?`Nuevo lanzamiento en ${Math.max(1,Math.ceil(p.respawnAt-duel.elapsed))} s · ${p.lives} vidas`:view.mode==='battle'?(duel.watched?.name||'Todos los supervivientes'):physics.state==='grounded'?'Tu volantín aterrizó':view.onboard?'Cámara a bordo':'Tu volantín · '+({glide:'planeando',flutter:'flotando',dive:'en picada'}[physics.freeMode]||'sin hilo');
  for(const id of ['spectator-next','spectator-all'])$(id).classList.toggle('hidden',!duel.visible);for(const [id,m]of[['spectator-kite','kite'],['spectator-onboard','onboard'],['spectator-all','battle']])$(id).setAttribute('aria-pressed',view.mode===m);$('result-watch').classList.toggle('hidden',!view.active);$('spectator-result').classList.toggle('hidden',duel.state!=='finished');$('spectator-result').disabled=!!online?.active&&!resultShown;
  compactUI?.update({physics:p,duel,trail,online,audio,assists});
  if(audio){audio.gain.gain.setTargetAtTime(audio.enabled?(p.profile==='calm'?.002:clamp(p.wind.length()/1000,.002,.015)):0,audio.context.currentTime,.25);audio.filter.frequency.setTargetAtTime(260+p.wind.length()*75,audio.context.currentTime,.25);}
}
async function toggleAudio(){
  try{
    if(!audio){const AudioContext=window.AudioContext||window.webkitAudioContext;if(!AudioContext)throw Error();const context=new AudioContext(),buffer=context.createBuffer(1,context.sampleRate*3,context.sampleRate),data=buffer.getChannelData(0);let last=0;for(let i=0;i<data.length;i++){const white=Math.random()*2-1;last=(last+.02*white)/1.02;data[i]=last*3.5;}const source=context.createBufferSource();source.buffer=buffer;source.loop=true;const filter=context.createBiquadFilter();filter.type='lowpass';const gain=context.createGain();gain.gain.value=0;source.connect(filter);filter.connect(gain);gain.connect(context.destination);source.start();audio={context,gain,filter,enabled:false};}
    await audio.context.resume();audio.enabled=!audio.enabled;$('audio-button').classList.toggle('sound-on',audio.enabled);$('audio-button').setAttribute('aria-label',audio.enabled?'Silenciar sonido':'Activar sonido');$('audio-button').setAttribute('aria-pressed',audio.enabled);updateUI();
  }catch{toast('Este navegador no pudo activar el sonido. El vuelo sigue disponible.');}
}

function bindEvents(){
  $('online-edit-settings').addEventListener('click',()=>{onlineSettingsReturn=true;openModal('online-settings-modal');});$('online-settings-done').addEventListener('click',closeModal);
  for(const id of ['online-capacity','online-wind','online-strength'])$(id).addEventListener('change',()=>flow.refresh());
  $('pause-help').addEventListener('click',()=>openModal('help-modal'));
  $('pause-audio').addEventListener('click',toggleAudio);
  $('pause-assists').addEventListener('click',toggleAssist);
  for(const id of ['flight-trail','pause-trail','trail-options'])$(id).addEventListener('click',()=>trail.visible?openModal('trail-modal'):beginPreparation('trail'));
  $('trail-start').addEventListener('click',()=>beginPreparation('trail'));$('trail-retry').addEventListener('click',startTrail);
  for(const id of ['trail-leave','trail-free'])$(id).addEventListener('click',()=>showFront('menu'));
  $('trail-resume').addEventListener('click',closeModal);$('camera-button').addEventListener('click',toggleCamera);$('pilot-view').addEventListener('click',viewPilot);
  $('orbit-near').addEventListener('click',()=>{landscape.orbit.zoom(-100);updateCamera();});$('orbit-far').addEventListener('click',()=>{landscape.orbit.zoom(100);updateCamera();});
  $('spectator-next').addEventListener('click',()=>{landscape.pilotFocus=-1;duel.spectatorView='battle';duel.spectateNext();landscape.follow=true;landscape.orbit.reset();updateUI();});
  $('spectator-all').addEventListener('click',()=>{landscape.pilotFocus=-1;duel.spectatorView='battle';duel.spectatorIndex=-1;landscape.orbit.active=false;landscape.follow=true;updateUI();});
  $('spectator-exit').addEventListener('click',()=>showFront('menu'));
  for(const [id,view]of[['spectator-kite','kite'],['spectator-onboard','onboard']])$(id).addEventListener('click',()=>{landscape.pilotFocus=-1;duel.spectatorView=view;landscape.orbit.active=false;landscape.follow=true;landscape.orbit.reset();updateFollow();updateUI();});
  $('result-watch').addEventListener('click',()=>{resultShown=true;closeModal();});$('spectator-result').addEventListener('click',()=>{if(online?.active){if(resultShown)openModal('result-modal');}else showCommissionResult();});
  for(const id of ['workshop-equipment','pause-equipment'])$(id).addEventListener('click',()=>openModal('equipment-modal'));$('equipment-done').addEventListener('click',closeModal);
  $('party-count').addEventListener('change',e=>{partyCount=clamp(Number(e.target.value),1,3);save();updatePartyRoster();});
  $('pause-new-game').addEventListener('click',()=>showFront('modes'));

  for(const id of ['commission-open','pause-commission'])$(id).addEventListener('click',()=>duel.visible?openModal('commission-modal'):beginPreparation('party'));$('duel-options').addEventListener('click',()=>openModal('commission-modal'));
  $('commission-start').addEventListener('click',()=>flow?.preparing?closeModal():beginPreparation(partyUI.value.rules==='last-man'?'last-man':'party'));$('commission-resume').addEventListener('click',closeModal);$('commission-leave').addEventListener('click',()=>showFront('menu'));$('rematch-button').addEventListener('click',startCommission);$('result-free').addEventListener('click',()=>showFront('menu'));
  $('line-capacity').addEventListener('change',e=>{if(duel.active||trail.visible||!physics.setLineCapacity(Number(e.target.value))){e.target.value=physics.lineCapacity;toast('Recoge el hilo antes de elegir un carrete más pequeño.');return;}save();updateUI();toast(`Carrete de ${distanceText(physics.lineCapacity)} preparado.`);});
  $('flight-workshop').addEventListener('click',()=>openModal('workshop'));$('pause-workshop').addEventListener('click',()=>openModal('workshop'));
  $('help-button').addEventListener('click',()=>openModal('help-modal'));$('help-done').addEventListener('click',closeModal);
  $('menu-button').addEventListener('click',()=>openModal('pause-modal'));$('home-button').addEventListener('click',e=>{e.preventDefault();openModal('pause-modal');});
  $('resume-button').addEventListener('click',closeModal);all('[data-close]').forEach(b=>b.addEventListener('click',closeModal));
  $('workshop-done').addEventListener('click',closeModal);
  $('wind-settings').addEventListener('click',()=>openModal('wind-modal'));$('pause-wind').addEventListener('click',()=>openModal('wind-modal'));$('wind-done').addEventListener('click',closeModal);
  $('restart-button').addEventListener('click',leaveCommission);
  $('return-home').addEventListener('click',()=>showFront('menu'));
  $('launch-button').addEventListener('click',launch);$('tug-button').addEventListener('click',e=>tug(e.shiftKey||shiftDown||boostLatched));
  $('boost-button').addEventListener('click',()=>{if(modal||mode!=='flight')return;boostLatched=!boostLatched;updateControlState();});
  $('audio-button').addEventListener('click',toggleAudio);$('assist-toggle').addEventListener('click',toggleAssist);
  $('follow-button').addEventListener('click',centerCamera);
  $('offscreen-center').addEventListener('click',()=>{landscape.follow=true;updateFollow();});$('zoom-button').addEventListener('click',toggleZoom);
  $('tab-bridles').addEventListener('click',()=>setWorkshopTab(false));$('tab-material').addEventListener('click',()=>setWorkshopTab(true));$('tab-design').addEventListener('click',()=>setWorkshopTab('design'));
  $('mass-input').addEventListener('input',e=>{setup.mass=Number(e.target.value);applySetup();});$('tail-input').addEventListener('change',e=>{setup.tail=e.target.checked;applySetup();});
  $('balance-button').addEventListener('click',()=>{Object.assign(setup,{left:44,right:44,lower:52,knotsLeft:0,knotsRight:0,knotsLower:0,anchorLeft:55,anchorRight:55});applySetup();});
  all('[data-wind]').forEach(el=>el.addEventListener('click',()=>{physics.profile=el.dataset.wind;if(physics.profile!=='calm')physics.windSpeed={breeze:5.5,gusts:7,strong:9}[physics.profile];save();updateWindSettings();updateUI();}));
  $('wind-strength').addEventListener('input',e=>{physics.windSpeed=Number(e.target.value);save();updateWindSettings();});
  for(const [id,action] of [['release-button','release'],['reel-button','reel'],['saw-button','saw'],['step-forward','forward'],['step-left','left'],['step-right','right'],['step-back','back']]){
    const button=$(id);button.addEventListener('pointerdown',e=>{e.preventDefault();if(mode!=='flight'||modal)return;button.setPointerCapture(e.pointerId);shiftDown=e.shiftKey;pointers.set(e.pointerId,action);updateControlState();});
    const end=e=>{pointers.delete(e.pointerId);updateControlState();};button.addEventListener('pointerup',end);button.addEventListener('pointercancel',end);button.addEventListener('lostpointercapture',end);button.addEventListener('contextmenu',e=>e.preventDefault());
  }
  window.addEventListener('keydown',e=>{
    if(!modal&&flow?.key(e))return;
    if(e.key==='Escape'){e.preventDefault();if(modal)closeModal();else if(compactUI?.cameraOpen)compactUI.setCameraTools(false);else openModal('pause-modal');return;}
    if(modal){if(modal==='equipment-modal'&&equipmentUI.key(e))return;if(e.key==='Tab'){const focusable=[...$(modal).querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled)')].filter(el=>el.offsetParent!==null);const first=focusable[0],last=focusable.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}return;}
    if(e.target.matches('input,textarea,select')||mode!=='flight')return;
    const key=e.key.toLowerCase();shiftDown=e.shiftKey;
    if(key==='shift'){updateControlState();return;}
    if(key==='q'||key==='e'||key==='f'||(online?.active&&['w','a','s','d'].includes(key))){e.preventDefault();keys.add(key);updateControlState();return;}
    if(e.repeat)return;
    if(e.code==='Space'){e.preventDefault();updateControlState();tug(shiftDown||boostLatched);}
    else if(key==='t')openModal('workshop');
    else if(key==='n'){if(duel.visible)openModal('commission-modal');else beginPreparation('party');}
    else if(key==='g'){if(trail.visible)openModal('trail-modal');else beginPreparation('trail');}
    else if(key==='v')toggleCamera();
    else if(key==='p')viewPilot();
    else if(key==='r'){if(trail.visible){openModal('trail-modal');return;}if(duel.visible){openModal('commission-modal');return;}releaseAll();physics.reset();landscape.follow=true;updateFollow();toast('De vuelta en tierra. Todo listo para otro intento.');}
    else if(key==='c'){$('follow-button').click();}
  });
  window.addEventListener('keyup',e=>{keys.delete(e.key.toLowerCase());shiftDown=e.shiftKey;updateControlState();});
  window.addEventListener('blur',()=>{releaseAll();if(mode==='flight'&&!modal&&!online?.active)openModal('pause-modal');});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){releaseAll();if(mode==='flight'&&!modal&&!online?.active)openModal('pause-modal');}lastTime=0;accumulator=0;});
  $('world').addEventListener('pointerdown',e=>{if(modal||mode!=='flight')return;compactUI?.setCameraTools(false);drag={id:e.pointerId,x:e.clientX,y:e.clientY};$('world').setPointerCapture(e.pointerId);});
  $('world').addEventListener('pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;landscape.drag(e.clientX-drag.x,e.clientY-drag.y);drag.x=e.clientX;drag.y=e.clientY;updateFollow();});
  for(const type of ['pointerup','pointercancel','lostpointercapture'])$('world').addEventListener(type,()=>drag=null);
  $('world').addEventListener('wheel',e=>{if(mode!=='flight'||modal)return;e.preventDefault();if(landscape.orbit.active||spectator().orbital){landscape.orbit.zoom(e.deltaY);updateCamera();return;}const desired=e.deltaY<0;if(desired!==zoom)toggleZoom();},{passive:false});
  $('overlay').addEventListener('pointerdown',e=>{if(e.target===$('overlay'))closeModal();});
}

function frame(now){
  const dt=lastTime?Math.min((now-lastTime)/1000,.08):1/60;lastTime=now;
  if(online?.active)online.render(physics,duel);
  if(mode==='intro'&&!modal){physics.time+=dt;physics.windAt(physics.position,physics.wind);}
  if(mode==='flight'&&!online?.active&&!modal&&!document.hidden){accumulator+=dt;const step=1/240;while(accumulator>=step){const wasSpectating=spectator().active;physics.step(step);duel.step(step);if(wasSpectating!==spectator().active){landscape.pilotFocus=-1;releaseAll();landscape.follow=true;landscape.orbit.active=false;landscape.orbit.reset();}if(!duel.visible)solveRopeSystem([physics.rope],step);trail.step(step);accumulator-=step;}}
  if(mode==='flight'&&!online?.active&&duel.state==='finished'&&!duelRecorded){recordCommission();releaseAll();resultAt=physics.time;}
  if(!online?.active&&duel.state==='finished'&&!resultShown&&!modal&&!spectator().active&&physics.time-resultAt>2.5)showCommissionResult();
  if(trail.state==='finished'&&!trailFinishedAt){trailFinishedAt=physics.time;releaseAll();if(trail.result.won&&(!trailBest||trail.elapsed<trailBest)){trailBest=trail.elapsed;trailNewBest=true;save();}}
  if(trail.state==='finished'&&!trailResultShown&&!modal&&physics.time-trailFinishedAt>.9)showTrailResult();
  if(modal==='equipment-modal'){equipmentUI.frame(dt);requestAnimationFrame(frame);return;}
  const marker=landscape.render(dt,mode,!!modal);
  const target=marker.trail,showTarget=mode==='flight'&&trail.active&&target?.visible;
  $('trail-marker').classList.toggle('hidden',!showTarget);$('trail-edge').classList.toggle('hidden',mode!=='flight'||!trail.active||!target||target.visible||!!modal);
  if(target&&trail.active){const distance=physics.position.distanceTo(trail.target);$('trail-target-name').textContent=`DESTELLO ${trail.index+1}`;$('trail-distance').innerHTML=distanceHTML(distance);if(showTarget){$('trail-marker').style.left=clamp(target.x,70,innerWidth-70)+'px';$('trail-marker').style.top=clamp(target.y-58,75,innerHeight-100)+'px';}else{let dx=target.x-innerWidth/2,dy=target.y-innerHeight/2;if(target.behind){dx=-dx;dy=-dy;}$('trail-edge').querySelector('b').style.transform=`rotate(${Math.atan2(dx,-dy)*180/Math.PI}deg)`;$('trail-edge').querySelector('span').textContent=`Destello ${trail.index+1} · ${distanceText(distance)}${target.behind?' · detrás':''}`;}}if(duel.visible&&$('contact-detail').open)drawContact($('contact-view'),duel);
  const show=mode==='flight'&&physics.state==='flying'&&assists&&marker.visible;
  $('kite-marker').classList.toggle('hidden',!show);
  if(show){$('kite-marker').style.left=marker.x+'px';$('kite-marker').style.top=(marker.y-Math.max(30,marker.size*.6+15))+'px';$('direction-arrow').style.transform=`rotate(${marker.angle}deg)`;}
  $('offscreen-hint').classList.toggle('hidden',mode!=='flight'||physics.state!=='flying'||marker.visible||landscape.pilotFocus>=0||!!modal);
  for(const [id,point,enabled] of [['rival-marker',marker.rival,duel.visible&&!duel.partyMode],['clash-marker',marker.clash,duel.contact]]){const show=mode==='flight'&&enabled&&point?.visible;$(id).classList.toggle('hidden',!show);if(show){$(id).style.left=point.x+'px';$(id).style.top=(point.y-(id==='rival-marker'?35:-22))+'px';}}
  const tagSlots=[];
  for(let i=0;i<3;i++){
    const el=$('party-marker-'+i),e=duel.roster[i+1],point=marker.rivals?.[i],visible=mode==='flight'&&duel.partyMode&&duel.visible&&e?.alive&&point?.visible;el.classList.toggle('hidden',!visible);
    if(visible){
      const label=el.querySelector('span'),name=e.name.toUpperCase();if(label.textContent!==name)label.textContent=name;
      el.style.left=point.x+'px';el.style.top=(point.y-35)+'px';el.style.setProperty('--rival',e.tint);
      // Keep each diamond attached to its kite; only move a colliding name tag.
      const base=clamp(point.x,42,innerWidth-42);
      const candidates=[0,-66,66,-132,132].map(dx=>({x:base+dx,y:point.y}));
      candidates.push({x:base,y:point.y-24},{x:base,y:point.y-48});
      const slot=candidates.find(c=>c.x>=42&&c.x<=innerWidth-42&&!tagSlots.some(t=>Math.abs(t.x-c.x)<65&&Math.abs(t.y-c.y)<23))||candidates[0];
      tagSlots.push(slot);el.querySelector('span').style.transform=`translate(${slot.x-point.x}px,${slot.y-point.y}px)`;
    }
  }
  graphTime+=dt;if(graphTime>.3){graphTime=0;windHistory.push(physics.windKmh);windHistory.shift();$('wind-graph').setAttribute('d',windHistory.map((v,i)=>`${i?'L':'M'}${(i*200/47).toFixed(1)} ${(24-clamp(v/72,0,1)*23).toFixed(1)}`).join(' '));}
  if(now-lastUi>100){lastUi=now;updateUI();}
  requestAnimationFrame(frame);
}

try{
  try{landscape=new Landscape($('world'),physics);}catch(error){console.warn('Using software perspective renderer:',error.message);landscape=new CanvasLandscape($('world'),physics);}
  landscape.duel=duel;landscape.trail=trail;
  partyUI=new PartySettings(saved.partyOptions||{profile:physics.profile,wind:physics.windSpeed},setup,save);
  compactUI=new CompactFlightUI({open:openModal,close:closeModal,release:releaseAll,currentModal:()=>modal});
  equipmentUI=new EquipmentUI(setup,()=>{physics.configure(setup);physics.reset();landscape.configure(setup);save();updateWorkshop();},!!landscape.renderer);
  if(['normal','hard'].includes(saved.npcLevel))$('npc-level').value=saved.npcLevel;
  for(const id of ['line-capacity','online-capacity'])populateCapacities($(id));
  flow=new GameFlowUI({snapshot:preparationSnapshot,choose:chooseGameMode,edit:editPreparation,begin:beginPreparedGame,audio:toggleAudio,assists:toggleAssist,capacity:meters=>{if(flow.choice==='online')$('online-capacity').value=meters;else physics.setLineCapacity(meters);save();}});
  buildWorkshop();workshopDesign=new WorkshopDesign(setup,applySetup,toast);bindEvents();updateWorkshop();updateWindSettings();updateFollow();updateUI();

  online=new OnlineGame({
    setup:()=>({...setup}),prepare:()=>beginPreparation('online'),open:()=>{if(mode==='intro'&&(!flow.preparing||flow.choice!=='online'))flow.select('online');openModal('online-modal');},close:closeModal,toast,
    enter:()=>{stopTrail();duel.stop();releaseAll();},leave:()=>showFront('menu'),
    ended:()=>{duel.stop();physics.networkControlled=false;duel.rival.networkControlled=false;physics.configure(setup);physics.anchor.set(0,1.35,0);physics.reset();setMode('intro');flow.show('menu');},
    round:data=>{
      closeModal();setMode('flight');resultShown=false;duelRecorded=true;zoom=false;landscape.zoom=false;
      duel.state=data.phase;physics.configure(data.match.pilots[data.slot].setup);landscape.configure(physics.setup);landscape.rivalKite?.configure(data.match.pilots[1-data.slot].setup);
      const rival=data.players[1-data.slot].name;$('rival-name').textContent=rival+' · ONLINE';$('rival-marker').querySelector('span').textContent=rival.toUpperCase();$('result-rival-name').textContent=rival;
      $('contact-detail').open=false;landscape.follow=true;updateFollow();toast('Duelo online · W A S D para dar pasos cortos y buscar el cruce.');
    },
    result:data=>{
      releaseAll();setTimeout(()=>{if(!online?.active||online.latest?.round!==data.round||online.latest?.phase!=='finished')return;
      online.render(physics,duel);releaseAll();resultShown=true;const r=duel.result;
      $('result-title').textContent={win:'La comisión es tuya.',loss:'Tu rival ganó esta vez.',draw:'El cielo queda parejo.'}[r.outcome];
      $('result-reason').textContent=r.reason;
      $('result-player').textContent=(r.playerLives??physics.lives??0)+' vidas';$('result-rival').textContent=(r.rivalLives??duel.rival.lives??0)+' vidas';$('result-detail').textContent=`Ronda ${data.round} · ${r.seconds} segundos · ${duel.engagements} cruces`;
      if(!spectator().active)openModal('result-modal');
      },2500);
    }
  });
  requestAnimationFrame(frame);$('loading').style.opacity=0;setTimeout(()=>$('loading').remove(),550);
}catch(error){
  console.error('TIRANTE initialization failed',error);
  $('loading').innerHTML='<div class="fatal-error"><strong>No pudimos abrir el cielo en este navegador.</strong><p>Prueba con un navegador actualizado que permita WebGL<br>y tenga activada la aceleración gráfica.</p><button class="primary" onclick="location.reload()">Volver a intentar ↗</button></div>';
}
