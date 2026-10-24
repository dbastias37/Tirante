import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {KitePhysics} from '../game/physics.js';
const trials=1000,dt=1/240,start=performance.now();let eligible=0,cuts=0,normalCuts=0,grounded=0;
for(let seed=0;seed<trials;seed++){
  const p=new KitePhysics(undefined,{seed});p.profile='strong';p.windSpeed=9;p.launch();eligible+=p.extremeGustEligible;
  for(let tick=0;tick<40/dt&&p.state==='flying';tick++)p.step(dt);
  if(p.rope.broken>=0){cuts++;if(!p.extremeGustEligible)normalCuts++;}if(p.state==='grounded')grounded++;
  if((seed+1)%200===0)console.log(JSON.stringify({tested:seed+1,eligible,cuts,normalCuts,grounded}));
}
assert.equal(normalCuts,0);assert.ok(cuts/trials>=.075&&cuts/trials<=.125,'Strong-wind failure stays near 10% of sustained, taut flights');
console.log(JSON.stringify({trials,eligible,cuts,normalCuts,grounded,rate:cuts/trials,cpuMs:Math.round(performance.now()-start)}));
