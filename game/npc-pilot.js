import {closestSegments} from './rope.js';
import {climbControls} from './battle-rules.js';
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));

// NPCs use the same controls, stamina, line and wind as the human player.
// Decisions run at a limited cadence; they never reposition a sail directly.
export function controlNPC(party,e,dt){
  const b=e.pilot,hard=party.difficulty==='hard';
  const climbTarget=Math.min(b.lineCapacity*.85,32),lineFloor=Math.min(b.lineCapacity*.75,28);
  if(b.lineLength<lineFloor-1)e.climbed=false;
  if(b.lineLength>=climbTarget)e.climbed=true;
  // Feeding pulses need fixed-tick timing; sampling them only on a thinking
  // tick made a 40 ms pulse last 180 ms and stalled the climb for minutes.
  if(!e.climbed&&b.rope.contactAge>.1&&b.rope.stressRatio<.7&&b.position.y>5&&b.velocity.y>-3){climbControls(b,b.flightTime+e.phase);e.intent='Toma altura';return;}
  e.thinkIn=Math.max(0,(e.thinkIn||0)-dt);
  if(e.thinkIn>0)return;
  const interval=hard?.08:.12;e.thinkIn=interval;
  const targets=party.roster.filter(other=>other!==e&&other.alive&&other.pilot.state==='flying');
  targets.sort((a,c)=>b.position.distanceTo(a.pilot.position)-b.position.distanceTo(c.pilot.position));
  const target=targets[0];e.targetIndex=target?.index??-1;
  if(!target){b.sawing=false;climbControls(b,b.flightTime+e.phase);e.intent='Toma altura';return;}
  const p=target.pilot,contact=b.rope.contactAge<.1,strain=b.rope.stressRatio;
  b.sawing=false;
  // Defend a loaded/worn strand and recover stamina before attacking again.
  if(strain>(hard?.73:.82)){b.setControls('release',strain>1&&b.energy>30);e.intent='Descarga';return;}
  if(b.position.y<4||b.velocity.y<-3){
    const upright=Math.cos(b.heading)>.45;
    b.setControls(upright?'hold':'release',!upright&&b.energy>25);
    if(upright&&Math.abs(b.spin)>.8&&b.energy>25)b.tug();
    e.intent='Recupera altura';return;
  }
  if(contact){
    if(b.energy<25){b.setControls('hold');e.intent='Recupera energía';return;}
    if(p.rope.stressRatio>.78&&strain<.65&&b.energy>40){
      b.setControls('reel',hard&&b.energy>60);b.tug(hard&&b.energy>65);e.intent='Busca el corte';return;
    }
    b.sawing=(party.elapsed+e.phase)%3<(hard?2.1:1.6);
    b.setControls(b.sawing?b.action:'hold',b.sawing&&hard&&b.energy>55);e.intent=b.sawing?'Trabaja el cruce':'Mide el hilo';return;
  }
  // Walk toward the nearest pair of actual segments, keeping personal space.
  let nearest=null;
  for(let i=8;i<27;i+=2)for(let j=8;j<27;j+=2){
    const h=closestSegments(p.rope.points[i],p.rope.points[i+1],b.rope.points[j],b.rope.points[j+1]);
    if(!nearest||h.distance<nearest.distance)nearest=h;
  }
  if(nearest&&b.energy>15){
    const delta=nearest.a.clone().sub(nearest.b);delta.y=0;
    if(delta.length()>.04){delta.setLength(Math.min(delta.length(),.65*interval));
      const next=b.anchor.clone().add(delta);next.x=clamp(next.x,e.homeX-3,e.homeX+3);next.z=clamp(next.z,e.homeZ-12,e.homeZ+12);
      const clear=point=>party.roster.every(other=>other===e||point.distanceTo(other.pilot.anchor)>=18);
      if(!clear(next))next.x=b.anchor.x;
      if(clear(next)){b.anchor.copy(next);b.energy=Math.max(0,b.energy-delta.length()*.8);}
    }
  }
  // Aim the cord through an airborne point on the target's real line, then
  // carry the sail past it. Matching the rival's reel length is insufficient
  // when the pilots stand 24 m apart.
  const crossing=p.rope.points[Math.floor((p.rope.points.length-1)*.78)];
  const reach=crossing.clone().sub(b.anchor),needed=Math.min(b.lineCapacity-.8,Math.max(lineFloor,reach.length()*1.36));
  const desired=clamp(Math.atan2(reach.x,Math.max(5,reach.y))*.82,-1.1,1.1);
  const heading=wrap(b.heading),error=wrap(desired-heading-b.spin*(hard?.12:.16));
  let action='hold';
  if(b.lineRemaining<.7){action='reel';e.intent='Recupera reserva';}
  else if(Math.abs(error)<.18){
    if(Math.abs(b.spin)>.35||b.lineLength>needed+1.5)action='reel';
    else if(b.lineLength<needed-.5&&(b.flightTime+e.phase)%.5<.10)action='release';
    if(b.maneuverHold<.2&&b.energy>35&&Math.abs(heading)>.35)b.tug();
    e.intent='Sostiene el rumbo';
  }else if(error*b.spinSign>0||Math.cos(heading)<0){action='release';e.intent='Busca el cruce alto';}
  else {action='hold';e.intent='Corrige el rumbo';}
  b.setControls(action,false);
}
