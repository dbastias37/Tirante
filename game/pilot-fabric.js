import * as T from './vendor/three.module.js';
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t);};

// Small silhouette folds and sewn details are part of the same weighted mesh.
// No texture downloads, per-frame cloth simulation or extra draw calls.
export function finishFabric(g,kind,level){
  const p=g.attributes.position,c=g.attributes.color;
  for(let i=0;i<p.count;i++){
    let x=p.getX(i),y=p.getY(i),z=p.getZ(i);const arm=smooth(.16,.25,Math.abs(x))*(1-smooth(1.48,1.53,y));
    y+=(y-1.425)*arm*(kind==='tee'?.19:.06);z+=(z+.015)*arm*(kind==='tee'?.22:.07);
    if(kind==='hoodie'){const cuff=smooth(.60,.745,Math.abs(x));y=1.425+(y-1.425)*(1-.32*cuff);z=-.015+(z+.015)*(1-.32*cuff);}
    const lower=(1-smooth(1.16,1.34,y))*smooth(.95,1.02,y)*(1-smooth(.12,.20,Math.abs(x)));
    const fold=Math.sin(y*59+x*33)*.0033+Math.sin(y*97-x*19)*.0014;
    z+=Math.sign(z||1)*fold*lower;p.setXYZ(i,x,y,z);
    const shade=1-.065*lower*(.5+.5*Math.sin(y*59+x*33))-.025*Math.sin(x*91+y*83)**2;
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
