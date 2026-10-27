import * as T from './vendor/three.module.js';
import {wardrobeGeometry} from './pilot-wardrobe.js';

const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t);};
const bell=(x,y,cx,cy,sx,sy)=>Math.exp(-(((x-cx)/sx)**2+((y-cy)/sy)**2));

// Smooth shared vertices together, including UV/part seams in the source head.
// Only construction time is affected; the animated head remains a rigid mesh.
function soften(g,face=false){
  const p=g.attributes.position.array,ids=g.index.array,map=new Map(),groups=[],lookup=[];
  for(let i=0;i<p.length;i+=3){const key=[p[i],p[i+1],p[i+2]].map(x=>Math.round(x*1e5)).join(',');let n=map.get(key);if(n===undefined){n=groups.length;map.set(key,n);groups.push({point:new T.Vector3(p[i],p[i+1],p[i+2]),vertices:[],neighbors:new Set()});}groups[n].vertices.push(i);lookup[i/3]=n;}
  for(let i=0;i<ids.length;i+=3)for(let j=0;j<3;j++){const a=lookup[ids[i+j]],b=lookup[ids[i+(j+1)%3]];if(a!==b){groups[a].neighbors.add(b);groups[b].neighbors.add(a);}}
  for(const amount of [.42,-.34,.42,-.34,.42,-.34]){
    const next=groups.map(a=>{const mean=new T.Vector3();for(const b of a.neighbors)mean.add(groups[b].point);return a.point.clone().lerp(mean.divideScalar(a.neighbors.size||1),amount);});
    groups.forEach((a,i)=>a.point.copy(next[i]));
  }
  // The source drawing figure has sharp hollows around its closed mouth.
  // Relax only that area; keep the nose, jaw outline and eye sockets intact.
  if(face)for(let pass=0;pass<12;pass++){
    const next=groups.map(a=>{
      const {x,y,z}=a.point,region=smooth(.006,.028,y)*(1-smooth(.080,.105,y))*(1-smooth(-.045,-.015,z))*(1-smooth(.055,.075,Math.abs(x))),nose=1-bell(x,y,0,.085,.018,.018);
      const mean=new T.Vector3();for(const b of a.neighbors)mean.add(groups[b].point);
      return a.point.clone().lerp(mean.divideScalar(a.neighbors.size||1),region*nose*.44);
    });groups.forEach((a,i)=>a.point.copy(next[i]));
  }
  for(const a of groups)for(const i of a.vertices)a.point.toArray(p,i);
  g.computeVertexNormals();const n=g.attributes.normal.array;
  for(const a of groups){const v=new T.Vector3();for(const i of a.vertices)v.add(new T.Vector3(n[i],n[i+1],n[i+2]));v.normalize();for(const i of a.vertices)v.toArray(n,i);}
  if(face){
    const original=n.slice();
    for(const a of groups){
      const {x,y,z}=a.point,blend=(1-smooth(.09,.12,y))*(1-smooth(-.035,-.010,z));if(blend===0)continue;
      const base=new T.Vector3().fromArray(original,a.vertices[0]),sum=base.clone();
      for(const b of groups){const distance=a.point.distanceTo(b.point);if(distance>.021)continue;const normal=new T.Vector3().fromArray(original,b.vertices[0]);if(base.dot(normal)>.35)sum.addScaledVector(normal,1-distance/.021);}
      base.lerp(sum.normalize(),blend*.85).normalize();for(const i of a.vertices)base.toArray(n,i);
    }
  }
  return g;
}
function surface(g){
  const p=g.attributes.position.array,ids=g.index.array;
  return (x,y)=>{
    let z=Infinity;
    for(let i=0;i<ids.length;i+=3){const a=ids[i]*3,b=ids[i+1]*3,c=ids[i+2]*3,ax=p[a],ay=p[a+1],bx=p[b],by=p[b+1],cx=p[c],cy=p[c+1];
      if(x<Math.min(ax,bx,cx)||x>Math.max(ax,bx,cx)||y<Math.min(ay,by,cy)||y>Math.max(ay,by,cy))continue;
      const det=(by-cy)*(ax-cx)+(cx-bx)*(ay-cy);if(Math.abs(det)<1e-12)continue;
      const u=((by-cy)*(x-cx)+(cx-bx)*(y-cy))/det,v=((cy-ay)*(x-cx)+(ax-cx)*(y-cy))/det,w=1-u-v;
      if(u>=-1e-6&&v>=-1e-6&&w>=-1e-6)z=Math.min(z,u*p[a+2]+v*p[b+2]+w*p[c+2]);
    }
    return Number.isFinite(z)?z:-.07;
  };
}
class Features{
  constructor(front){this.front=front;this.p=[];this.c=[];this.i=[];}
  vertex(x,y,color,offset=.0008){const i=this.p.length/3;this.p.push(x,y,this.front(x,y)-offset);const c=new T.Color(color);this.c.push(c.r,c.g,c.b);return i;}
  patch(cx,cy,rx,ry,color,n=16,offset=.0008,almond=false){
    const center=this.vertex(cx,cy,color,offset);
    for(let j=0;j<n;j++){const a=j/n*Math.PI*2,b=(j+1)/n*Math.PI*2;
      const point=t=>[cx+Math.cos(t)*rx,cy+Math.sin(t)*ry*(almond?Math.abs(Math.sin(t))**.35:1)];
      this.i.push(center,this.vertex(...point(b),color,offset),this.vertex(...point(a),color,offset));
    }
  }
  stroke(points,width,color,offset=.0012){
    for(let j=0;j<points.length-1;j++){
      const a=points[j],b=points[j+1],dx=b[0]-a[0],dy=b[1]-a[1],d=Math.hypot(dx,dy)||1,nx=-dy/d*width/2,ny=dx/d*width/2;
      const ids=[[a[0]+nx,a[1]+ny],[b[0]+nx,b[1]+ny],[b[0]-nx,b[1]-ny],[a[0]-nx,a[1]-ny]].map(q=>this.vertex(...q,color,offset));this.i.push(ids[0],ids[1],ids[2],ids[0],ids[2],ids[3]);
    }
  }
  geometry(){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(this.p,3));g.setAttribute('color',new T.Float32BufferAttribute(this.c,3));g.setIndex(this.i);g.computeVertexNormals();return g;}
}
export function faceLevel(source,index,far=false){
  const female=index%3===1,g=soften(wardrobeGeometry(source),true),p=g.attributes.position,colors=[];
  for(let i=0;i<p.count;i++){
    const x=p.getX(i),y=p.getY(i),z=p.getZ(i),front=1-smooth(-.035,.015,z);
    const cheeks=(bell(x,y,.042,.078,.025,.026)+bell(x,y,-.042,.078,.025,.026))*front;
    const socket=(bell(x,y,.030,.124,.020,.012)+bell(x,y,-.030,.124,.020,.012))*front;
    const beard=index%3===2?smooth(.082,.035,y)*front*(1-smooth(.055,.078,Math.abs(x))):0;
    colors.push((1-.08*socket)*(1-.17*beard),(1-.09*cheeks-.12*socket)*(1-.16*beard),(1-.10*cheeks-.13*socket)*(1-.13*beard));
  }
  g.setAttribute('color',new T.Float32BufferAttribute(colors,3));
  const f=new Features(surface(g)),eyeY=female?.125:.122,eyeX=female?.029:.031,n=far?8:16;
  const lid=['#856149','#986c56','#614635'][index%3],brow=['#43362c','#463026','#302b24'][index%3],lip=['#956550','#ae7667','#775347'][index%3];
  for(const s of [-1,1]){
    const x=s*eyeX;
    f.patch(x,eyeY,.0128,.0045,lid,n,.0009,true);
    f.patch(x,eyeY,.0117,.0036,'#c9c8b9',n,.0015,true);
    f.patch(x,eyeY+.0006,.0045,.0033,index===1?'#62523b':'#4c3929',n,.0021);
    f.patch(x,eyeY+.0006,.0021,.0021,'#252620',n,.0025);
    if(!far)f.patch(x-.0008,eyeY+.0014,.00065,.00055,'#dedbcc',8,.0028);
    const browPoints=[];for(let k=0;k<=6;k++){const t=k/6;browPoints.push([x+(t-.5)*.029,eyeY+.014+.003*Math.sin(t*Math.PI)-s*(t-.5)*.002]);}
    f.stroke(browPoints,female?.0026:.0032,brow);
    f.patch(s*.008,.0735,.0030,.0013,'#76503e',n,.0010);
  }
  // A restrained lip colour and a closed mouth, rather than a painted smile.
  f.patch(0,.053,.018,female?.0036:.0031,lip,n,.0026,true);
  f.stroke([[-.018,.0532],[-.010,.0525],[0,.053],[.010,.0525],[.018,.0532]],.00065,'#705441',.0031);
  return {geometry:g,features:f.geometry(),hair:hairGeometry(g,index)};
}
function hairGeometry(g,index){
  const p=g.attributes.position,idx=g.index.array,vertices=[],indices=[],colors=[],female=index%3===1;
  const threshold=v=>v.y-(.180+.012*Math.exp(-((v.x/.040)**2))-.070*smooth(-.025,.035,v.z));
  for(let k=0;k<idx.length;k+=3){
    const tri=[0,1,2].map(j=>new T.Vector3().fromBufferAttribute(p,idx[k+j])),poly=[];
    for(let j=0;j<3;j++){const a=tri[j],b=tri[(j+1)%3],fa=threshold(a),fb=threshold(b);if(fa>=0)poly.push(a);if((fa>=0)!==(fb>=0))poly.push(a.clone().lerp(b,fa/(fa-fb)));}
    const start=vertices.length/3;
    for(const v of poly){
      const ridge=Math.sin(Math.atan2(v.x,v.z)*24+v.y*22)*.001;
      vertices.push(v.x*1.035,v.y+.004+ridge,v.z*1.025+.002);
      const shade=.78+.22*smooth(.13,.23,v.y)+.06*Math.sin(v.x*430+v.y*90);colors.push(shade,shade*.96,shade*.92);
    }
    for(let j=1;j<poly.length-1;j++)indices.push(start,start+j,start+j+1);
  }
  const out=new T.BufferGeometry();out.setAttribute('position',new T.Float32BufferAttribute(vertices,3));out.setAttribute('color',new T.Float32BufferAttribute(colors,3));out.setIndex(indices);out.computeVertexNormals();return soften(out);
}
