import {Vector3,Matrix4,Quaternion,BufferGeometry,Float32BufferAttribute,Mesh,DynamicDrawUsage,Sphere} from './vendor/three.module.js';
import {PILOT_WALK} from './pilot-walk-data.js';

const V=(x=0,y=0,z=0)=>new Vector3(x,y,z),UP=V(0,1,0),ONE=V(1,1,1);
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x)),STRIDE=PILOT_WALK.stride;
const ROW=13;
export function legRotation(a,b){
  const y=b.clone().sub(a).normalize(),z=V(1,0,0).cross(y).normalize(),x=y.clone().cross(z).normalize();
  return new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(x,y,z));
}

export function sampleWalk(phase,out=new Float64Array(ROW)){
  const at=((phase%1)+1)%1*PILOT_WALK.samples,i=Math.floor(at),f=at-i;
  for(let k=0;k<ROW;k++)out[k]=PILOT_WALK.frames[i*ROW+k]*(1-f)+PILOT_WALK.frames[(i+1)*ROW+k]*f;
  return out;
}

// Distance drives the imported cycle; simulation time only blends starts/stops.
// Ground contact is held in world coordinates, including while facing the kite.
export class PilotLocomotion{
  constructor(){
    this.phase=0;this.blend=0;this.speed=0;this.previous=null;this.direction=V(0,0,-1);this.sample=new Float64Array(ROW);
    this.bob=0;this.sway=0;this.twist=0;this.pelvis=new Matrix4();
    this.feet=[-1,1].map(s=>({s,lock:null,contact:false,ankle:V(),knee:V(),hip:V(),pitch:0}));
  }
  update(root,dt,legs){
    if(!this.previous){this.previous=root.position.clone();this.yaw=root.rotation.y;}
    if(dt===0&&this.ready)return;
    const delta=root.position.clone().sub(this.previous);delta.y=0;const distance=delta.length();
    const teleport=distance>.8;this.previous.copy(root.position);
    if(teleport){this.blend=0;this.speed=0;for(const f of this.feet)f.lock=null;}
    else if(dt>0){
      this.speed=distance/dt;
      if(distance>1e-6)this.direction.copy(delta).divideScalar(distance);
      const local=this.direction.clone().applyAxisAngle(UP,-root.rotation.y),strideScale=.62+.38*Math.abs(local.z);
      this.phase=(this.phase+distance/(STRIDE*strideScale))%1;
      this.blend+=(clamp(this.speed/.35,0,1)-this.blend)*(1-Math.exp(-dt*12));
    }
    sampleWalk(this.phase,this.sample);const q=this.sample,b=this.blend;
    this.bob=(q[1]-.038)*b;this.sway=q[0]*b;this.twist=q[2]*b;
    this.pelvis.makeRotationY(this.twist*.45);this.pelvis.setPosition(this.sway,this.bob,0);
    const dir=this.direction.clone().applyAxisAngle(UP,-root.rotation.y),strideScale=.62+.38*Math.abs(dir.z);
    root.updateMatrix();const toLocal=root.matrix.clone().invert();
    for(let i=0;i<2;i++){
      const f=this.feet[i],leg=legs[i],offset=f.s>0?3:8;
      const travel=q[offset]*strideScale*b,lift=q[offset+1]*b;
      f.pitch=clamp(q[offset+2]*(-dir.z)*b,-.72,.90);
      leg.shoe.rotation.set(f.pitch,f.s*.09+clamp(dir.x*.22,-.22,.22)*b,0);
      const rotation=leg.shoe.quaternion;
      // Ground the actual sole, not a point at the centre of the ankle.
      let low=Infinity;const points=leg.solePoints;
      const soleRotation=new Matrix4().makeRotationFromQuaternion(rotation).elements;
      for(const point of points)low=Math.min(low,soleRotation[1]*point.x+soleRotation[5]*point.y+soleRotation[9]*point.z);
      const end=f.pitch>=0?1:-1,soleContact=V(0,0,end>0?.066:-.214),contact=soleContact.clone().applyQuaternion(rotation);
      const shoe=V(f.s*.145-dir.x*travel,-low+lift,-dir.z*travel+(1-b)*(f.s<0?.035:-.035));
      const desired=shoe.clone().add(contact),world=desired.clone().applyMatrix4(root.matrix);
      f.contact=lift<.014&&b>.12&&!teleport;
      if(f.contact){
        if(!f.lock||f.lock.distanceTo(world)>.30)f.lock=world.clone();
        else if(f.plantEnd!==end&&f.previousShoe)f.lock=soleContact.clone().applyMatrix4(f.previousShoe);
        const locked=f.lock.clone().applyMatrix4(toLocal);shoe.x+=locked.x-desired.x;shoe.z+=locked.z-desired.z;
      }else f.lock=null;
      f.plantEnd=end;leg.shoe.position.copy(shoe);
      f.previousShoe=new Matrix4().multiplyMatrices(root.matrix,new Matrix4().compose(shoe,rotation,ONE));
      f.contactWorld=soleContact.clone().applyMatrix4(f.previousShoe);
      f.ankle.copy(V(0,.125,0).applyQuaternion(rotation)).add(shoe);
      f.hip.set(f.s*.09,.97,0).applyMatrix4(this.pelvis);
      // The sampled knee supplies the bend direction; the two-link solver
      // preserves human limb lengths when retargeting to sideways/backward steps.
      f.knee.set(f.s*.18,.50,-.45-Math.abs(q[offset+3])*.4*b);
    }
    // Lower the pelvis when a backwards/sideways planted step would otherwise
    // overextend a knee. Recover height smoothly as the stance narrows.
    let lower=0;
    for(const f of this.feet){
      const horizontal=Math.hypot(f.ankle.x-f.hip.x,f.ankle.z-f.hip.z);
      const reachY=Math.sqrt(Math.max(0,.855*.855-horizontal*horizontal));
      lower=Math.max(lower,f.hip.y-f.ankle.y-reachY);
    }
    this.lowering=Math.max(lower,(this.lowering||0)*Math.exp(-dt*10));
    this.bob-=this.lowering;this.pelvis.setPosition(this.sway,this.bob,0);
    for(const f of this.feet)f.hip.y-=this.lowering;
    this.ready=true;
  }
}

// The uploaded character's connected lower-body topology replaces separate
// thigh/shin cylinders. The same CPU-skinned mesh is used by WebGL and Canvas.
export class PilotTrousers{
  constructor(material){
    const source=PILOT_WALK.trousers,g=new BufferGeometry();this.rest=new Float32Array(source.vertices);this.weights=source.weights;
    g.setAttribute('position',new Float32BufferAttribute(this.rest.slice(),3));g.setIndex(source.indices);g.computeVertexNormals();this.normals=g.attributes.normal.array.slice();
    g.attributes.position.setUsage(DynamicDrawUsage);g.attributes.normal.setUsage(DynamicDrawUsage);g.boundingSphere=new Sphere(V(0,.55,0),.9);
    this.mesh=new Mesh(g,material);this.mesh.name='walk-cycle-trousers';this.matrices=Array.from({length:5},()=>new Matrix4());this.binds=[];
    for(const points of PILOT_WALK.restLegs)for(let j=0;j<2;j++){
      const a=V(...points[j]),b=V(...points[j+1]);this.binds.push(new Matrix4().compose(a,legRotation(a,b),ONE).invert());
    }
  }
  update(pelvis,legs){
    this.matrices[0].copy(pelvis);
    // Data order is +X then -X; PilotModel stores -X then +X.
    for(let i=0;i<2;i++)for(let j=0;j<2;j++){
      const limb=j?legs[1-i].shin:legs[1-i].thigh;
      this.matrices[1+i*2+j].compose(limb.position,limb.quaternion,ONE).multiply(this.binds[i*2+j]);
    }
    const g=this.mesh.geometry,p=g.attributes.position.array,n=g.attributes.normal.array;
    for(let i=0;i<this.rest.length;i+=3){
      let x=0,y=0,z=0,nx=0,ny=0,nz=0;
      for(let k=0;k<5;k++){
        const w=this.weights[i/3*5+k];if(!w)continue;const e=this.matrices[k].elements,rx=this.rest[i],ry=this.rest[i+1],rz=this.rest[i+2],a=this.normals[i],b=this.normals[i+1],c=this.normals[i+2];
        x+=w*(e[0]*rx+e[4]*ry+e[8]*rz+e[12]);y+=w*(e[1]*rx+e[5]*ry+e[9]*rz+e[13]);z+=w*(e[2]*rx+e[6]*ry+e[10]*rz+e[14]);
        nx+=w*(e[0]*a+e[4]*b+e[8]*c);ny+=w*(e[1]*a+e[5]*b+e[9]*c);nz+=w*(e[2]*a+e[6]*b+e[10]*c);
      }
      p[i]=x;p[i+1]=y;p[i+2]=z;const length=Math.hypot(nx,ny,nz)||1;n[i]=nx/length;n[i+1]=ny/length;n[i+2]=nz/length;
    }
    g.attributes.position.needsUpdate=true;g.attributes.normal.needsUpdate=true;
  }
}
