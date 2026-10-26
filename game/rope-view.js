import {Vector3} from './vendor/three.module.js';
export const LOOSE_SUBDIVISIONS=3;
export function displayStrands(rope,points=rope.points,cache=[]){
  if(rope.broken<0)return {points,broken:-1};
  let at=0,broken=-1;
  const put=q=>(cache[at++]||=new Vector3()).copy(q);
  for(const [start,end]of [[0,rope.broken],[rope.broken+1,points.length-1]]){
    if(start>0)broken=at-1;
    put(points[start]);
    for(let i=start;i<end;i++){
      const a=points[i],b=points[i+1],length=a.distanceTo(b),prev=points[Math.max(start,i-1)],next=points[Math.min(end,i+2)];
      const c1=b.clone().sub(prev).normalize().multiplyScalar(length*.22).add(a),c2=next.clone().sub(a).normalize().multiplyScalar(-length*.22).add(b);
      for(let j=1;j<=LOOSE_SUBDIVISIONS;j++){const t=j/LOOSE_SUBDIVISIONS,u=1-t,q=a.clone().multiplyScalar(u*u*u).addScaledVector(c1,3*u*u*t).addScaledVector(c2,3*u*t*t).addScaledVector(b,t*t*t);q.y=Math.max(.035,q.y);put(q);}
    }
  }
  cache.length=at;return {points:cache,broken};
}
