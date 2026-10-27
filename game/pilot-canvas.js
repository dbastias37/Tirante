import {Vector3,Color,Matrix3,DoubleSide,BackSide} from './vendor/three.module.js';
import {rasterTriangle} from './software-raster.js';

const sun=new Vector3(-.4,.7,-.5).normalize();
// The fallback renders the same meshes and articulated pose as WebGL.
// A small depth buffer is reused per visible person instead of painting sticks.
export function pilotFaces(model,camera,width,height){
  const result=[],normal=new Vector3(),normalMatrix=new Matrix3(),color=new Color();
  let left=Infinity,top=Infinity,right=-Infinity,bottom=-Infinity;
  for(const m of model.parts){
    if(m===model.shadow)continue;
    const g=m.geometry,p=g.attributes.position,index=g.index,n=g.attributes.normal,colors=g.attributes.color,uv=g.attributes.uv,texture=uv?m.material.userData.pixels:null,mirrored=m.matrixWorld.determinant()<0;normalMatrix.getNormalMatrix(m.matrixWorld);
    const cache=m.userData.canvasVertices||(m.userData.canvasVertices=Array.from({length:p.count},()=>({world:new Vector3(),screen:new Vector3(),rgb:[0,0,0]})));
    for(let i=0;i<p.count;i++){
      const q=cache[i];q.world.fromBufferAttribute(p,i).applyMatrix4(m.matrixWorld);q.screen.copy(q.world).project(camera);q.screen.x=(q.screen.x*.5+.5)*width;q.screen.y=(.5-q.screen.y*.5)*height;
      if(texture){const e=camera.matrixWorldInverse.elements;q.screen.u=uv.getX(i);q.screen.v=uv.getY(i);q.screen.w=-1/(e[2]*q.world.x+e[6]*q.world.y+e[10]*q.world.z+e[14]);}
      normal.fromBufferAttribute(n,i).applyMatrix3(normalMatrix).normalize();const shade=.60+.40*Math.max(0,normal.dot(sun));
      color.copy(m.material.color);if(colors&&m.material.vertexColors){color.r*=colors.getX(i);color.g*=colors.getY(i);color.b*=colors.getZ(i);}color.multiplyScalar(shade).convertLinearToSRGB();
      q.rgb[0]=color.r*255;q.rgb[1]=color.g*255;q.rgb[2]=color.b*255;
    }
    for(let i=0;i<index.count;i+=3){
      const points=[0,1,2].map(j=>cache[index.getX(i+j)]);if(points.some(q=>q.screen.z<-1||q.screen.z>1))continue;
      const [a,b,c]=points.map(q=>q.screen),area=(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x),front=mirrored?area>0:area<0;
      if(m.material.side!==DoubleSide&&(m.material.side===BackSide?front:!front))continue;
      for(const q of points){left=Math.min(left,q.screen.x);right=Math.max(right,q.screen.x);top=Math.min(top,q.screen.y);bottom=Math.max(bottom,q.screen.y);}
      result.push({points:points.map(q=>q.screen),rgb:points[0].rgb,colors:points.map(q=>q.rgb),texture});
    }
  }
  return {faces:result,left,top,right,bottom};
}
export function rasterPilot(view,target){
  target.data.fill(0);target.depth.fill(Infinity);
  const w=view.right-view.left+4,h=view.bottom-view.top+4;
  for(const f of view.faces){const q=f.points.map(p=>({x:(p.x-view.left+2)/w*target.width,y:(p.y-view.top+2)/h*target.height,z:p.z,u:p.u,v:p.v,w:p.w}));rasterTriangle(target,q[0],q[1],q[2],f.colors[0],f.colors[1],f.colors[2],f.texture);}
}
export const pilotRasterHeight=view=>view.bottom-view.top>320?432:view.bottom-view.top>192?288:view.bottom-view.top>96?192:96;
export class PilotCanvas{
  constructor(){
    // Reusable sizes: a distant 60 px pilot does not need a 288 px buffer.
    this.buffers=new Map([96,192,288,432].map(height=>{
      const width=height*2/3,canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
      const ctx=canvas.getContext('2d'),image=ctx.createImageData(width,height);
      return [height,{canvas,ctx,image,target:{width,height,data:image.data,depth:new Float32Array(width*height)}}];
    }));
  }
  draw(ctx,model,camera,width,height){
    const center=model.group.position.clone().add(new Vector3(0,.9,0)).project(camera);if(center.z<-1||center.z>1||Math.abs(center.x)>1.4||Math.abs(center.y)>2)return;
    const view=pilotFaces(model,camera,width,height);if(!view.faces.length||view.right<0||view.left>width||view.bottom<0||view.top>height)return;
    const project=(x,y)=>{const q=new Vector3(x,y,0).applyMatrix4(model.shadow.matrixWorld).project(camera);return {x:(q.x*.5+.5)*width,y:(.5-q.y*.5)*height,z:q.z};};
    const o=project(0,0),x=project(1,0),y=project(0,1);
    if(o.z>=-1&&o.z<=1){
      ctx.save();ctx.transform(x.x-o.x,x.y-o.y,y.x-o.x,y.y-o.y,o.x,o.y);
      const shade=ctx.createRadialGradient(0,0,0,0,0,1);shade.addColorStop(0,'rgba(33,67,47,.22)');shade.addColorStop(.5,'rgba(33,67,47,.11)');shade.addColorStop(1,'rgba(33,67,47,0)');ctx.fillStyle=shade;ctx.beginPath();ctx.arc(0,0,1,0,Math.PI*2);ctx.fill();ctx.restore();
    }
    const buffer=this.buffers.get(pilotRasterHeight(view));rasterPilot(view,buffer.target);buffer.ctx.putImageData(buffer.image,0,0);ctx.drawImage(buffer.canvas,view.left-2,view.top-2,view.right-view.left+4,view.bottom-view.top+4);
  }
}
