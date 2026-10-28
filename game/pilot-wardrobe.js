import * as T from './vendor/three.module.js';
import {finishFabric} from './pilot-fabric.js';
import {lineGarment} from './pilot-surface.js';
import {VolumeSkinning} from './pilot-skinning.js';
import {PILOT_WARDROBE} from './pilot-wardrobe-data.js';
import {PILOT_KIT} from './pilot-kit-data.js';

const smooth=(a,b,x)=>{const t=T.MathUtils.clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
const UP=new T.Vector3(0,1,0),ONE=new T.Vector3(1,1,1);
export {PILOT_WARDROBE};

export function wardrobeGeometry(source,mirror=1){
  const g=new T.BufferGeometry(),p=new Float32Array(source.vertices),indices=source.indices.slice();
  if(mirror<0){for(let i=0;i<p.length;i+=3)p[i]*=-1;for(let i=0;i<indices.length;i+=3)[indices[i+1],indices[i+2]]=[indices[i+2],indices[i+1]];}
  g.setAttribute('position',new T.BufferAttribute(p,3));g.setIndex(indices);g.computeVertexNormals();
  if(source.normals){const normals=new Float32Array(source.normals);if(mirror<0)for(let i=0;i<normals.length;i+=3)normals[i]*=-1;g.setAttribute('normal',new T.BufferAttribute(normals,3));}
  if(source.uv)g.setAttribute('uv',new T.Float32BufferAttribute(source.uv,2));
  if(source.colors){
    const colors=new Float32Array(source.colors.length),c=new T.Color();
    for(let i=0;i<colors.length;i+=3){c.setRGB(source.colors[i]/255,source.colors[i+1]/255,source.colors[i+2]/255).convertSRGBToLinear();colors[i]=c.r;colors[i+1]=c.g;colors[i+2]=c.b;}
    g.setAttribute('color',new T.BufferAttribute(colors,3));
  }
  return g;
}

// One continuous garment, weighted to the chest and the same two-link arms that
// control the reel. CPU skinning keeps the exact mesh available to Canvas too.
// There is no per-frame cloth simulation or disconnected sleeve primitives.
export class FittedGarment{
  constructor(kind,material){
    this.kind=kind;this.level=0;
    this.levels=(kind==='sweater'?PILOT_KIT.sweater:PILOT_WARDROBE[kind]).map((source,level)=>{
      const geometry=lineGarment(finishFabric(wardrobeGeometry(source),kind,level),source.vertices.length/3,source.indices.length),rest=geometry.attributes.position.array.slice(),normals=geometry.attributes.normal.array.slice(),weights=new Float32Array(rest.length/3*3),bones=new Uint8Array(rest.length/3*3);
      for(let i=0;i<rest.length;i+=3){
        const x=Math.abs(rest[i]),y=rest[i+1],arm=y>1.53?0:smooth(.185,.285,x)*smooth(1.20,1.34,y),fore=smooth(.375,.595,x),side=rest[i]<0?1:3;
        weights[i]=1-arm;weights[i+1]=arm*(1-fore);weights[i+2]=arm*fore;bones[i]=0;bones[i+1]=side;bones[i+2]=side+1;
        if(y<1.22){const chest=smooth(.99,1.22,y);weights[i]=1-chest;weights[i+1]=chest;weights[i+2]=0;bones[i]=6;bones[i+1]=0;}
        if(kind==='hoodie'&&y>1.54){const head=smooth(1.54,1.64,y);weights[i]=1-head;weights[i+1]=head;weights[i+2]=0;bones[i+1]=5;}
      }
      const {outerVertices,baseVertices}=geometry.userData.lining;
      for(let i=0;i<baseVertices;i++)for(let k=0;k<3;k++){weights[(outerVertices+i)*3+k]=weights[i*3+k];bones[(outerVertices+i)*3+k]=bones[i*3+k];}
      geometry.attributes.position.setUsage(T.DynamicDrawUsage);geometry.attributes.normal.setUsage(T.DynamicDrawUsage);
      geometry.boundingSphere=new T.Sphere(new T.Vector3(0,1.25,0),1.2);
      return {geometry,rest,normals,weights,bones};
    });
    this.mesh=new T.Mesh(this.levels[0].geometry,material);this.mesh.name='fitted-'+kind;
    this.matrices=Array.from({length:7},()=>new T.Matrix4());
    this.binds=[new T.Matrix4().makeTranslation(0,-.96,0)];
    this.skinning=new VolumeSkinning(7);this.armAxes=[];
    for(const s of [-1,1]){
      this.binds.push(new T.Matrix4().makeTranslation(-s*.185,-1.425,0),new T.Matrix4().makeTranslation(-s*.485,-1.425,0));
      this.armAxes.push(new T.Vector3(s,0,0));
    }
    this.headBind=new T.Matrix4().makeTranslation(0,-1.53,0);
    this.rotation=new T.Quaternion();this.axis=new T.Vector3();
  }
  setDetail(level){if(level===this.level)return;this.level=level;this.mesh.geometry=this.levels[level].geometry;this.mesh.userData.canvasVertices=null;}
  update(body,arms,head,pelvis=null){
    if(pelvis)this.matrices[6].copy(pelvis);
    this.matrices[0].multiplyMatrices(body.matrix,this.binds[0]);
    head.updateMatrix();this.matrices[5].multiplyMatrices(body.matrix,head.matrix).multiply(this.headBind);
    for(let a=0;a<2;a++)for(let j=0;j<2;j++){
      const limb=j?arms[a].lower:arms[a].upper,index=1+a*2+j;
      this.axis.copy(UP).applyQuaternion(limb.quaternion);this.rotation.setFromUnitVectors(this.armAxes[a],this.axis);
      this.matrices[index].compose(limb.position,this.rotation,ONE).multiply(this.binds[index]);
    }
    const {geometry,rest,weights,bones}=this.levels[this.level],out=geometry.attributes.position.array;
    for(let i=0;i<this.matrices.length;i++)this.skinning.setBone(i,this.matrices[i]);
    this.skinning.deform(rest,bones,weights,out);
    // Round the sleeve around the actual elbow with a tangent-aligned sweep.
    // A short dual-quaternion blend folds the inner wall through itself at a
    // right angle. The rounded centerline leaves room for the fabric thickness.
    if(this.kind!=='tee')for(let a=0;a<2;a++){
      const arm=arms[a],joint=arm.lower.position,s=a?1:-1;
      const upper=new T.Vector3(0,1,0).applyQuaternion(arm.upper.quaternion),lower=new T.Vector3(0,1,0).applyQuaternion(arm.lower.quaternion);
      const start=joint.clone().addScaledVector(upper,-.12),end=joint.clone().addScaledVector(lower,.12),center=new T.Vector3(),tangent=new T.Vector3(),radial=new T.Vector3(),q=new T.Quaternion();
      for(let i=0;i<rest.length;i+=3){
        const x=rest[i]*s,blend=smooth(.28,.35,x)*(1-smooth(1.49,1.55,rest[i+1]));if(blend<=0)continue;
        const t=T.MathUtils.clamp((x-.365)/.24,0,1);
        if(x<.365){center.copy(joint).addScaledVector(upper,x-.485);tangent.copy(upper);}
        else if(x>.605){center.copy(joint).addScaledVector(lower,x-.485);tangent.copy(lower);}
        else {center.copy(start).multiplyScalar((1-t)**2).addScaledVector(joint,2*t*(1-t)).addScaledVector(end,t*t);tangent.copy(upper).lerp(lower,t).normalize();}
        q.setFromUnitVectors(this.armAxes[a],tangent);radial.set(0,rest[i+1]-1.425,rest[i+2]).applyQuaternion(q).add(center);
        out[i]+=(radial.x-out[i])*blend;out[i+1]+=(radial.y-out[i+1])*blend;out[i+2]+=(radial.z-out[i+2])*blend;
      }
    }
    // Compressed cloth gathers on the inside of a bent elbow. Keep the outer
    // stretched side smooth and apply the same displacement to the lining.
    if(this.kind!=='tee')for(let a=0;a<2;a++){
      const arm=arms[a],joint=arm.lower.position;
      const upper=new T.Vector3(0,1,0).applyQuaternion(arm.upper.quaternion),lower=new T.Vector3(0,1,0).applyQuaternion(arm.lower.quaternion);
      const inner=lower.clone().sub(upper).normalize(),bend=T.MathUtils.clamp(1-upper.dot(lower),0,1);
      for(let i=0;i<rest.length;i+=3){
        if((rest[i]<0?0:1)!==a)continue;const along=Math.abs(rest[i])-.485;
        if(Math.abs(along)>.09)continue;
        const compression=smooth(.005,.040,(out[i]-joint.x)*inner.x+(out[i+1]-joint.y)*inner.y+(out[i+2]-joint.z)*inner.z);
        const fold=.0015*bend*compression*(Math.exp(-(((along+.034)/.018)**2))-.8*Math.exp(-(((along+.004)/.019)**2))+.6*Math.exp(-(((along-.030)/.018)**2)));
        out[i]+=inner.x*fold;out[i+1]+=inner.y*fold;out[i+2]+=inner.z*fold;
      }
    }
    // Rebuild the inner shell from the deformed outside. Rotating a rest-pose
    // offset can put lining through a deeply bent elbow, leaving dark patches.
    const lining=geometry.userData.lining,normals=this.liningNormals?.length>=lining.baseVertices*3?this.liningNormals:(this.liningNormals=new Float32Array(lining.baseVertices*3));
    normals.fill(0);const ids=geometry.index.array;
    for(let i=0;i<lining.baseIndices;i+=3){
      const a=ids[i]*3,b=ids[i+1]*3,c=ids[i+2]*3,ux=out[b]-out[a],uy=out[b+1]-out[a+1],uz=out[b+2]-out[a+2],vx=out[c]-out[a],vy=out[c+1]-out[a+1],vz=out[c+2]-out[a+2];
      const nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;
      for(const j of [a,b,c]){normals[j]+=nx;normals[j+1]+=ny;normals[j+2]+=nz;}
    }
    for(let i=0;i<lining.baseVertices;i++){
      const a=i*3;if(Math.abs(rest[a])<.28||rest[a+1]<1.25||rest[a+1]>1.53)continue;
      const b=(lining.outerVertices+i)*3,length=Math.hypot(normals[a],normals[a+1],normals[a+2])||1;
      for(let k=0;k<3;k++)out[b+k]=out[a+k]-normals[a+k]/length*lining.thickness;
    }
    // Recompute from the deformed surface: blended rest normals were wrong
    // around bent elbows and made the fabric look stretched or translucent.
    geometry.attributes.position.needsUpdate=true;geometry.computeVertexNormals();
  }
}
