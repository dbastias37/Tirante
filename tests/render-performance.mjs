import assert from 'node:assert/strict';
import {Vector3,Scene,PerspectiveCamera,Quaternion} from '../game/vendor/three.module.js';
import {visitRopePairs} from '../game/rope-broadphase.js';
import {PaperKite,Landscape} from '../game/scene.js';
import {CanvasLandscape} from '../game/canvas-scene.js';
import {KitePhysics,DEFAULT_SETUP} from '../game/physics.js';
import {PAPER_OPACITY,FIELD_SIZE,CAMERA_FAR,FOG_NEAR,HORIZON_RADIUS,terrainHeight,renderPixelRatio} from '../game/render-settings.js';

// Compare candidates AND their order against an independent all-pairs oracle.
// Preserving order matters because the iterative collision solver is sequential.
function brute(ropes,swept,radius){
 const edges=ropes.flatMap((r,ri)=>r.broken>=0?[]:r.points.slice(1).map((_,i)=>({r,ri,i}))),hits=[];
 for(let x=0;x<edges.length;x++)for(let y=x+1;y<edges.length;y++){
  const a=edges[x],b=edges[y];if(a.ri===b.ri&&b.i-a.i<2)continue;
  const points=e=>[e.r.points[e.i],e.r.points[e.i+1],...(swept?[e.r.previous[e.i],e.r.previous[e.i+1]]:[])];
  const A=points(a),B=points(b);
  if(['x','y','z'].every(k=>Math.min(...A.map(p=>p[k]))<=Math.max(...B.map(p=>p[k]))+radius&&Math.min(...B.map(p=>p[k]))<=Math.max(...A.map(p=>p[k]))+radius))hits.push([a.ri,a.i,b.ri,b.i]);
 }
 return hits;
}
let seed=3581;const rand=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);
for(let trial=0;trial<50;trial++){
 const ropes=Array.from({length:1+trial%4},()=>({broken:-1,points:Array.from({length:8+trial%21},()=>new Vector3(rand()*9,rand()*9,rand()*9))}));
 for(const r of ropes)r.previous=r.points.map(q=>q.clone().add(new Vector3(rand()-.5,rand()-.5,rand()-.5)));
 for(const swept of [false,true])for(const radius of [0,.004,.02]){
  const hits=[];visitRopePairs(ropes,swept,radius,(a,b)=>hits.push([a.ri,a.i,b.ri,b.i]));assert.deepEqual(hits,brute(ropes,swept,radius));
 }
 // Reuse scratch after a reset, a fracture, and a reordered roster.
 ropes[0].broken=3;ropes.reverse();const hits=[];visitRopePairs(ropes,true,.02,(a,b)=>hits.push([a.ri,a.i,b.ri,b.i]));assert.deepEqual(hits,brute(ropes,true,.02));
}
const long=Array.from({length:4},(_,r)=>{const points=Array.from({length:29},(_,i)=>new Vector3(r*3,1.35+i*4,-i*3));return {points,previous:points.map(p=>p.clone()),broken:-1};});
const checks=visitRopePairs(long,true,.02,()=>{}),allPairs=112*111/2;
assert.ok(checks<allPairs/5,`${checks} candidate bounds checks vs ${allPairs} all-pairs`);

const paper=new PaperKite();paper.configure(DEFAULT_SETUP);paper.animate(1.3,.8,8);
for(const panel of paper.panels){
 assert.equal(panel.material.opacity,.45);assert.equal(panel.material.transparent,true);assert.equal(panel.material.depthWrite,false);assert.equal(panel.material.forceSinglePass,true);
 const g=panel.geometry,p=g.attributes.position;let area=0;
 for(let i=0;i<g.index.count;i+=3){const a=new Vector3().fromBufferAttribute(p,g.index.getX(i)),b=new Vector3().fromBufferAttribute(p,g.index.getX(i+1)),c=new Vector3().fromBufferAttribute(p,g.index.getX(i+2));area+=Math.abs((b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x))/2;}
 assert.ok(Math.abs(area-.08)<1e-7,'Indexed panels cover the full diamond without overlapping or missing triangles');
 assert.ok([...g.attributes.normal.array].every(Number.isFinite));
}
const vertexCount=paper.panels.reduce((n,p)=>n+p.geometry.attributes.position.count,0);assert.ok(vertexCount<200);
const landscape=Object.create(Landscape.prototype);landscape.scene=new Scene();landscape.createLandscape();
const ground=landscape.scene.children.find(m=>m.geometry?.parameters?.width===FIELD_SIZE);
assert.ok(ground);assert.equal(ground.geometry.parameters.height,FIELD_SIZE);assert.ok(ground.geometry.index.count/3<10000);assert.ok(!landscape.scene.children.some(m=>m.isInstancedMesh));
assert.ok(FOG_NEAR>150&&HORIZON_RADIUS>300&&CAMERA_FAR>FIELD_SIZE);
for(let i=0;i<360;i++){const angle=i*Math.PI/180;assert.ok(terrainHeight(Math.sin(angle)*914.4,Math.cos(angle)*914.4)===0);}
assert.equal(renderPixelRatio(3,true),1.25);assert.equal(renderPixelRatio(1,true),1);

// Observe actual Canvas draw calls: paper has one 45% compositing layer;
// spars, bridles and contour restore normal opacity, including printed sails.
function context(){const calls=[],stack=[];return {calls,globalAlpha:1,save(){stack.push(this.globalAlpha);},restore(){this.globalAlpha=stack.pop();},beginPath(){},moveTo(){},lineTo(){},closePath(){},arc(){},clip(){},transform(){},fillRect(){},fill(){calls.push(['fill',this.globalAlpha]);},stroke(){calls.push(['stroke',this.globalAlpha]);},drawImage(){calls.push(['image',this.globalAlpha]);}};}
const ctx=context(),canvas=Object.create(CanvasLandscape.prototype);canvas.ctx=ctx;canvas.physics=new KitePhysics();canvas.width=800;canvas.height=600;canvas.camera=new PerspectiveCamera(50,4/3,.05,CAMERA_FAR);canvas.camera.position.set(0,0,3);canvas.camera.lookAt(0,0,0);canvas.camera.updateMatrixWorld();canvas.kiteRotation=new Quaternion();canvas.kitePosition=new Vector3();canvas.kiteScale=1;
globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>context()})};
for(const setup of [{...DEFAULT_SETUP,tail:false},{...DEFAULT_SETUP,tail:false,sailStyle:'solid',paperColor:'#cc0000'},{...DEFAULT_SETUP,tail:false,sailStyle:'image',printId:'ab'.repeat(32)}]){
 ctx.calls.length=0;canvas.drawKite(1,false,canvas.physics,setup);
 const fills=ctx.calls.filter(([op])=>op==='fill'),images=ctx.calls.filter(([op])=>op==='image');
 if(setup.sailStyle==='image'){assert.equal(fills.length,0);assert.ok(images.length>0);assert.ok(images.every(c=>c[1]===PAPER_OPACITY));}
 else {assert.equal(fills.length,4);assert.ok(fills.every(c=>c[1]===PAPER_OPACITY));}
 assert.ok(ctx.calls.filter(c=>c[0]==='stroke').every(c=>c[1]===1));assert.equal(ctx.globalAlpha,1);
}
delete globalThis.document;
console.log(`PASS: ordered broadphase equivalence, ${checks}/${allPairs} bounds checks for four long lines, ${vertexCount} sail vertices, complete indexed panels, 45% WebGL/Canvas/printed paper, green field geometry and flat 1,000 yd radius.`);
