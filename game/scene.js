import {bowHeight,sailZ,bridleAnchors,bridleJunction,SPAR_OFFSET} from './kite-shape.js';
import {appearance,paperColor} from './appearance.js';
import {cachedSailArt,artKey} from './sail-art.js';
import {OrbitCamera} from './orbit-camera.js';
import {spectatorView,onboardFrame} from './spectator-camera.js';
import {ArticulatedTail,TAIL_VERTICES} from './tail.js';
import {equipmentStats} from './equipment.js';
import {createReelModel,disposeModel} from './equipment-models.js';
import {TrailView,drawCanvasTrail} from './trail-view.js';
import {frameDuel,positionView} from './duel-camera.js';
import {reelViewport,foregroundLine} from './reel-view.js';
import * as THREE from './vendor/three.module.js';
import {clamp,mix,configuration} from './physics.js';
import {PAPER_OPACITY,FIELD_SIZE,CAMERA_NEAR,CAMERA_FAR,SKY_RADIUS,HORIZON_RADIUS,FOG_NEAR,FOG_FAR,renderPixelRatio,terrainHeight} from './render-settings.js';

const PALETTE={terracotta:0xc96343,teal:0x397f80,saffron:0xd3a138,plum:0x92709b};
const v3=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
function mesh(geometry,color,roughness=1){return new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color,roughness}));}
function seeded(seed){return()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};}

export class PaperKite {
  constructor(){
    this.group=new THREE.Group();this.panels=[];this.materials=[];this.strings=[];this.knots=new THREE.Group();
    const corners=[v3(0,.4,0),v3(.4,0,0),v3(0,-.4,0),v3(-.4,0,0)];
    for(let sector=0;sector<4;sector++){
      const a=corners[sector],b=corners[(sector+1)%4],vertices=[],indices=[],rows=[],n=6;
      // Shared vertices keep the paper flexible without recalculating duplicate
      // positions and normals for every triangle, every frame, on every kite.
      for(let i=0;i<=n;i++){rows[i]=vertices.length/3;for(let j=0;j<=n-i;j++)vertices.push(a.x*i/n+b.x*j/n,a.y*i/n+b.y*j/n,0);}
      const index=(i,j)=>rows[i]+j;
      for(let i=0;i<n;i++)for(let j=0;j<n-i;j++){
        indices.push(index(i,j),index(i+1,j),index(i,j+1));
        if(i+j<n-1)indices.push(index(i+1,j),index(i+1,j+1),index(i,j+1));
      }
      const geometry=new THREE.BufferGeometry();geometry.setIndex(indices);geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(vertices.flatMap((v,i)=>i%3===0?[(v+.4)/.8,(vertices[i+1]+.4)/.8]:[]),2));geometry.computeVertexNormals();
      const mat=new THREE.MeshStandardMaterial({color:sector%2?0xf8efd8:PALETTE.terracotta,side:THREE.DoubleSide,roughness:.91,metalness:0,transparent:true,opacity:PAPER_OPACITY,depthWrite:false,forceSinglePass:true});
      const part=new THREE.Mesh(geometry,mat);part.castShadow=true;this.group.add(part);this.panels.push(part);this.materials.push(mat);
    }
    const lineMaterial=new THREE.LineBasicMaterial({color:0x94744f});
    const makeLine=(points,material=lineMaterial)=>{const l=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),material);this.group.add(l);return l;};
    this.spine=makeLine([v3(0,-.4,SPAR_OFFSET),v3(0,.4,SPAR_OFFSET)]);
    this.bow=makeLine(Array.from({length:21},(_,i)=>v3(-.4+i*.04,bowHeight(-.4+i*.04),SPAR_OFFSET)));
    this.edge=makeLine([...corners,corners[0]]);
    for(let i=0;i<3;i++)this.strings.push(makeLine([v3(),v3()],new THREE.LineBasicMaterial({color:0xe5dbad})));
    this.group.add(this.knots);
    this.tailSimulation=new ArticulatedTail();this.tailWind=v3();const tailGeo=new THREE.BufferGeometry();tailGeo.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(TAIL_VERTICES*3),3));
    this.tail=new THREE.Mesh(tailGeo,new THREE.MeshStandardMaterial({color:PALETTE.terracotta,side:THREE.DoubleSide,roughness:1}));
    this.group.add(this.tail);this.junction=v3(0,-.06,.23);this.setup=null;
  }
  configure(setup){
    this.setup={...setup};const color=paperColor(setup),a=appearance(setup),key=artKey(setup);
    if(this.artKey!==key){
      this.artKey=key;this.texture?.dispose();this.texture=null;
      this.materials.forEach((m,i)=>{m.map=null;m.color.set(a.sailStyle==='classic'&&i%2?'#f8efd8':color);m.needsUpdate=true;});
      if(a.sailStyle==='image'&&a.printId)cachedSailArt(a).ready.then(canvas=>{
        if(this.artKey!==key)return;const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;this.texture=texture;
        this.materials.forEach(m=>{m.map=texture;m.color.set('#ffffff');m.needsUpdate=true;});
      }).catch(()=>{});
    }
    this.tail.material.color.set(color);this.tail.visible=setup.tail;
    this.junction.fromArray(bridleJunction(configuration(setup)));
    for(const child of [...this.knots.children]){this.knots.remove(child);child.geometry.dispose();child.material.dispose();}
    ['knotsLeft','knotsRight','knotsLower'].forEach((key,i)=>{
      for(let k=0;k<setup[key];k++){
        const bead=mesh(new THREE.SphereGeometry(.009,7,5),0xb78d4d);bead.userData={anchor:i,t:.38+k*.11};this.knots.add(bead);
      }
    });
    this.updateBridle(0,0,0);
  }
  updateBridle(time,bend,wind){
    const anchors=bridleAnchors(this.setup,time,bend,wind).map(p=>v3(...p));
    this.strings.forEach((line,i)=>{const p=line.geometry.attributes.position;p.setXYZ(0,...anchors[i].toArray());p.setXYZ(1,...this.junction.toArray());p.needsUpdate=true;line.geometry.computeBoundingSphere();});
    for(const bead of this.knots.children)bead.position.copy(anchors[bead.userData.anchor]).lerp(this.junction,bead.userData.t);
  }
  animate(time,bend,wind,physics=null){
    for(const panel of this.panels){const p=panel.geometry.attributes.position;for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i);p.setZ(i,sailZ(x,y,time,bend,wind));}p.needsUpdate=true;panel.geometry.computeVertexNormals();}
    const bp=this.bow.geometry.attributes.position;for(let i=0;i<bp.count;i++)bp.setZ(i,sailZ(bp.getX(i),bp.getY(i),time,bend,wind)+SPAR_OFFSET);bp.needsUpdate=true;
    const ep=this.edge.geometry.attributes.position;for(let i=0;i<ep.count;i++)ep.setZ(i,sailZ(ep.getX(i),ep.getY(i),time,bend,wind));ep.needsUpdate=true;
    this.updateBridle(time,bend,wind);
    if(this.tail.visible){this.tailSimulation.update(time,this.group.position,this.group.quaternion,physics?.wind||this.tailWind.set(0,0,-wind),physics?.velocity,this.group.scale.x);const p=this.tail.geometry.attributes.position;this.tailSimulation.fill(p,time);p.needsUpdate=true;this.tail.geometry.computeVertexNormals();this.tail.geometry.computeBoundingSphere();}
  }
}

export class Landscape {
  constructor(canvas,physics){
    this.physics=physics;this.canvas=canvas;this.time=0;this.follow=true;this.zoom=false;this.orbit=new OrbitCamera();this.yaw=0;this.pitch=.1;this.width=1;this.height=1;
    this.renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});
    this.renderer.setPixelRatio(renderPixelRatio(window.devicePixelRatio));this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.25;
    this.scene=new THREE.Scene();this.scene.fog=new THREE.Fog(0xc2cfbe,FOG_NEAR,FOG_FAR);
    this.camera=new THREE.PerspectiveCamera(52,1,CAMERA_NEAR,CAMERA_FAR);this.camera.position.set(0,1.7,1.2);this.scene.add(this.camera);
    this.targetCamera=new THREE.PerspectiveCamera();this.scene.add(new THREE.HemisphereLight(0xd7edf3,0x777f46,2.2));
    const sun=new THREE.DirectionalLight(0xffe4b6,3.1);sun.position.set(-35,70,-45);this.scene.add(sun);
    const fill=new THREE.DirectionalLight(0xc1e5ee,.7);fill.position.set(10,8,6);this.scene.add(fill);
    this.createSky();this.createLandscape();this.createReel();this.trailView=new TrailView(this.scene);
    this.kite=new PaperKite();this.kite.configure(physics.setup);this.scene.add(this.kite.group);
    this.rope=new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(Array.from({length:80},()=>v3())),new THREE.LineBasicMaterial({color:0xf8efc8,transparent:true,opacity:.9}));this.rope.frustumCulled=false;this.scene.add(this.rope);
    this.rivalVisuals=Array.from({length:3},()=>this.createRival());
    const first=this.rivalVisuals[0];this.rivalKite=first.kite;this.rivalRope=first.rope;this.rivalPilot=first.pilot;
    for(const rope of [this.rope,...this.rivalVisuals.map(v=>v.rope)]){
      rope.geometry.setAttribute('color',new THREE.BufferAttribute(new Float32Array(80*3).fill(1),3));rope.material.vertexColors=true;rope.material.color.setHex(0xffffff);
      rope.userData.fray=new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(Array.from({length:120},()=>v3())),new THREE.LineBasicMaterial({color:0xedd29d}));rope.userData.fray.frustumCulled=false;this.scene.add(rope.userData.fray);
      rope.userData.tips=new THREE.Points(new THREE.BufferGeometry().setFromPoints([v3(),v3()]),new THREE.PointsMaterial({color:0xfbe6b2,size:3,sizeAttenuation:false}));rope.userData.tips.frustumCulled=false;rope.userData.tips.visible=false;this.scene.add(rope.userData.tips);
      const wideGeometry=new THREE.BufferGeometry();for(const attr of ['position','color'])wideGeometry.setAttribute(attr,new THREE.Float32BufferAttribute(new Float32Array(40*6*3),3));rope.userData.ribbon=new THREE.Mesh(wideGeometry,new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.DoubleSide}));rope.userData.ribbon.frustumCulled=false;rope.userData.ribbon.visible=false;this.scene.add(rope.userData.ribbon);rope.material.visible=false;
    }
    this.clashGlow=mesh(new THREE.SphereGeometry(.07,8,6),0xffcf73);this.clashGlow.material=new THREE.MeshBasicMaterial({color:0xffd780});this.clashGlow.visible=false;this.scene.add(this.clashGlow);
    this.kiteShadow=mesh(new THREE.CircleGeometry(.43,24),0x445037);this.kiteShadow.material.transparent=true;this.kiteShadow.material.opacity=.15;this.kiteShadow.material.depthWrite=false;this.kiteShadow.material.polygonOffset=true;this.kiteShadow.material.polygonOffsetFactor=-1;this.kiteShadow.material.polygonOffsetUnits=-2;this.kiteShadow.rotation.x=-Math.PI/2;this.scene.add(this.kiteShadow);
    this.screenPoint=v3();this.nosePoint=v3();this.worldEnd=v3();this.worldStart=v3();this.forward=v3();this._temp=v3();
    this.resize();this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(document.body);
  }
  createRival(){
    const kite=new PaperKite();kite.configure({...this.physics.setup,color:'teal'});kite.group.visible=false;this.scene.add(kite.group);
    const rope=new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(Array.from({length:80},()=>v3())),new THREE.LineBasicMaterial({color:0xffffff}));rope.frustumCulled=false;rope.visible=false;this.scene.add(rope);
    const pilot=new THREE.Group(),torso=mesh(new THREE.CylinderGeometry(.2,.17,.65,7),0x397f80);torso.position.y=1.02;pilot.add(torso);const head=mesh(new THREE.SphereGeometry(.14,12,9),0xc69876);head.position.y=1.53;pilot.add(head);
    for(const x of [-.12,.12]){const leg=mesh(new THREE.CylinderGeometry(.07,.06,.74,6),0x465e55);leg.position.set(x,.37,0);pilot.add(leg);const arm=mesh(new THREE.CapsuleGeometry(.055,.35,3,6),0xc69876);arm.position.set(x*1.9,1.16,-.12);arm.rotation.x=-.7;arm.rotation.z=-x;pilot.add(arm);}pilot.visible=false;this.scene.add(pilot);
    return {kite,rope,pilot,torso};
  }
  configureRivals(rivals){rivals.forEach((p,i)=>{const visual=this.rivalVisuals[i];if(visual){visual.kite.configure(p.setup);visual.torso.material.color.set(p.partyTint||'#397f80');}});}
  createSky(){
    const skyGeo=new THREE.SphereGeometry(SKY_RADIUS,24,16);
    const skyMat=new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,uniforms:{top:{value:new THREE.Color(0x7bafc8)},bottom:{value:new THREE.Color(0xe6e6cd)}},vertexShader:'varying vec3 vPos; void main(){vPos=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:'uniform vec3 top;uniform vec3 bottom;varying vec3 vPos;void main(){float h=clamp(normalize(vPos).y*1.7,0.0,1.0);gl_FragColor=vec4(mix(bottom,top,pow(h,.6)),1.0);}',fog:false});
    this.sky=new THREE.Mesh(skyGeo,skyMat);this.scene.add(this.sky);
    const sun=mesh(new THREE.SphereGeometry(3,20,16),0xfff5d1);sun.material=new THREE.MeshBasicMaterial({color:0xfff5d1});sun.position.set(-75,100,-150);this.scene.add(sun);
    const cloudCanvas=document.createElement('canvas');cloudCanvas.width=256;cloudCanvas.height=128;const ctx=cloudCanvas.getContext('2d');const rand=seeded(54);
    for(let i=0;i<24;i++){const x=40+rand()*170,y=50+rand()*30,r=18+rand()*26;const g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,'rgba(255,253,235,.15)');g.addColorStop(.5,'rgba(255,253,235,.1)');g.addColorStop(1,'rgba(255,253,235,0)');ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2);}
    const texture=new THREE.CanvasTexture(cloudCanvas);this.clouds=[];
    for(let i=0;i<17;i++){const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,opacity:.65,depthWrite:false,fog:true,color:0xffffff}));sprite.position.set((rand()-.5)*250,28+rand()*40,-65-rand()*130);sprite.scale.set(30+rand()*38,13+rand()*12,1);sprite.userData.baseX=sprite.position.x;this.scene.add(sprite);this.clouds.push(sprite);}
  }
  createLandscape(){
    const surround=new THREE.Shape();surround.moveTo(-6000,-6000);surround.lineTo(6000,-6000);surround.lineTo(6000,6000);surround.lineTo(-6000,6000);surround.closePath();
    const opening=new THREE.Path(),edge=FIELD_SIZE/2;opening.moveTo(-edge,-edge);opening.lineTo(-edge,edge);opening.lineTo(edge,edge);opening.lineTo(edge,-edge);opening.closePath();surround.holes.push(opening);
    const farGround=mesh(new THREE.ShapeGeometry(surround),0x64894f);farGround.rotation.x=-Math.PI/2;farGround.userData.groundSurround=true;this.scene.add(farGround);
    const terrain=new THREE.PlaneGeometry(FIELD_SIZE,FIELD_SIZE,64,64);terrain.rotateX(-Math.PI/2);const pos=terrain.attributes.position;const colors=[];
    const color=new THREE.Color(),c1=new THREE.Color(0x548447),c2=new THREE.Color(0x7fa354);
    for(let i=0;i<pos.count;i++){const x=pos.getX(i),z=pos.getZ(i);pos.setY(i,terrainHeight(x,z));const shade=(Math.sin(x*.13+z*.12)+Math.sin(x*.3-z*.09))*.15+.4;color.copy(c1).lerp(c2,shade);colors.push(color.r,color.g,color.b);}
    terrain.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));terrain.computeVertexNormals();this.scene.add(new THREE.Mesh(terrain,new THREE.MeshStandardMaterial({vertexColors:true,roughness:1})));
    const pathVertices=[];for(let i=0;i<100;i++){const z=8-i*3.6,z2=z-3.6;const x=3+Math.sin(-z*.045)*3,x2=3+Math.sin(-z2*.045)*3;const w=.7;for(const [a,b] of [[x-w,z],[x+w,z],[x2+w,z2],[x-w,z],[x2+w,z2],[x2-w,z2]])pathVertices.push(a,terrainHeight(a,b)+.025,b);}
    const pathGeo=new THREE.BufferGeometry();pathGeo.setAttribute('position',new THREE.Float32BufferAttribute(pathVertices,3));pathGeo.computeVertexNormals();this.scene.add(new THREE.Mesh(pathGeo,new THREE.MeshStandardMaterial({color:0xc3b890,roughness:1,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-4})));
    this.createMountains();
    const rand=seeded(81);for(let i=0;i<18;i++){const angle=i/18*Math.PI*2+(rand()-.5)*.12,radius=210+rand()*80;this.createTree(Math.sin(angle)*radius,Math.cos(angle)*radius,4+rand()*5);}
    // A simple wind ribbon on a field post gives a second, diegetic wind cue.
    const post=mesh(new THREE.CylinderGeometry(.035,.045,2.7,6),0x897855);post.position.set(-5.6,1.35,-9);this.scene.add(post);
    this.ribbon=new THREE.Mesh(new THREE.PlaneGeometry(.17,1.25,1,12),new THREE.MeshStandardMaterial({color:0xc58a53,side:THREE.DoubleSide,roughness:1}));this.ribbon.geometry.translate(0,-.625,0);this.ribbon.position.set(-5.6,2.66,-9);this.scene.add(this.ribbon);
    this.ribbonBase=new Float32Array(this.ribbon.geometry.attributes.position.array);
  }
  createMountains(){
    const rand=seeded(133);for(let layer=0;layer<3;layer++){
      const vertices=[],radius=HORIZON_RADIUS+(2-layer)*65,base=-5;
      const peaks=Array.from({length:48},()=>16+rand()*28+(layer===0?20:0));
      for(let i=0;i<48;i++){const a=i/48*Math.PI*2,b=(i+1)/48*Math.PI*2,x=Math.sin(a)*radius,z=Math.cos(a)*radius,x2=Math.sin(b)*radius,z2=Math.cos(b)*radius;vertices.push(x,base,z,x,peaks[i],z,x2,peaks[(i+1)%48],z2,x,base,z,x2,peaks[(i+1)%48],z2,x2,base,z2);}
      const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geo.computeVertexNormals();this.scene.add(new THREE.Mesh(geo,new THREE.MeshBasicMaterial({color:[0xadbeb4,0x97b0a2,0x809b8b][layer],side:THREE.DoubleSide,fog:true})));
    }
  }
  createTree(x,z,height){
    const tree=new THREE.Group(),trunk=mesh(new THREE.CylinderGeometry(.05,.11,height*.65,5),0x6e6c4d);trunk.position.y=height*.32;tree.add(trunk);
    for(let i=0;i<3;i++){const crown=mesh(new THREE.IcosahedronGeometry(height*(.28-i*.04),0),[0x607c56,0x69825c,0x70885f][i]);crown.scale.set(1,.85,1);crown.position.set(Math.sin(i*4)*height*.12,height*(.56+i*.14),Math.cos(i*3)*height*.1);tree.add(crown);}tree.position.set(x,terrainHeight(x,z),z);this.scene.add(tree);
  }
  createReel(){
    this.reelScene=new THREE.Scene();this.reelCamera=new THREE.PerspectiveCamera(48,1,.1,10);this.reelCamera.position.set(0,.05,3.2);this.reelCamera.lookAt(0,0,0);
    this.reelScene.add(new THREE.HemisphereLight(0xfff4da,0x536851,2.7));const light=new THREE.DirectionalLight(0xffead1,3);light.position.set(-3,5,4);this.reelScene.add(light);
    this.reelRig=new THREE.Group();this.reelRig.rotation.set(.12,1.03,-.25);this.reelScene.add(this.reelRig);this.spool=new THREE.Group();this.reelRig.add(this.spool);this.reelOutlet=new THREE.Object3D();this.reelRig.add(this.reelOutlet);this.configureReel(this.physics.setup);
  }
  prepareReel(dt,paused){
    const p=this.physics,box=reelViewport(this.width,this.height);
    if(!paused&&p.action!=='hold')this.spool.rotation.z+=dt*(p.action==='reel'?3:-3)*(p.boost?2.5:1);
    this.reelRig.position.y=-Math.sin(clamp((p.time-p.lastTug)/.2,0,1)*Math.PI)*.06;
    this.reelScene.updateMatrixWorld(true);this.reelCamera.updateMatrixWorld(true);
    const projected=this.reelOutlet.getWorldPosition(new THREE.Vector3()).project(this.reelCamera);
    const outlet={x:box.x+(projected.x*.5+.5)*box.size,y:box.y+(.5-projected.y*.5)*box.size};
    this.reelLinePoints=foregroundLine(p.rope,this.camera,this.width,this.height,outlet,this.reelLineCache||=[]);
  }
  renderReel(){
    const box=reelViewport(this.width,this.height),r=this.renderer;
    r.autoClear=false;r.clearDepth();r.setViewport(box.x,this.height-box.y-box.size,box.size,box.size);r.render(this.reelScene,this.reelCamera);r.setViewport(0,0,this.width,this.height);r.autoClear=true;
  }
  resize(){this.width=window.innerWidth;this.height=window.innerHeight;this.camera.aspect=this.width/this.height;this.camera.updateProjectionMatrix();this.renderer.setSize(this.width,this.height,false);}
  configureReel(s){const key=[s.reelType,s.bearingType,s.lineType].join('/');if(this.reelKey===key)return;this.reelKey=key;if(this.reelModel){this.spool.remove(this.reelModel);disposeModel(this.reelModel);}const e=equipmentStats(s);this.reelModel=createReelModel(e.reel,e.bearing,e.thread);this.reelModel.scale.setScalar(.88*(e.reel.diameter/20.3)**.3);this.spool.add(this.reelModel);this.reelOutlet.position.set(0,.869*this.reelModel.scale.x,0);}
  configure(s){this.kite.configure(s);this.configureReel(s);}
  drag(dx,dy){if(spectatorView(this.physics,this.duel).onboard)return;if(this.orbit.active||spectatorView(this.physics,this.duel).orbital){this.orbit.drag(dx,dy);return;}if(this.follow){this.camera.getWorldDirection(this.forward);this.yaw=Math.atan2(this.forward.x,-this.forward.z);this.pitch=Math.asin(this.forward.y);}this.follow=false;this.yaw-=dx*.0035;this.pitch=clamp(this.pitch+dy*.003,-.35,1.4);}
  updateTether(line,p){
    const r=p.rope,points=p===this.physics&&this.reelLinePoints?this.reelLinePoints:r.points,attr=line.geometry.attributes.position,colors=line.geometry.attributes.color,fray=line.userData.fray.geometry.attributes.position;let index=0,fi=0;
    const tint=new THREE.Color();
    for(let i=0;i<r.points.length-1;i++){
      if(i===r.broken)continue;
      const wear=r.broken<0?r.wearAt(i):0,contact=r.contactAge<.1&&Math.abs(i-r.contactEdge)<2;
      tint.set(wear>.25?0xdf9a5e:contact?0xffd78e:p===this.physics?0xf8efc8:p.partyTint||0x64aaa8);
      for(const id of [i,i+1]){this._temp.copy(points[id]);attr.setXYZ(index,this._temp.x,this._temp.y,this._temp.z);colors.setXYZ(index++,tint.r,tint.g,tint.b);}
      if(wear>.2&&fi<116){this._temp.copy(r.points[i]).lerp(r.points[i+1],.5);const q=this._temp,size=.025+wear*.035;fray.setXYZ(fi++,q.x-size,q.y+size,q.z);fray.setXYZ(fi++,q.x,q.y,q.z);fray.setXYZ(fi++,q.x,q.y,q.z);fray.setXYZ(fi++,q.x+size,q.y+size*.6,q.z+.02);}
    }
    attr.needsUpdate=true;colors.needsUpdate=true;line.geometry.setDrawRange(0,index);fray.needsUpdate=true;line.userData.fray.geometry.setDrawRange(0,fi);line.userData.fray.visible=line.visible;
    const ribbon=line.userData.ribbon;if(ribbon){const vertices=ribbon.geometry.attributes.position,shades=ribbon.geometry.attributes.color,a=v3(),b=v3(),side=v3(),middle=v3(),normal=v3();let k=0;const thickness=(p.equipment?.thread.diameter||.5)/.5;for(let i=0;i<index;i+=2){a.fromBufferAttribute(attr,i);b.fromBufferAttribute(attr,i+1);middle.copy(a).add(b).multiplyScalar(.5);normal.subVectors(middle,this.camera.position);side.subVectors(b,a).cross(normal).normalize();if(side.lengthSq()<.1)side.set(1,0,0);const width=Math.max(.0002,normal.length()*Math.tan(this.camera.fov*Math.PI/360)*1.2*thickness/this.height);side.multiplyScalar(width);for(const [point,sign]of[[a,-1],[a,1],[b,1],[a,-1],[b,1],[b,-1]]){vertices.setXYZ(k,point.x+side.x*sign,point.y+side.y*sign,point.z+side.z*sign);shades.setXYZ(k++,colors.getX(i),colors.getY(i),colors.getZ(i));}}vertices.needsUpdate=true;shades.needsUpdate=true;ribbon.geometry.setDrawRange(0,k);ribbon.visible=line.visible;}
    line.userData.tips.visible=r.broken>=0&&line.visible;if(r.broken>=0){const tips=line.userData.tips.geometry.attributes.position;for(let k=0;k<2;k++){const q=r.points[r.broken+k];tips.setXYZ(k,q.x,q.y,q.z);}tips.needsUpdate=true;}
  }
  render(dt,mode,paused){
    const p=this.physics,intro=mode==='intro',inDuel=!intro&&!!this.duel?.visible;const view=spectatorView(p,this.duel),spectating=view.active,watched=view.pilot,onboard=!intro&&view.onboard;const orbital=!intro&&!onboard&&(this.orbit.active||view.orbital);if(!orbital&&!onboard)positionView(this.camera,inDuel,dt,this.duel?.partyMode?this.duel.npcCount:1);const orbitFrame=onboard?onboardFrame(this.camera,p,dt):orbital?this.orbit.frame(this.camera,watched?.position||p.position,dt):null,duelFrame=inDuel&&!orbital&&!onboard?frameDuel(this.camera,this.duel):null;this.time=p.time;
    if(this.inDuel!==inDuel){this.inDuel=inDuel;this.renderer.setPixelRatio(renderPixelRatio(window.devicePixelRatio,inDuel));}
    for(const cloud of this.clouds)cloud.position.x=cloud.userData.baseX+Math.sin(p.time*.008)*9;
    if(intro){this.kite.group.position.set((this.width<760?1.7:4.3)+Math.sin(p.time*.47)*.25,p.profile==='calm'?.5:(this.width<760?7.4:6.1)+Math.sin(p.time*.7)*.2,-14);this.kite.group.rotation.set(-.38,.1,Math.sin(p.time*.66)*.08-.13);this.kite.group.scale.setScalar(1.45);}
    else{this.kite.group.position.copy(p.position);this.kite.group.quaternion.copy(p.orientation);this.kite.group.scale.setScalar(1);}
    this.kite.group.visible=!onboard;this.kite.animate(p.time,intro?.45:p.bend,p.wind.length(),intro?null:p);
    this.kiteShadow.position.set(this.kite.group.position.x,.05+terrainHeight(this.kite.group.position.x,this.kite.group.position.z),this.kite.group.position.z);this.kiteShadow.material.opacity=.15/(1+this.kite.group.position.y*.3);this.kiteShadow.scale.setScalar(1+this.kite.group.position.y*.07);
    if(intro)this._temp.set(this.width<760?0:0,3.8,-24);
    else if(orbitFrame)this._temp.copy(orbitFrame.target);
    else if(this.follow){if(duelFrame)this._temp.copy(duelFrame.target);else{this._temp.copy(p.position);this._temp.y+=p.state==='flying'?-.7:.8;}}
    else this._temp.set(Math.sin(this.yaw)*Math.cos(this.pitch),Math.sin(this.pitch),-Math.cos(this.yaw)*Math.cos(this.pitch)).add(this.camera.position);
    this.targetCamera.position.copy(this.camera.position);this.targetCamera.lookAt(this._temp);
    if(orbital||onboard)this.camera.quaternion.copy(this.targetCamera.quaternion);else this.camera.quaternion.slerp(this.targetCamera.quaternion,1-Math.exp(-dt*(intro?2:3.5)));
    const fov=intro?50:orbitFrame?orbitFrame.fov:duelFrame?(this.follow?duelFrame.fov:74):(this.zoom?35:this.width<760?63:54);this.camera.fov=mix(this.camera.fov,fov,1-Math.exp(-dt*6));this.camera.updateProjectionMatrix();
    this.reelLinePoints=null;if(!intro&&!orbital&&!spectating)this.prepareReel(dt,paused);
    this.scene.updateMatrixWorld();
    this.worldEnd.copy(this.kite.junction);this.kite.group.localToWorld(this.worldEnd);
    if(intro)this.worldStart.set(0,.4,1);
    this.rope.userData.fray.visible=!intro;this.rope.userData.tips.visible=!intro&&p.rope.broken>=0;
    if(intro){this.rope.geometry.attributes.color.array.fill(1);this.rope.geometry.attributes.color.needsUpdate=true;const attr=this.rope.geometry.attributes.position;for(let i=0;i<40;i++){for(let j=0;j<2;j++){const t=(i+j)/40;this._temp.copy(this.worldStart).lerp(this.worldEnd,t);this._temp.y-=Math.sin(t*Math.PI)*.32;attr.setXYZ(i*2+j,this._temp.x,this._temp.y,this._temp.z);}}attr.needsUpdate=true;this.rope.geometry.setDrawRange(0,80);}
    else this.updateTether(this.rope,p);
    this.rope.visible=!onboard;this.rope.material.visible=intro;this.rope.userData.ribbon.visible=!intro&&!onboard;
    const rivalVisible=!intro&&!!this.duel?.visible,rivals=this.duel?.rivals||[this.duel?.rival];this.clashGlow.visible=rivalVisible&&this.duel.contact;
    this.rivalVisuals.forEach((visual,i)=>{const b=rivals[i],visible=rivalVisible&&!!b;visual.kite.group.visible=visible;visual.pilot.visible=visible;visual.rope.visible=visible;visual.rope.userData.fray.visible=visible;visual.rope.userData.ribbon.visible=visible;visual.rope.userData.tips.visible=visible&&b.rope.broken>=0;
      if(visible){visual.kite.group.position.copy(b.position);visual.kite.group.quaternion.copy(b.orientation);visual.kite.animate(p.time,b.bend,b.wind.length(),b);visual.pilot.position.set(b.anchor.x,0,b.anchor.z);this.updateTether(visual.rope,b);}
    });if(this.clashGlow.visible)this.clashGlow.position.copy(this.duel.contactPoint);
    this.trailView.update(!intro?this.trail:null,this.camera,p.time);
    this.sky.position.copy(this.camera.position);this.renderer.render(this.scene,this.camera);if(!intro&&!orbital&&!spectating)this.renderReel();
    this.screenPoint.copy(this.kite.group.position).project(this.camera);this.nosePoint.set(0,.4,0);this.kite.group.localToWorld(this.nosePoint);this.nosePoint.project(this.camera);
    const projected=q=>{const o=q.clone().project(this.camera);return {x:(o.x*.5+.5)*this.width,y:(.5-o.y*.5)*this.height,behind:o.z>1,visible:o.z<1&&Math.abs(o.x)<.95&&Math.abs(o.y)<.95};};
    return {trail:this.trail?.active&&this.trail.target?projected(this.trail.target):null,rivals:rivalVisible?rivals.map(b=>projected(b.position)):[],rival:rivalVisible?projected(this.duel.rival.position):null,clash:this.duel?.contact?projected(this.duel.contactPoint):null,x:(this.screenPoint.x*.5+.5)*this.width,y:(-.5*this.screenPoint.y+.5)*this.height,visible:this.screenPoint.z<1&&Math.abs(this.screenPoint.x)<.94&&Math.abs(this.screenPoint.y)<.95,angle:Math.atan2((this.nosePoint.x-this.screenPoint.x)*this.width,(this.nosePoint.y-this.screenPoint.y)*this.height)*180/Math.PI,size:Math.abs((this.nosePoint.y-this.screenPoint.y)*this.height)};
  }
}
