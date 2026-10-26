import {solveRopeSystem} from './rope-system.js';
import {mixSeed} from './line-stress.js';
import {controlNPC} from './npc-pilot.js';
import {Vector3} from './vendor/three.module.js';
import {KitePhysics,DEFAULT_SETUP,clamp} from './physics.js';
import {PILOT_SPACING,LAUNCH_SECONDS,DUEL_SECONDS,prepareLives,launchLife,loseLife,respawnLife,climbControls} from './battle-rules.js';
const v=()=>new Vector3();
const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));

import {closestSegments,findRopeContact,SawStroke} from './rope.js';
export {closestSegments};
export function lineContact(player,rival){
  if(player.state!=='flying'||rival.state!=='flying')return null;
  return findRopeContact(player.rope,rival.rope);
}
export class Commission {
  constructor(player){
    this.player=player;this.rival=new KitePhysics({...DEFAULT_SETUP,color:'teal',knotsLeft:1},{seed:mixSeed(player.flightSeed^1)});this.rival.anchor.set(3.2,1.35,0);this.rival.reset();
    this.state='idle';this.elapsed=0;this.remaining=90;this.playerHealth=100;this.rivalHealth=100;this.contact=false;this.contactPoint=v();this.contactTime=0;this.engagements=0;this.lastPlayerPull=0;this.lastRivalPull=0;this.result=null;this.aiWait=0;this.attackAt=4;this.message='Acércate al hilo azul.';this.difficulty='normal';this.playerStroke=new SawStroke();this.rivalStroke=new SawStroke();this.pressure=0;this.sliding=0;this.reversals=0;this.lastHit=null;prepareLives(this.player);prepareLives(this.rival);
  }
  get active(){return this.state==='preparing'||this.state==='playing';}
  get visible(){return this.state!=='idle';}
  get spectating(){return this.visible&&!!this.player.eliminated;}
  start(difficulty='normal'){
    this.difficulty=difficulty;this.state='preparing';this.elapsed=0;this.remaining=90;this.playerHealth=this.rivalHealth=100;this.contact=false;this.contactTime=0;this.engagements=0;this.lastPlayerPull=this.lastRivalPull=0;this.result=null;this.aiWait=0;this.attackAt=4;this.message='Tomando altura · 3';
    this.playerStroke.reset();this.rivalStroke.reset();this.pressure=0;this.sliding=0;this.reversals=0;this.lastHit=null;this.lastContactAt=-100;this.footworkAt=0;
    this._rivalAI=null;this.remaining=DUEL_SECONDS;prepareLives(this.player);prepareLives(this.rival);launchLife(this.player);this.rival.anchor.copy(this.player.anchor);this.rival.anchor.x+=PILOT_SPACING;this.rival.lineCapacity=this.player.lineCapacity;launchLife(this.rival);this.rival.time=this.player.time;this.rival.spinSign=-1;
    this.rival.profile=this.player.profile;this.rival.windSpeed=this.player.windSpeed;
  }
  stop(){this.state='idle';this.contact=false;this.result=null;this.rival.reset();}
  finish(outcome,reason){
    if(!this.active)return;
    this.state='finished';this.contact=false;this.player.sawing=false;this.rival.sawing=false;this.message=reason;this.result={outcome,reason,seconds:Math.round(this.elapsed),playerHealth:Math.round(this.playerHealth),rivalHealth:Math.round(this.rivalHealth)};
    this.result.playerLives=this.player.lives;this.result.rivalLives=this.rival.lives;this.player.setControls('hold');this.rival.setControls('hold');
    if(this.playerHealth<=0)this.player.cutLine(this.lastHit?.i,this.lastHit?.s);if(this.rivalHealth<=0)this.rival.cutLine(this.lastHit?.j,this.lastHit?.t);
  }
  controlRival(dt){
    const p=this.player,b=this.rival;
    if(b.eliminated){b.setControls('hold');return;}
    if(!this._rivalAI||this._rivalAI.serial!==b.lifeSerial)this._rivalAI={pilot:b,index:1,alive:true,homeX:b.anchor.x,homeZ:b.anchor.z,side:1,phase:0,thinkIn:0,serial:b.lifeSerial};
    controlNPC({roster:[{pilot:p,index:0,alive:p.state==='flying'&&!p.eliminated},this._rivalAI],difficulty:this.difficulty,elapsed:this.elapsed},this._rivalAI,dt);
  }
  step(dt){
    if(!this.visible)return;
    const b=this.rival,p=this.player;b.profile=p.profile;b.windSpeed=p.windSpeed;
    if(this.state==='finished'){b.step(dt);solveRopeSystem([p.rope,b.rope],dt);return;}
    if(this.state==='preparing'){
      climbControls(b,this.elapsed);this.elapsed+=dt;climbControls(p,this.elapsed);b.step(dt);solveRopeSystem([p.rope,b.rope],dt);this.message='Tomando altura · '+Math.max(1,Math.ceil(LAUNCH_SECONDS-this.elapsed));
      if(this.elapsed>=LAUNCH_SECONDS){this.state='playing';this.elapsed=0;p.setControls('hold');b.setControls('hold');this.message='Gana altura antes de buscar el cruce.';}return;
    }
    this.elapsed+=dt;this.remaining=Math.max(0,DUEL_SECONDS-this.elapsed);this.controlRival(dt);b.step(dt);const physical=solveRopeSystem([p.rope,b.rope],dt)[0];
    this.playerHealth=p.rope.integrity;this.rivalHealth=b.rope.integrity;
    if(p.state!=='flying'||b.state!=='flying'){
      this.updateLives();this.checkOutcome();if(!this.active)return;
    }
    const hit=!p.eliminated&&!b.eliminated?physical?.hit:null;this.contact=!!hit;this.sliding=0;this.pressure=0;
    if(hit){
      const contact=physical.contact;this.lastHit=hit;
      this.contactPoint.copy(contact.point);this.contactTime+=dt;if(this.elapsed-this.lastContactAt>.35)this.engagements++;this.lastContactAt=this.elapsed;
      this.pressure=contact.load;this.sliding=contact.slip/dt;
      this.playerStroke.step(p.rope.feedDelta,dt,this.elapsed);this.rivalStroke.step(b.rope.feedDelta,dt,this.elapsed);
      this.reversals=this.playerStroke.reversals;
      // Abrasion requires physical contact, normal pressure and actual sliding.
      // The same friction work wears both materials at their current coordinates.
      // Alternating strokes repeatedly revisit a small patch; holding still costs 0.
      if(p.tension>.08&&b.tension>.08){
        const alternating=Math.max(this.playerStroke.factor(this.elapsed),this.rivalStroke.factor(this.elapsed));
        const work=.36*contact.load*contact.slip*alternating;
        // The moving strand presents fresh fibres; its stroke works mainly
        // into the opposing patch. Symmetric rules for player and NPC.
        const pa=Math.abs(p.rope.feedDelta)*this.playerStroke.factor(this.elapsed),ba=Math.abs(b.rope.feedDelta)*this.rivalStroke.factor(this.elapsed),total=pa+ba;
        p.rope.abrade(hit.i,hit.s,work*(.2+.8*(total?ba/total:0)));
        b.rope.abrade(hit.j,hit.t,work*(.2+.8*(total?pa/total:0)));
      }
      this.playerHealth=p.rope.integrity;this.rivalHealth=b.rope.integrity;
      this.message=p.rope.stressRatio>.8?'Tu hilo está al límite · mantén Q para descargar.':contact.load<.04?'Cruce flojo · recoge suavemente antes de atacar.':'Tensa y da un tirón para cargar el cruce; el hilo más exigido puede cortarse, incluso el tuyo.';
    }else{
      if(this.elapsed-this.playerStroke.lastReversal>1){this.playerStroke.direction=0;this.playerStroke.travel=0;}
      if(this.elapsed-this.rivalStroke.lastReversal>1){this.rivalStroke.direction=0;this.rivalStroke.travel=0;}
      this.message='Busca el contacto real con el hilo azul. Al cruzarlo, alterna Q / E o mantén F.';
    }
    this.updateLives();this.checkOutcome();
    if(p.eliminated&&p.lives>0)this.message=`Vuelves en ${Math.max(1,Math.ceil(p.respawnAt-this.elapsed))} s · ${p.lives} vidas.`;
    else if(b.eliminated&&b.lives>0)this.message=`El rival vuelve en ${Math.max(1,Math.ceil(b.respawnAt-this.elapsed))} s · ${b.lives} vidas.`;
    else if(!this.contact&&p.position.y<18)this.message='Gana altura: suelta en pulsos cortos y mantén para estabilizar.';
  }
  updateLives(){
    for(const [i,p]of [this.player,this.rival].entries()){
      if(!p.eliminated&&(p.state!=='flying'||p.rope.integrity<=0)){const cut=p.rope.integrity<=0&&p.rope.cutReason!=='ground';if(cut)p.cutLine(i?this.lastHit?.j:this.lastHit?.i,i?this.lastHit?.t:this.lastHit?.s);loseLife(p,this.elapsed,cut?'Hilo cortado':'En tierra');}
      if(respawnLife(p,this.elapsed)){(i?this.rivalStroke:this.playerStroke).reset();if(i)p.spinSign=-1;this.lastHit=null;this.contact=false;}
    }
    this.playerHealth=this.player.rope.integrity;this.rivalHealth=this.rival.rope.integrity;
  }
  checkOutcome(){
    const p=this.player,b=this.rival;
    if(p.lives<=0||b.lives<=0){this.finish(p.lives===b.lives?'draw':b.lives<=0?'win':'loss',p.lives===b.lives?'Ambos agotaron sus vidas.':b.lives<=0?'El rival agotó sus 3 vidas.':'Agotaste tus 3 vidas.');return;}
    if(this.remaining<=0){const diff=p.lives-b.lives||((this.playerHealth-this.rivalHealth)/100);this.finish(Math.abs(diff)<.01?'draw':diff>0?'win':'loss',Math.abs(diff)<.01?'Tiempo cumplido: empate en vidas y estado del hilo.':'Tiempo cumplido: gana quien conserva más vidas; desempata el hilo.');}
  }
}
