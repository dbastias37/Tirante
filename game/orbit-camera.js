import {Vector3} from './vendor/three.module.js';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export class OrbitCamera{
  constructor(){this.active=false;this.reset();}
  reset(){this.yaw=.25;this.pitch=.24;this.distance=6;}
  drag(dx,dy){this.yaw-=dx*.005;this.pitch=clamp(this.pitch+dy*.004,-1.05,1.35);}
  zoom(delta){this.distance=clamp(this.distance*Math.exp(clamp(delta,-400,400)*.002),2,24);}
  frame(camera,position,dt){
    const r=this.distance,c=Math.cos(this.pitch),eye=new Vector3(Math.sin(this.yaw)*c*r,Math.sin(this.pitch)*r,Math.cos(this.yaw)*c*r).add(position);eye.y=Math.max(.55,eye.y);
    camera.position.lerp(eye,1-Math.exp(-dt*9));return {target:position.clone(),fov:camera.aspect<.8?68:57};
  }
}
