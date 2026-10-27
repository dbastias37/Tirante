import * as T from './vendor/three.module.js';
const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
const mix=(a,b,t)=>a+(b-a)*t;

// Hand proportions follow the supplied character, with separate thumb and four
// fingers reconstructed for the photographed axle grip. One mesh per hand;
// rounded palm, knuckles and continuous bent fingers share the skin shading.
export class PilotHand{
  constructor(side,skin){
    this.side=side;this.level=0;this.group=new T.Group();this.curl=null;
    const material=skin.clone();material.vertexColors=true;
    this.levels=[this.build(8,8),this.build(6,5)];
    this.mesh=new T.Mesh(this.levels[0].geometry,material);this.mesh.name='articulated-hand';this.group.add(this.mesh);this.group.scale.x=side;
  }
  build(sides,steps){
    const p=[],colors=[],indices=[],rings=[];
    const append=(points,shade=1)=>{const start=p.length/3;for(const q of points){p.push(...q);colors.push(shade,shade*.975,shade*.94);}return start;};
    const join=(a,b)=>{for(let j=0;j<sides;j++){const k=(j+1)%sides;indices.push(a+j,b+j,a+k,a+k,b+j,b+k);}};
    const cap=(ring,point,first)=>{const center=append([point]);for(let j=0;j<sides;j++){const a=ring+j,b=ring+(j+1)%sides;indices.push(center,first?a:b,first?b:a);}};
    const rows=[[0,.025,.012],[-.018,.031,.016],[-.040,.037,.019],[-.062,.037,.016],[-.075,.032,.012]];
    for(let k=0;k<rows.length;k++){
      const [z,rx,ry]=rows[k],ring=append(Array.from({length:sides},(_,j)=>{const a=j/sides*Math.PI*2,c=Math.cos(a),s=Math.sin(a);return [Math.sign(c)*Math.abs(c)**.65*rx,s*ry-(s<0?.003:0),z];}));
      if(k)join(ring-sides,ring);else cap(ring,V(0,0,z).toArray(),true);if(k===rows.length-1)cap(ring,V(0,0,z).toArray(),false);
    }
    const fingers=[[-.027,-.064,.062,.0080],[-.009,-.074,.073,.0085],[.010,-.072,.068,.0082],[.027,-.062,.053,.0070]];
    for(let digit=0;digit<5;digit++){
      const start=p.length/3;for(let k=0;k<=steps;k++)append(Array.from({length:sides},()=>[0,0,0]));
      for(let k=0;k<steps;k++)join(start+k*sides,start+(k+1)*sides);
      const capIndex=append([[0,0,0]]);for(let j=0;j<sides;j++)indices.push(capIndex,start+steps*sides+(j+1)%sides,start+steps*sides+j);
      rings.push({start,capIndex,digit,info:fingers[digit]});
    }
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.setIndex(indices);g.attributes.position.setUsage(T.DynamicDrawUsage);g.boundingSphere=new T.Sphere(V(0,-.025,-.075),.16);
    return {geometry:g,sides,steps,rings};
  }
  setDetail(level){this.level=level;this.mesh.geometry=this.levels[level].geometry;this.mesh.userData.canvasVertices=null;this.lastPose=null;}
  pose(target,dt=0){
    if(this.curl===null)this.curl=target;else this.curl+=(target-this.curl)*(1-Math.exp(-dt*16));
    const curl=this.curl;if(this.lastPose===curl)return;this.lastPose=curl;
    const {geometry:g,sides,steps,rings}=this.levels[this.level],p=g.attributes.position,colors=g.attributes.color;
    for(const r of rings){
      const centers=[],radii=[];
      if(r.digit<4){
        const [x,z,length,radius]=r.info;let y=-.002,along=z;
        for(let k=0;k<=steps;k++){const t=k/steps,angle=-.10-curl*(.55+2.1*t);if(k){y+=Math.sin(angle)*length/steps;along-=Math.cos(angle)*length/steps;}centers.push(V(x,y,along));radii.push(radius*(1-.28*t+.09*Math.cos(t*Math.PI*4)));}
      }else{
        const endOpen=V(.063,-.006,-.068),endClosed=V(.019,-.044,-.080),midOpen=V(.048,-.009,-.044),midClosed=V(.046,-.028,-.053);
        const curve=new T.CatmullRomCurve3([V(.029,-.009,-.026),midOpen.lerp(midClosed,curl),endOpen.lerp(endClosed,curl)]);
        for(let k=0;k<=steps;k++){centers.push(curve.getPoint(k/steps));radii.push(mix(.012,.007,k/steps));}
      }
      for(let k=0;k<=steps;k++){
        const tangent=centers[Math.min(steps,k+1)].clone().sub(centers[Math.max(0,k-1)]).normalize();
        const across=V(1,0,0).addScaledVector(tangent,-tangent.x).normalize(),normal=across.clone().cross(tangent).normalize();
        for(let j=0;j<sides;j++){
          const a=j/sides*Math.PI*2,q=centers[k].clone().addScaledVector(across,Math.cos(a)*radii[k]).addScaledVector(normal,Math.sin(a)*radii[k]*.9),at=r.start+k*sides+j;
          p.setXYZ(at,q.x,q.y,q.z);const nail=k>=steps-1&&Math.sin(a)>.65,shade=1-(k>0&&k<steps&&k%3===0?.055:0);colors.setXYZ(at,nail?1.03:shade,nail?.94:shade*.975,nail?.88:shade*.94);
        }
      }
      const tip=centers[steps];p.setXYZ(r.capIndex,tip.x,tip.y,tip.z);
    }
    p.needsUpdate=true;colors.needsUpdate=true;g.computeVertexNormals();
  }
}
