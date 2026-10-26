import {mountSettings} from './kite-shape.js';
import {Tether} from './rope.js';
import {flightGust,extremeGust,updateWindStress} from './line-stress.js';
import {DEFAULT_EQUIPMENT,cleanEquipment,equipmentStats} from './equipment.js';
import {stepFreeFlight} from './free-flight.js';
import { Vector3, Quaternion, Matrix4 } from './vendor/three.module.js';

export const DEFAULT_SETUP = Object.freeze({...DEFAULT_EQUIPMENT,left:44, right:44, lower:52, knotsLeft:0, knotsRight:0, knotsLower:0, mass:34, tail:true, color:'terracotta', anchorLeft:55, anchorRight:55, sailStyle:'classic', paperColor:null, printId:'', imageFit:'cover', imageScale:1});
export const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export const mix=(a,b,t)=>a+(b-a)*t;
export const LINE_BOOST=2.5;
export const DOUBLE_TUG_GAP=.22;
export const LINE_CAPACITIES=[30,65,100,150];
export const TURN_RESPONSE=1.1;
export function configuration(s=DEFAULT_SETUP) {
  const left=s.left-s.knotsLeft*.8, right=s.right-s.knotsRight*.8, lower=s.lower-s.knotsLower*.8;
  const mounts=mountSettings(s),lengthBias=clamp((left-right)/8,-1,1);
  const mountBias=(mounts.right-mounts.left)/100;
  const bias=clamp(lengthBias+mountBias,-1,1),spreadDelta=mounts.spread-.55;
  const attack=clamp(38+(lower-52)*.8,25,49)*Math.PI/180;
  const stability=clamp(.61+(s.tail?.26:0)+spreadDelta*.18-Math.abs(bias)*.4-Math.abs(lower-52)*.007,.12,.95);
  return {left,right,lower,bias,lengthBias,mountBias,mountCenter:mounts.center,spread:mounts.spread,turnScale:1-spreadDelta*.75,dampingScale:1+spreadDelta*.5,attack,stability,agility:clamp(1.12-stability+.15,.15,.95),climb:clamp(.85-Math.abs(lower-48)*.018-(s.mass-24)*.008-(s.tail?.06:0),.2,.95),mass:(s.mass+(s.tail?2.5:0)+(s.knotsLeft+s.knotsRight+s.knotsLower)*.025)/1000};
}

// Reduced aerodynamic model: a translating kite, an evolving sail attitude,
// unilateral elastic tether, apparent wind, and tension-dependent spin.
// Coefficients are tunable estimates, not measurements of a particular kite.
export class KitePhysics {
  constructor(setup={...DEFAULT_SETUP},{seed=0x51f15e}={}) {
    this.setup={...DEFAULT_SETUP,...setup,...cleanEquipment(setup)}; this.trim=configuration(this.setup);this.equipment=equipmentStats(this.setup);
    this.anchor=new Vector3(0,1.35,0); this.position=new Vector3();this.velocity=new Vector3();
    this.orientation=new Quaternion(); this.normal=new Vector3(0,.75,.66);this.nose=new Vector3(0,.66,-.75);
    this.right=new Vector3(1,0,0);this.wind=new Vector3();this.aero=new Vector3();this.force=new Vector3();
    this.time=0;this.windSpeed=5.5;this.profile='breeze';this.lineCapacity=65;this.lineLength=8;this.energy=100;this.boostRequested=false;this.exhausted=false;
    this.flightSeed=seed>>>0;this.flightNumber=0;this.extremeGustEligible=false;this.extremeGustAt=30;
    this.heading=0;this.spin=0;this.tension=0;this.bend=0;this.maxHeight=0;this.flightTime=0;this.steadyTime=0;
    this.state='ready';this.action='hold';this.boost=false;this.spinSign=1;this.tugCooldown=0;this.lastTug=-100;
    this.pendingTug=0;this.tugCount=0;this.tugSequence=1;this.tugIndex=0;this.maneuverHold=0;this.turns=0;this.turnProgress=0;
    this._rel=new Vector3();this._flow=new Vector3();this._up=new Vector3();this._side=new Vector3();this._lift=new Vector3();
    this._radial=new Vector3();this._basis=new Matrix4();this.reset();this.rope=new Tether(this);
  }
  configure(s) {this.setup={...DEFAULT_SETUP,...s,...cleanEquipment(s)};this.trim=configuration(this.setup);this.equipment=equipmentStats(this.setup);}
  reset() {
    this.state='ready';this.position.set(this.anchor.x,.48,this.anchor.z-7.8);this.velocity.set(0,0,0);this.lineLength=8;
    this.heading=0;this.spin=0;this.tension=0;this.bend=0;this.flightTime=0;this.steadyTime=0;
    this.freeTime=0;this.freePhase=0;this.freeYaw=0;this.freeNoseY=0;this.freeMode='';
    this.action='hold';this.boost=false;this.boostRequested=false;this.energy=100;this.exhausted=false;this.tugCooldown=0;this.pendingTug=0;this.lastTug=-100;
    this.tugCount=0;this.tugSequence=1;this.tugIndex=0;this.maneuverHold=0;this.turns=0;this.turnProgress=0;
    this.sawing=false;this.sawClock=0;this.spinSign=this.trim.bias<-.04?-1:1;this.updateAttitude(new Vector3(0,0,-1));this.rope?.reset();
  }
  launch() {
    this.reset();this.state='flying';this.position.set(this.anchor.x,2.1,this.anchor.z-7.6);this.velocity.set(0,3,-1.2);
    const gust=flightGust(this.flightSeed,++this.flightNumber);this.extremeGustEligible=gust.eligible;this.extremeGustAt=gust.at;
    this.heading=this.trim.bias*.15;this.tension=.3;this.rope.reset();
  }
  setLineCapacity(meters){if(!LINE_CAPACITIES.includes(meters)||meters<this.lineLength)return false;this.lineCapacity=meters;return true;}
  setControls(action='hold',boost=false) {
    if(action==='release'&&this.action!=='release'&&this.state==='flying'&&!this.sawing&&!(this.rope?.contactAge<.1))this.lineLength=Math.min(this.lineCapacity,this.lineLength+.28);
    this.action=action;this.boostRequested=!!boost;this.boost=!!boost&&!this.exhausted&&this.energy>0;
  }
  tug(double=false) {
    if(this.state!=='flying'||this.tugCooldown>0||this.lineLength<=3||this.energy<(double?14:7))return false;
    this.energy-=double?14:7;
    this.tugSequence=double?2:1;this.tugIndex=0;
    this.pullLine();this.pendingTug=double?DOUBLE_TUG_GAP:0;
    this.tugCooldown=double?.75:.45;return true;
  }
  pullLine() {
    this.lineLength=Math.max(3,this.lineLength-.3);this.lastTug=this.time;
    this.maneuverHold=1.25;this.tugCount++;this.tugIndex++;
    // A taut pulse arrests spin at the current heading, including a dive.
    if(this.slack<.12)this.spin*=.35;
  }
  windAt(p,out=new Vector3()) {
    const t=this.time, strength=this.profile==='calm'?0:this.windSpeed;
    const gust=this.profile==='gusts'?.42:this.profile==='strong'?.2:.09;
    const wave=Math.sin(t*.73+p.z*.008)*.54+Math.sin(t*1.73+1.4)*.29+Math.sin(t*3.21+.3)*.17;
    const height=1+.1*Math.log1p(Math.max(0,p.y)/6);
    const speed=Math.max(0,strength*height*(1+gust*wave))*extremeGust(this);
    return out.set(speed*(Math.sin(t*.29)*.025+Math.sin(t*.87+p.y*.03)*gust*.11),speed*gust*.055*Math.sin(t*1.19),-speed);
  }
  updateAttitude(flow) {
    const up=this._up.set(0,1,0).addScaledVector(flow,-flow.y).normalize();
    if(up.lengthSq()<.1)up.set(0,0,1);
    const side=this._side.crossVectors(flow,up).normalize();
    const lift=this._lift.copy(up).multiplyScalar(Math.cos(this.heading)).addScaledVector(side,Math.sin(this.heading));
    const alpha=this.trim.attack;
    // The leading tip points upwind. The bridle face points toward the pilot;
    // the aerodynamic resultant acts on the opposite face of the sail.
    this.normal.copy(lift).multiplyScalar(-Math.cos(alpha)).addScaledVector(flow,-Math.sin(alpha));
    this.nose.copy(lift).multiplyScalar(Math.sin(alpha)).addScaledVector(flow,-Math.cos(alpha));
    this.right.crossVectors(this.nose,this.normal).normalize();
    this.orientation.setFromRotationMatrix(this._basis.makeBasis(this.right,this.nose,this.normal));
  }
  cutLine(edge=this.rope.contactEdge,fraction=.5,reason='abrasion'){if(this.rope.broken<0){this.rope.cutReason=reason;this.rope.breakAt(clamp(Number.isFinite(edge)&&edge>=0?edge:18,0,this.rope.points.length-2),fraction);}if(this.state!=='cut'){this.velocity.clampLength(0,8);this.freeTime=0;this.freePhase=this.heading;this.freeNoseY=this.nose.y;this.freeYaw=Math.atan2(this.nose.x,-this.nose.z);this.freeMode='glide';}this.sawing=false;this.state='cut';this.tension=0;this.pendingTug=0;this.setControls('hold',false);}
  step(dt) {
    this.time+=dt;this.tugCooldown=Math.max(0,this.tugCooldown-dt);this.maneuverHold=Math.max(0,this.maneuverHold-dt);this.windAt(this.position,this.wind);
    if(this.state==='cut'){stepFreeFlight(this,dt);this.rope.step(dt);return;}
    if(this.state!=='flying'){this.energy=Math.min(100,this.energy+10*dt);this._flow.copy(this.wind);if(this._flow.lengthSq()<.001)this._flow.set(0,0,-1);else this._flow.normalize();this.updateAttitude(this._flow);this.rope.step(dt);return;}
    // Schedule the second distinct pulse on simulation time: it freezes on
    // pause and is cleared on restart or landing, without wall-clock timers.
    if(this.pendingTug>0){this.pendingTug-=dt;if(this.pendingTug<=1e-8){this.pendingTug=0;this.pullLine();}}
    if(this.sawing){this.sawClock+=dt;this.setControls(this.rope.contactAge<.09?(this.sawClock%.34<.14?'release':'reel'):'hold',this.boostRequested);}
    this.flightTime+=dt;
    if(this.energy<=.05)this.exhausted=true;else if(this.energy>=20)this.exhausted=false;
    this.boost=this.boostRequested&&!this.exhausted&&this.energy>0;
    const exerting=this.action==='reel'&&this.lineLength>3||this.action==='release'&&this.lineLength<this.lineCapacity;
    const cost=exerting?(this.boost?(this.action==='reel'?22:14):(this.action==='reel'?2.3+Math.min(this.tension,20)*.08:-1)): -6;
    this.energy=clamp(this.energy-cost*(cost>0?this.equipment.effort:1)*dt,0,100);
    const drag=1/(1+this.rope.contactLoad*.12);
    const lineSpeed=drag*this.equipment.speed*(this.boost?LINE_BOOST:1)*(this.energy<20?.55+.45*this.energy/20:1);
    const releasing=this.action==='release'&&this.lineLength<this.lineCapacity;
    const reeling=this.action==='reel'&&this.lineLength>3;
    if(releasing)this.lineLength=Math.min(this.lineCapacity,this.lineLength+1.8*lineSpeed*dt);
    if(reeling){this.lineLength=Math.max(3,this.lineLength-1.25*lineSpeed*dt);this.maneuverHold=Math.max(this.maneuverHold,.8);}
    const rel=this._rel.copy(this.wind).sub(this.velocity), speed=rel.length();
    const flow=this._flow.copy(rel).normalize();if(speed<.001)flow.set(0,0,-1);
    const taut=clamp(this.tension/.35,0,1);
    const slack=1-taut;
    const loadedCrossing=this.rope.contactAge<.1&&this.rope.contactLoad>.1;
    const freedom=Math.max(slack,releasing?(this.boost?1:.82)*(loadedCrossing?.12:1):0);
    const catching=this.maneuverHold>0;
    const disturbance=this.profile==='gusts'?.19:.025;
    const turnTorque=this.trim.bias*(1.4+taut*2.7)+disturbance*Math.sin(this.time*1.37);
    const selfRight=(this.setup.tail?3.8:1.15)*this.trim.stability;
    const drive=TURN_RESPONSE*this.trim.turnScale*freedom*this.spinSign*(this.setup.tail?3.8:5.1)*clamp(this.wind.length()/3.5,0,1.7);
    const restoring=selfRight*Math.sin(this.heading)*(1-freedom)*taut*(catching?.025:1);
    const damping=((1-freedom)*(catching?9:4.8)+freedom*(this.setup.tail?.65:.45))*this.trim.dampingScale;
    const angularAcceleration=drive+turnTorque-restoring-this.spin*damping;
    this.spin=clamp(this.spin+angularAcceleration*dt,-8.5,8.5);
    const rotation=this.spin*dt;this.heading+=rotation;this.turnProgress+=rotation;
    if(Math.abs(this.turnProgress)>=Math.PI*2){this.turns++;this.turnProgress-=Math.sign(this.turnProgress)*Math.PI*2;}
    if(this.heading>Math.PI*2)this.heading-=Math.PI*2;
    if(this.heading<-Math.PI*2)this.heading+=Math.PI*2;
    this.updateAttitude(flow);
    const alpha=this.trim.attack;
    const q=.5*1.225*speed*speed;
    const area=.32;
    const cl=1.08*Math.sin(2*alpha)*(1-.42*freedom);
    const cd=.14+1.1*Math.sin(alpha)**2+(this.setup.tail?.055:0);
    this.aero.copy(this._lift).multiplyScalar(q*area*cl).addScaledVector(flow,q*area*cd);
    // Half of the distributed tether load is lumped at the kite; the remainder
    // is carried by the hand. The segmented chain supplies contact deflection.
    this.aero.addScaledVector(flow,.25*1.225*1.1*this.equipment.thread.diameter/1000*this.lineLength*speed*speed);
    const lineMass=this.equipment.thread.mass/1000,effectiveMass=this.trim.mass+this.lineLength*lineMass/3;
    this.force.copy(this.aero);this.force.y-=(this.trim.mass+this.lineLength*lineMass*.5)*9.81;
    const radial=this._radial.copy(this.position).sub(this.anchor);
    const distance=radial.length();radial.normalize();
    const route=this.rope.loadPath(this.position,radial);
    const extension=Math.max(distance,route)-this.lineLength, radialSpeed=this.velocity.dot(radial);
    this.tension=extension>-.008?Math.max(0,38*extension+1.8*radialSpeed):0;
    this.tension=Math.min(120,this.tension);
    this.force.addScaledVector(radial,-this.tension);
    this.velocity.addScaledVector(this.force,dt/effectiveMass);
    this.position.addScaledVector(this.velocity,dt);
    this.bend+=((1-Math.exp(-this.tension/1.1))-this.bend)*Math.min(1,dt*12);
    this.maxHeight=Math.max(this.maxHeight,this.position.y);
    if(this.position.y>5&&Math.abs(this.spin)<.2&&this.tension>.08)this.steadyTime+=dt;
    else this.steadyTime=Math.max(0,this.steadyTime-dt*.25);
    if(this.position.y<.42){this.position.y=.42;this.velocity.set(0,0,0);this.tension=0;this.pendingTug=0;this.state='grounded';}
    this.rope.step(dt);
    updateWindStress(this,dt);
  }
  get lineRemaining(){return Math.max(0,this.lineCapacity-this.lineLength);}
  get slack(){return Math.max(0,this.lineLength-this.position.distanceTo(this.anchor));}
  get windKmh(){return this.wind.length()*3.6;}
}
