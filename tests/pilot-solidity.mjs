import assert from 'node:assert/strict';
import {PilotModel} from '../game/pilot-model.js';
import {KitePhysics} from '../game/physics.js';
import {Vector3,Vector2,PerspectiveCamera,Raycaster,Box3,FrontSide} from '../game/vendor/three.module.js';

const V=(x=0,y=0,z=0)=>new Vector3(x,y,z);
function manifold(indices){
  const edges=new Map();for(let i=0;i<indices.length;i+=3)for(let j=0;j<3;j++){const a=indices[i+j],b=indices[i+(j+1)%3],key=[Math.min(a,b),Math.max(a,b)].join(',');edges.set(key,(edges.get(key)||0)+1);}
  for(const count of edges.values())assert.equal(count,2,'A solid surface has two faces at every edge');
}
function probeTube(tube,rows){
  const mesh=tube.mesh,p=mesh.geometry.attributes.position;
  assert.equal(mesh.material.side,FrontSide,'The repair uses outward-facing solid geometry');
  manifold(mesh.geometry.index.array);
  for(const row of rows){
    const center=V(),next=V();for(let i=0;i<tube.sides;i++){center.add(V().fromBufferAttribute(p,row*tube.sides+i));next.add(V().fromBufferAttribute(p,(row+1)*tube.sides+i));}center.divideScalar(tube.sides);next.divideScalar(tube.sides);
    const u=V().fromBufferAttribute(p,row*tube.sides).sub(center).normalize(),v=V().fromBufferAttribute(p,row*tube.sides+tube.sides/4).sub(center).normalize();center.lerp(next,.37).applyMatrix4(mesh.matrixWorld);
    for(let i=0;i<tube.sides;i+=2){
      const angle=(i+.37)/tube.sides*Math.PI*2,out=u.clone().multiplyScalar(Math.cos(angle)).addScaledVector(v,Math.sin(angle)).transformDirection(mesh.matrixWorld);
      const hits=new Raycaster(center.clone().addScaledVector(out,.3),out.clone().negate(),0,.5).intersectObject(mesh,false);
      assert.ok(hits.length,`No view through ${mesh.name} at ring ${row}, angle ${i}, center ${center.toArray()} with WebGL face culling`);
    }
  }
}
let poses=0;
for(let index=0;index<3;index++){
  const p=new KitePhysics(),m=new PilotModel(index);p.launch();p.position.set(0,15,-25);m.update(p,0);
  for(const leg of m.legs){const direction=V(0,0,-1).applyQuaternion(leg.shoe.quaternion);assert.ok(direction.z<-.99&&direction.x*leg.s>0,'Both toes face forward, slightly outward on their own anatomical side');}
  const handle=m.reel.getObjectByName('reel-fixed-handle');handle.updateMatrix();const box=new Box3().setFromBufferAttribute(handle.geometry.attributes.position).applyMatrix4(handle.matrix);
  assert.ok(box.min.x>=-.091&&box.max.x>.20&&box.max.x<.22,'Only the supporting-hand side has an exposed handle');
  for(const level of [0,1]){
    m.setDetail(level);const cloth=m.garment.levels[level],g=cloth.geometry,{baseIndices,baseVertices,outerVertices,edges}=g.userData.lining;
    manifold([...g.index.array.slice(0,baseIndices),...g.index.array.slice(-(baseIndices+edges.length*6))]);
    for(let v=0;v<baseVertices;v++)for(let k=0;k<3;k++){
      assert.equal(cloth.weights[(outerVertices+v)*3+k],cloth.weights[v*3+k],'Lining deforms with its outer cloth vertex');
      assert.equal(cloth.bones[(outerVertices+v)*3+k],cloth.bones[v*3+k]);
    }
    for(let pose=0;pose<9;pose++){
      const t=1+poses*.07;p.position.set(Math.sin(pose)*12,pose%3===0?2:pose%3===1?16:65,-25);p.action=['hold','reel','release'][pose%3];p.lastTug=t-.12;p.eliminated=pose===8;p.state=pose===8?'cut':'flying';m.update(p,t);poses++;
      for(const arm of m.arms)probeTube(arm.surface.surface,[5,6,7,11,12]);probeTube(m.neckSurface.surface,[1,2,3]);
      // Probe the actual head/neck union, including the area above the old
      // neck cap that was exposed from below at a steep upward look.
      for(const y of [.035,.060,.085])for(let k=0;k<12;k++){
        const angle=(k+.31)/12*Math.PI*2,center=V(0,y,-.01).applyMatrix4(m.head.matrixWorld),out=V(Math.cos(angle),0,Math.sin(angle)).transformDirection(m.head.matrixWorld);
        const hits=new Raycaster(center.clone().addScaledVector(out,.22),out.clone().negate(),0,.22).intersectObjects([m.face,m.neck],false);
        assert.ok(hits.length,`The jaw/neck union is filled at height ${y}, angle ${k}, pilot ${index}, detail ${level}`);
      }
      for(const x of [-.0213,.0037,.0191]){
        const origin=V(x,-.025,.0093).applyMatrix4(m.head.matrixWorld),up=V(0,1,0).transformDirection(m.head.matrixWorld);
        assert.ok(new Raycaster(origin,up,0,.060).intersectObject(m.face,false).length,`The cut head has a skin cap below its throat: pilot ${index}, detail ${level}, pose ${pose}, x ${x}`);
      }
      // From outside the chest, the cloth must cover its solid inner body.
      for(const y of [.28,.35,.42])for(const s of [-1,1]){
        const origin=V(s*.6,y,0).applyMatrix4(m.body.matrixWorld),direction=V(-s,0,0).transformDirection(m.body.matrixWorld);
        const hits=new Raycaster(origin,direction,0,.7).intersectObjects([m.garment.mesh,m.underbody],false);
        assert.ok(hits.length&&hits[0].object===m.garment.mesh,`Cloth covers the torso at ${y}, side ${s}, pilot ${index}, pose ${pose}`);
      }
      assert.ok(m.outlet.getWorldPosition(V()).distanceTo(p.anchor)<1e-8);
      for(const part of m.parts){const {position,normal}=part.geometry.attributes;assert.equal(position.count,normal.count);assert.ok(position.array.every(Number.isFinite)&&normal.array.every(Number.isFinite));}
    }
    // From inside the back of a hood or shirt, its lining is visible rather
    // than relying on a double-sided material that still has no thickness.
    const pos=g.attributes.position;let checked=false;
    for(let i=0;i<baseIndices&&!checked;i+=3){
      const ids=[0,1,2].map(k=>g.index.getX(i+k));if(!ids.every(j=>Math.abs(cloth.rest[j*3])<.12&&cloth.rest[j*3+2]>.04))continue;
      const [a,b,c]=ids.map(j=>V().fromBufferAttribute(pos,j)),center=a.clone().add(b).add(c).divideScalar(3),normal=b.clone().sub(a).cross(c.clone().sub(a)).normalize();
      const origin=center.clone().addScaledVector(normal,-.015).applyMatrix4(m.garment.mesh.matrixWorld),direction=normal.transformDirection(m.garment.mesh.matrixWorld);
      const hits=new Raycaster(origin,direction,0,.03).intersectObject(m.garment.mesh,false);assert.ok(hits.length,'The interior lining stops an inside-to-outside ray');checked=true;
    }
    assert.ok(checked);p.eliminated=false;
  }
}
// Regression for the dark lining patches visible on the outside of a bent
// sleeve. Scan both side views and both LODs; isolated silhouette grazing is
// tolerated, but an exposed interior patch may not cover 2% of the elbow.
for(const index of [0,2])for(const side of [-1,1])for(const detail of [0,1]){
 const p=new KitePhysics(),m=new PilotModel(index);p.launch();p.position.set(0,12,-25);m.setDetail(detail);m.update(p,0);m.group.updateMatrixWorld(true);
 const target=m.group.position.clone().add(V(0,1.43,-.15)),camera=new PerspectiveCamera(35,400/520,.01,100);camera.position.copy(target).add(V(1.32*side,.02,-.18));camera.lookAt(target);camera.updateMatrixWorld();
 const ray=new Raycaster(),cloth=m.garment.levels[detail],lining=cloth.geometry.userData.lining;let inside=0,outside=0;
 for(let y=330;y<515;y+=5)for(let x=60;x<240;x+=5){
  ray.setFromCamera(new Vector2(x/400*2-1,1-y/520*2),camera);const hit=ray.intersectObject(m.garment.mesh)[0];if(!hit)continue;
  const ids=[hit.face.a,hit.face.b,hit.face.c],inner=ids.every(i=>i>=lining.outerVertices),rest=ids.map(i=>cloth.rest[(inner?i-lining.outerVertices:i)*3]);
  if(!rest.every(x=>Math.abs(x)>.37&&Math.abs(x)<.61))continue;if(inner)inside++;else outside++;
 }
 assert.ok(outside>30);assert.ok(inside/(inside+outside)<.02,`Exposed sleeve lining: ${index}, ${side}, ${detail}: ${inside}/${outside}`);
}
console.log(`PASS: closed skin and fabric topology, front-face raycasts around elbows/wrists/neck, lining attachment, outward shoe heading and one-sided handle in ${poses} poses.`);
