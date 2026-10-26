import {Vector3,Quaternion,Matrix4} from './vendor/three.module.js';
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const ambient=new Vector3(),previous=new Vector3(),air=new Vector3(),flow=new Vector3(),lift=new Vector3(),nose=new Vector3(),normal=new Vector3(),right=new Vector3(),target=new Quaternion(),basis=new Matrix4(),up=new Vector3(0,1,0);
// Reduced falling-sheet aerodynamics: apparent air, quadratic drag and signed
// lift. Flutter changes incidence; nose-down attitudes trade drag for a dive.
// This is a game model, not a measured replica of any paper/bridle combination.
export function stepFreeFlight(p,dt){
  p.freeTime+=dt;p.flightTime+=dt;p.tension=0;p.pendingTug=0;
  const t=p.freeTime,mass=p.trim.mass,light=clamp(.0365/mass,.55,1.5);
  ambient.copy(p.wind).multiplyScalar(.65);previous.copy(p.velocity);
  air.copy(ambient).sub(p.velocity);const speed=air.length();flow.copy(air).normalize();if(speed<1e-8)flow.set(0,0,-1);
  const initialDive=clamp(-p.freeNoseY,0,1)*Math.exp(-t/1.35);
  const wind=p.wind.length(),flutter=Math.sin(t*(2.2+light*.55)+p.freePhase),roll=Math.sin(t*1.43+p.freePhase)*.55;
  // A wide paper face settles nearly horizontally, rocking in the air. Preserve
  // the release attitude initially so a cut during a dive does not snap upright.
  nose.set(Math.sin(p.freeYaw+flutter*.24),-.13-initialDive*.75+flutter*.14,-Math.cos(p.freeYaw+flutter*.24)).normalize();
  right.crossVectors(nose,up).normalize();normal.crossVectors(right,nose).normalize();
  normal.applyAxisAngle(nose,roll);right.crossVectors(nose,normal).normalize();target.setFromRotationMatrix(basis.makeBasis(right,nose,normal));
  p.orientation.slerp(target,1-Math.exp(-dt*(1.35+light*.5)));p.normal.set(0,0,1).applyQuaternion(p.orientation);p.nose.set(0,1,0).applyQuaternion(p.orientation);p.right.set(1,0,0).applyQuaternion(p.orientation);
  const incidence=clamp(p.normal.dot(flow),-1,1),face=Math.abs(incidence),dive=clamp(-p.nose.y,0,1);
  const q=.5*1.225*speed*speed*.32,cd=.07+1.12*face*face+(p.setup.tail?.07:0),cl=1.05*incidence*Math.sqrt(Math.max(0,1-incidence*incidence));
  lift.copy(p.normal).addScaledVector(flow,-incidence).normalize();
  p.aero.copy(flow).multiplyScalar(q*cd).addScaledVector(lift,q*cl);
  // Tail/loose paper increases drag. Updrafts are wind-dependent and bounded;
  // no permanent artificial lift in still air.
  p.aero.y+=mass*Math.min(1.5,wind*.07)*Math.sin(p.time*.81+p.position.z*.02);
  p.force.copy(p.aero);p.force.y-=mass*9.81;
  // Quadratic drag is integrated semi-implicitly, keeping high-wind release
  // stable without clipping a kite to a prescribed trajectory.
  const damping=q*cd/Math.max(speed,.1)/mass;
  p.velocity.addScaledVector(lift,q*cl*dt/mass);p.velocity.y+=(-9.81+Math.min(1.5,wind*.07)*Math.sin(p.time*.81+p.position.z*.02))*dt;
  p.velocity.addScaledVector(ambient,damping*dt).multiplyScalar(1/(1+damping*dt));
  // A detached paper kite entrains gradually instead of snapping to gust speed.
  const dx=p.velocity.x-previous.x,dz=p.velocity.z-previous.z,change=Math.hypot(dx,dz),limit=4*dt;
  if(change>limit){p.velocity.x=previous.x+dx*limit/change;p.velocity.z=previous.z+dz*limit/change;}
  p.velocity.y=previous.y+clamp(p.velocity.y-previous.y,-12*dt,9*dt);
  p.position.addScaledVector(p.velocity,dt);p.bend+=(.08+face*.14-p.bend)*Math.min(1,dt*3);p.spin+=(flutter*.45-p.spin)*Math.min(1,dt*1.2);
  p.freeMode=dive>.55?'dive':face>.55||wind<2?'flutter':'glide';
  p.maxHeight=Math.max(p.maxHeight,p.position.y);
  if(p.position.y<=.42){p.position.y=.42;p.velocity.set(0,0,0);p.state='grounded';p.freeMode='landed';}
}
