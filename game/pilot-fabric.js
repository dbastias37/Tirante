import * as T from './vendor/three.module.js';
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t);};

// Relax irregular triangulation once, keeping neck, cuff and hem boundaries.
// This removes sharp inherited ridges before fitting the cloth to the rig.
function relaxCloth(g){
 const p=g.attributes.position,neighbors=Array.from({length:p.count},()=>new Set()),edges=new Map(),fixed=new Set();
 for(let k=0;k<g.index.count;k+=3)for(let j=0;j<3;j++){
  const a=g.index.getX(k+j),b=g.index.getX(k+(j+1)%3),key=[Math.min(a,b),Math.max(a,b)].join(',');neighbors[a].add(b);neighbors[b].add(a);edges.set(key,(edges.get(key)||0)+1);
 }
 for(const [edge,n] of edges)if(n===1)for(const id of edge.split(','))fixed.add(Number(id));
 for(const amount of [.38,-.34,.38,-.34,.24,.24]){
  const next=p.array.slice();
  for(let i=0;i<p.count;i++)if(!fixed.has(i)&&neighbors[i].size){
   for(let axis=0;axis<3;axis++){let sum=0;for(const j of neighbors[i])sum+=p.array[j*3+axis];const shoulder=smooth(.10,.18,Math.abs(p.getX(i)))*(1-smooth(.28,.36,Math.abs(p.getX(i))))*smooth(1.30,1.40,p.getY(i))*(1-smooth(1.50,1.54,p.getY(i)));next[i*3+axis]+=(sum/neighbors[i].size-p.array[i*3+axis])*amount*(amount===.24?shoulder:1);}
  }
  p.array.set(next);
 }
}
const interpolate=(x,points)=>{for(let i=1;i<points.length;i++)if(x<points[i][0]){const [a,av]=points[i-1],[b,bv]=points[i];return av+(bv-av)*clamp((x-a)/(b-a));}return points.at(-1)[1];};

// Small silhouette folds and sewn details are part of the same weighted mesh.
// No texture downloads, per-frame cloth simulation or extra draw calls.
export function finishFabric(g,kind,level){
  relaxCloth(g);const p=g.attributes.position,c=g.attributes.color;
  for(let i=0;i<p.count;i++){
    let x=p.getX(i),y=p.getY(i),z=p.getZ(i);const distance=Math.abs(x),arm=smooth(.215,.29,distance)*(1-smooth(1.49,1.55,y));
    if(arm){
      const centerY=kind==='tee'?1.423:kind==='sweater'?1.402:1.410,centerZ=interpolate(distance,[[.24,0],[.4,-.008],[.6,-.012],[.75,-.018]]);
      const ry=kind==='tee'?.064:interpolate(distance,[[.28,kind==='hoodie'?.070:.064],[.48,.057],[.60,.047],[.75,kind==='hoodie'?.038:.034]]);
      const rz=kind==='tee'?.060:ry*.88,dy=(y-centerY)/ry,dz=(z-centerZ)/rz,r=Math.hypot(dy,dz)||1;
      const ease=.90+.10*clamp(r,.7,1.3),fitY=1.425+dy/r*ry*ease,fitZ=dz/r*rz*ease;
      y+=(fitY-y)*arm;z+=(fitZ-z)*arm;
    }
    // The shoulder slopes from the collar toward the sleeve; retain the hood
    // and collar boundaries instead of flattening them into a padded ledge.
    const shoulder=smooth(.11,.21,distance)*(1-smooth(.24,.30,distance))*smooth(1.43,1.49,y)*(1-smooth(1.53,1.57,y));
    y-=.015*shoulder;
    const lower=(1-smooth(1.16,1.34,y))*smooth(.95,1.02,y)*(1-smooth(.12,.20,Math.abs(x)));
    const fold=Math.sin(x*38+.4)*.0024+Math.sin((y-.98)*55)*.0010;
    z+=Math.sign(z||1)*fold*lower;p.setXYZ(i,x,y,z);
    const shade=1-.025*lower*(.5+.5*Math.sin(x*38+.4))-.012*Math.sin(x*91+y*83)**2;
    c.setXYZ(i,c.getX(i)*shade,c.getY(i)*shade,c.getZ(i)*shade);
  }
  g.computeVertexNormals();
  const base=p.array,indices=Array.from(g.index.array),vertices=Array.from(base),colors=Array.from(c.array);
  const front=(x,y)=>{
    let z=Infinity;for(let k=0;k<g.index.count;k+=3){const a=indices[k]*3,b=indices[k+1]*3,d=indices[k+2]*3,ax=base[a],ay=base[a+1],bx=base[b],by=base[b+1],cx=base[d],cy=base[d+1];
      if(x<Math.min(ax,bx,cx)||x>Math.max(ax,bx,cx)||y<Math.min(ay,by,cy)||y>Math.max(ay,by,cy))continue;
      const det=(by-cy)*(ax-cx)+(cx-bx)*(ay-cy);if(Math.abs(det)<1e-12)continue;const u=((by-cy)*(x-cx)+(cx-bx)*(y-cy))/det,v=((cy-ay)*(x-cx)+(ax-cx)*(y-cy))/det,w=1-u-v;
      if(Math.min(u,v,w)>=-1e-5)z=Math.min(z,u*base[a+2]+v*base[b+2]+w*base[d+2]);
    }return Number.isFinite(z)?z:-.105;
  };
  const vertex=(x,y,shade,depth=.002)=>{const at=vertices.length/3;vertices.push(x,y,front(x,y)-depth);colors.push(shade,shade,shade);return at;};
  const stroke=(points,width,shade,depth=.003)=>{
    for(let k=0;k<points.length-1;k++){const a=points[k],b=points[k+1],length=Math.hypot(b[0]-a[0],b[1]-a[1])||1,nx=-(b[1]-a[1])/length*width/2,ny=(b[0]-a[0])/length*width/2;
      const ids=[[a[0]+nx,a[1]+ny],[b[0]+nx,b[1]+ny],[b[0]-nx,b[1]-ny],[a[0]-nx,a[1]-ny]].map(q=>vertex(...q,shade,depth));indices.push(ids[0],ids[1],ids[2],ids[0],ids[2],ids[3]);}
  };
  // The hem and chest details remain subdued in the chosen team colour.
  const hem=Array.from({length:level?7:15},(_,i)=>[-.13+i/(level?6:14)*.26,.972]);stroke(hem,.0016,.64);
  if(kind==='tee'){
    const pocket=[[.047,1.337],[.112,1.337],[.112,1.270],[.080,1.254],[.047,1.270],[.047,1.337]];
    stroke(pocket,.0014,.69);stroke([[.047,1.335],[.112,1.335]],.004,.84,.0035);
  }else if(kind==='hoodie'){
    const pocket=[[-.105,1.073],[-.075,1.151],[.075,1.151],[.105,1.073],[.092,1.033],[-.092,1.033],[-.105,1.073]];
    stroke(pocket,.0022,.67);stroke([[-.105,1.073],[-.075,1.151]],.006,.58,.004);stroke([[.075,1.151],[.105,1.073]],.006,.58,.004);
    for(const s of [-1,1])stroke([[s*.027,1.465],[s*.031,1.412],[s*.024,1.365]],.0032,.45,.005);
  }
  // Turn the exposed cloth boundary into a narrow rolled edge (neck/cuffs).
  const edges=new Map();for(let k=0;k<g.index.count;k+=3)for(let j=0;j<3;j++){const a=g.index.getX(k+j),b=g.index.getX(k+(j+1)%3),key=[Math.min(a,b),Math.max(a,b)].join(',');if(edges.has(key))edges.get(key).count++;else edges.set(key,{a,b,count:1});}
  const normal=g.attributes.normal;
  for(const {a,b,count} of edges.values())if(count===1&&Math.max(p.getY(a),p.getY(b))>1.2){
    const at=vertices.length/3;
    for(const [i,lift] of [[a,0],[b,0],[b,.0024],[a,.0024]]){vertices.push(p.getX(i)+normal.getX(i)*lift,p.getY(i)+normal.getY(i)*lift,p.getZ(i)+normal.getZ(i)*lift);colors.push(.67,.67,.67);}
    indices.push(at,at+1,at+2,at,at+2,at+3);
  }
  g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.setIndex(indices);g.deleteAttribute('normal');g.computeVertexNormals();return g;
}
