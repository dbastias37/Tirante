import * as T from './vendor/three.module.js';
import {finishFabric} from './pilot-fabric.js';
import {lineGarment} from './pilot-surface.js';
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
        const x=Math.abs(rest[i]),y=rest[i+1],arm=kind==='sweater'?smooth(.14,.235,x):y>1.53?0:smooth(.12,.235,x)*smooth(1.20,1.37,y),fore=smooth(.435,.532,x),side=rest[i]<0?1:3;
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
    this.armRotations=[];
    for(const s of [-1,1]){
      this.binds.push(new T.Matrix4().makeTranslation(-s*.185,-1.425,0),new T.Matrix4().makeTranslation(-s*.485,-1.425,0));
      this.armRotations.push(new T.Quaternion().setFromUnitVectors(new T.Vector3(s,0,0),UP));
    }
    this.headBind=new T.Matrix4().makeTranslation(0,-1.53,0);
    this.rotation=new T.Quaternion();
  }
  setDetail(level){if(level===this.level)return;this.level=level;this.mesh.geometry=this.levels[level].geometry;this.mesh.userData.canvasVertices=null;}
  update(body,arms,head,pelvis=null){
    if(pelvis)this.matrices[6].copy(pelvis);
    this.matrices[0].multiplyMatrices(body.matrix,this.binds[0]);
    head.updateMatrix();this.matrices[5].multiplyMatrices(body.matrix,head.matrix).multiply(this.headBind);
    for(let a=0;a<2;a++)for(let j=0;j<2;j++){
      const limb=j?arms[a].lower:arms[a].upper,index=1+a*2+j;
      this.rotation.copy(limb.quaternion).multiply(this.armRotations[a]);
      this.matrices[index].compose(limb.position,this.rotation,ONE).multiply(this.binds[index]);
    }
    const {geometry,rest,weights,bones}=this.levels[this.level],out=geometry.attributes.position.array;
    for(let i=0;i<rest.length;i+=3){
      const x=rest[i],y=rest[i+1],z=rest[i+2];let px=0,py=0,pz=0;
      for(let j=0;j<3;j++){
        const w=weights[i+j];if(!w)continue;const e=this.matrices[bones[i+j]].elements;
        px+=w*(e[0]*x+e[4]*y+e[8]*z+e[12]);py+=w*(e[1]*x+e[5]*y+e[9]*z+e[13]);pz+=w*(e[2]*x+e[6]*y+e[10]*z+e[14]);
      }
      out[i]=px;out[i+1]=py;out[i+2]=pz;
    }
    // Recompute from the deformed surface: blended rest normals were wrong
    // around bent elbows and made the fabric look stretched or translucent.
    geometry.attributes.position.needsUpdate=true;geometry.computeVertexNormals();
  }
}
