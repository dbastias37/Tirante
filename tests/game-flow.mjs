import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {GAME_MODES,GameFlow} from '../game/game-flow.js';
import {GameFlowUI} from '../game/game-flow-ui.js';
import {DEFAULT_SETUP,KitePhysics} from '../game/physics.js';
import {distanceHTML,distanceText,toYards,populateCapacities} from '../game/units.js';
import {reelViewport} from '../game/reel-view.js';
import {Landscape} from '../game/scene.js';
import {Scene,Raycaster,Vector3} from '../game/vendor/three.module.js';
import {FIELD_SIZE,CAMERA_NEAR,terrainHeight} from '../game/render-settings.js';

// Exercise the real UI callbacks: selection and editing cannot start a round.
const html=await readFile(new URL('../game/index.html',import.meta.url),'utf8');
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
assert.equal(new Set(ids).size,ids.length,'No duplicate input or dialog IDs');
const canvasContext={fillRect(){},beginPath(){},moveTo(){},lineTo(){},closePath(){},fill(){}};
function element(){const classes=new Set();return {getContext:()=>canvasContext,dataset:{},options:[],classList:{toggle(k,on){on?classes.add(k):classes.delete(k);},contains:k=>classes.has(k)},setAttribute(){},replaceChildren(...children){this.children=children;},querySelector(){return null;}};}
const nodes=new Map(ids.map(id=>[id,element()])),pages=['title','menu','modes','prepare','settings'].map(page=>{const e=element();e.dataset.flowPage=page;return e;}),backs=Array.from({length:3},element);
for(const id of ['prep-capacity','line-capacity','online-capacity'])nodes.get(id).options=[30,65,100,150].map(value=>({value}));
globalThis.document={body:element(),getElementById:id=>{assert.ok(nodes.has(id),`Missing DOM node ${id}`);return nodes.get(id);},createElement:element,querySelectorAll:q=>q==='[data-flow-back]'?backs:q==='[data-flow-page]'?pages:[],querySelector:q=>pages.find(p=>q.includes(`"${p.dataset.flowPage}"`))};
globalThis.requestAnimationFrame=fn=>fn();
let started=[],edited=[],chosen=[],capacity=150;
const original=GameFlowUI.prototype.drawPreview;GameFlowUI.prototype.drawPreview=()=>{};
// Refresh is tested with all actual preparation DOM IDs; bypass texture creation only.
const ui=new GameFlowUI({snapshot:()=>({setup:DEFAULT_SETUP,fixed:false,capacity,wind:5.5,weather:'Brisa',opponents:'Prueba',audio:false,assists:true}),choose:id=>chosen.push(id),edit:(...args)=>edited.push(args),begin:id=>started.push(id),audio(){},assists(){},capacity:n=>{capacity=n;}});
assert.equal(ui.state,'title');ui.key({key:'Enter',preventDefault(){}});assert.equal(ui.state,'menu');
nodes.get('menu-settings').onclick();assert.equal(ui.state,'settings');backs[0].onclick();assert.equal(ui.state,'menu');nodes.get('menu-new').onclick();assert.equal(ui.state,'modes');
for(const [i,mode] of GAME_MODES.entries()){
  nodes.get('mode-grid').children[i].onclick();assert.equal(ui.state,'prepare');assert.equal(ui.choice,mode.id);assert.equal(nodes.get('prep-mode').textContent,mode.name);
  for(const kind of ['kite','equipment','conditions'])nodes.get('prep-'+kind).onclick();
  assert.deepEqual(edited.slice(-3),[['kite',mode.id],['equipment',mode.id],['conditions',mode.id]]);
  assert.equal(started.length,i,'Choosing a mode or editing cannot start the game');
  nodes.get('prep-start').onclick();assert.equal(started.at(-1),mode.id);backs[0].onclick();assert.equal(ui.state,'modes');
}
nodes.get('mode-grid').children[0].onclick();nodes.get('prep-capacity').onchange({target:{value:'100'}});assert.equal(capacity,100);assert.match(nodes.get('prep-capacity-detail').innerHTML,/109,4/);
assert.deepEqual(started,GAME_MODES.map(m=>m.id));
await Promise.resolve();
GameFlowUI.prototype.drawPreview=original;
delete globalThis.document;delete globalThis.requestAnimationFrame;

const state=new GameFlow();assert.equal(state.state,'title');state.go('menu');state.go('modes');
for(const mode of GAME_MODES){state.choose(mode.id);assert.equal(state.preparing,true);assert.equal(state.choice,mode.id);assert.equal(state.back(),'modes');assert.notEqual(state.state,'hidden');}
assert.equal(state.back(),'menu');state.go('settings');assert.equal(state.back(),'menu');state.choose('free');state.hide();assert.equal(state.state,'hidden');assert.throws(()=>state.choose('invalid'));


assert.ok(Math.abs(toYards(150)-164.041994750656)<1e-10);assert.equal(distanceText(65),'71,1 yd (65,0 m)');assert.match(distanceHTML(150),/164,0.*yd.*<small[^>]*>\(150,0 m\)<\/small>/);
const select={options:[{value:'150'}]};populateCapacities(select);assert.equal(select.options[0].value,'150');assert.equal(select.options[0].textContent,'164,0 yd (150,0 m)');
for(const [w,h]of[[1363,936],[1920,1080],[390,844],[360,640],[844,390],[568,320]]){const b=reelViewport(w,h);assert.ok(b.x>=0&&b.y>=0&&b.x<w&&b.y<h,`Reel stays visible at ${w}×${h}`);assert.ok(Math.abs(b.x+b.size/2-w/2)<1,'Foreground reel is horizontally centered');assert.ok(b.y+b.size*.82<h-80,'Reel clears the bottom controls');}

const landscape=Object.create(Landscape.prototype);landscape.scene=new Scene();landscape.createLandscape();const ground=landscape.scene.children.find(m=>m.geometry?.parameters?.width===FIELD_SIZE),surround=landscape.scene.children.find(m=>m.userData.groundSurround);assert.ok(ground&&surround);ground.updateMatrixWorld();surround.updateMatrixWorld();
for(const [x,z]of[[.13,.27],[21.23,70.16],[110.15,-145.31],[180.13,249.71],[1001.31,-1181.75],[1220.13,30.27],[-1501.1,1402.3]]){const ray=new Raycaster(new Vector3(x,100,z),new Vector3(0,-1,0)),hits=ray.intersectObjects([ground,surround]);assert.equal(hits.length,1,`Exactly one ground surface at ${x},${z}`);}
for(let x=-FIELD_SIZE/2;x<=FIELD_SIZE/2;x+=13){assert.ok(terrainHeight(x,FIELD_SIZE/2)===0);assert.ok(terrainHeight(-FIELD_SIZE/2,x)===0);}assert.ok(CAMERA_NEAR>=.15,'Improved distant depth precision');
landscape.physics=new KitePhysics();landscape.createReel();assert.equal(landscape.reelRig.children.filter(o=>o.children.length).length,1);assert.equal(landscape.spool.children.length,1,'First-person rig contains the reel only');assert.equal(landscape.scene.children.includes(landscape.reelRig),false,'Viewmodel is independent from world camera motion');

const draws=[],viewports=[];landscape.width=1363;landscape.height=936;landscape.renderer={autoClear:true,clearDepth(){},setViewport(...args){viewports.push(args);},render(scene,camera){draws.push([scene,camera]);}};const anchor=landscape.physics.anchor.clone();landscape.renderReel(1/60,false);assert.equal(draws[0][0],landscape.reelScene);assert.deepEqual(viewports.at(-1),[0,0,1363,936]);assert.equal(landscape.renderer.autoClear,true);assert.equal(landscape.physics.anchor.distanceTo(anchor),0,'Viewmodel never relocates the simulated line');

const p=new KitePhysics();p.launch();p.position.set(0,60,-30);p.velocity.set(12,8,-14);const before=p.position.clone(),direction=p.velocity.clone().normalize();p.cutLine();assert.ok(p.velocity.length()<=8+1e-10);assert.ok(p.velocity.clone().normalize().distanceTo(direction)<1e-10);assert.equal(p.position.distanceTo(before),0,'A cut does not teleport the kite');p.profile='strong';p.windSpeed=12;
for(let i=0;i<240;i++){const velocity=p.velocity.clone();p.step(1/240);assert.ok(Math.hypot(p.velocity.x-velocity.x,p.velocity.z-velocity.z)<=4/240+1e-9,'Gust pickup remains smooth');assert.ok(Number.isFinite(p.position.length()));}
assert.ok(p.position.distanceTo(before)<10,'The first second of detached flight stays readable');
console.log('PASS: title/menu navigation, unique preparation DOM, yards/meters, reel-only viewmodel bounds, one ground surface and smooth release.');
