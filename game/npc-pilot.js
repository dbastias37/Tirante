import {closestSegments} from './rope.js';
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));

// NPCs use the same controls, stamina, line and wind as the human player.
// Decisions run at a limited cadence; they never reposition a sail directly.
export function controlNPC(party,e,dt){
  const b=e.pilot,hard=party.difficulty==='hard';
  e.thinkIn=Math.max(0,(e.thinkIn||0)-dt);
  if(e.thinkIn>0)return;
  const interval=hard?.10:.18;e.thinkIn=interval;
  const targets=party.roster.filter(other=>other!==e&&other.alive&&other.pilot.state==='flying');
  targets.sort((a,c)=>b.position.distanceTo(a.pilot.position)-b.position.distanceTo(c.pilot.position));
  const target=targets[0];e.targetIndex=target?.index??-1;
  if(!target){b.sawing=false;b.setControls('hold');return;}
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
      const next=b.anchor.clone().add(delta);next.x=clamp(next.x,e.homeX-5,e.homeX+5);next.z=clamp(next.z,e.homeZ-3,e.homeZ+3);
      const clear=point=>party.roster.every(other=>other===e||!other.alive||point.distanceTo(other.pilot.anchor)>2.5);
      if(!clear(next))next.x=b.anchor.x;
      if(clear(next)){b.anchor.copy(next);b.energy=Math.max(0,b.energy-delta.length()*.8);}
    }
  }
  const desired=clamp(Math.atan2(p.position.x-b.position.x,Math.max(6,b.anchor.z-p.position.z))-e.side*.35,-.85,.85);
  if(b.lineLength>p.lineLength+2&&Math.cos(b.heading)>.3){b.setControls('reel',false);e.intent='Ajusta la distancia';return;}
  const error=wrap(desired-(b.heading+b.spin*(hard?.16:.10)));
  let action='hold';
  if(Math.abs(b.spin)>.25&&Math.abs(error)<.25)action='reel';
  else if(Math.abs(error)>.25&&b.position.y>5.5&&b.lineRemaining>.5)action='release';
  else if(b.lineLength>p.lineLength+1.5&&Math.cos(b.heading)>.5)action='reel';
  if((party.elapsed+e.phase)%5<.32&&b.position.y>6&&b.lineLength<p.lineLength+2)action='release';
  b.setControls(action,false);e.intent='Busca un rival';
}
