import {Vector3} from './vendor/three.module.js';
import {closestSegments,CONTACT_RADIUS} from './rope.js';
const GAP=CONTACT_RADIUS*2,SKIN=GAP*1.25,GUARD=GAP*.25;
const v=()=>new Vector3();
// Conservative advancement: the distance between two deforming segments is
// Lipschitz bounded by their maximum relative endpoint displacement. No plane
// sign approximation, fixed temporal samples, or missed tangential crossings.
export function segmentTOI(a0,a1,b0,b1,A0,A1,B0,B1,radius=GUARD){
  const da=A0.clone().sub(a0),db=A1.clone().sub(a1),dc=B0.clone().sub(b0),dd=B1.clone().sub(b1);
  const common=da.clone().add(db).add(dc).add(dd).multiplyScalar(.25);
  const speed=Math.max(da.clone().sub(common).length(),db.clone().sub(common).length())+Math.max(dc.clone().sub(common).length(),dd.clone().sub(common).length());
  let t=0,hit;const x=v(),y=v(),u=v(),w=v();
  for(let n=0;n<64;n++){
    x.copy(a0).addScaledVector(da,t);y.copy(a1).addScaledVector(db,t);u.copy(b0).addScaledVector(dc,t);w.copy(b1).addScaledVector(dd,t);hit=closestSegments(x,y,u,w);
    if(hit.distance<=radius+1e-7)return {...hit,time:t};
    if(speed<1e-12)return null;
    const advance=.8*(hit.distance-radius)/speed;if(t+advance>1)return null;t+=advance;
  }
  // An unresolved grazing case is blocked conservatively, never waved through.
  return {...hit,time:t};
}
function edges(ropes,swept){const out=[];ropes.forEach((r,ri)=>{if(r.broken>=0)return;for(let i=0;i<r.points.length-1;i++){const a=r.points[i],b=r.points[i+1],p=swept?r.previous[i]:a,q=swept?r.previous[i+1]:b;out.push({r,ri,i,min:[Math.min(a.x,b.x,p.x,q.x),Math.min(a.y,b.y,p.y,q.y),Math.min(a.z,b.z,p.z,q.z)],max:[Math.max(a.x,b.x,p.x,q.x),Math.max(a.y,b.y,p.y,q.y),Math.max(a.z,b.z,p.z,q.z)]});}});return out;}
function pairs(ropes,swept,radius,visit){
  const es=edges(ropes,swept);
  for(let x=0;x<es.length;x++)for(let y=x+1;y<es.length;y++){
    const a=es[x],b=es[y];if(a.ri===b.ri&&b.i-a.i<2)continue;
    if(a.min[0]>b.max[0]+radius||b.min[0]>a.max[0]+radius||a.min[1]>b.max[1]+radius||b.min[1]>a.max[1]+radius||a.min[2]>b.max[2]+radius||b.min[2]>a.max[2]+radius)continue;
    visit(a,b);
  }
}
function normalFor(a,b,h,old){
  const n=old.a.clone().sub(old.b);
  if(n.lengthSq()<1e-12)n.copy(h.a).sub(h.b);
  if(n.lengthSq()<1e-12)n.crossVectors(a.r.points[a.i+1].clone().sub(a.r.points[a.i]),b.r.points[b.i+1].clone().sub(b.r.points[b.i]));
  if(n.lengthSq()<1e-12)n.crossVectors(a.r.points[a.i+1].clone().sub(a.r.points[a.i]),new Vector3(0,1,0));
  if(n.lengthSq()<1e-12)n.set(1,0,0);return n.normalize();
}
function gather(ropes,swept=true){
  const contacts=[];
  pairs(ropes,swept,SKIN,(a,b)=>{
    const ap=a.r.points,bp=b.r.points,old=closestSegments(a.r.previous[a.i],a.r.previous[a.i+1],b.r.previous[b.i],b.r.previous[b.i+1]);
    let hit=closestSegments(ap[a.i],ap[a.i+1],bp[b.i],bp[b.i+1]),toi=null;
    if(swept&&old.distance>GAP+1e-7)toi=segmentTOI(a.r.previous[a.i],a.r.previous[a.i+1],b.r.previous[b.i],b.r.previous[b.i+1],ap[a.i],ap[a.i+1],bp[b.i],bp[b.i+1],GAP);
    if(!toi&&hit.distance>SKIN)return;
    if(toi)hit=toi;
    const normal=normalFor(a,b,hit,toi?hit:old);
    contacts.push({a:a.ri,b:b.ri,ra:a.r,rb:b.r,i:a.i,j:b.i,s:hit.s,t:hit.t,normal,swept:!!toi,correction:0});
  });return contacts;
}
function project(c,friction=false){
  const {ra:a,rb:b,i,j,s,t,normal:n}=c,wa=[1-s,s,1-t,t],ids=[i,i+1,j,j+1],rs=[a,a,b,b];
  const p=a.points[i].clone().lerp(a.points[i+1],s),q=b.points[j].clone().lerp(b.points[j+1],t);
  const mass=ids.reduce((sum,id,k)=>sum+rs[k].weights[id]*wa[k]**2,0),depth=SKIN-p.clone().sub(q).dot(n);
  if(mass<1e-12||depth<=0)return;
  const impulse=depth/mass;c.correction+=impulse;
  for(let k=0;k<4;k++)rs[k].points[ids[k]].addScaledVector(n,impulse*rs[k].weights[ids[k]]*wa[k]*(k<2?1:-1));
  if(friction){
    const delta=p.clone().sub(a.previous[i].clone().lerp(a.previous[i+1],s)).sub(q.clone().sub(b.previous[j].clone().lerp(b.previous[j+1],t)));delta.addScaledVector(n,-delta.dot(n));
    if(delta.lengthSq()>1e-14){delta.setLength(Math.min(delta.length(),impulse*.24));for(let k=0;k<4;k++)rs[k].points[ids[k]].addScaledVector(delta,rs[k].weights[ids[k]]*wa[k]/mass*(k<2?-1:1));}
  }
}
// Final acceptance guard is applied after every length/contact correction.
// It also includes endpoints, the hand-side edges and self contacts. If an
// unresolved tangle blocks motion, it remains blocked until it slides free or
// abrasion fractures a strand. We do not reset/teleport the rope to untangle it.
export function guardRopeMotion(ropes){
  let fraction=1;
  pairs(ropes,true,GUARD,(a,b)=>{
    const ap=a.r.previous,bp=b.r.previous,aq=a.r.points,bq=b.r.points;
    const initial=closestSegments(ap[a.i],ap[a.i+1],bp[b.i],bp[b.i+1]);
    // A too-close starting pair still retains its side. Only an exactly
    // intersecting spawn has no previous ordering; the projection repairs it.
    if(initial.distance<1e-10)return;
    const radius=Math.min(GUARD,initial.distance*.5);
    const h=segmentTOI(ap[a.i],ap[a.i+1],bp[b.i],bp[b.i+1],aq[a.i],aq[a.i+1],bq[b.i],bq[b.i+1],radius);
    if(h)fraction=Math.min(fraction,h.time*.9);
  });
  if(fraction<1)for(const r of ropes){if(r.broken>=0)continue;const end=r.points.at(-1).clone();for(let i=0;i<r.points.length;i++)r.points[i].copy(r.previous[i].clone().lerp(r.points[i],fraction));r.owner.anchor.copy(r.points[0]);r.owner.position.add(r.points.at(-1).clone().sub(end));r.owner.velocity?.multiplyScalar(fraction);r._blockedMotion=1-fraction;}
  return fraction;
}
export function solveRopeSystem(ropes,dt){
  const intact=ropes.filter(r=>r.broken<0);if(!intact.length)return [];
  for(const r of intact){r._blockedMotion=0;r.dt=dt;}
  let contacts=gather(ropes),all=[...contacts];
  if(contacts.length){
    for(let pass=0;pass<6;pass++){
      for(const c of contacts)project(c,pass===0);
      if(pass<5)for(const r of intact)r.solve(1);
      if(pass===2){const extra=gather(ropes);const keys=new Set(contacts.map(c=>`${c.a}:${c.i}:${c.b}:${c.j}`));for(const c of extra)if(!keys.has(`${c.a}:${c.i}:${c.b}:${c.j}`)){contacts.push(c);all.push(c);}}
    }
  }
  const accepted=guardRopeMotion(ropes),byPair=new Map(),strongest=new Map();
  // Aggregate geometric contacts per strand pair. Multiple vertices must not
  // multiply the same physical feed travel into artificial damage.
  for(const h of all){
    const a=h.ra,b=h.rb,p=a.points[h.i].clone().lerp(a.points[h.i+1],h.s),q=b.points[h.j].clone().lerp(b.points[h.j+1],h.t);
    const ta=a.points[h.i+1].clone().sub(a.points[h.i]).normalize(),tb=b.points[h.j+1].clone().sub(b.points[h.j]).normalize(),point=p.clone().lerp(q,.5);
    const load=Math.min(8,Math.min(a.owner.tension,b.owner.tension)*(.18+Math.sqrt(Math.max(0,1-ta.dot(tb)**2))*.7));
    const contact={point,load,slip:ta.multiplyScalar(a.feedDelta).addScaledVector(tb,-b.feedDelta).length(),accepted};
    const hit={i:h.i,j:h.j,s:h.s,t:h.t,a:p,b:q,normal:h.normal,swept:h.swept,distance:p.distanceTo(q)},key=`${h.a}:${h.b}`;
    if(h.a!==h.b&&(!byPair.has(key)||byPair.get(key).contact.load<load))byPair.set(key,{a:h.a,b:h.b,hit,contact});
    for(const [r,edge] of [[a,h.i],[b,h.j]])if(!strongest.has(r)||strongest.get(r).load<load)strongest.set(r,{point,load,edge});
  }
  for(const [r,c]of strongest){r.contactEdge=c.edge;r.contactPoint.copy(c.point);r.contactLoad=c.load;r.contactAge=0;}
  for(const r of intact)r.commitVelocities();
  return [...byPair.values()];
}
