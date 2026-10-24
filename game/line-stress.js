// Reduced game calibration, not a measured breaking specification for cotton.
// Shared by local flight, NPCs and the authoritative online simulation.
export const LINE_STRENGTH=90;
export const EXTREME_GUST_CHANCE=.1;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export function mixSeed(value){let x=value>>>0;x=Math.imul(x^(x>>>16),0x21f0aaad);x=Math.imul(x^(x>>>15),0x735a2d97);return (x^(x>>>15))>>>0;}
export function flightGust(seed,flight){const roll=mixSeed((seed+Math.imul(flight,0x9e3779b9))>>>0);return {eligible:roll/4294967296<EXTREME_GUST_CHANCE,at:12+mixSeed(roll^0xa511e9b3)/4294967296*18};}
export function extremeGust(p){
  if(!p.extremeGustEligible||p.windSpeed<8||p.profile==='calm'||p.state!=='flying')return 1;
  const t=(p.flightTime-p.extremeGustAt)/2.4;if(t<=0||t>=1)return 1;
  return 1+1.55*Math.sin(Math.PI*t)**2;
}
export function remainingStrength(rope,edge,fraction=.5){return LINE_STRENGTH*Math.max(.12,1-.88*rope.wearAt(edge,fraction));}
function expose(rope,load,strength,dt){
  rope.stressLoad=load;rope.strength=strength;rope.stressRatio=load/strength;
  // A frame spike is not a break. Excess load must persist; releasing unloads
  // the strand and drains the exposure rather than rewarding input spam.
  rope.overload=rope.stressRatio>1?rope.overload+dt*(rope.stressRatio-1):Math.max(0,rope.overload-dt*.65);
  return rope.overload>=.03;
}
export function updateWindStress(p,dt){
  const r=p.rope;if(r.broken>=0||p.state!=='flying'||r.contactAge<.1)return;
  r.jamStrain*=Math.exp(-dt*5);r.jamTime=0;
  const edge=Math.min(27,Math.max(0,Math.floor(8+mixSeed(p.flightSeed)%15))),strength=remainingStrength(r,edge);
  const failed=expose(r,p.tension,strength,dt);
  // No spontaneous failures in gentle air or during the launch impulse.
  if(failed&&p.flightTime>3&&p.windSpeed>=8&&p.wind.length()>=9.8)p.cutLine(edge,.5,'wind');
}
export function resolveLineStress(ropes,contacts,dt){
  const touching=new Set();for(const c of contacts){touching.add(c.ra);touching.add(c.rb);}
  for(const r of ropes){
    if(r.broken>=0||r.owner.state!=='flying')continue;
    const blocked=r._blockedMotion||0;
    r.shock=Math.max((r.shock||0)*Math.exp(-dt/0.14),Math.min(36,Math.max(0,-r.feedDelta)*90));
    if(touching.has(r)){
      r.jamTime=blocked>.8?r.jamTime+dt:Math.max(0,r.jamTime-dt*3);
      const input=Math.min(.025,(r._blockedTravel||0)+Math.max(0,-r.feedDelta)*blocked);
      r.jamStrain=clamp(r.jamStrain+input-Math.max(0,r.feedDelta)*.65-dt*.035,0,3);
      if(blocked<.1)r.jamStrain*=Math.exp(-dt*6);
    }else {r.jamStrain*=Math.exp(-dt*6);r.jamTime=0;}
  }
  // Use each strand's worst material patch once per tick, regardless of mesh
  // density or the number of coincident collision constraints.
  const candidates=new Map();
  for(const c of contacts){
    const a=c.ra,b=c.rb;if(a.broken>=0||b.broken>=0)continue;
    const pa=a.owner,pb=b.owner;if(pa.state!=='flying'||pb.state!=='flying')continue;
    const peak=Math.max(pa.tension+a.shock,pb.tension+b.shock),stored=38*Math.max(a.jamStrain,b.jamStrain);
    for(const [r,edge,fraction]of[[a,c.i,c.s],[b,c.j,c.t]]){
      const strength=remainingStrength(r,edge,fraction),load=.55*peak+.45*r.owner.tension+stored;
      const candidate={load,strength,edge,fraction,ratio:load/strength,other:r===a?b:a};
      if(!candidates.has(r)||candidate.ratio>candidates.get(r).ratio)candidates.set(r,candidate);
    }
  }
  const ready=[];
  for(const [r,c]of candidates)if(expose(r,c.load,c.strength,dt))ready.push([r,c]);
  ready.sort((a,b)=>b[1].ratio-a[1].ratio);
  // The most overloaded strand in a crossing breaks first. Its release
  // unloads the partner; there is no automatic win for the initiating player.
  const released=new Set();
  for(const [r,c]of ready){
    if(r.broken>=0||released.has(r)||c.other.broken>=0)continue;
    const tied=ready.find(([other,q])=>other===c.other&&other!==r&&q.other===r&&Math.abs(q.ratio-c.ratio)<1e-9);
    r.owner.cutLine(c.edge,c.fraction,'tension');
    if(tied)tied[0].owner.cutLine(tied[1].edge,tied[1].fraction,'tension');
    else {released.add(c.other);c.other.overload=0;c.other.jamStrain*=.25;}
  }
}
