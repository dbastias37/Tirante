import * as THREE from './vendor/three.module.js';
// The ring's world radius is also the collection radius. Future rings are only
// breadcrumbs; they cannot be collected before the bright current target.
export class TrailView{
 constructor(scene){
  this.root=new THREE.Group();scene.add(this.root);
  const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const c=canvas.getContext('2d'),g=c.createRadialGradient(64,64,0,64,64,64);g.addColorStop(0,'rgba(255,255,228,1)');g.addColorStop(.12,'rgba(255,234,135,.95)');g.addColorStop(.35,'rgba(255,208,90,.35)');g.addColorStop(1,'rgba(255,196,70,0)');c.fillStyle=g;c.fillRect(0,0,128,128);const texture=new THREE.CanvasTexture(canvas);
  this.rings=Array.from({length:8},()=>{
   const group=new THREE.Group(),ring=new THREE.Mesh(new THREE.TorusGeometry(1,.012,6,80),new THREE.MeshBasicMaterial({color:0xffd17c,transparent:true,opacity:.9}));group.add(ring);
   const core=new THREE.Mesh(new THREE.OctahedronGeometry(.1),new THREE.MeshBasicMaterial({color:0xfff8d5}));group.add(core);
   const glow=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,color:0xffe1a0,transparent:true,depthWrite:false,opacity:.9}));glow.scale.setScalar(1.7);group.add(glow);this.root.add(group);return {group,ring,core,glow};
  });
  this.path=new THREE.Line(new THREE.BufferGeometry(),new THREE.LineDashedMaterial({color:0xffd59a,dashSize:.06,gapSize:.18,transparent:true,opacity:.27}));this.root.add(this.path);
  this.bursts=Array.from({length:8},()=>{const points=new THREE.Points(new THREE.BufferGeometry().setFromPoints(Array.from({length:16},()=>new THREE.Vector3())),new THREE.PointsMaterial({color:0xffde89,size:.065,transparent:true,depthWrite:false}));this.root.add(points);return points;});
 }
 update(trail,camera,time){
  this.root.visible=!!trail?.visible;if(!this.root.visible)return;
  this.rings.forEach((v,i)=>{
   const active=trail.active&&i===trail.index;v.group.visible=trail.active&&i>=trail.index&&i<=trail.index+2;if(!v.group.visible)return;
   v.group.position.copy(trail.points[i]);v.group.quaternion.copy(camera.quaternion);v.ring.scale.setScalar(trail.radius);v.ring.material.opacity=active?.9:.2;v.ring.material.color.set(active?0xffcd70:0xe8e9c6);
   v.core.visible=active;v.core.rotation.set(time*.8,time*1.3,0);v.glow.visible=active;v.glow.material.opacity=.7+Math.sin(time*4)*.15;v.glow.scale.setScalar(1.4+Math.sin(time*3)*.15);
  });
  this.path.visible=trail.active&&trail.index<7;if(this.path.visible&&this.pathIndex!==trail.index){this.pathIndex=trail.index;this.path.geometry.dispose();this.path.geometry=new THREE.BufferGeometry().setFromPoints(trail.points.slice(trail.index,trail.index+3));this.path.computeLineDistances();}
  this.bursts.forEach((mesh,i)=>{const b=trail.bursts[i],age=b?time-b.time:2;mesh.visible=age>=0&&age<1.2;if(!mesh.visible)return;mesh.position.copy(b.position);const a=mesh.geometry.attributes.position;for(let k=0;k<16;k++){const theta=k*2.39996,r=(.25+age*1.8)*Math.sqrt((k+.5)/16);a.setXYZ(k,Math.cos(theta)*r,Math.sin(theta)*r,Math.sin(k*1.7)*age*.7);}a.needsUpdate=true;mesh.material.opacity=1-age/1.2;});
 }
}
export function drawCanvasTrail(view,trail,time){
 if(!trail?.visible)return;const c=view.ctx,right=new THREE.Vector3(1,0,0).applyQuaternion(view.camera.quaternion),project=p=>view.project(p);
 c.save();
 if(trail.active){
  const route=trail.points.slice(trail.index,trail.index+3).map(project);c.strokeStyle='#fff0be70';c.lineWidth=1;c.setLineDash([2,8]);c.beginPath();let begun=false;for(const p of route){if(p.z>1){begun=false;continue;}if(begun)c.lineTo(p.x,p.y);else c.moveTo(p.x,p.y);begun=true;}c.stroke();c.setLineDash([]);
  for(let i=Math.min(trail.points.length-1,trail.index+2);i>=trail.index;i--){const pos=trail.points[i],p=project(pos),edge=project(pos.clone().addScaledVector(right,trail.radius));if(p.z>1)continue;const radius=Math.abs(edge.x-p.x);if(!Number.isFinite(radius)||radius>view.width*3)continue;
   const active=i===trail.index;c.globalAlpha=active?1:.25;c.strokeStyle=active?'#f8cd7f':'#fff8d8';c.lineWidth=active?2:1;c.beginPath();c.arc(p.x,p.y,Math.max(1,radius),0,Math.PI*2);c.stroke();
   if(active){const r=Math.max(8,radius*(.75+Math.sin(time*3)*.07)),g=c.createRadialGradient(p.x,p.y,0,p.x,p.y,r);g.addColorStop(0,'#ffffe8');g.addColorStop(.07,'#fff1b5');g.addColorStop(.2,'#fbd16b85');g.addColorStop(1,'#edb64900');c.fillStyle=g;c.fillRect(p.x-r,p.y-r,2*r,2*r);c.save();c.translate(p.x,p.y);c.rotate(time*.6);c.fillStyle='#fff9e1';c.beginPath();c.moveTo(0,-8);c.lineTo(3,-2);c.lineTo(8,0);c.lineTo(2,3);c.lineTo(0,8);c.lineTo(-3,2);c.lineTo(-8,0);c.lineTo(-2,-3);c.closePath();c.fill();c.restore();}
  }
 }
 for(const b of trail.bursts){const age=time-b.time,p=project(b.position);if(age<0||age>1.2||p.z>1)continue;c.globalAlpha=1-age/1.2;c.strokeStyle='#fff1b1';c.lineWidth=2;for(let k=0;k<12;k++){const theta=k*Math.PI/6,r=10+age*65;c.beginPath();c.moveTo(p.x+Math.cos(theta)*r,p.y+Math.sin(theta)*r);c.lineTo(p.x+Math.cos(theta)*(r+7),p.y+Math.sin(theta)*(r+7));c.stroke();}}
 c.restore();
}
