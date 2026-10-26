import {Vector3,Color} from './vendor/three.module.js';
import {rasterTriangle} from './software-raster.js';

const sun=new Vector3(-.4,.7,-.5).normalize();
// The fallback renders the same meshes and articulated pose as WebGL.
// A small depth buffer is reused per visible person instead of painting sticks.
export function pilotFaces(model,camera,width,height){
  const result=[],a=new Vector3(),b=new Vector3(),normal=new Vector3(),color=new Color();
  let left=Infinity,top=Infinity,right=-Infinity,bottom=-Infinity;
  for(const m of model.parts){
    const g=m.geometry,p=g.attributes.position,index=g.index;
    const cache=m.userData.canvasVertices||(m.userData.canvasVertices=Array.from({length:p.count},()=>({world:new Vector3(),screen:new Vector3()})));
    for(let i=0;i<p.count;i++){const q=cache[i];q.world.fromBufferAttribute(p,i).applyMatrix4(m.matrixWorld);q.screen.copy(q.world).project(camera);q.screen.x=(q.screen.x*.5+.5)*width;q.screen.y=(.5-q.screen.y*.5)*height;}
    for(let i=0;i<index.count;i+=3){
      const points=[0,1,2].map(j=>cache[index.getX(i+j)]);if(points.some(q=>q.screen.z<-1||q.screen.z>1))continue;
      normal.crossVectors(a.subVectors(points[1].world,points[0].world),b.subVectors(points[2].world,points[0].world)).normalize();
      const shade=.60+.40*Math.max(0,normal.dot(sun));color.copy(m.material.color).multiplyScalar(shade).convertLinearToSRGB();
      for(const q of points){left=Math.min(left,q.screen.x);right=Math.max(right,q.screen.x);top=Math.min(top,q.screen.y);bottom=Math.max(bottom,q.screen.y);}
      result.push({points:points.map(q=>q.screen),rgb:[Math.round(color.r*255),Math.round(color.g*255),Math.round(color.b*255)]});
    }
  }
  return {faces:result,left,top,right,bottom};
}
export function rasterPilot(view,target){
  target.data.fill(0);target.depth.fill(Infinity);
  const w=view.right-view.left+4,h=view.bottom-view.top+4;
  for(const f of view.faces){const q=f.points.map(p=>({x:(p.x-view.left+2)/w*target.width,y:(p.y-view.top+2)/h*target.height,z:p.z}));rasterTriangle(target,q[0],q[1],q[2],f.rgb);}
}
export class PilotCanvas{
  constructor(){this.canvas=document.createElement('canvas');this.canvas.width=192;this.canvas.height=288;this.ctx=this.canvas.getContext('2d');this.image=this.ctx.createImageData(192,288);this.target={width:192,height:288,data:this.image.data,depth:new Float32Array(192*288)};}
  draw(ctx,model,camera,width,height){
    const center=model.group.position.clone().add(new Vector3(0,.9,0)).project(camera);if(center.z<-1||center.z>1||Math.abs(center.x)>1.4||Math.abs(center.y)>2)return;
    const view=pilotFaces(model,camera,width,height);if(!view.faces.length||view.right<0||view.left>width||view.bottom<0||view.top>height)return;
    rasterPilot(view,this.target);this.ctx.putImageData(this.image,0,0);ctx.drawImage(this.canvas,view.left-2,view.top-2,view.right-view.left+4,view.bottom-view.top+4);
  }
}
