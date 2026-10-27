import assert from 'node:assert/strict';
import {PilotModel} from '../game/pilot-model.js';
import {KitePhysics} from '../game/physics.js';
import {Vector3,Box3} from '../game/vendor/three.module.js';

const V=(x=0,y=0,z=0)=>new Vector3(x,y,z);
const triangleNormal=(g,offset)=>{
  const a=V().fromBufferAttribute(g.attributes.position,g.index.getX(offset));
  const b=V().fromBufferAttribute(g.attributes.position,g.index.getX(offset+1));
  const c=V().fromBufferAttribute(g.attributes.position,g.index.getX(offset+2));
  return b.sub(a).cross(c.sub(a)).normalize();
};
let poses=0;
for(let index=0;index<3;index++){
  const p=new KitePhysics(),m=new PilotModel(index);p.launch();p.position.set(0,12,-25);m.update(p,0);
  const support=m.arms[1],guide=m.arms[0],hold=support.palm.position.clone();
  for(const level of [0,1]){
    m.setDetail(level);m.update(p,.1);
    const face=m.face.geometry;
    assert.equal(face.attributes.uv.count,face.attributes.position.count);
    assert.ok(face.attributes.uv.array.every(x=>x>=0&&x<=1),'Atlas coordinates stay inside the cropped source textures');
    for(const hand of m.arms.map(a=>a.hand)){
      const g=hand.mesh.geometry,edges=new Map();
      for(let i=0;i<g.index.count;i+=3)for(let j=0;j<3;j++){
        const a=g.index.getX(i+j),b=g.index.getX(i+(j+1)%3),key=[Math.min(a,b),Math.max(a,b)].join(',');edges.set(key,(edges.get(key)||0)+1);
      }
      for(const n of edges.values())assert.equal(n,2,'The imported hand has no open wrist or finger edges');
      hand.curl=null;hand.pose(0);const open=g.attributes.position.array.slice();
      hand.curl=null;hand.pose(1);let moved=0;
      for(let i=0;i<open.length;i+=3){const displacement=Math.hypot(open[i]-g.attributes.position.array[i],open[i+1]-g.attributes.position.array[i+1],open[i+2]-g.attributes.position.array[i+2]);if(displacement>.005)moved++;}
      assert.ok(moved>40,'Closing the hand moves the actual finger mesh');
      const wrist=[];for(let i=0;i<open.length;i+=3)if(open[i+2]>.003)wrist.push(i);
      for(const i of wrist)assert.ok(Math.hypot(open[i]-g.attributes.position.array[i],open[i+1]-g.attributes.position.array[i+1],open[i+2]-g.attributes.position.array[i+2])<.001,'Finger flexion leaves the wrist attached to its arm');
    }
    support.hand.curl=null;guide.hand.curl=null;
    for(const action of ['hold','release','reel'])for(let step=0;step<12;step++){
      const time=1+poses*.02;p.action=action;p.lastTug=time-.12;p.rope.stressRatio=step/12;m.update(p,time);poses++;
      assert.ok(support.palm.position.distanceTo(hold)<1e-10,'The supporting hand stays on the fixed axle while the spool turns');
      assert.ok(m.outlet.getWorldPosition(V()).distanceTo(p.anchor)<1e-8,'Appearance changes cannot move the physical line anchor');
      for(const part of m.parts){
        const g=part.geometry,position=g.attributes.position,normal=g.attributes.normal,color=g.attributes.color;
        assert.equal(normal.count,position.count,'Added cloth details also receive normals');
        if(color)assert.equal(color.count,position.count,'Every added vertex has a colour');
        for(const a of [position,normal,color].filter(Boolean))assert.ok(a.array.every(Number.isFinite),'Animated appearance has finite buffers');
      }
    }
    const hand=support.hand.mesh,box=new Box3().setFromBufferAttribute(hand.geometry.attributes.position);box.applyMatrix4(hand.matrix).applyMatrix4(support.palm.matrix);
    assert.ok(box.min.y<1.21&&box.max.y>1.21&&box.min.z<-.40&&box.max.z>-.40,'The support hand surrounds the axle instead of floating beside it');
    const fingers=support.hand.mesh.geometry.attributes.position.array.slice();m.update(p,m.lastTime);assert.deepEqual(support.hand.mesh.geometry.attributes.position.array,fingers,'Paused fingers do not advance');
    p.eliminated=true;m.update(p,m.lastTime+.1);assert.ok(guide.palm.position.y<1.1);assert.ok(support.palm.position.distanceTo(hold)<1e-10);p.eliminated=false;
  }
}
console.log(`PASS: UV-mapped faces, closed imported hand topology, articulated finger motion, fixed axle grip, paused fingers, finite matched cloth/face buffers and exact line anchor in ${poses} animated poses.`);
