import {bowHeight,sailZ,bridleAnchors,bridleJunction,SPAR_OFFSET} from './kite-shape.js';
import {appearance,paperColor} from './appearance.js';
import {cachedSailArt,texturedTriangle} from './sail-art.js';
import {OrbitCamera} from './orbit-camera.js';
import {drawCanvasTrail} from './trail-view.js';
import {frameDuel,positionView} from './duel-camera.js';
// Software perspective renderer for browsers without an available WebGL context.
// The physical state and camera remain three-dimensional in both renderers.
import {Vector3,PerspectiveCamera,Quaternion,Euler} from './vendor/three.module.js';
import {clamp,mix,configuration} from './physics.js';
const v=(x=0,y=0,z=0)=>new Vector3(x,y,z);
function random(seed){return()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};}
export class CanvasLandscape {
  constructor(canvas,physics){
    this.canvas=canvas;this.physics=physics;this.ctx=canvas.getContext('2d',{alpha:false});if(!this.ctx)throw new Error('Canvas unavailable');
    this.camera=new PerspectiveCamera(50,1,.05,350);this.targetCamera=new PerspectiveCamera();this.camera.position.set(0,1.72,1.1);this.camera.lookAt(0,3.8,-24);
    this.forward=v();this.follow=true;this.zoom=false;this.orbit=new OrbitCamera();this.yaw=0;this.pitch=.1;this.setup={...physics.setup};this.kitePosition=v();this.kiteRotation=new Quaternion();this.tmp=v();
    const r=random(1955);this.hills=Array.from({length:4},(_,layer)=>Array.from({length:61},(_,i)=>v(-240+i*8,7+Math.sin(i*.35+layer)*5+Math.sin(i*.8+layer)*3+(layer<2?r()*3:0),-185+layer*32)));
    this.grass=Array.from({length:1000},()=>({x:(r()-.5)*110,z:7-r()*90,h:.12+r()*.6,c:['#8b945d','#aeb17b','#7c8c59','#c0b680'][Math.floor(r()*4)],phase:r()*6}));
    this.trees=Array.from({length:30},()=>({x:(r()-.5)*160,z:-40-r()*90,h:3+r()*5,phase:r()*6})).filter(t=>Math.abs(t.x)>9);
    this.clouds=Array.from({length:10},()=>({x:(r()-.5)*180,y:30+r()*35,z:-80-r()*100,size:10+r()*15}));
    this.resize();this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(document.body);
  }
  resize(){this.width=innerWidth;this.height=innerHeight;this.ratio=Math.min(devicePixelRatio,1.7);this.canvas.width=Math.round(this.width*this.ratio);this.canvas.height=Math.round(this.height*this.ratio);this.camera.aspect=this.width/this.height;this.camera.updateProjectionMatrix();}
  configure(s){this.setup={...s};}
  drag(dx,dy){if(this.orbit.active){this.orbit.drag(dx,dy);return;}if(this.follow){this.camera.getWorldDirection(this.forward);this.yaw=Math.atan2(this.forward.x,-this.forward.z);this.pitch=Math.asin(this.forward.y);}this.follow=false;this.yaw-=dx*.0035;this.pitch=clamp(this.pitch+dy*.003,-.35,1.4);}
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
        const points=[];for(let i=0;i<=120;i++){const angle=yaw-Math.PI*.48+i/120*Math.PI*.96,radius=185-layer*28,alt=7+Math.sin(angle*5+layer)*4+Math.sin(angle*11+layer)*2;const p=this.project(v(this.camera.position.x+Math.sin(angle)*radius,alt,this.camera.position.z-Math.cos(angle)*radius));if(p.z<1&&Number.isFinite(p.x+p.y))points.push(p);}points.sort((a,b)=>a.x-b.x);
        if(points.length){c.beginPath();c.moveTo(points[0].x,h+200);for(const p of points)c.lineTo(p.x,p.y);c.lineTo(points.at(-1).x,h+200);c.closePath();c.fillStyle=['#b5c5bb','#a6bba9','#90a584','#899666'][layer];c.fill();}
      }
      const ground=c.createLinearGradient(0,Math.max(0,horizon),0,h);ground.addColorStop(0,'#9aa477');ground.addColorStop(.6,'#a4a574');ground.addColorStop(1,'#8b9360');c.beginPath();c.moveTo(0,horizon+18);c.bezierCurveTo(w*.3,horizon-3,w*.7,horizon+30,w,horizon+11);c.lineTo(w,h);c.lineTo(0,h);c.closePath();c.fillStyle=ground;c.fill();
      const left=[],right=[];for(let z=-130;z<1;z+=2){const x=3+Math.sin(-z*.045)*3;left.push(v(x-.7,0,z));right.push(v(x+.7,0,z));}this.polygon([...left,...right.reverse()],'#c7bfa026');
      for(const tree of this.trees){const p=this.project(v(tree.x,0,tree.z)),top=this.project(v(tree.x,tree.h,tree.z)),height=p.y-top.y;if(p.z>1||height<0)continue;c.fillStyle='#637b5c';c.fillRect(p.x-1,top.y,height*.03,height);for(let i=0;i<3;i++){c.beginPath();c.ellipse(p.x+Math.sin(i*4+tree.phase)*height*.12,top.y+height*(.25+i*.13),height*(.27-i*.035),height*.22,0,0,Math.PI*2);c.fillStyle=['#738b68','#7d9270','#849976'][i];c.fill();}}
      for(const g of this.grass){const bottom=this.project(v(g.x,0,g.z)),top=this.project(v(g.x+Math.sin(time*1.7+g.phase)*g.h*.13,g.h,g.z));if(bottom.z>1||bottom.x<0||bottom.x>w||bottom.y<0||bottom.y>h+40||top.y<0)continue;const height=bottom.y-top.y;if(height<.2)continue;c.strokeStyle=g.c;c.lineWidth=clamp(height*.055,.5,2);c.beginPath();c.moveTo(bottom.x,bottom.y);c.quadraticCurveTo(bottom.x+(top.x-bottom.x)*.6,top.y+height*.3,top.x,top.y);c.stroke();}
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
    if(!facing)drawBridle();
    for(let i=0;i<4;i++)this.polygon([center,point(corners[i]),point(corners[(i+1)%4])],a.sailStyle==='classic'&&i%2?'#f8efd8':color,'#987b5622',.5);
    if(a.sailStyle==='image'&&a.printId){
      const image=cachedSailArt(setup).canvas,n=4;
      for(let sector=0;sector<4;sector++){
        const A=corners[sector],B=corners[(sector+1)%4],vertex=(i,j)=>[A[0]*i/n+B[0]*j/n,A[1]*i/n+B[1]*j/n];
        const triangle=vertices=>texturedTriangle(c,image,vertices.map(([x,y])=>({x:(x+.4)/.8*image.width,y:(.4-y)/.8*image.height})),vertices.map(v=>this.project(point(v))));
        for(let i=0;i<n;i++)for(let j=0;j<n-i;j++){triangle([vertex(i,j),vertex(i+1,j),vertex(i,j+1)]);if(i+j<n-1)triangle([vertex(i+1,j),vertex(i+1,j+1),vertex(i,j+1)]);}
      }
    }
    if(!facing){
      this.line([point([0,-.4],SPAR_OFFSET),point([0,.4],SPAR_OFFSET)],'#94744f',1.2);
      this.line(Array.from({length:21},(_,i)=>{const x=-.4+i*.04;return point([x,bowHeight(x)],SPAR_OFFSET);}), '#94744f',1.3);
    }else drawBridle();
    this.line([...corners,corners[0]].map(p=>point(p)),'#8f7b5844',.7);
    if(setup.tail){const tail=Array.from({length:30},(_,i)=>{const t=i/29;return this.local(Math.sin(time*3.3-t*7)*t*.08,-.4-t*1.1,-.01-Math.sin(t*4+time*1.8)*t*.1);});this.line(tail,color,1.9);for(let i=4;i<29;i+=6){const t=i/29,x=Math.sin(time*3.3-t*7)*t*.08,y=-.4-t*1.1,z=-.01-Math.sin(t*4+time*1.8)*t*.1;this.polygon([this.local(x-.04,y+.025,z),this.local(x+.04,y-.025,z),this.local(x+.04,y+.025,z),this.local(x-.04,y-.025,z)],color);}}
    return junction;
  }
  drawRival(time){
    const duel=this.duel;if(!duel?.visible)return;
    const c=this.ctx;
    for(const bot of duel.rivals||[duel.rival]){const anchor=bot.anchor;
    this.line([v(anchor.x-.15,0,anchor.z),v(anchor.x-.1,.7,anchor.z),v(anchor.x,.99,anchor.z),v(anchor.x+.16,0,anchor.z)],'#465e55',4);
    this.polygon([v(anchor.x-.22,.7,anchor.z),v(anchor.x-.23,1.3,anchor.z),v(anchor.x+.2,1.3,anchor.z),v(anchor.x+.19,.7,anchor.z)],bot.partyTint||'#397f80');
    this.line([v(anchor.x-.2,1.22,anchor.z),v(anchor.x-.35,1.05,anchor.z-.1),anchor,v(anchor.x+.27,1.15,anchor.z)],'#c69876',5);
    const head=this.project(v(anchor.x,1.53,anchor.z));const top=this.project(v(anchor.x,1.72,anchor.z));if(head.z<1){c.fillStyle='#c69876';c.beginPath();c.arc(head.x,head.y,Math.max(2,Math.abs(head.y-top.y)*.65),0,Math.PI*2);c.fill();}
    const pos=this.kitePosition.clone(),rot=this.kiteRotation.clone(),scale=this.kiteScale;
    this.kitePosition.copy(bot.position);this.kiteRotation.copy(bot.orientation);this.kiteScale=1;
    const end=this.drawKite(time,false,bot,bot.setup);
    this.drawTether(bot,bot.partyTint||'#5faaa9');
    this.kitePosition.copy(pos);this.kiteRotation.copy(rot);this.kiteScale=scale;}
    if(duel.contact){const point=this.project(duel.contactPoint);if(point.z<1){c.strokeStyle='#ffe2a0';c.lineWidth=2;c.beginPath();c.arc(point.x,point.y,6+Math.sin(time*14)*2,0,Math.PI*2);c.stroke();}}
  }
  drawTether(p,color){
    const r=p.rope,c=this.ctx,points=r.points.map(q=>this.project(q));
    for(let i=0;i<points.length-1;i++){
      if(i===r.broken)continue;const a=points[i],b=points[i+1];if(a.z>1||b.z>1)continue;
      const worn=r.broken<0?r.wearAt(i):0,contact=r.contactAge<.1&&Math.abs(i-r.contactEdge)<2;
      c.beginPath();c.moveTo(a.x,a.y);c.lineTo(b.x,b.y);c.strokeStyle='#3c514b70';c.lineWidth=2.7;c.stroke();c.strokeStyle=worn>.25?'#df9a5e':contact?'#ffe4a0':color;c.lineWidth=contact?1.8:1.2;c.stroke();
      if(worn>.2){const x=(a.x+b.x)*.5,y=(a.y+b.y)*.5;c.beginPath();c.moveTo(x-3,y+4);c.lineTo(x,y);c.lineTo(x+4,y+3);c.lineWidth=.8;c.stroke();}
    }
    if(r.broken>=0)for(const id of [r.broken,r.broken+1]){const q=points[id];if(q.z>1)continue;c.fillStyle=color;c.beginPath();c.arc(q.x,q.y,2.4,0,Math.PI*2);c.fill();}
    if(r.breakAge<.6){const q=this.project(r.breakPoint);c.strokeStyle=`rgba(255,239,192,${1-r.breakAge/.6})`;c.lineWidth=2;c.beginPath();c.arc(q.x,q.y,5+r.breakAge*32,0,Math.PI*2);c.stroke();}
  }
  drawReel(time){
    const c=this.ctx,w=this.width,h=this.height,scale=(w<760?.7:1)*(this.reelScale||1),x=this.reelStart.x+5*scale,y=this.reelStart.y+43*scale;
    c.save();c.translate(x,y+Math.sin(time*1.6)*1.2);c.scale(scale,scale);c.rotate(-.15);
    // Cuff, hand and the two wooden reel cheeks.
    c.fillStyle='#bcc2a9';c.beginPath();c.moveTo(38,29);c.lineTo(84,22);c.lineTo(126,210);c.lineTo(35,210);c.closePath();c.fill();
    c.fillStyle='#a0ad97';c.beginPath();c.roundRect(35,25,51,25,5);c.fill();
    c.fillStyle='#c89a78';c.beginPath();c.ellipse(45,9,31,43,-.3,0,Math.PI*2);c.fill();
    c.fillStyle='#80583a';c.beginPath();c.ellipse(-32,-12,19,46,-.05,0,Math.PI*2);c.fill();
    const thread=c.createLinearGradient(0,-52,0,28);thread.addColorStop(0,'#e3d5ac');thread.addColorStop(.4,'#c9bb92');thread.addColorStop(1,'#a1926c');c.fillStyle=thread;c.beginPath();c.roundRect(-32,-48,68,73,9);c.fill();
    const threadShift=this.physics.action==='hold'?0:time*(this.physics.boost?30:12)*(this.physics.action==='reel'?1:-1);
    c.strokeStyle='#aa9b7370';c.lineWidth=1;for(let i=0;i<18;i++){const tx=-29+((i*3.6+threadShift)%64+64)%64;c.beginPath();c.moveTo(tx,-45);c.quadraticCurveTo(tx+7,-9,tx,22);c.stroke();}
    c.fillStyle='#a4774c';c.beginPath();c.ellipse(37,-12,22,47,-.05,0,Math.PI*2);c.fill();c.strokeStyle='#ba8a59';c.lineWidth=3;c.stroke();
    c.fillStyle='#735538';c.beginPath();c.ellipse(37,-12,6,12,-.05,0,Math.PI*2);c.fill();
    c.fillStyle='#d4a584';c.strokeStyle='#b78a6c';c.lineWidth=.8;for(let i=0;i<4;i++){c.beginPath();c.roundRect(36+i*5,8+i*8,24,11,6);c.fill();c.stroke();}
    c.fillStyle='#d8aa87';c.beginPath();c.ellipse(28,-24,11,21,-.9,0,Math.PI*2);c.fill();c.restore();
    return {x:x-5*scale,y:y-43*scale};
  }
  render(dt,mode,paused){
    const p=this.physics,intro=mode==='intro',time=p.time,inDuel=!intro&&!!this.duel?.visible;const orbital=!intro&&this.orbit.active;if(!orbital)positionView(this.camera,inDuel,dt,this.duel?.partyMode?this.duel.npcCount:1);const orbitFrame=orbital?this.orbit.frame(this.camera,p.position,dt):null,duelFrame=inDuel&&!orbital?frameDuel(this.camera,this.duel):null;this.tugOffset=Math.sin(clamp((time-p.lastTug)/.2,0,1)*Math.PI)*12;
    if(intro){this.kitePosition.set((this.width<760?1.7:4.3)+Math.sin(time*.47)*.25,p.profile==='calm'?.5:(this.width<760?7.4:6.1)+Math.sin(time*.7)*.2,-14);this.kiteRotation.setFromEuler(new Euler(-.38,.1,Math.sin(time*.66)*.08-.13));this.kiteScale=1.45;}
    else{this.kitePosition.copy(p.position);this.kiteRotation.copy(p.orientation);this.kiteScale=1;if(p.state==='ready'||p.state==='grounded')this.kiteRotation.setFromEuler(new Euler(-.3,0,.17));}
    if(intro)this.tmp.set(0,3.8,-24);else if(orbital)this.tmp.copy(orbitFrame.target);else if(this.follow){if(duelFrame)this.tmp.copy(duelFrame.target);else{this.tmp.copy(p.position);this.tmp.y+=p.state==='flying'?-.7:.8;}}else this.tmp.set(Math.sin(this.yaw)*Math.cos(this.pitch),Math.sin(this.pitch),-Math.cos(this.yaw)*Math.cos(this.pitch)).add(this.camera.position);
    this.targetCamera.position.copy(this.camera.position);this.targetCamera.lookAt(this.tmp);if(orbital)this.camera.quaternion.copy(this.targetCamera.quaternion);else this.camera.quaternion.slerp(this.targetCamera.quaternion,1-Math.exp(-dt*(intro?2:3.5)));
    this.camera.fov=mix(this.camera.fov,intro?50:orbitFrame?orbitFrame.fov:duelFrame?(this.follow?duelFrame.fov:74):this.zoom?35:this.width<760?63:54,1-Math.exp(-dt*6));this.camera.updateProjectionMatrix();this.camera.updateMatrixWorld();
    const c=this.ctx;c.setTransform(this.ratio,0,0,this.ratio,0,0);this.drawSky(time);if(!intro){drawCanvasTrail(this,this.trail,time);this.drawRival(time);}
    const junction=this.drawKite(time,intro),end=this.project(junction);let start={x:this.width*.5,y:this.height*1.06};if(!intro)start={x:(this.width<760?this.width*.87:this.width*.84)-5*(this.width<760?.7:1),y:this.height*(this.width<760?.68:.85)-43*(this.width<760?.7:1)+this.tugOffset};
    if(!intro){
      const depth=.57,baseFov=this.width<760?63:54,tan=Math.tan(baseFov*Math.PI/360);
      start=this.project(p.rope.points[0]);this.reelStart=start;
      const viewDepth=p.rope.points[0].clone().applyMatrix4(this.camera.matrixWorldInverse).z;
      this.reelScale=Math.max(.3,Math.min(1.1,depth/Math.max(.2,-viewDepth)*tan/Math.tan(this.camera.fov*Math.PI/360)));
    }
    if(intro&&end.z<1){c.beginPath();c.moveTo(start.x,start.y);c.quadraticCurveTo((start.x+end.x)*.5,(start.y+end.y)*.5+20,end.x,end.y);c.strokeStyle='#f4ebcb';c.lineWidth=1;c.stroke();}
    else if(!intro)this.drawTether(p,'#f9edc9');
    if(!intro&&!orbital)this.drawReel(time);
    const projected=q=>{const o=this.project(q);return {...o,behind:o.z>1,visible:o.z<1&&o.x>15&&o.x<this.width-15&&o.y>25&&o.y<this.height-15};};
    const point=this.project(this.kitePosition),nose=this.project(this.local(0,.4,0));return {trail:this.trail?.active&&this.trail.target?projected(this.trail.target):null,rivals:this.duel?.visible?(this.duel.rivals||[this.duel.rival]).map(b=>projected(b.position)):[],rival:this.duel?.visible?projected(this.duel.rival.position):null,clash:this.duel?.contact?projected(this.duel.contactPoint):null,x:point.x,y:point.y,visible:point.z<1&&point.x>20&&point.x<this.width-20&&point.y>20&&point.y<this.height-20,angle:Math.atan2(nose.x-point.x,point.y-nose.y)*180/Math.PI,size:Math.abs(nose.y-point.y)*2};
  }
}
