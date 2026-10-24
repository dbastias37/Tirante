import {appearance} from './appearance.js';
import {Vector3} from './vendor/three.module.js';
import {DEFAULT_SETUP,clamp} from './physics.js';
export const TRAIL_POINTS=Object.freeze([
 [0.1,8.3,-4.3],[2.3,8.8,-5.1],[2.6,9.5,-7.35],[3.4,11.2,-7.2],
 [.65,11,-5.9],[3.35,11.1,-7],[8.7,7.8,-9.1],[2.66,11.28,-6.67]
]);
export const TRAIL_VERSION='rastro-1';
export function formatTrailTime(seconds,decimal=false){const units=decimal?Math.round(Math.max(0,seconds)*10):Math.ceil(Math.max(0,seconds)),n=decimal?units/10:units;return `${String(Math.floor(n/60)).padStart(2,'0')}:${decimal?(n%60).toFixed(1).padStart(4,'0'):String(n%60).padStart(2,'0')}`;}
export function segmentSphere(a,b,center,radius){const ab=b.clone().sub(a),t=ab.lengthSq()?clamp(center.clone().sub(a).dot(ab)/ab.lengthSq(),0,1):0;return a.clone().addScaledVector(ab,t).distanceToSquared(center)<=radius*radius;}
export class LightTrail{
 constructor(player){this.player=player;this.state='idle';this.points=TRAIL_POINTS.map(p=>new Vector3(...p));this.radius=.95;this.index=0;this.elapsed=0;this.remaining=90;this.bursts=[];this.previous=new Vector3();this.result=null;this.saved=null;}
 get visible(){return this.state!=='idle';}get active(){return this.state==='preparing'||this.state==='playing';}get target(){return this.points[this.index]||null;}
 start(){
  const p=this.player;if(!this.visible)this.saved={setup:{...p.setup},profile:p.profile,windSpeed:p.windSpeed,lineCapacity:p.lineCapacity};
  p.configure({...DEFAULT_SETUP,...appearance(this.saved?.setup)});p.profile='breeze';p.windSpeed=5.5;p.lineCapacity=65;p.anchor.set(0,1.35,0);p.time=0;p.networkControlled=false;p.launch();
  this.state='preparing';this.countdown=3;this.elapsed=0;this.remaining=90;this.index=0;this.bursts=[];this.result=null;this.lastPickup=-100;this.previous.copy(p.position);
 }
 stop(){const p=this.player;if(this.saved){p.configure(this.saved.setup);p.profile=this.saved.profile;p.windSpeed=this.saved.windSpeed;p.lineCapacity=this.saved.lineCapacity;}this.saved=null;this.state='idle';this.bursts=[];this.result=null;}
 finish(won,reason){if(!this.active)return;this.state='finished';this.player.setControls('hold',false);this.result={won,reason,seconds:this.elapsed,collected:this.index,total:this.points.length,medal:won?(this.elapsed<=30?'Oro':this.elapsed<=55?'Plata':'Bronce'):null};}
 step(dt){
  if(!this.active)return;const p=this.player;this.bursts=this.bursts.filter(b=>p.time-b.time<1.2);
  if(this.state==='preparing'){p.setControls('hold',false);this.countdown-=dt;this.previous.copy(p.position);if(this.countdown<=0)this.state='playing';return;}
  this.elapsed+=dt;this.remaining=Math.max(0,this.remaining-dt);
  if(p.state!=='flying'){this.finish(false,'El volantín tocó tierra. Vuelve a intentarlo.');return;}
  if(this.target&&segmentSphere(this.previous,p.position,this.target,this.radius)){
   this.bursts.push({position:this.target.clone(),time:p.time});this.index++;this.remaining+=2;this.lastPickup=p.time;
   if(this.index===this.points.length)this.finish(true,'Recogiste todos los destellos en orden.');
  }
  this.previous.copy(p.position);if(this.remaining<=0)this.finish(false,'Se acabó el tiempo. Cada destello te devuelve 2 segundos.');
 }
 hint(){if(this.state==='preparing')return `El recorrido comienza en ${Math.max(1,Math.ceil(this.countdown))}.`;if(!this.target)return 'Recorrido completo.';const reach=this.target.distanceTo(this.player.anchor);return this.player.lineLength<reach-.4?'Da hilo para llegar más lejos. Usa soltadas cortas.':this.player.lineLength>reach+1.5?'Recoge un poco para volver hacia el destello.':'Suelta para girar; recoge cuando la nariz apunte al aro.';}
}
