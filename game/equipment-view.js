import * as T from './vendor/three.module.js';
import {equipmentModel,disposeModel} from './equipment-models.js';
import {rasterTriangle} from './software-raster.js';
export class EquipmentView{
  constructor(canvas,webgl=true){
    this.canvas=canvas;this.angle=.55;this.tilt=-.24;this.auto=true;this.drag=null;this.clock=0;this.camera=new T.PerspectiveCamera(38,1,.1,20);this.camera.position.set(0,.12,4.25);this.camera.lookAt(0,0,0);this.scene=new T.Scene();
    if(webgl)try{this.renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:true});this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));this.renderer.outputColorSpace=T.SRGBColorSpace;this.scene.add(new T.HemisphereLight(0xfff5da,0x52635e,2.5));const light=new T.DirectionalLight(0xffffff,3);light.position.set(-3,5,4);this.scene.add(light);const rim=new T.DirectionalLight(0xd5e7ec,1.5);rim.position.set(3,1,-3);this.scene.add(rim);}catch{this.renderer=null;}
    if(!this.renderer)this.ctx=canvas.getContext('2d');
    canvas.addEventListener('pointerdown',e=>{e.preventDefault();this.drag={id:e.pointerId,x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);});
    canvas.addEventListener('pointermove',e=>{if(this.drag?.id!==e.pointerId)return;this.angle+=(e.clientX-this.drag.x)*.012;this.tilt=Math.max(-1.1,Math.min(1.1,this.tilt+(e.clientY-this.drag.y)*.008));this.drag.x=e.clientX;this.drag.y=e.clientY;});
    for(const event of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(event,()=>this.drag=null);
  }
  set(category,setup){if(this.model){this.scene.remove(this.model);disposeModel(this.model);}this.model=equipmentModel(category,setup);this.scene.add(this.model);this.angle=.55;this.tilt=category==='thread'?-.42:-.20;this.faces=null;this.canvas.setAttribute('aria-label',`Modelo tridimensional de ${category==='thread'?'bobina de hilo':category==='reel'?'carrete de madera':'rodamiento'}. Arrastra para girar 360 grados.`);if(!this.renderer)this.prepareSoftware();}
  resize(){const rect=this.canvas.getBoundingClientRect(),w=Math.max(1,Math.round(rect.width)),h=Math.max(1,Math.round(rect.height));if(w===this.width&&h===this.height)return;this.width=w;this.height=h;this.camera.aspect=w/h;this.camera.updateProjectionMatrix();if(this.renderer)this.renderer.setSize(w,h,false);else{this.canvas.width=Math.round(w);this.canvas.height=Math.round(h);this.image=this.ctx.createImageData(this.canvas.width,this.canvas.height);this.raster={width:this.canvas.width,height:this.canvas.height,data:this.image.data,depth:new Float32Array(this.canvas.width*this.canvas.height)};}}
  prepareSoftware(){this.faces=[];this.model.updateMatrixWorld(true);const p=new T.Vector3();this.model.traverse(m=>{if(!m.isMesh)return;const g=m.geometry,a=g.attributes.position,c=g.attributes.color,n=g.index,base=m.material.color;for(let i=0;i<(n?n.count:a.count);i+=3){const vertices=[],rgb=[0,0,0];for(let j=0;j<3;j++){const k=n?n.getX(i+j):i+j;p.fromBufferAttribute(a,k).applyMatrix4(m.matrixWorld);vertices.push(p.clone());rgb[0]+=base.r*(c?c.getX(k):1)/3;rgb[1]+=base.g*(c?c.getY(k):1)/3;rgb[2]+=base.b*(c?c.getZ(k):1)/3;}this.faces.push({vertices,rgb,world:vertices.map(p=>p.clone()),screen:vertices.map(p=>p.clone()),color:new T.Color()});}});}
  frame(dt){if(!this.model)return;this.resize();if(this.auto&&!this.drag)this.angle+=dt*.42;this.model.rotation.set(this.tilt,this.angle,.04);if(this.renderer){this.renderer.render(this.scene,this.camera);return;}this.clock+=dt;if(this.clock<1/20)return;this.clock=0;this.drawSoftware();}
  drawSoftware(){
    if(!this.ctx||!this.raster)return;
    const target=this.raster;target.data.fill(0);target.depth.fill(Infinity);
    this.model.updateMatrix();this.camera.updateMatrixWorld();
    const light=new T.Vector3(-.4,.7,1).normalize(),edge1=new T.Vector3(),edge2=new T.Vector3(),normal=new T.Vector3(),rgb=[0,0,0];
    for(const f of this.faces){
      const world=f.world,screen=f.screen;
      for(let i=0;i<3;i++){world[i].copy(f.vertices[i]).applyMatrix4(this.model.matrix);screen[i].copy(world[i]).project(this.camera);screen[i].x=(screen[i].x*.5+.5)*target.width;screen[i].y=(.5-screen[i].y*.5)*target.height;}
      normal.crossVectors(edge1.subVectors(world[1],world[0]),edge2.subVectors(world[2],world[0])).normalize();
      const shade=.48+.52*Math.abs(normal.dot(light)),color=f.color.setRGB(...f.rgb).multiplyScalar(shade).convertLinearToSRGB();
      rgb[0]=Math.round(color.r*255);rgb[1]=Math.round(color.g*255);rgb[2]=Math.round(color.b*255);
      rasterTriangle(target,screen[0],screen[1],screen[2],rgb);
    }
    this.ctx.putImageData(this.image,0,0);
  }
}
