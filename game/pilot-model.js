import * as T from './vendor/three.module.js';
import {PilotLocomotion,PilotTrousers,legRotation} from './pilot-locomotion.js';
import {PilotHand} from './pilot-hands.js';
import {faceLevel} from './pilot-appearance.js';
import {PILOT_HEADS} from './pilot-heads.js';
import {FittedGarment,wardrobeGeometry,PILOT_WARDROBE} from './pilot-wardrobe.js';

const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z),UP=V(0,1,0);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const material=color=>new T.MeshStandardMaterial({color,roughness:.94});
function rings(rows,sides=12){
  const p=[],indices=[];
  for(let j=0;j<rows.length;j++){
    const [y,rx,rz,z=0]=rows[j];
    for(let i=0;i<sides;i++){const a=i/sides*Math.PI*2,fold=1+.025*Math.sin(a*5+j*1.7);p.push(Math.cos(a)*rx*fold,y,Math.sin(a)*rz*fold+z);}
  }
  for(let j=0;j<rows.length-1;j++)for(let i=0;i<sides;i++){const a=j*sides+i,b=j*sides+(i+1)%sides,c=a+sides,d=b+sides;indices.push(a,c,b,b,c,d);}
  for(const j of [0,rows.length-1]){const center=p.length/3;p.push(0,rows[j][0],rows[j][3]||0);for(let i=0;i<sides;i++)j?indices.push(center,j*sides+i,j*sides+(i+1)%sides):indices.push(center,j*sides+(i+1)%sides,j*sides+i);}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setIndex(indices);g.computeVertexNormals();return g;
}
function add(parent,geometry,mat,position=V(),scale=null){const m=new T.Mesh(geometry,mat);m.position.copy(position);if(scale)m.scale.copy(scale);parent.add(m);return m;}
function ball(parent,mat,position,scale){return add(parent,new T.SphereGeometry(1,10,7),mat,position,scale);}
function bake(group){
  const batches=new Map(),q=V(),n=V(),nm=new T.Matrix3();
  for(const m of [...group.children]){
    if(!m.isMesh)continue;m.updateMatrix();nm.getNormalMatrix(m.matrix);
    let batch=batches.get(m.material);if(!batch){batch={p:[],n:[],i:[]};batches.set(m.material,batch);}
    const g=m.geometry,p=g.attributes.position,normal=g.attributes.normal,offset=batch.p.length/3;
    for(let i=0;i<p.count;i++){q.fromBufferAttribute(p,i).applyMatrix4(m.matrix);n.fromBufferAttribute(normal,i).applyMatrix3(nm).normalize();batch.p.push(q.x,q.y,q.z);batch.n.push(n.x,n.y,n.z);}
    for(const i of g.index.array)batch.i.push(offset+i);group.remove(m);g.dispose();
  }
  for(const [mat,b] of batches){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(b.p,3));g.setAttribute('normal',new T.Float32BufferAttribute(b.n,3));g.setIndex(b.i);add(group,g,mat);}
}
function segment(mesh,a,b){mesh.position.copy(a);const d=b.clone().sub(a);mesh.quaternion.setFromUnitVectors(UP,d.clone().normalize());mesh.scale.y=d.length();}
function elbow(a,b,pole,upper=.30,lower=.27){
  const d=b.clone().sub(a),distance=clamp(d.length(),.03,upper+lower-.0001);d.normalize();
  const side=pole.clone().sub(a);side.addScaledVector(d,-side.dot(d)).normalize();
  const along=(upper*upper-lower*lower+distance*distance)/(2*distance);
  return a.clone().addScaledVector(d,along).addScaledVector(side,Math.sqrt(Math.max(0,upper*upper-along*along)));
}
function reel(parent,wood,thread,trim){
  const rig=new T.Group();parent.add(rig);rig.position.set(0,1.21,-.40);
  const spin=new T.Group();rig.add(spin);
  const core=add(spin,new T.CylinderGeometry(.118,.118,.145,24),thread);core.rotation.z=Math.PI/2;
  for(const x of [-.085,.085]){
    const shape=new T.Shape();shape.absarc(0,0,.138,0,Math.PI*2,false);
    const axle=new T.Path();axle.absarc(0,0,.027,0,Math.PI*2,true);shape.holes.push(axle);
    for(let i=0;i<6;i++){const a=i/6*Math.PI*2,hole=new T.Path();hole.absarc(Math.cos(a)*.077,Math.sin(a)*.077,.027,0,Math.PI*2,true);shape.holes.push(hole);}
    const disk=new T.ExtrudeGeometry(shape,{depth:.012,bevelEnabled:false,steps:1,curveSegments:5});if(!disk.index)disk.setIndex(Array.from({length:disk.attributes.position.count},(_,i)=>i));
    const side=add(spin,disk,wood,V(x-.006,0,0));side.rotation.y=Math.PI/2;
    const rim=add(spin,new T.TorusGeometry(.138,.006,5,28),wood,V(x,0,0));rim.rotation.y=Math.PI/2;
  }
  bake(spin);
  // The reel turns around a fixed axle, while the supporting hand stays on it.
  const handle=add(rig,new T.CylinderGeometry(.016,.019,.42,12),wood);handle.rotation.z=Math.PI/2;
  return {rig,spin};
}

function contactShadow(parent){
  const g=new T.CircleGeometry(1,32),colors=[];
  for(let i=0;i<g.attributes.position.count;i++)colors.push(1,1,1,i===0?.22:0);
  g.setAttribute('color',new T.Float32BufferAttribute(colors,4));
  const mat=new T.MeshBasicMaterial({color:0x21432f,vertexColors:true,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-2});
  const shadow=add(parent,g,mat,V(0,.008,-.05),V(.42,.27,1));shadow.rotation.x=-Math.PI/2;shadow.name='pilot-contact-shadow';return shadow;
}

// A game rig rebuilt around the uploaded drawing figures' proportions:
// separate pelvis/chest, two-link limbs, shaped head, wrists and articulated grip.
// Clothing bridges the mannequin gaps; no editor rigs or scripts run in the game.
export class PilotModel{
  constructor(index=0){
    this.index=index;this.group=new T.Group();this.group.name='pilot';this.yaw=0;this.initialized=false;this.lastTime=null;this.parts=[];this.detail=0;
    const female=index%3===1;
    this.skin=material([0xc58f69,0xd3a17c,0x946447][index%3]);this.top=material(0x397f80);this.top.vertexColors=true;this.dark=material(0x263d3b);this.pants=material([0x354a58,0x3f414b,0x4a4b3d][index%3]);this.shoe=material(0xffffff);this.shoe.vertexColors=true;this.shoe.roughness=.82;this.sole=material(0xd6ccad);this.hair=material([0x302a25,0x33231e,0x332c22][index%3]);this.cream=material(0xe9ddbd);this.wood=material(0x9b7048);
    this.body=new T.Group();this.group.add(this.body);this.body.position.y=.96;
    this.garment=new FittedGarment(index%3===2?'hoodie':'tee',this.top);this.group.add(this.garment.mesh);this.torso=this.garment.mesh;
    this.neck=add(this.body,new T.CylinderGeometry(.046,.057,.10,12),this.skin,V(0,.54,0));
    this.head=new T.Group();this.head.position.set(0,.57,0);this.body.add(this.head);
    this.faceSkin=this.skin.clone();this.faceSkin.vertexColors=true;this.hair.vertexColors=true;
    this.headLevels=[PILOT_HEADS[female?1:0],PILOT_WARDROBE.distantHeads[female?1:0]].map((source,level)=>faceLevel(source,index,level===1));
    this.face=add(this.head,this.headLevels[0].geometry,this.faceSkin);
    const detailMaterial=material(0xffffff);detailMaterial.vertexColors=true;this.features=add(this.head,this.headLevels[0].features,detailMaterial);this.features.name='facial-features';
    this.hairMesh=add(this.head,this.headLevels[0].hair,this.hair);this.hairMesh.name='hair';
    if(female)ball(this.head,this.hair,V(0,.14,.105),V(.043,.075,.04));
    this.locomotion=new PilotLocomotion();this.trousers=new PilotTrousers(this.pants);this.hips=this.trousers.mesh;this.group.add(this.hips);
    this.arms=[];this.legs=[];
    for(const s of [-1,1]){
      const upper=add(this.group,rings([[.22,.056,.056],[.35,.057,.055],[.72,.048,.046],[1,.041,.042]],12),this.skin);
      const lower=add(this.group,rings([[0,.042,.043],[.22,.050,.045],[.70,.034,.033],[.87,.030,.029],[1,.029,.027]],12),this.skin);
      const cuff=new T.Object3D();this.group.add(cuff);upper.visible=lower.visible=this.garment.kind==='tee';
      const hand=new PilotHand(s,this.skin),palm=hand.group;this.group.add(palm);this.arms.push({s,upper,lower,cuff,palm,hand});
      const thigh=new T.Object3D(),shin=new T.Object3D();this.group.add(thigh,shin);
      const shoeGroup=new T.Group();this.group.add(shoeGroup);
      const shoeLevels=PILOT_WARDROBE.sneaker.map(source=>wardrobeGeometry(source,s));
      const sneaker=add(shoeGroup,shoeLevels[0],this.shoe);sneaker.name='sneaker';
      const solePoints=[];for(const g of shoeLevels)for(let i=0;i<g.attributes.position.count;i++){const v=V().fromBufferAttribute(g.attributes.position,i);solePoints.push(v);}
      this.legs.push({s,thigh,shin,shoe:shoeGroup,sneaker,shoeLevels,solePoints});
    }
    const r=reel(this.group,this.wood,this.cream,this.dark);this.reel=r.rig;this.spool=r.spin;
    this.outlet=new T.Object3D();this.outlet.position.set(0,1.35,-.40);this.group.add(this.outlet);
    this.shadow=contactShadow(this.group);
    this.configure('#397f80');this.group.traverse(m=>{if(m.isMesh&&m.visible){m.castShadow=false;this.parts.push(m);}});
  }
  configure(tint){if(this.tint===tint)return;this.tint=tint;this.top.color.set(tint);this.dark.color.set(tint).multiplyScalar(.40);}
  setDetail(level){
    if(this.detail===level)return;this.detail=level;this.garment.setDetail(level);
    this.face.geometry=this.headLevels[level].geometry;this.hairMesh.geometry=this.headLevels[level].hair;this.features.geometry=this.headLevels[level].features;
    for(const leg of this.legs)leg.sneaker.geometry=leg.shoeLevels[level];
    for(const arm of this.arms)arm.hand.setDetail(level);
    for(const part of this.parts)part.userData.canvasVertices=null;
  }
  update(p,time,camera=null){
    if(camera){const distance=camera.position.distanceTo(p.anchor);this.setDetail(distance>(this.detail?8:10)?1:0);}
    this.configure(p.partyTint||'#397f80');
    const dt=this.lastTime===null?0:clamp(time-this.lastTime,0,.1);this.lastTime=time;
    const targetYaw=Math.atan2(-(p.position.x-p.anchor.x),-(p.position.z-p.anchor.z));
    if(!this.initialized){this.yaw=targetYaw;this.initialized=true;}
    this.yaw+=Math.atan2(Math.sin(targetYaw-this.yaw),Math.cos(targetYaw-this.yaw))*(1-Math.exp(-dt*5));

    const inactive=p.eliminated||p.state==='cut'||p.state==='ground',load=inactive?0:clamp(p.rope?.stressRatio||0,0,1),tug=inactive?0:Math.sin(clamp((time-p.lastTug)/.32,0,1)*Math.PI);
    this.group.rotation.y=this.yaw;
    // The reel outlet stays exactly at the physical anchor, even while turning.
    const shift=V(0,0,-.40).applyAxisAngle(UP,this.yaw);this.group.position.set(p.anchor.x-shift.x,0,p.anchor.z-shift.z);
    this.locomotion.update(this.group,dt,this.legs);const gait=this.locomotion;
    this.body.position.set(Math.sin(time*1.5+this.index)*.006+gait.sway,.96+gait.bob,load*.035+tug*.035);
    this.body.rotation.set(load*.11+tug*.09,gait.twist*.15,0);
    const look=Math.atan2(p.position.y-1.65,Math.hypot(p.position.x-p.anchor.x,p.position.z-p.anchor.z));this.head.rotation.x=inactive?-.16:clamp(look*.55,-.25,.65);
    this.body.updateMatrix();
    const reelRate=inactive||p.action==='hold'?0:(p.action==='reel'?1:-1)*(p.boost?8:4);this.spool.rotation.x+=dt*reelRate;
    for(const arm of this.arms){
      const s=arm.s,a=V(s*.185,.465,0).applyMatrix4(this.body.matrix),working=p.action!=='hold'&&!inactive;
      const b=s>0?V(.16,1.24,-.325):inactive?V(-.22,1.01,-.13):V(p.action==='release'?-.14:-.12,1.13+(working?Math.sin(this.spool.rotation.x)*.012:0)+tug*.02,-.405+(working?Math.cos(this.spool.rotation.x)*.012:0)+tug*.015);
      const e=elbow(a,b,V(s*.6,.95,.02));segment(arm.upper,a,e);segment(arm.lower,e,b);
      const wrist=b.clone().lerp(e,.12);segment(arm.cuff,wrist,b);
      arm.palm.position.copy(b);
      if(s<0&&!inactive)arm.palm.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(V(0,0,1),V(-1,0,0),V(0,-1,0)));
      else arm.palm.rotation.set(s<0?-.45:0,0,s<0?-.12:0);
      arm.hand.pose(s>0?.95:inactive?.15:p.action==='release'?.12:p.action==='reel'?.40:.20,dt);
    }
    for(let i=0;i<this.legs.length;i++){
      const leg=this.legs[i],foot=gait.feet[i],knee=elbow(foot.hip,foot.ankle,foot.knee,.43,.43);
      segment(leg.thigh,foot.hip,knee);segment(leg.shin,knee,foot.ankle);
      leg.thigh.quaternion.copy(legRotation(foot.hip,knee));leg.shin.quaternion.copy(legRotation(knee,foot.ankle));
    }
    this.trousers.update(gait.pelvis,this.legs);
    this.garment.update(this.body,this.arms,this.head,gait.pelvis);
    this.group.updateMatrixWorld(true);
  }
}
