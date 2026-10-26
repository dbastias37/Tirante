import {bowHeight,sailZ,bridleAnchors,bridleJunction,SPAR_OFFSET} from './kite-shape.js';
import {appearance,paperColor} from './appearance.js';
import {cachedSailArt,texturedTriangle} from './sail-art.js';
import {OrbitCamera} from './orbit-camera.js';
import {spectatorView,onboardFrame} from './spectator-camera.js';
import {ArticulatedTail} from './tail.js';
import {reelViewport,canvasReelOutlet,foregroundLine} from './reel-view.js';
import {displayStrands} from './rope-view.js';
import {PilotModel} from './pilot-model.js';
import {PilotCanvas} from './pilot-canvas.js';
import {equipmentStats} from './equipment.js';
import {drawCanvasTrail} from './trail-view.js';
import {frameDuel,positionView,pilotFocusTarget} from './duel-camera.js';
// Software perspective renderer for browsers without an available WebGL context.
// The physical state and camera remain three-dimensional in both renderers.
import {Vector3,PerspectiveCamera,Quaternion,Euler} from './vendor/three.module.js';
import {clamp,mix,configuration} from './physics.js';
import {PAPER_OPACITY,CAMERA_NEAR,CAMERA_FAR,HORIZON_RADIUS,renderPixelRatio,terrainHeight} from './render-settings.js';
const v=(x=0,y=0,z=0)=>new Vector3(x,y,z);
function random(seed){return()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};}
export class CanvasLandscape {
  constructor(canvas,physics){
    this.canvas=canvas;this.physics=physics;this.ctx=canvas.getContext('2d',{alpha:false});if(!this.ctx)throw new Error('Canvas unavailable');
    this.camera=new PerspectiveCamera(50,1,CAMERA_NEAR,CAMERA_FAR);this.targetCamera=new PerspectiveCamera();this.camera.position.set(0,1.72,1.1);this.camera.lookAt(0,3.8,-24);
    this.forward=v();this.follow=true;this.zoom=false;this.orbit=new OrbitCamera();this.yaw=0;this.pitch=.1;this.setup={...physics.setup};this.kitePosition=v();this.kiteRotation=new Quaternion();this.tmp=v();this.tails=new WeakMap();this.pilots=Array.from({length:3},(_,i)=>new PilotModel(i));this.pilotCanvas=new PilotCanvas();
    const r=random(1955);
    this.trees=Array.from({length:18},(_,i)=>{const angle=i/18*Math.PI*2+(r()-.5)*.12,radius=210+r()*80;return {x:Math.sin(angle)*radius,z:Math.cos(angle)*radius,h:4+r()*5,phase:r()*6};});
    this.clouds=Array.from({length:10},()=>({x:(r()-.5)*180,y:30+r()*35,z:-80-r()*100,size:10+r()*15}));
    this.resize();this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(document.body);
  }
  resize(){this.width=innerWidth;this.height=innerHeight;this.ratio=renderPixelRatio(devicePixelRatio,this.inDuel);this.canvas.width=Math.round(this.width*this.ratio);this.canvas.height=Math.round(this.height*this.ratio);this.camera.aspect=this.width/this.height;this.camera.updateProjectionMatrix();}
  configure(s){this.setup={...s};}
  drag(dx,dy){if(spectatorView(this.physics,this.duel).onboard)return;if(this.orbit.active||spectatorView(this.physics,this.duel).orbital){this.orbit.drag(dx,dy);return;}if(this.follow){this.camera.getWorldDirection(this.forward);this.yaw=Math.atan2(this.forward.x,-this.forward.z);this.pitch=Math.asin(this.forward.y);}this.follow=false;this.yaw-=dx*.0035;this.pitch=clamp(this.pitch+dy*.003,-.35,1.4);}
  project(point){const q=point.clone().project(this.camera);return {x:(q.x*.5+.5)*this.width,y:(.5-q.y*.5)*this.height,z:q.z};}
  local(x,y,z=0){return v(x,y,z).multiplyScalar(this.kiteScale).applyQuaternion(this.kiteRotation).add(this.kitePosition);}
  polygon(points,fill,stroke,width=1){const c=this.ctx;const ps=points.map(p=>this.project(p));if(ps.some(p=>p.z>1||!Number.isFinite(p.x+p.y)))return;c.beginPath();ps.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.closePath();if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=width;c.stroke();}}
  line(points,color,width=1){const c=this.ctx;c.beginPath();let started=false;for(const point of points){const p=this.project(point);if(p.z>1){started=false;continue;}if(started)c.lineTo(p.x,p.y);else c.moveTo(p.x,p.y);started=true;}c.strokeStyle=color;c.lineWidth=width;c.lineCap='round';c.stroke();}
  drawSky(time){
    const c=this.ctx,w=this.width,h=this.height,direction=this.camera.getWorldDirection(v()),yaw=Math.atan2(direction.x,-direction.z);const horizon=this.project(v(this.camera.position.x+Math.sin(yaw)*10000,0,this.camera.position.z-Math.cos(yaw)*10000)).y;
    const sky=c.createLinearGradient(0,0,0,Math.max(h,horizon));sky.addColorStop(0,'#9fc6d3');sky.addColorStop(.6,'#c4d8d4');sky.addColorStop(1,'#e4e4c9');c.fillStyle=sky;c.fillRect(0,0,w,h);
    const glow=c.createRadialGradient(w*.23,h*.04,3,w*.23,h*.04,w*.7);glow.addColorStop(0,'rgba(255,246,214,.3)');glow.addColorStop(1,'rgba(255,246,214,0)');c.fillStyle=glow;c.fillRect(0,0,w,h);
    for(const cloud of this.clouds){const p=this.project(v(cloud.x+Math.sin(time*.008)*9,cloud.y,cloud.z));if(p.z>1)continue;const size=this.height/Math.abs(cloud.z)*cloud.size;c.save();c.translate(p.x,p.y);c.scale(1,.22);const gradient=c.createRadialGradient(0,0,0,0,0,size);gradient.addColorStop(0,'rgba(255,252,232,.28)');gradient.addColorStop(.5,'rgba(255,252,232,.15)');gradient.addColorStop(1,'rgba(255,252,232,0)');c.fillStyle=gradient;c.beginPath();c.ellipse(0,0,size,size,0,0,Math.PI*2);c.fill();c.restore();}
    if(horizon<h+200){
      for(let layer=0;layer<4;layer++){
        // A full panorama stays in front of an orbital view. Projecting the old
        // fixed strip behind the camera inverted the hills into giant wedges.
        const points=[];for(let i=0;i<=72;i++){const angle=yaw-Math.PI*.48+i/72*Math.PI*.96,radius=HORIZON_RADIUS+(3-layer)*45,alt=18+Math.sin(angle*5+layer)*9+Math.sin(angle*11+layer)*5;const p=this.project(v(this.camera.position.x+Math.sin(angle)*radius,alt,this.camera.position.z-Math.cos(angle)*radius));if(p.z<1&&Number.isFinite(p.x+p.y))points.push(p);}points.sort((a,b)=>a.x-b.x);
        if(points.length){c.beginPath();c.moveTo(points[0].x,h+200);for(const p of points)c.lineTo(p.x,p.y);c.lineTo(points.at(-1).x,h+200);c.closePath();c.fillStyle=['#b5c5bb','#a6bba9','#90a584','#899666'][layer];c.fill();}
      }
      const ground=c.createLinearGradient(0,Math.max(0,horizon),0,h);ground.addColorStop(0,'#84a265');ground.addColorStop(.6,'#70994f');ground.addColorStop(1,'#568240');c.beginPath();c.moveTo(0,horizon+18);c.bezierCurveTo(w*.3,horizon-3,w*.7,horizon+30,w,horizon+11);c.lineTo(w,h);c.lineTo(0,h);c.closePath();c.fillStyle=ground;c.fill();
      const left=[],right=[];for(let z=-350;z<1;z+=4){const x=3+Math.sin(-z*.045)*3;left.push(v(x-.7,terrainHeight(x-.7,z),z));right.push(v(x+.7,terrainHeight(x+.7,z),z));}this.polygon([...left,...right.reverse()],'#c7bfa026');
      for(const tree of this.trees){const base=terrainHeight(tree.x,tree.z),p=this.project(v(tree.x,base,tree.z)),top=this.project(v(tree.x,base+tree.h,tree.z)),height=p.y-top.y;if(p.z>1||height<0)continue;c.fillStyle='#637b5c';c.fillRect(p.x-1,top.y,height*.03,height);for(let i=0;i<3;i++){c.beginPath();c.ellipse(p.x+Math.sin(i*4+tree.phase)*height*.12,top.y+height*(.25+i*.13),height*(.27-i*.035),height*.22,0,0,Math.PI*2);c.fillStyle=['#738b68','#7d9270','#849976'][i];c.fill();}}
      this.line([v(-5.6,0,-9),v(-5.6,2.7,-9)],'#837354',2.5);const strength=this.physics.profile==='calm'?0:clamp(this.physics.windSpeed/5,0,1);this.line(Array.from({length:16},(_,i)=>{const t=i/15;return v(-5.6+Math.sin(time*4+t*8)*.06*t,2.65-t*(1-strength*.7),-9-t*strength);}), '#bd8959',5);
    }
  }
  drawKite(time,intro,p=this.physics,setup=this.setup){
    const c=this.ctx,bend=intro?.4:p.bend,wind=p.wind.length(),color=paperColor(setup),a=appearance(setup);
    const corners=[[0,.4],[.4,0],[0,-.4],[-.4,0]],center=this.local(0,0,0);
    const point=([x,y],offset=0)=>this.local(x,y,sailZ(x,y,time,bend,wind)+offset);
    const facing=v(0,0,1).applyQuaternion(this.kiteRotation).dot(this.camera.position.clone().sub(this.kitePosition))>=0;
    const junction=this.local(...bridleJunction(configuration(setup))),anchors=bridleAnchors(setup,time,bend,wind).map(a=>this.local(...a));
    const drawBridle=()=>anchors.forEach((a,i)=>{this.line([a,junction],'#e5d9ae',.8);const key=['knotsLeft','knotsRight','knotsLower'][i];for(let k=0;k<setup[key];k++){const knot=this.project(a.clone().lerp(junction,.38+k*.11));if(knot.z>1)continue;c.beginPath();c.arc(knot.x,knot.y,1.5,0,Math.PI*2);c.fillStyle='#af7d3a';c.fill();}});
    const drawSpars=()=>{
      this.line([point([0,-.4],SPAR_OFFSET),point([0,.4],SPAR_OFFSET)],'#94744f',1.2);
      this.line(Array.from({length:21},(_,i)=>{const x=-.4+i*.04;return point([x,bowHeight(x)],SPAR_OFFSET);}), '#94744f',1.3);
    };
    if(facing)drawSpars();else drawBridle();
    c.save();c.globalAlpha=PAPER_OPACITY;
    // Printed art already contains the paper background: composite it once,
    // so an image does not accidentally make the sail more opaque.
    if(a.sailStyle==='image'&&a.printId){
      const image=cachedSailArt(setup).canvas,n=4;
      for(let sector=0;sector<4;sector++){
        const A=corners[sector],B=corners[(sector+1)%4],vertex=(i,j)=>[A[0]*i/n+B[0]*j/n,A[1]*i/n+B[1]*j/n];
        const triangle=vertices=>texturedTriangle(c,image,vertices.map(([x,y])=>({x:(x+.4)/.8*image.width,y:(.4-y)/.8*image.height})),vertices.map(v=>this.project(point(v))));
        for(let i=0;i<n;i++)for(let j=0;j<n-i;j++){triangle([vertex(i,j),vertex(i+1,j),vertex(i,j+1)]);if(i+j<n-1)triangle([vertex(i+1,j),vertex(i+1,j+1),vertex(i,j+1)]);}
      }
    }else for(let i=0;i<4;i++)this.polygon([center,point(corners[i]),point(corners[(i+1)%4])],a.sailStyle==='classic'&&i%2?'#f8efd8':color);
    c.restore();
    if(facing)drawBridle();else drawSpars();
    this.line([...corners,corners[0]].map(p=>point(p)),'#8f7b5844',.7);
    if(setup.tail){let tail=this.tails.get(p);if(!tail){tail=new ArticulatedTail();this.tails.set(p,tail);}const points=tail.update(time,this.kitePosition,this.kiteRotation,p.wind,p.velocity,this.kiteScale);this.line(tail.points,color,1.9);for(let i=4;i<=20;i+=4){const q=points[i],twist=Math.sin(time*4-i*.6),x=Math.cos(twist)*.047,z=Math.sin(twist)*.047;this.polygon([this.local(q.x,q.y,q.z),this.local(q.x-x,q.y+.023,q.z-z),this.local(q.x-x,q.y-.023,q.z-z)],color);this.polygon([this.local(q.x,q.y,q.z),this.local(q.x+x,q.y+.023,q.z+z),this.local(q.x+x,q.y-.023,q.z+z)],color);}}
    return junction;
  }
  drawRival(time){
    const duel=this.duel;if(!duel?.visible)return;
    const c=this.ctx;
    for(const [i,bot] of (duel.rivals||[duel.rival]).entries()){
    const actor=this.pilots[i];actor.update(bot,time);this.pilotCanvas.draw(c,actor,this.camera,this.width,this.height);
    const pos=this.kitePosition.clone(),rot=this.kiteRotation.clone(),scale=this.kiteScale;
    this.kitePosition.copy(bot.position);this.kiteRotation.copy(bot.orientation);this.kiteScale=1;
    const end=this.drawKite(time,false,bot,bot.setup);
    this.drawTether(bot,bot.partyTint||'#5faaa9');
    this.kitePosition.copy(pos);this.kiteRotation.copy(rot);this.kiteScale=scale;}
    if(duel.contact){const point=this.project(duel.contactPoint);if(point.z<1){c.strokeStyle='#ffe2a0';c.lineWidth=2;c.beginPath();c.arc(point.x,point.y,6+Math.sin(time*14)*2,0,Math.PI*2);c.stroke();}}
  }
  drawTether(p,color){
    const r=p.rope,c=this.ctx,drawn=displayStrands(r,p===this.physics&&this.reelLinePoints?this.reelLinePoints:r.points,r._drawCache||=[]),points=drawn.points.map(q=>this.project(q));
    for(let i=0;i<points.length-1;i++){
      if(i===drawn.broken)continue;const a=points[i],b=points[i+1];if(a.z>1||b.z>1)continue;
      const worn=r.broken<0?r.wearAt(i):0,contact=r.contactAge<.1&&Math.abs(i-r.contactEdge)<2;
      const thickness=(p.equipment?.thread.diameter||.5)/.5;c.beginPath();c.moveTo(a.x,a.y);c.lineTo(b.x,b.y);c.strokeStyle=worn>.25?'#df9a5e':contact?'#ffe4a0':color;c.lineWidth=(contact?1.2:.85)*thickness;c.stroke();
      if(worn>.2){const x=(a.x+b.x)*.5,y=(a.y+b.y)*.5;c.beginPath();c.moveTo(x-3,y+4);c.lineTo(x,y);c.lineTo(x+4,y+3);c.lineWidth=.8;c.stroke();}
    }
    if(r.broken>=0)for(const id of [drawn.broken,drawn.broken+1]){const q=points[id];if(q.z>1)continue;c.fillStyle=color;c.beginPath();c.arc(q.x,q.y,1.1,0,Math.PI*2);c.fill();}
    if(r.breakAge<.6){const q=this.project(r.breakPoint);c.strokeStyle=`rgba(255,239,192,${1-r.breakAge/.6})`;c.lineWidth=2;c.beginPath();c.arc(q.x,q.y,5+r.breakAge*32,0,Math.PI*2);c.stroke();}
  }
  drawReel(time){
    const c=this.ctx,box=reelViewport(this.width,this.height),scale=box.size/145,x=box.x+box.size*.48,y=box.y+box.size*.56;
    c.save();c.translate(x,y+Math.sin(time*1.6)*1.2);c.scale(scale,scale);c.rotate(-.15);
    c.fillStyle='#80583a';c.beginPath();c.ellipse(-32,-12,19,46,-.05,0,Math.PI*2);c.fill();
    const thread=c.createLinearGradient(0,-52,0,28);thread.addColorStop(0,'#e3d5ac');thread.addColorStop(.4,'#c9bb92');thread.addColorStop(1,'#a1926c');c.fillStyle=thread;c.beginPath();c.roundRect(-32,-48,68,73,9);c.fill();
    const threadShift=this.physics.action==='hold'?0:time*(this.physics.boost?30:12)*(this.physics.action==='reel'?1:-1);
    c.strokeStyle='#aa9b7370';c.lineWidth=1;for(let i=0;i<18;i++){const tx=-29+((i*3.6+threadShift)%64+64)%64;c.beginPath();c.moveTo(tx,-45);c.quadraticCurveTo(tx+7,-9,tx,22);c.stroke();}
    const equipment=equipmentStats(this.setup);c.fillStyle=equipment.reel.color;c.beginPath();c.ellipse(37,-12,22,47,-.05,0,Math.PI*2);c.fill();c.strokeStyle=equipment.reel.rim;c.lineWidth=2.5;c.stroke();for(let i=0;i<equipment.reel.holes;i++){const angle=i/equipment.reel.holes*Math.PI*2+threadShift*.02;c.fillStyle='#63513a';c.beginPath();c.ellipse(37+Math.cos(angle)*13,-12+Math.sin(angle)*29,equipment.reel.holes===8?3.5:4.4,equipment.reel.holes===8?6:8,-.05,0,Math.PI*2);c.fill();}
    c.fillStyle='#735538';c.beginPath();c.ellipse(37,-12,6,12,-.05,0,Math.PI*2);c.fill();
    c.restore();
    return canvasReelOutlet(this.width,this.height,time);
  }
  render(dt,mode,paused){
    const p=this.physics,intro=mode==='intro',time=p.time,inDuel=!intro&&!!this.duel?.visible;const focus=pilotFocusTarget(this.duel,this.pilotFocus),view=spectatorView(p,this.duel),spectating=view.active,watched=view.pilot,onboard=!focus&&!intro&&view.onboard;const orbital=!intro&&!onboard&&(this.orbit.active||view.orbital);if(!orbital&&!onboard)positionView(this.camera,inDuel,dt,this.duel?.partyMode?this.duel.npcCount:1);const orbitFrame=onboard?onboardFrame(this.camera,p,dt):orbital?this.orbit.frame(this.camera,focus||watched?.position||p.position,dt):null,duelFrame=inDuel&&!orbital&&!onboard?frameDuel(this.camera,this.duel):null;this.tugOffset=Math.sin(clamp((time-p.lastTug)/.2,0,1)*Math.PI)*12;
    if(intro){this.kitePosition.set((this.width<760?1.7:4.3)+Math.sin(time*.47)*.25,p.profile==='calm'?.5:(this.width<760?7.4:6.1)+Math.sin(time*.7)*.2,-14);this.kiteRotation.setFromEuler(new Euler(-.38,.1,Math.sin(time*.66)*.08-.13));this.kiteScale=1.45;}
    else{this.kitePosition.copy(p.position);this.kiteRotation.copy(p.orientation);this.kiteScale=1;}
    if(intro)this.tmp.set(0,3.8,-24);else if(orbitFrame)this.tmp.copy(orbitFrame.target);else if(this.follow){if(duelFrame)this.tmp.copy(duelFrame.target);else{this.tmp.copy(p.position);this.tmp.y+=p.state==='flying'?-.7:.8;}}else this.tmp.set(Math.sin(this.yaw)*Math.cos(this.pitch),Math.sin(this.pitch),-Math.cos(this.yaw)*Math.cos(this.pitch)).add(this.camera.position);
    this.targetCamera.position.copy(this.camera.position);this.targetCamera.lookAt(this.tmp);if(orbital||onboard)this.camera.quaternion.copy(this.targetCamera.quaternion);else this.camera.quaternion.slerp(this.targetCamera.quaternion,1-Math.exp(-dt*(intro?2:3.5)));
    this.camera.fov=mix(this.camera.fov,intro?50:orbitFrame?orbitFrame.fov:duelFrame?(this.follow?duelFrame.fov:74):this.zoom?35:this.width<760?63:54,1-Math.exp(-dt*6));this.camera.updateProjectionMatrix();this.camera.updateMatrixWorld();
    if(this.inDuel!==inDuel){this.inDuel=inDuel;this.resize();}
    this.reelLinePoints=!intro&&!orbital&&!spectating?foregroundLine(p.rope,this.camera,this.width,this.height,canvasReelOutlet(this.width,this.height,time),this.reelLineCache||=[]):null;
    const c=this.ctx;c.setTransform(this.ratio,0,0,this.ratio,0,0);this.drawSky(time);if(!intro){drawCanvasTrail(this,this.trail,time);this.drawRival(time);}
    const junction=onboard?this.local(0,0,0):this.drawKite(time,intro),end=this.project(junction);let start={x:this.width*.5,y:this.height*1.06};if(!intro)start={x:(this.width<760?this.width*.87:this.width*.84)-5*(this.width<760?.7:1),y:this.height*(this.width<760?.68:.85)-43*(this.width<760?.7:1)+this.tugOffset};
    if(intro&&end.z<1){c.beginPath();c.moveTo(start.x,start.y);c.quadraticCurveTo((start.x+end.x)*.5,(start.y+end.y)*.5+20,end.x,end.y);c.strokeStyle='#f4ebcb';c.lineWidth=1;c.stroke();}
    else if(!intro&&!onboard)this.drawTether(p,'#f9edc9');
    if(!intro&&!orbital&&!spectating)this.drawReel(time);
    const projected=q=>{const o=this.project(q);return {...o,behind:o.z>1,visible:o.z<1&&o.x>15&&o.x<this.width-15&&o.y>25&&o.y<this.height-15};};
    const point=this.project(this.kitePosition),nose=this.project(this.local(0,.4,0));return {trail:this.trail?.active&&this.trail.target?projected(this.trail.target):null,rivals:this.duel?.visible?(this.duel.rivals||[this.duel.rival]).map(b=>projected(b.position)):[],rival:this.duel?.visible?projected(this.duel.rival.position):null,clash:this.duel?.contact?projected(this.duel.contactPoint):null,x:point.x,y:point.y,visible:point.z<1&&point.x>20&&point.x<this.width-20&&point.y>20&&point.y<this.height-20,angle:Math.atan2(nose.x-point.x,point.y-nose.y)*180/Math.PI,size:Math.abs(nose.y-point.y)*2};
  }
}
