import {Vector3} from './vendor/three.module.js';
import {bridleJunction} from './kite-shape.js';
import {WEAR_STEP,WEAR_SAMPLES} from './line-config.js';
import {LINE_STRENGTH} from './line-stress.js';
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const V=()=>new Vector3();
export const ROPE_SEGMENTS=28,CONTACT_RADIUS=.008;

// Finite 3-D segments. Parameters refer to the material's two mesh edges.
export function closestSegments(a,b,c,d){
  const u=b.clone().sub(a),v=d.clone().sub(c),r=a.clone().sub(c),aa=u.dot(u),ee=v.dot(v),f=v.dot(r);let s=0,t=0;
  if(aa<1e-12&&ee<1e-12)return {a:a.clone(),b:c.clone(),distance:a.distanceTo(c),s,t};
  if(aa<1e-12)t=clamp(f/ee,0,1);
  else{const cc=u.dot(r);if(ee<1e-12)s=clamp(-cc/aa,0,1);else{const bb=u.dot(v),den=aa*ee-bb*bb;s=den>1e-12?clamp((bb*f-cc*ee)/den,0,1):0;t=(bb*s+f)/ee;if(t<0){t=0;s=clamp(-cc/aa,0,1);}else if(t>1){t=1;s=clamp((bb-cc)/aa,0,1);}}}
  const p=a.clone().addScaledVector(u,s),q=c.clone().addScaledVector(v,t);return {a:p,b:q,distance:p.distanceTo(q),s,t};
}

// XPBD distance chain. Identical vertices are used for rendering and contact.
// Compliance/radius and fracture work are game calibration, not measured cotton.
export class Tether {
  constructor(owner){this.owner=owner;this.end=V();this.contactPoint=V();this.reset();}
  endpoint(){const p=this.owner;return this.end.fromArray(bridleJunction(p.trim)).applyQuaternion(p.orientation).add(p.position);}
  reset(){
    const end=this.endpoint(),p=this.owner,n=ROPE_SEGMENTS;
    this.points=Array.from({length:n+1},(_,i)=>p.anchor.clone().lerp(end,i/n));
    this.previous=this.points.map(q=>q.clone());this.velocities=this.points.map(V);this.weights=this.points.map((_,i)=>i===0||i===n?0:1);
    this.rest=Array(n).fill(p.lineLength/n);this.lambda=Array(n).fill(0);this.wear=new Float64Array(WEAR_SAMPLES);this.broken=-1;this.breakPoint=null;
    this.contactLoad=0;this.contactEdge=-1;this.feedDelta=0;this.lastLength=p.lineLength;this.integrity=100;this.contactAge=100;this.breakAge=100;
    this.stressLoad=0;this.strength=p.equipment?.thread.strength||LINE_STRENGTH;this.stressRatio=0;this.overload=0;this.jamStrain=0;this.jamTime=0;this.shock=0;this.cutReason='';
  }
  moveAnchor(position){
    // The simulated hand and the visible reel share one endpoint. Move only the
    // boundary: the remaining particles respond through their constraints.
    this.owner.anchor.copy(position);this.points[0].copy(position);
  }
  pin(){this.points[0].copy(this.owner.anchor);this.points.at(-1).copy(this.endpoint());}
  solve(iterations=10){
    const x=this.points,w=this.weights,alpha=1e-7/(this.dt*this.dt);
    for(let pass=0;pass<iterations;pass++){
      for(let k=0;k<this.rest.length;k++){
        const i=pass%2?this.rest.length-1-k:k;if(i===this.broken)continue;
        const a=x[i],b=x[i+1],dx=b.x-a.x,dy=b.y-a.y,dz=b.z-a.z,len=Math.hypot(dx,dy,dz);if(len<1e-9)continue;
        const change=(-(len-this.rest[i])-alpha*this.lambda[i])/(w[i]+w[i+1]+alpha);this.lambda[i]+=change;
        const f=change/len;a.x-=w[i]*f*dx;a.y-=w[i]*f*dy;a.z-=w[i]*f*dz;b.x+=w[i+1]*f*dx;b.y+=w[i+1]*f*dy;b.z+=w[i+1]*f*dz;
      }
      for(let i=1;i<x.length-1;i++)x[i].y=Math.max(.035,x[i].y);
    }
  }
  commitVelocities(){for(let i=1;i<this.points.length-1;i++){const v=this.velocities[i].subVectors(this.points[i],this.previous[i]).multiplyScalar(1/this.dt);if(v.lengthSq()>900)v.setLength(30);}}
  step(dt){
    this.dt=dt;const p=this.owner;this.contactAge+=dt;this.breakAge+=dt;this.contactLoad*=Math.exp(-dt*15);
    if(this.contactAge>.08)this.contactEdge=-1;
    this.feedDelta=p.lineLength-this.lastLength;this.lastLength=p.lineLength;
    if(this.broken<0)this.rest.fill(p.lineLength/ROPE_SEGMENTS);
    this.lambda.fill(0);
    for(let i=0;i<this.points.length;i++){
      const q=this.points[i];this.previous[i].copy(q);if(!this.weights[i])continue;
      const vel=this.velocities[i];vel.multiplyScalar(Math.exp(-dt*2.4));vel.y-=9.81*dt;
      // Distributed air drag, strongest on slack strands. No artificial sag curve.
      vel.x+=(p.wind.x*.14-vel.x)*dt*.7;vel.z+=(p.wind.z*.14-vel.z)*dt*.7;
      q.addScaledVector(vel,dt);
    }
    this.pin();this.solve();this.commitVelocities();
  }
  // Bend at a collision changes both the loaded path and force direction.
  loadPath(end,direction){
    if(this.contactEdge<0||this.broken>=0)return end.distanceTo(this.owner.anchor);
    direction.subVectors(end,this.contactPoint).normalize();
    return this.owner.anchor.distanceTo(this.contactPoint)+this.contactPoint.distanceTo(end);
  }
  materialAt(edge,fraction){return Math.max(0,this.owner.lineLength*(1-(edge+fraction)/ROPE_SEGMENTS));}
  wearAt(edge,fraction=.5){return this.wear[Math.min(this.wear.length-1,Math.round(this.materialAt(edge,fraction)/WEAR_STEP))]||0;}
  abrade(edge,fraction,work){
    if(work<=0||this.broken>=0)return false;
    const coordinate=this.materialAt(edge,fraction)/WEAR_STEP,index=Math.round(coordinate);
    for(let k=Math.max(0,index-1);k<=Math.min(this.wear.length-1,index+1);k++){
      const amount=work/(3.6*(this.owner.equipment?.thread.wear||1))*Math.max(0,1-Math.abs(k-coordinate)/1.25);
      this.wear[k]=Math.min(1,this.wear[k]+amount);this.integrity=Math.min(this.integrity,100*(1-this.wear[k]));
    }
    return this.integrity<=.001;
  }
  breakAt(edge,fraction){
    if(this.broken>=0)return;
    fraction=clamp(fraction,0,1);const a=this.points[edge],b=this.points[edge+1],point=a.clone().lerp(b,fraction),rest=this.rest[edge];
    const velocity=this.velocities[edge].clone().lerp(this.velocities[edge+1],fraction),dir=b.clone().sub(a).normalize();
    this.points.splice(edge+1,0,point.clone(),point.clone());this.previous.splice(edge+1,0,point.clone(),point.clone());
    // Stored elastic energy releases at the two free ends; the ends stay visible.
    const recoil=Math.min(3,.7+this.owner.tension*.3);
    this.velocities.splice(edge+1,0,velocity.clone().addScaledVector(dir,-recoil),velocity.clone().addScaledVector(dir,recoil));
    this.weights.splice(edge+1,0,1,1);this.rest.splice(edge,1,rest*fraction,0,rest*(1-fraction));this.lambda=Array(this.rest.length).fill(0);
    this.broken=edge+1;this.breakPoint=point;this.breakAge=0;this.contactEdge=-1;this.contactLoad=0;this.integrity=0;
  }
}

function overlaps(a,b,c,d,ap,bp,cp,dp,r){
  for(const key of ['x','y','z'])if(Math.max(a[key],b[key],ap[key],bp[key])+r<Math.min(c[key],d[key],cp[key],dp[key])||Math.max(c[key],d[key],cp[key],dp[key])+r<Math.min(a[key],b[key],ap[key],bp[key]))return false;
  return true;
}
export function findRopeContact(a,b){
  if(a.broken>=0||b.broken>=0)return null;
  const radius=CONTACT_RADIUS*2;let best=null;
  for(let i=3;i<a.points.length-1;i++)for(let j=3;j<b.points.length-1;j++){
    const x=a.points[i],y=a.points[i+1],u=b.points[j],v=b.points[j+1],xp=a.previous[i],yp=a.previous[i+1],up=b.previous[j],vp=b.previous[j+1];
    if(!overlaps(x,y,u,v,xp,yp,up,vp,radius))continue;
    let h=closestSegments(x,y,u,v),normal=null,swept=false;
    if(h.distance<radius){
      const old=closestSegments(xp,yp,up,vp),prior=old.a.clone().sub(old.b);normal=h.a.clone().sub(h.b);
      if(normal.lengthSq()<1e-12)normal.copy(prior);
      if(normal.lengthSq()<1e-12)normal.crossVectors(y.clone().sub(x),v.clone().sub(u));
      if(normal.lengthSq()<1e-12)normal.crossVectors(y.clone().sub(x),new Vector3(0,1,0));
      if(normal.lengthSq()<1e-12)normal.set(1,0,0);
      if(prior.lengthSq()>1e-8&&normal.dot(prior)<0)normal.copy(prior);
      normal.normalize();
    }
    else{
      // Continuous crossing of the separating plane. Re-evaluate finite edges
      // at time of impact so crossings between fixed ticks cannot tunnel.
      const old=closestSegments(xp,yp,up,vp),n=new Vector3().crossVectors(yp.clone().sub(xp),vp.clone().sub(up)).normalize();
      if(n.lengthSq()<.5)n.copy(old.a).sub(old.b).normalize();
      const before=old.a.clone().sub(old.b).dot(n),after=h.a.clone().sub(h.b).dot(n);
      if(before*after<0&&Math.abs(before-after)>1e-8){
        const t=before/(before-after),at=closestSegments(xp.clone().lerp(x,t),yp.clone().lerp(y,t),up.clone().lerp(u,t),vp.clone().lerp(v,t));
        if(at.distance<radius){h={...at,a:x.clone().lerp(y,at.s),b:u.clone().lerp(v,at.t)};normal=n.multiplyScalar(Math.sign(before));swept=true;}
      }
    }
    if(normal?.lengthSq()>.5&&Math.min(h.a.y,h.b.y)>.3&&(!best||h.distance<best.distance))best={...h,i,j,normal,swept};
  }
  return best;
}
export function resolveRopeContact(a,b,hit,dt){
  const weights=[1-hit.s,hit.s,1-hit.t,hit.t],indices=[hit.i,hit.i+1,hit.j,hit.j+1],ropes=[a,a,b,b];
  let correction=0;
  for(let pass=0;pass<5;pass++){
    const p=a.points[hit.i].clone().lerp(a.points[hit.i+1],hit.s),q=b.points[hit.j].clone().lerp(b.points[hit.j+1],hit.t);
    const depth=CONTACT_RADIUS*2-p.sub(q).dot(hit.normal);
    const mass=indices.reduce((s,id,k)=>s+ropes[k].weights[id]*weights[k]**2,0);
    if(depth>0&&mass>0){const impulse=Math.min(.15,depth)/mass;correction+=impulse;
      for(let k=0;k<4;k++)ropes[k].points[indices[k]].addScaledVector(hit.normal,impulse*ropes[k].weights[indices[k]]*weights[k]*(k<2?1:-1));
    }
    if(pass<4){a.solve(2);b.solve(2);}
  }
  hit.a.copy(a.points[hit.i]).lerp(a.points[hit.i+1],hit.s);hit.b.copy(b.points[hit.j]).lerp(b.points[hit.j+1],hit.t);
  const point=hit.a.clone().lerp(hit.b,.5),ta=a.points[hit.i+1].clone().sub(a.points[hit.i]).normalize(),tb=b.points[hit.j+1].clone().sub(b.points[hit.j]).normalize();
  const angle=Math.sqrt(Math.max(0,1-ta.dot(tb)**2));
  // Normal load estimate for the reduced, fixed-end chain (N), not UI damage.
  const load=correction>0?Math.min(8,Math.min(a.owner.tension,b.owner.tension)*(.18+angle*.7)):0;
  // Coulomb-limited tangential correction transmits a pull into the other cord.
  const slipVector=ta.clone().multiplyScalar(a.feedDelta).addScaledVector(tb,-b.feedDelta);
  slipVector.add(hit.a.clone().sub(a.previous[hit.i].clone().lerp(a.previous[hit.i+1],hit.s)));
  slipVector.sub(hit.b.clone().sub(b.previous[hit.j].clone().lerp(b.previous[hit.j+1],hit.t)));
  slipVector.addScaledVector(hit.normal,-slipVector.dot(hit.normal));
  const friction=Math.min(slipVector.length(),correction*.32);
  if(friction>1e-9){slipVector.setLength(friction);const mass=indices.reduce((s,id,k)=>s+ropes[k].weights[id]*weights[k]**2,0);
    if(mass>0)for(let k=0;k<4;k++)ropes[k].points[indices[k]].addScaledVector(slipVector,ropes[k].weights[indices[k]]*weights[k]/mass*(k<2?-1:1));
  }
  for(const [r,edge]of[[a,hit.i],[b,hit.j]]){r.contactEdge=edge;r.contactAge=0;r.contactPoint.copy(point);r.contactLoad=load;r.commitVelocities();}
  return {point,load,slip:ta.multiplyScalar(a.feedDelta).addScaledVector(tb,-b.feedDelta).length()};
}

export class SawStroke {
  constructor(){this.reset();}
  reset(){this.direction=0;this.travel=0;this.duration=0;this.reversals=0;this.lastReversal=-100;}
  step(delta,dt,time){
    const sign=Math.sign(delta);if(!sign){this.duration+=dt;return;}
    if(sign!==this.direction){if(this.direction&&this.travel>=.045&&this.duration>=.045){this.reversals++;this.lastReversal=time;}this.direction=sign;this.travel=0;this.duration=0;}
    this.travel+=Math.abs(delta);this.duration+=dt;
  }
  factor(time){return time-this.lastReversal<.8?1:.08;}
}
