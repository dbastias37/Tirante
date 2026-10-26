import * as T from './vendor/three.module.js';
import {PILOT_HEADS} from './pilot-heads.js';

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
function hand(parent,skin){
  const g=new T.Group();parent.add(g);
  ball(g,skin,V(),V(.043,.023,.064));
  for(let i=0;i<4;i++){
    const x=(i-1.5)*.019,length=[.056,.065,.062,.05][i];
    const finger=add(g,rings([[0,.008,.008],[.45,.009,.009],[1,.0065,.0065]],7),skin);
    segment(finger,V(x,0,-.037),V(x,-.026,-.037-length*.7));
    const tip=add(g,rings([[0,.007,.007],[1,.005,.005]],7),skin);segment(tip,V(x,-.026,-.037-length*.7),V(x,-.048,-.055));
  }
  const thumb=add(g,rings([[0,.011,.01],[1,.008,.008]],8),skin);segment(thumb,V(.036,0,.012),V(.055,-.028,-.025));bake(g);return g;
}
function reel(parent,wood,thread,trim){
  const rig=new T.Group();parent.add(rig);rig.position.set(0,1.235,-.40);
  const spin=new T.Group();rig.add(spin);
  const core=add(spin,new T.CylinderGeometry(.082,.082,.18,20),thread);core.rotation.z=Math.PI/2;
  for(const x of [-.10,.10]){
    const rim=add(spin,new T.TorusGeometry(.106,.010,5,24),wood,V(x,0,0));rim.rotation.y=Math.PI/2;
    for(let i=0;i<6;i++){const a=i/6*Math.PI*2,spoke=add(spin,new T.BoxGeometry(.012,.018,.095),wood,V(x,Math.sin(a)*.052,Math.cos(a)*.052));spoke.rotation.x=-a;}
    const hub=add(spin,new T.CylinderGeometry(.023,.023,.025,12),trim,V(x,0,0));hub.rotation.z=Math.PI/2;
  }
  bake(spin);return {rig,spin};
}

// A game rig rebuilt around the uploaded drawing figures' proportions:
// separate pelvis/chest, two-link limbs, shaped head, wrists and articulated grip.
// Clothing bridges the mannequin gaps; no editor rigs or scripts run in the game.
export class PilotModel{
  constructor(index=0){
    this.index=index;this.group=new T.Group();this.group.name='pilot';this.phase=0;this.yaw=0;this.initialized=false;this.lastAnchor=V();this.lastTime=null;this.parts=[];
    const female=index%3===1;
    this.skin=material([0xc58f69,0xd3a17c,0x946447][index%3]);this.top=material(0x397f80);this.dark=material(0x263d3b);this.pants=material([0x354a58,0x3f414b,0x4a4b3d][index%3]);this.shoe=material(0x3a3530);this.sole=material(0xd6ccad);this.hair=material([0x302a25,0x33231e,0x332c22][index%3]);this.cream=material(0xe9ddbd);this.wood=material(0x9b7048);
    this.body=new T.Group();this.group.add(this.body);this.body.position.y=.96;
    this.torso=add(this.body,rings([[0,.164,.115],[.035,.171,.118],[.11,female?.156:.163,.115],[.25,.181,.122],[.40,.218,.13],[.47,.209,.12],[.52,.102,.077]],16),this.top);
    add(this.body,rings([[0,.168,.12],[.035,.168,.12]],16),this.dark);
    add(this.body,new T.BoxGeometry(.009,.44,.008),this.dark,V(0,.25,-.129));
    for(const x of [-.096,.096]){
      const pocket=add(this.body,new T.BoxGeometry(.10,.079,.008),this.dark,V(x,.13,-.12));pocket.rotation.z=x*.7;
      add(this.body,new T.BoxGeometry(.072,.012,.012),this.cream,V(x,.30,-.132));
    }
    this.neck=add(this.body,new T.CylinderGeometry(.046,.057,.10,12),this.skin,V(0,.54,0));
    this.head=new T.Group();this.head.position.set(0,.57,0);this.body.add(this.head);
    const source=PILOT_HEADS[female?1:0],headGeo=new T.BufferGeometry();headGeo.setAttribute('position',new T.Float32BufferAttribute(source.vertices,3));headGeo.setIndex(source.indices);headGeo.computeVertexNormals();add(this.head,headGeo,this.skin);
    const hairFaces=[];
    for(let i=0;i<source.indices.length;i+=3){let y=0,z=0;for(let j=0;j<3;j++){const n=source.indices[i+j]*3;y+=source.vertices[n+1]/3;z+=source.vertices[n+2]/3;}if(y>.17||(z>.023&&y>.10))hairFaces.push(...source.indices.slice(i,i+3));}
    const hairGeo=headGeo.clone();hairGeo.setIndex(hairFaces);const hair=add(this.head,hairGeo,this.hair,V(0,.001,.001),V(1.025,1.01,1.025));hair.name='hair';
    if(female)ball(this.head,this.hair,V(0,.14,.105),V(.043,.075,.04));
    if(index%3===2){const cap=ball(this.head,this.dark,V(0,.198,.005),V(.095,.055,.102));const brim=add(this.head,new T.BoxGeometry(.17,.009,.10),this.dark,V(0,.177,-.104));brim.rotation.x=.07;}
    this.hips=add(this.group,rings([[.84,.15,.105],[.97,.16,.12],[1.01,.155,.115]],14),this.pants);
    this.arms=[];this.legs=[];
    for(const s of [-1,1]){
      const upper=add(this.group,rings([[0,.075,.076],[.25,.082,.078],[.72,.065,.063],[1,.057,.058]],12),this.top);
      const lower=add(this.group,rings([[0,.059,.06],[.22,.065,.06],[.70,.048,.047],[.87,.044,.043],[1,.040,.039]],12),this.top);
      const cuff=add(this.group,rings([[0,.044,.044],[1,.044,.044]],12),this.dark);
      const palm=hand(this.group,this.skin);this.arms.push({s,upper,lower,cuff,palm});
      const thigh=add(this.group,rings([[0,.09,.098],[.25,.095,.10],[.65,.077,.079],[1,.063,.066]],12),this.pants);
      const shin=add(this.group,rings([[0,.064,.066],[.25,.071,.073],[.70,.05,.055],[1,.046,.048]],12),this.pants);
      const shoeGroup=new T.Group();this.group.add(shoeGroup);
      ball(shoeGroup,this.sole,V(0,.045,-.055),V(.072,.038,.145));ball(shoeGroup,this.shoe,V(0,.079,-.049),V(.067,.061,.132));
      for(let i=0;i<3;i++)add(shoeGroup,new T.BoxGeometry(.068,.006,.008),this.cream,V(0,.129-i*.004,-.054-i*.018));
      bake(shoeGroup);this.legs.push({s,thigh,shin,shoe:shoeGroup});
    }
    const r=reel(this.group,this.wood,this.cream,this.dark);this.reel=r.rig;this.spool=r.spin;
    this.outlet=new T.Object3D();this.outlet.position.set(0,1.35,-.40);this.group.add(this.outlet);
    this.configure('#397f80');this.group.traverse(m=>{if(m.isMesh){m.castShadow=false;this.parts.push(m);}});
  }
  configure(tint){if(this.tint===tint)return;this.tint=tint;this.top.color.set(tint);this.dark.color.set(tint).multiplyScalar(.40);}
  update(p,time){
    this.configure(p.partyTint||'#397f80');
    const dt=this.lastTime===null?0:clamp(time-this.lastTime,0,.1);this.lastTime=time;
    const targetYaw=Math.atan2(-(p.position.x-p.anchor.x),-(p.position.z-p.anchor.z));
    if(!this.initialized){this.yaw=targetYaw;this.lastAnchor.copy(p.anchor);this.initialized=true;}
    this.yaw+=Math.atan2(Math.sin(targetYaw-this.yaw),Math.cos(targetYaw-this.yaw))*(1-Math.exp(-dt*5));
    const distance=p.anchor.distanceTo(this.lastAnchor),walking=dt>0?clamp(distance/dt,0,1):0;this.phase+=distance*9;this.lastAnchor.copy(p.anchor);
    const inactive=p.eliminated||p.state==='cut'||p.state==='ground',load=inactive?0:clamp(p.rope?.stressRatio||0,0,1),tug=inactive?0:Math.sin(clamp((time-p.lastTug)/.32,0,1)*Math.PI);
    this.group.rotation.y=this.yaw;
    // The reel outlet stays exactly at the physical anchor, even while turning.
    const shift=V(0,0,-.40).applyAxisAngle(UP,this.yaw);this.group.position.set(p.anchor.x-shift.x,0,p.anchor.z-shift.z);
    this.body.position.set(Math.sin(time*1.5+this.index)*.006,.96-Math.abs(Math.sin(this.phase))*.012*walking,load*.035+tug*.035);
    this.body.rotation.x=load*.11+tug*.09;
    const look=Math.atan2(p.position.y-1.65,Math.hypot(p.position.x-p.anchor.x,p.position.z-p.anchor.z));this.head.rotation.x=inactive?-.16:clamp(look*.55,-.25,.65);
    this.body.updateMatrix();
    const reelRate=inactive||p.action==='hold'?0:(p.action==='reel'?1:-1)*(p.boost?8:4);this.spool.rotation.x+=dt*reelRate;
    for(const arm of this.arms){
      const s=arm.s,a=V(s*.208,.465,0).applyMatrix4(this.body.matrix),working=p.action!=='hold'&&!inactive;
      const b=s<0?V(-.148,1.235,-.40):inactive?V(.22,1.01,-.13):V(.137,1.27+(working?Math.sin(this.spool.rotation.x)*.035:0)+tug*.045,-.40+(working?Math.cos(this.spool.rotation.x)*.035:0)+tug*.035);
      const e=elbow(a,b,V(s*.6,.95,.02));segment(arm.upper,a,e);segment(arm.lower,e,b);
      const wrist=b.clone().lerp(e,.12);segment(arm.cuff,wrist,b);
      arm.palm.position.copy(b);arm.palm.rotation.set(-.3,s<0?.9:-.9,s<0?-.7:.7);
    }
    for(const leg of this.legs){
      const s=leg.s,step=Math.sin(this.phase+(s<0?Math.PI:0))*walking;
      const hip=V(s*.09,.97,load*.02),ankle=V(s*.15,.125+Math.max(0,step)*.065,step*.14+(s<0?.06:-.08));
      const knee=elbow(hip,ankle,V(s*.2,.50,-.6),.43,.43);segment(leg.thigh,hip,knee);segment(leg.shin,knee,ankle);leg.shoe.position.set(ankle.x,ankle.y-.125,ankle.z);leg.shoe.rotation.y=s*.09;
    }
    this.group.updateMatrixWorld(true);
  }
}
