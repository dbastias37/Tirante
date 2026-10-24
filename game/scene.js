import {bowHeight,sailZ,bridleAnchors,bridleJunction,SPAR_OFFSET} from './kite-shape.js';
import {appearance,paperColor} from './appearance.js';
import {cachedSailArt,artKey} from './sail-art.js';
import {OrbitCamera} from './orbit-camera.js';
import {TrailView,drawCanvasTrail} from './trail-view.js';
import {frameDuel,positionView,handViewOffset} from './duel-camera.js';
import * as THREE from './vendor/three.module.js';
import {clamp,mix,configuration} from './physics.js';

const PALETTE={terracotta:0xc96343,teal:0x397f80,saffron:0xd3a138,plum:0x92709b};
const v3=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
function mesh(geometry,color,roughness=1){return new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color,roughness}));}
function terrainHeight(x,z){const distance=clamp((-z-12)/60,0,1);return distance*(Math.sin(x*.035+.4)*2.1+Math.sin(z*.035)*1.3+.6);}
function seeded(seed){return()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};}

export class PaperKite {
  constructor(){
    this.group=new THREE.Group();this.panels=[];this.materials=[];this.strings=[];this.knots=new THREE.Group();
    const corners=[v3(0,.4,0),v3(.4,0,0),v3(0,-.4,0),v3(-.4,0,0)];
    for(let sector=0;sector<4;sector++){
      const a=corners[sector],b=corners[(sector+1)%4],vertices=[],n=9;
      const point=(i,j)=>[a.x*i/n+b.x*j/n,a.y*i/n+b.y*j/n,0];
      for(let i=0;i<n;i++)for(let j=0;j<n-i;j++){
        vertices.push(...point(i,j),...point(i+1,j),...point(i,j+1));
        if(i+j<n-1)vertices.push(...point(i+1,j),...point(i+1,j+1),...point(i,j+1));
      }
      const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(vertices.flatMap((v,i)=>i%3===0?[(v+.4)/.8,(vertices[i+1]+.4)/.8]:[]),2));geometry.computeVertexNormals();
      const mat=new THREE.MeshStandardMaterial({color:sector%2?0xf8efd8:PALETTE.terracotta,side:THREE.DoubleSide,roughness:.91,metalness:0});
      const part=new THREE.Mesh(geometry,mat);part.castShadow=true;this.group.add(part);this.panels.push(part);this.materials.push(mat);
    }
    const lineMaterial=new THREE.LineBasicMaterial({color:0x94744f});
    const makeLine=(points,material=lineMaterial)=>{const l=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),material);this.group.add(l);return l;};
    this.spine=makeLine([v3(0,-.4,SPAR_OFFSET),v3(0,.4,SPAR_OFFSET)]);
    this.bow=makeLine(Array.from({length:21},(_,i)=>v3(-.4+i*.04,bowHeight(-.4+i*.04),SPAR_OFFSET)));
    this.edge=makeLine([...corners,corners[0]]);
    for(let i=0;i<3;i++)this.strings.push(makeLine([v3(),v3()],new THREE.LineBasicMaterial({color:0xe5dbad})));
    this.group.add(this.knots);
    const tailGeo=new THREE.BufferGeometry();tailGeo.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(38*6*3),3));
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
  animate(time,bend,wind){
    for(const panel of this.panels){const p=panel.geometry.attributes.position;for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i);p.setZ(i,sailZ(x,y,time,bend,wind));}p.needsUpdate=true;panel.geometry.computeVertexNormals();}
    const bp=this.bow.geometry.attributes.position;for(let i=0;i<bp.count;i++)bp.setZ(i,sailZ(bp.getX(i),bp.getY(i),time,bend,wind)+SPAR_OFFSET);bp.needsUpdate=true;
    const ep=this.edge.geometry.attributes.position;for(let i=0;i<ep.count;i++)ep.setZ(i,sailZ(ep.getX(i),ep.getY(i),time,bend,wind));ep.needsUpdate=true;
    this.updateBridle(time,bend,wind);
    if(this.tail.visible){const p=this.tail.geometry.attributes.position;let k=0;const point=t=>v3(Math.sin(time*3.3-t*7)*t*.08,-.4-t*1.1,-.01-Math.sin(t*4+time*1.8)*t*.1);for(let i=0;i<38;i++){const a=point(i/38),b=point((i+1)/38),w=.014*(1-i/50);for(const q of [[a,-w],[a,w],[b,w],[a,-w],[b,w],[b,-w]])p.setXYZ(k++,q[0].x+q[1],q[0].y,q[0].z);}p.needsUpdate=true;this.tail.geometry.computeVertexNormals();}
  }
}

export class Landscape {
  constructor(canvas,physics){
    this.physics=physics;this.canvas=canvas;this.time=0;this.follow=true;this.zoom=false;this.orbit=new OrbitCamera();this.yaw=0;this.pitch=.1;this.width=1;this.height=1;
    this.renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.7));this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.25;
    this.scene=new THREE.Scene();this.scene.fog=new THREE.Fog(0xc2cfbe,65,205);
    this.camera=new THREE.PerspectiveCamera(52,1,.05,350);this.camera.position.set(0,1.7,1.2);this.scene.add(this.camera);
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
    }
    this.clashGlow=mesh(new THREE.SphereGeometry(.07,8,6),0xffcf73);this.clashGlow.material=new THREE.MeshBasicMaterial({color:0xffd780});this.clashGlow.visible=false;this.scene.add(this.clashGlow);
    this.kiteShadow=mesh(new THREE.CircleGeometry(.43,24),0x445037);this.kiteShadow.material.transparent=true;this.kiteShadow.material.opacity=.15;this.kiteShadow.rotation.x=-Math.PI/2;this.scene.add(this.kiteShadow);
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
    const skyGeo=new THREE.SphereGeometry(300,24,16);
    const skyMat=new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,uniforms:{top:{value:new THREE.Color(0x7bafc8)},bottom:{value:new THREE.Color(0xe6e6cd)}},vertexShader:'varying vec3 vPos; void main(){vPos=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:'uniform vec3 top;uniform vec3 bottom;varying vec3 vPos;void main(){float h=clamp(normalize(vPos).y*1.7,0.0,1.0);gl_FragColor=vec4(mix(bottom,top,pow(h,.6)),1.0);}',fog:false});
    this.scene.add(new THREE.Mesh(skyGeo,skyMat));
    const sun=mesh(new THREE.SphereGeometry(3,20,16),0xfff5d1);sun.material=new THREE.MeshBasicMaterial({color:0xfff5d1});sun.position.set(-75,100,-150);this.scene.add(sun);
    const cloudCanvas=document.createElement('canvas');cloudCanvas.width=256;cloudCanvas.height=128;const ctx=cloudCanvas.getContext('2d');const rand=seeded(54);
    for(let i=0;i<24;i++){const x=40+rand()*170,y=50+rand()*30,r=18+rand()*26;const g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,'rgba(255,253,235,.15)');g.addColorStop(.5,'rgba(255,253,235,.1)');g.addColorStop(1,'rgba(255,253,235,0)');ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2);}
    const texture=new THREE.CanvasTexture(cloudCanvas);this.clouds=[];
    for(let i=0;i<17;i++){const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,opacity:.65,depthWrite:false,fog:true,color:0xffffff}));sprite.position.set((rand()-.5)*250,28+rand()*40,-65-rand()*130);sprite.scale.set(30+rand()*38,13+rand()*12,1);sprite.userData.baseX=sprite.position.x;this.scene.add(sprite);this.clouds.push(sprite);}
  }
  createLandscape(){
    const terrain=new THREE.PlaneGeometry(320,320,100,100);terrain.rotateX(-Math.PI/2);const pos=terrain.attributes.position;const colors=[];
    const color=new THREE.Color(),c1=new THREE.Color(0x8b985e),c2=new THREE.Color(0xb0ab72);
    for(let i=0;i<pos.count;i++){const x=pos.getX(i),z=pos.getZ(i);pos.setY(i,terrainHeight(x,z));const shade=(Math.sin(x*.13+z*.12)+Math.sin(x*.3-z*.09))*.15+.4;color.copy(c1).lerp(c2,shade);colors.push(color.r,color.g,color.b);}
    terrain.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));terrain.computeVertexNormals();this.scene.add(new THREE.Mesh(terrain,new THREE.MeshStandardMaterial({vertexColors:true,roughness:1})));
    const pathVertices=[];for(let i=0;i<100;i++){const z=8-i*1.3,z2=z-1.3;const x=3+Math.sin(-z*.045)*3,x2=3+Math.sin(-z2*.045)*3;const w=.7;for(const [a,b] of [[x-w,z],[x+w,z],[x2+w,z2],[x-w,z],[x2+w,z2],[x2-w,z2]])pathVertices.push(a,terrainHeight(a,b)+.025,b);}
    const pathGeo=new THREE.BufferGeometry();pathGeo.setAttribute('position',new THREE.Float32BufferAttribute(pathVertices,3));pathGeo.computeVertexNormals();this.scene.add(new THREE.Mesh(pathGeo,new THREE.MeshStandardMaterial({color:0xc3b890,roughness:1,side:THREE.DoubleSide})));
    this.createMountains();this.createGrass();
    const rand=seeded(81);for(let i=0;i<24;i++){const x=(rand()-.5)*150,z=-38-rand()*100;if(Math.abs(x)<9)continue;this.createTree(x,z,2.5+rand()*4);}
    // A simple wind ribbon on a field post gives a second, diegetic wind cue.
    const post=mesh(new THREE.CylinderGeometry(.035,.045,2.7,6),0x897855);post.position.set(-5.6,1.35,-9);this.scene.add(post);
    this.ribbon=new THREE.Mesh(new THREE.PlaneGeometry(.17,1.25,1,12),new THREE.MeshStandardMaterial({color:0xc58a53,side:THREE.DoubleSide,roughness:1}));this.ribbon.geometry.translate(0,-.625,0);this.ribbon.position.set(-5.6,2.66,-9);this.scene.add(this.ribbon);
    this.ribbonBase=new Float32Array(this.ribbon.geometry.attributes.position.array);
  }
  createMountains(){
    const rand=seeded(133);for(let layer=0;layer<3;layer++){
      const vertices=[],z=-190+layer*27,base=-3;let previous=8;
      for(let i=0;i<22;i++){const x=-180+i*17,next=8+rand()*16+(layer===0?10:0);vertices.push(x,base,z,x,previous,z,x+17,next,z,x,base,z,x+17,next,z,x+17,base,z);previous=next;}
      const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geo.computeVertexNormals();this.scene.add(new THREE.Mesh(geo,new THREE.MeshBasicMaterial({color:[0xadbeb4,0x97b0a2,0x809b8b][layer],side:THREE.DoubleSide,fog:true})));
    }
  }
  createGrass(){
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute([-.04,0,0,.04,0,0,.01,.55,.02,0,0,-.04,0,0,.04,.03,.4,.02],3));geo.computeVertexNormals();
    const mat=new THREE.MeshStandardMaterial({color:0x90995b,roughness:1,side:THREE.DoubleSide,vertexColors:false});
    this.grassUniform={value:0};mat.onBeforeCompile=shader=>{shader.uniforms.uTime=this.grassUniform;shader.vertexShader='uniform float uTime;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n transformed.x += sin(uTime * 1.8 + instanceMatrix[3].x * .7 + instanceMatrix[3].z * .3) * position.y * .15; transformed.z += cos(uTime * 1.3 + instanceMatrix[3].z * .6) * position.y * .08;');};
    const grass=new THREE.InstancedMesh(geo,mat,4500);const rand=seeded(913),dummy=new THREE.Object3D(),c=new THREE.Color();
    for(let i=0;i<4500;i++){let x=(rand()-.5)*85,z=7-rand()*90;const pathX=3+Math.sin(-z*.045)*3;if(Math.abs(x-pathX)<.9)x+=1.9;dummy.position.set(x,terrainHeight(x,z),z);dummy.rotation.y=rand()*Math.PI;dummy.scale.setScalar(.35+rand()*1.4);dummy.updateMatrix();grass.setMatrixAt(i,dummy.matrix);c.setHex([0x879753,0xa9a56a,0x7e8d54,0xb5ad77][Math.floor(rand()*4)]);grass.setColorAt(i,c);}this.scene.add(grass);
    const flowers=new THREE.InstancedMesh(new THREE.SphereGeometry(.035,5,4),new THREE.MeshStandardMaterial({color:0xe0cf9b,roughness:1}),220);
    for(let i=0;i<220;i++){const x=(rand()-.5)*30,z=2-rand()*26;dummy.position.set(x,terrainHeight(x,z)+.25+rand()*.2,z);dummy.scale.setScalar(.6+rand());dummy.updateMatrix();flowers.setMatrixAt(i,dummy.matrix);}this.scene.add(flowers);
  }
  createTree(x,z,height){
    const tree=new THREE.Group(),trunk=mesh(new THREE.CylinderGeometry(.05,.11,height*.65,5),0x6e6c4d);trunk.position.y=height*.32;tree.add(trunk);
    for(let i=0;i<3;i++){const crown=mesh(new THREE.IcosahedronGeometry(height*(.28-i*.04),0),[0x607c56,0x69825c,0x70885f][i]);crown.scale.set(1,.85,1);crown.position.set(Math.sin(i*4)*height*.12,height*(.56+i*.14),Math.cos(i*3)*height*.1);tree.add(crown);}tree.position.set(x,terrainHeight(x,z),z);this.scene.add(tree);
  }
  createReel(){
    this.handRig=new THREE.Group();this.handRig.position.set(.29,-.255,-.57);this.handRig.rotation.set(.08,-.38,-.2);this.handRig.scale.setScalar(.85);this.camera.add(this.handRig);
    this.spool=new THREE.Group();this.handRig.add(this.spool);
    const woodMat=new THREE.MeshStandardMaterial({color:0x986644,roughness:.85});
    for(const x of [-.085,.085]){const disk=new THREE.Mesh(new THREE.CylinderGeometry(.112,.112,.019,28),woodMat);disk.rotation.z=Math.PI/2;disk.position.x=x;this.spool.add(disk);const center=mesh(new THREE.CylinderGeometry(.026,.026,.026,16),0x664e38);center.rotation.z=Math.PI/2;center.position.x=x+(x>0?.014:-.014);this.spool.add(center);}
    const thread=mesh(new THREE.CylinderGeometry(.082,.082,.15,28),0xd6c9a5);thread.rotation.z=Math.PI/2;this.spool.add(thread);
    for(let i=0;i<15;i++){const loop=new THREE.Mesh(new THREE.TorusGeometry(.083,.0016,3,32),new THREE.MeshStandardMaterial({color:i%3?0xd6c6a2:0xbca77e,roughness:1}));loop.rotation.y=Math.PI/2;loop.position.x=-.069+i*.0098;this.spool.add(loop);}
    const handMat=new THREE.MeshStandardMaterial({color:0xc59675,roughness:.95});
    const palm=new THREE.Mesh(new THREE.CapsuleGeometry(.039,.09,4,9),handMat);palm.rotation.z=-.55;palm.position.set(.115,-.045,.035);this.handRig.add(palm);
    for(let i=0;i<4;i++){const finger=new THREE.Mesh(new THREE.CapsuleGeometry(.011,.053,3,7),handMat);finger.rotation.set(.1,.2,-.65);finger.position.set(.105+i*.014,-.035-i*.018,-.015+i*.013);this.handRig.add(finger);}
    const thumb=new THREE.Mesh(new THREE.CapsuleGeometry(.015,.043,3,8),handMat);thumb.rotation.set(.2,.2,.9);thumb.position.set(.064,.006,.07);this.handRig.add(thumb);
    const sleeve=mesh(new THREE.CylinderGeometry(.055,.078,.39,9),0xc9cab4);sleeve.rotation.z=.42;sleeve.position.set(.19,-.23,.08);this.handRig.add(sleeve);
    const cuff=mesh(new THREE.CylinderGeometry(.057,.06,.045,9),0xa3ad97);cuff.rotation.z=.42;cuff.position.set(.124,-.077,.078);this.handRig.add(cuff);
    this.ropeAnchor=new THREE.Object3D();this.ropeAnchor.position.set(0,.085,0);this.handRig.add(this.ropeAnchor);
  }
  resize(){this.width=window.innerWidth;this.height=window.innerHeight;this.camera.aspect=this.width/this.height;this.camera.updateProjectionMatrix();this.renderer.setSize(this.width,this.height,false);}
  configure(s){this.kite.configure(s);}
  drag(dx,dy){if(this.orbit.active){this.orbit.drag(dx,dy);return;}if(this.follow){this.camera.getWorldDirection(this.forward);this.yaw=Math.atan2(this.forward.x,-this.forward.z);this.pitch=Math.asin(this.forward.y);}this.follow=false;this.yaw-=dx*.0035;this.pitch=clamp(this.pitch+dy*.003,-.35,1.4);}
  updateTether(line,p){
    const r=p.rope,attr=line.geometry.attributes.position,colors=line.geometry.attributes.color,fray=line.userData.fray.geometry.attributes.position;let index=0,fi=0;
    const tint=new THREE.Color();
    for(let i=0;i<r.points.length-1;i++){
      if(i===r.broken)continue;
      const wear=r.broken<0?r.wearAt(i):0,contact=r.contactAge<.1&&Math.abs(i-r.contactEdge)<2;
      tint.set(wear>.25?0xdf9a5e:contact?0xffd78e:p===this.physics?0xf8efc8:p.partyTint||0x64aaa8);
      for(const id of [i,i+1]){this._temp.copy(r.points[id]);attr.setXYZ(index,this._temp.x,this._temp.y,this._temp.z);colors.setXYZ(index++,tint.r,tint.g,tint.b);}
      if(wear>.2&&fi<116){this._temp.copy(r.points[i]).lerp(r.points[i+1],.5);const q=this._temp,size=.025+wear*.035;fray.setXYZ(fi++,q.x-size,q.y+size,q.z);fray.setXYZ(fi++,q.x,q.y,q.z);fray.setXYZ(fi++,q.x,q.y,q.z);fray.setXYZ(fi++,q.x+size,q.y+size*.6,q.z+.02);}
    }
    attr.needsUpdate=true;colors.needsUpdate=true;line.geometry.setDrawRange(0,index);fray.needsUpdate=true;line.userData.fray.geometry.setDrawRange(0,fi);line.userData.fray.visible=line.visible;
    line.userData.tips.visible=r.broken>=0&&line.visible;if(r.broken>=0){const tips=line.userData.tips.geometry.attributes.position;for(let k=0;k<2;k++){const q=r.points[r.broken+k];tips.setXYZ(k,q.x,q.y,q.z);}tips.needsUpdate=true;}
  }
  render(dt,mode,paused){
    const p=this.physics,intro=mode==='intro',inDuel=!intro&&!!this.duel?.visible;const orbital=!intro&&this.orbit.active;if(!orbital)positionView(this.camera,inDuel,dt,this.duel?.partyMode?this.duel.npcCount:1);const orbitFrame=orbital?this.orbit.frame(this.camera,p.position,dt):null,duelFrame=inDuel&&!orbital?frameDuel(this.camera,this.duel):null;this.time=p.time;
    this.grassUniform.value=p.time*(p.profile==='calm'?.05:.45+p.windSpeed*.12);
    for(const cloud of this.clouds)cloud.position.x=cloud.userData.baseX+Math.sin(p.time*.008)*9;
    if(intro){this.kite.group.position.set((this.width<760?1.7:4.3)+Math.sin(p.time*.47)*.25,p.profile==='calm'?.5:(this.width<760?7.4:6.1)+Math.sin(p.time*.7)*.2,-14);this.kite.group.rotation.set(-.38,.1,Math.sin(p.time*.66)*.08-.13);this.kite.group.scale.setScalar(1.45);}
    else{this.kite.group.position.copy(p.position);this.kite.group.quaternion.copy(p.orientation);this.kite.group.scale.setScalar(1);if(p.state==='ready'||p.state==='grounded'){this.kite.group.rotation.set(-.3,0,.17);}}
    this.kite.animate(p.time,intro?.45:p.bend,p.wind.length());
    this.kiteShadow.position.set(this.kite.group.position.x,.05+terrainHeight(this.kite.group.position.x,this.kite.group.position.z),this.kite.group.position.z);this.kiteShadow.material.opacity=.15/(1+this.kite.group.position.y*.3);this.kiteShadow.scale.setScalar(1+this.kite.group.position.y*.07);
    if(intro)this._temp.set(this.width<760?0:0,3.8,-24);
    else if(orbital)this._temp.copy(orbitFrame.target);
    else if(this.follow){if(duelFrame)this._temp.copy(duelFrame.target);else{this._temp.copy(p.position);this._temp.y+=p.state==='flying'?-.7:.8;}}
    else this._temp.set(Math.sin(this.yaw)*Math.cos(this.pitch),Math.sin(this.pitch),-Math.cos(this.yaw)*Math.cos(this.pitch)).add(this.camera.position);
    this.targetCamera.position.copy(this.camera.position);this.targetCamera.lookAt(this._temp);
    if(orbital)this.camera.quaternion.copy(this.targetCamera.quaternion);else this.camera.quaternion.slerp(this.targetCamera.quaternion,1-Math.exp(-dt*(intro?2:3.5)));
    const fov=intro?50:orbitFrame?orbitFrame.fov:duelFrame?(this.follow?duelFrame.fov:74):(this.zoom?35:this.width<760?63:54);this.camera.fov=mix(this.camera.fov,fov,1-Math.exp(-dt*6));this.camera.updateProjectionMatrix();
    const tugPulse=Math.sin(clamp((p.time-p.lastTug)/.2,0,1)*Math.PI);
    this.handRig.visible=!intro&&!orbital;this.handRig.position.y=(this.width<760?-.14:-.255)+Math.sin(p.time*1.6)*.002-tugPulse*.026;this.handRig.position.x=this.width<760?.11:.29;this.handRig.position.z=-.57;this.handRig.position.add(handViewOffset(this.camera));
    if(!paused&&p.action!=='hold')this.spool.rotation.x+=dt*(p.action==='reel'?3:-3)*(p.boost?2.5:1);
    this.scene.updateMatrixWorld();
    this.worldEnd.copy(this.kite.junction);this.kite.group.localToWorld(this.worldEnd);
    if(intro)this.worldStart.set(0,.4,1);else this.ropeAnchor.getWorldPosition(this.worldStart);
    if(!intro&&!orbital){const desired=this.camera.worldToLocal(p.anchor.clone()),actual=this.camera.worldToLocal(this.worldStart.clone());this.handRig.position.add(desired.sub(actual));this.scene.updateMatrixWorld();}
    this.rope.userData.fray.visible=!intro;this.rope.userData.tips.visible=!intro&&p.rope.broken>=0;
    if(intro){this.rope.geometry.attributes.color.array.fill(1);this.rope.geometry.attributes.color.needsUpdate=true;const attr=this.rope.geometry.attributes.position;for(let i=0;i<40;i++){for(let j=0;j<2;j++){const t=(i+j)/40;this._temp.copy(this.worldStart).lerp(this.worldEnd,t);this._temp.y-=Math.sin(t*Math.PI)*.32;attr.setXYZ(i*2+j,this._temp.x,this._temp.y,this._temp.z);}}attr.needsUpdate=true;this.rope.geometry.setDrawRange(0,80);}
    else this.updateTether(this.rope,p);
    this.rope.visible=true;
    const rivalVisible=!intro&&!!this.duel?.visible,rivals=this.duel?.rivals||[this.duel?.rival];this.clashGlow.visible=rivalVisible&&this.duel.contact;
    this.rivalVisuals.forEach((visual,i)=>{const b=rivals[i],visible=rivalVisible&&!!b;visual.kite.group.visible=visible;visual.pilot.visible=visible;visual.rope.visible=visible;visual.rope.userData.fray.visible=visible;visual.rope.userData.tips.visible=visible&&b.rope.broken>=0;
      if(visible){visual.kite.group.position.copy(b.position);visual.kite.group.quaternion.copy(b.orientation);visual.kite.animate(p.time,b.bend,b.wind.length());visual.pilot.position.set(b.anchor.x,0,b.anchor.z);this.updateTether(visual.rope,b);}
    });if(this.clashGlow.visible)this.clashGlow.position.copy(this.duel.contactPoint);
    this.trailView.update(!intro?this.trail:null,this.camera,p.time);
    this.renderer.render(this.scene,this.camera);
    this.screenPoint.copy(this.kite.group.position).project(this.camera);this.nosePoint.set(0,.4,0);this.kite.group.localToWorld(this.nosePoint);this.nosePoint.project(this.camera);
    const projected=q=>{const o=q.clone().project(this.camera);return {x:(o.x*.5+.5)*this.width,y:(.5-o.y*.5)*this.height,behind:o.z>1,visible:o.z<1&&Math.abs(o.x)<.95&&Math.abs(o.y)<.95};};
    return {trail:this.trail?.active&&this.trail.target?projected(this.trail.target):null,rivals:rivalVisible?rivals.map(b=>projected(b.position)):[],rival:rivalVisible?projected(this.duel.rival.position):null,clash:this.duel?.contact?projected(this.duel.contactPoint):null,x:(this.screenPoint.x*.5+.5)*this.width,y:(-.5*this.screenPoint.y+.5)*this.height,visible:this.screenPoint.z<1&&Math.abs(this.screenPoint.x)<.94&&Math.abs(this.screenPoint.y)<.95,angle:Math.atan2((this.nosePoint.x-this.screenPoint.x)*this.width,(this.nosePoint.y-this.screenPoint.y)*this.height)*180/Math.PI,size:Math.abs((this.nosePoint.y-this.screenPoint.y)*this.height)};
  }
}
