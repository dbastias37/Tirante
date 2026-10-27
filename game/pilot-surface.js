import * as T from './vendor/three.module.js';
const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);

// A closed, connected skin surface. Adjacent sections share their ring, so a
// bent joint cannot expose the background between two separately capped limbs.
export class SkinTube{
  constructor(count,sides,material,name){
    this.count=count;this.sides=sides;const g=new T.BufferGeometry(),indices=[];
    g.setAttribute('position',new T.Float32BufferAttribute(new Float32Array((count*sides+2)*3),3));
    for(let row=0;row<count-1;row++)for(let i=0;i<sides;i++){const a=row*sides+i,b=row*sides+(i+1)%sides,c=a+sides,d=b+sides;indices.push(a,b,c,b,d,c);}
    for(let i=0;i<sides;i++){indices.push(count*sides,(i+1)%sides,i);indices.push(count*sides+1,(count-1)*sides+i,(count-1)*sides+(i+1)%sides);}
    g.setIndex(indices);g.attributes.position.setUsage(T.DynamicDrawUsage);g.boundingSphere=new T.Sphere(V(0,1.15,0),1.2);
    this.mesh=new T.Mesh(g,material);this.mesh.name=name;
  }
  update(centers,radii,endQuaternion=null){
    const g=this.mesh.geometry,p=g.attributes.position;
    let previous=null;
    for(let row=0;row<this.count;row++){
      const tangent=centers[Math.min(row+1,this.count-1)].clone().sub(centers[Math.max(0,row-1)]).normalize();
      let u=(previous||V(0,0,1)).clone().addScaledVector(tangent,-(previous||V(0,0,1)).dot(tangent));
      if(u.lengthSq()<1e-6)u=V(1,0,0).addScaledVector(tangent,-tangent.x);u.normalize();
      if(endQuaternion&&row>=this.count-3){
        const end=V(1,0,0).applyQuaternion(endQuaternion);end.addScaledVector(tangent,-end.dot(tangent)).normalize();if(end.dot(u)<0)end.negate();
        u.lerp(end,(row-(this.count-4))/3).normalize();
      }
      const v=tangent.clone().cross(u).normalize();previous=u;
      for(let i=0;i<this.sides;i++){
        const angle=i/this.sides*Math.PI*2,point=centers[row].clone().addScaledVector(u,Math.cos(angle)*radii[row][0]).addScaledVector(v,Math.sin(angle)*radii[row][1]);
        p.setXYZ(row*this.sides+i,point.x,point.y,point.z);
      }
    }
    centers[0].toArray(p.array,this.count*this.sides*3);centers.at(-1).toArray(p.array,(this.count*this.sides+1)*3);
    p.needsUpdate=true;g.computeVertexNormals();
  }
}

export class PilotArmSurface{
  constructor(material){this.surface=new SkinTube(14,12,material,'continuous-arm');this.mesh=this.surface.mesh;}
  update(shoulder,elbow,wrist,palm,covered=false){
    const upper=elbow.clone().sub(shoulder).normalize(),lower=wrist.clone().sub(elbow).normalize(),forward=V(0,0,-1).applyQuaternion(palm.quaternion);
    const start=elbow.clone().addScaledVector(upper,-.045),end=elbow.clone().addScaledVector(lower,.045);
    const bend=t=>start.clone().multiplyScalar((1-t)**2).addScaledVector(elbow,2*t*(1-t)).addScaledVector(end,t*t);
    const centers=[shoulder.clone().addScaledVector(upper,-.018),shoulder.clone(),shoulder.clone().addScaledVector(upper,.085),shoulder.clone().addScaledVector(upper,.17),start,bend(.25),bend(.5),bend(.75),end,elbow.clone().addScaledVector(lower,.100),wrist.clone().addScaledVector(lower,-.070),wrist.clone().addScaledVector(lower,-.032),wrist.clone(),wrist.clone().addScaledVector(forward,.014)];
    const radii=[[.029,.029],[.035,.035],[.051,.050],[.049,.047],[.041,.042],[.041,.041],[.042,.041],[.043,.041],[.047,.043],[.043,.039],[.034,.031],[.028,.024],[.025,.014],[.029,.015]];
    if(covered)for(let i=0;i<12;i++)radii[i]=radii[i].map(r=>r*(i<10?.45:.65));
    this.surface.update(centers,radii,palm.quaternion);
  }
}

export class PilotNeckSurface{
  constructor(material){
    this.baseColor=material.color.clone();const skin=material.clone();skin.color.set(0xffffff);skin.vertexColors=true;
    this.surface=new SkinTube(5,16,skin,'continuous-neck');this.mesh=this.surface.mesh;this.inverse=new T.Matrix4();this.point=V();
    this.mesh.geometry.setAttribute('color',new T.Float32BufferAttribute(new Float32Array(this.mesh.geometry.attributes.position.count*3),3));
  }
  fitHead(g){
    const p=g.attributes.position,c=g.attributes.color,uv=g.attributes.uv;this.palette=[];
    for(let k=0;k<16;k++){
      const angle=k/16*Math.PI*2,candidates=[];
      for(let i=0;i<p.count;i++)if(p.getY(i)<.075&&uv.getX(i)<.5&&uv.getY(i)>.5){
        const direction=Math.atan2(p.getZ(i)-.012,p.getX(i)),delta=Math.atan2(Math.sin(direction-angle),Math.cos(direction-angle));
        candidates.push({i,score:delta*delta*.001+(p.getY(i)-.030)**2});
      }
      candidates.sort((a,b)=>a.score-b.score);const color=new T.Color(0,0,0);let sum=0;
      for(const {i,score} of candidates.slice(0,4)){const w=1/(score+.00001);color.r+=c.getX(i)*w;color.g+=c.getY(i)*w;color.b+=c.getZ(i)*w;sum+=w;}
      this.palette.push(sum?color.multiplyScalar(1/sum):this.baseColor.clone());
    }
  }
  update(head){
    head.updateMatrix();const base=V(0,.445,0);
    // The imported neck opening is centered on this endpoint and capped;
    // overlap inside it without extending a cylinder across the jaw.
    const centers=[base,V(0,.485,0),V(0,.530,0),V(0,.010,.008).applyMatrix4(head.matrix),V(0,.055,.012).applyMatrix4(head.matrix)];
    this.surface.update(centers,[[.070,.062],[.060,.055],[.049,.047],[.045,.043],[.043,.042]]);
    const {position,color}=this.mesh.geometry.attributes;this.inverse.copy(head.matrix).invert();
    for(let i=0;i<position.count;i++){
      const p=this.point.fromBufferAttribute(position,i).applyMatrix4(this.inverse),t=T.MathUtils.smoothstep(p.y,-.050,.025),angle=(Math.atan2(p.z-.012,p.x)+Math.PI*2)%(Math.PI*2)/Math.PI*8,at=Math.floor(angle),blend=angle-at;
      const a=this.palette?.[at]||this.baseColor,b=this.palette?.[(at+1)%16]||a;
      color.setXYZ(i,this.baseColor.r+(a.r+(b.r-a.r)*blend-this.baseColor.r)*t,this.baseColor.g+(a.g+(b.g-a.g)*blend-this.baseColor.g)*t,this.baseColor.b+(a.b+(b.b-a.b)*blend-this.baseColor.b)*t);
    }
    color.needsUpdate=true;
  }
}

// Inner fabric has its own inward-facing triangles and sewn boundary walls.
// Copying the outer skin weights keeps both layers together through bending.
export function lineGarment(g,baseVertices,baseIndices,thickness=.0028){
  const p=g.attributes.position,n=g.attributes.normal,c=g.attributes.color,vertices=Array.from(p.array),colors=Array.from(c.array),indices=Array.from(g.index.array),outerVertices=p.count,edges=new Map();
  for(let i=0;i<baseVertices;i++){vertices.push(p.getX(i)-n.getX(i)*thickness,p.getY(i)-n.getY(i)*thickness,p.getZ(i)-n.getZ(i)*thickness);colors.push(c.getX(i)*.61,c.getY(i)*.61,c.getZ(i)*.61);}
  for(let i=0;i<baseIndices;i+=3){
    const a=g.index.getX(i),b=g.index.getX(i+1),d=g.index.getX(i+2);indices.push(outerVertices+a,outerVertices+d,outerVertices+b);
    for(const [x,y] of [[a,b],[b,d],[d,a]]){const key=[Math.min(x,y),Math.max(x,y)].join(',');if(edges.has(key))edges.delete(key);else edges.set(key,[x,y]);}
  }
  for(const [a,b] of edges.values())indices.push(b,a,outerVertices+a,b,outerVertices+a,outerVertices+b);
  g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.setIndex(indices);g.deleteAttribute('normal');g.computeVertexNormals();
  g.userData.lining={outerVertices,baseVertices,baseIndices,edges:Array.from(edges.values()),thickness};return g;
}
