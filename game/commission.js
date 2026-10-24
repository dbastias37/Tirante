import {solveRopeSystem} from './rope-system.js';
import {Vector3} from './vendor/three.module.js';
import {KitePhysics,DEFAULT_SETUP,clamp} from './physics.js';
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
    this.player=player;this.rival=new KitePhysics({...DEFAULT_SETUP,color:'teal',knotsLeft:1});this.rival.anchor.set(3.2,1.35,0);this.rival.reset();
    this.state='idle';this.elapsed=0;this.remaining=90;this.playerHealth=100;this.rivalHealth=100;this.contact=false;this.contactPoint=v();this.contactTime=0;this.engagements=0;this.lastPlayerPull=0;this.lastRivalPull=0;this.result=null;this.aiWait=0;this.attackAt=4;this.message='Acércate al hilo azul.';this.difficulty='normal';this.playerStroke=new SawStroke();this.rivalStroke=new SawStroke();this.pressure=0;this.sliding=0;this.reversals=0;this.lastHit=null;
  }
  get active(){return this.state==='preparing'||this.state==='playing';}
  get visible(){return this.state!=='idle';}
  start(difficulty='normal'){
    this.difficulty=difficulty;this.state='preparing';this.elapsed=0;this.remaining=90;this.playerHealth=this.rivalHealth=100;this.contact=false;this.contactTime=0;this.engagements=0;this.lastPlayerPull=this.lastRivalPull=0;this.result=null;this.aiWait=0;this.attackAt=4;this.message='Tomando altura · 3';
    this.playerStroke.reset();this.rivalStroke.reset();this.pressure=0;this.sliding=0;this.reversals=0;this.lastHit=null;this.lastContactAt=-100;this.footworkAt=0;
    this.player.launch();this.rival.anchor.set(3.2,1.35,0);this.rival.lineCapacity=this.player.lineCapacity;this.rival.launch();this.rival.time=this.player.time;this.rival.spinSign=-1;
    this.rival.profile=this.player.profile;this.rival.windSpeed=this.player.windSpeed;
  }
  stop(){this.state='idle';this.contact=false;this.result=null;this.rival.reset();}
  finish(outcome,reason){
    if(!this.active)return;
    this.state='finished';this.contact=false;this.player.sawing=false;this.rival.sawing=false;this.message=reason;this.result={outcome,reason,seconds:Math.round(this.elapsed),playerHealth:Math.round(this.playerHealth),rivalHealth:Math.round(this.rivalHealth)};
    this.player.setControls('hold');this.rival.setControls('hold');
    if(this.playerHealth<=0)this.player.cutLine(this.lastHit?.i,this.lastHit?.s);if(this.rivalHealth<=0)this.rival.cutLine(this.lastHit?.j,this.lastHit?.t);
  }
  controlRival(dt){
    const p=this.player,b=this.rival;this.aiWait=Math.max(0,this.aiWait-dt);
    const dx=p.position.x-3.2-b.position.x;
    const desired=clamp(dx*.19-b.velocity.x*.16,-.85,.55);
    const error=wrap(desired-b.heading);
    // Visible footwork aligns the depth of the crossing. The pilot walks; the
    // sail and cord respond through the same solver, without teleporting them.
    if(!this.contact&&this.elapsed>1&&this.elapsed>=(this.footworkAt||0)){
      this.footworkAt=this.elapsed+.05;
      let nearest=null;for(let i=8;i<27;i++)for(let j=8;j<27;j++){
        const hit=closestSegments(p.rope.points[i],p.rope.points[i+1],b.rope.points[j],b.rope.points[j+1]);
        if(!nearest||hit.distance<nearest.distance)nearest=hit;
      }
      if(nearest&&Math.abs(nearest.a.x-nearest.b.x)<1.2){
        const pace=clamp((nearest.a.z-nearest.b.z)*3,-.65,.65);
        b.anchor.z=clamp(b.anchor.z+pace*.05,-3,3);b.energy=Math.max(0,b.energy-Math.abs(pace)*.05*.8);
      }
    }
    // Fixed bridle bias; the opponent steers by catching a heading with the line.
    let action='hold',boost=false;
    if(this.aiWait>0)action='hold';
    else if(error<-.13&&b.position.y>3.5&&b.lineRemaining>.4){action='release';}
    else if(Math.abs(b.spin)>.3&&Math.abs(error)<.38){action='reel';this.aiWait=.24;}
    else if(b.lineLength>p.lineLength+.55&&Math.cos(b.heading)>.5)action='reel';
    else if(b.lineLength<p.lineLength-.55&&b.position.y>4){action='release';}
    if(b.position.y<3.5&&Math.cos(b.heading)<.2){action='release';boost=true;}
    b.sawing=this.contact&&(this.difficulty==='hard'||this.elapsed%4<1.5);
    if(this.contact)action='hold';
    if(b.sawing){action=b.action;boost=this.difficulty==='hard'&&b.energy>35;}
    b.setControls(action,boost);
  }
  step(dt){
    if(!this.visible)return;
    const b=this.rival,p=this.player;b.profile=p.profile;b.windSpeed=p.windSpeed;
    if(this.state==='finished'){b.step(dt);solveRopeSystem([p.rope,b.rope],dt);return;}
    if(this.state==='preparing'){
      this.elapsed+=dt;p.setControls('hold');b.setControls('hold');b.step(dt);solveRopeSystem([p.rope,b.rope],dt);this.message='Tomando altura · '+Math.max(1,Math.ceil(3-this.elapsed));
      if(this.elapsed>=3){this.state='playing';this.elapsed=0;this.message='Cruza el hilo azul.';}return;
    }
    this.elapsed+=dt;this.remaining=Math.max(0,90-this.elapsed);this.controlRival(dt);b.step(dt);const physical=solveRopeSystem([p.rope,b.rope],dt)[0];
    if(p.state!=='flying'||b.state!=='flying'){
      this.finish(p.state===b.state?'draw':p.state==='flying'?'win':'loss',p.state===b.state?'Ambos volantines tocaron tierra.':p.state==='flying'?'El rival tocó tierra.':'Tu volantín tocó tierra.');return;
    }
    const hit=physical?.hit;this.contact=!!hit;this.sliding=0;this.pressure=0;
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
      this.message=contact.load<.04?'Contacto flojo · recoge para cargar el cruce.':this.sliding<.03?'Hilos trabados · alterna Q / E o mantén F para aserruchar.':'Aserruchando · el roce desgasta el punto de contacto.';
    }else{
      if(this.elapsed-this.playerStroke.lastReversal>1){this.playerStroke.direction=0;this.playerStroke.travel=0;}
      if(this.elapsed-this.rivalStroke.lastReversal>1){this.rivalStroke.direction=0;this.rivalStroke.travel=0;}
      this.message='Busca el contacto real con el hilo azul. Al cruzarlo, alterna Q / E o mantén F.';
    }
    if(this.playerHealth<=0||this.rivalHealth<=0)this.finish(this.playerHealth===this.rivalHealth?'draw':this.rivalHealth<=0?'win':'loss',this.rivalHealth<=0?'Cortaste el hilo del rival.':'El rival cortó tu hilo.');
    else if(this.remaining<=0){const diff=this.playerHealth-this.rivalHealth;this.finish(Math.abs(diff)<1?'draw':diff>0?'win':'loss',Math.abs(diff)<1?'Tiempo cumplido: los hilos quedaron iguales.':'Tiempo cumplido: gana el hilo con menos desgaste.');}
  }
}
