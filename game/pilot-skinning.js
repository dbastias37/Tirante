import {Quaternion} from './vendor/three.module.js';
// Rigid dual quaternion blends keep sleeve sections round through a bend.
// Bone matrices contain rotation+translation only (no scale/shear).
export class VolumeSkinning{
 constructor(count){this.real=Array.from({length:count},()=>new Float64Array(4));this.dual=Array.from({length:count},()=>new Float64Array(4));this.rotation=new Quaternion();}
 setBone(index,matrix){
  const e=matrix.elements,q=this.rotation.setFromRotationMatrix(matrix).normalize(),r=this.real[index],d=this.dual[index],x=e[12],y=e[13],z=e[14];
  r.set([q.x,q.y,q.z,q.w]);d[0]=.5*(x*q.w+y*q.z-z*q.y);d[1]=.5*(-x*q.z+y*q.w+z*q.x);d[2]=.5*(x*q.y-y*q.x+z*q.w);d[3]=-.5*(x*q.x+y*q.y+z*q.z);
 }
 deform(rest,bones,weights,out){
  const rr=this.real,dd=this.dual;
  for(let i=0;i<rest.length;i+=3){
   let anchor=0;for(let j=1;j<3;j++)if(weights[i+j]>weights[i+anchor])anchor=j;const ref=rr[bones[i+anchor]];
   let rx=0,ry=0,rz=0,rw=0,dx=0,dy=0,dz=0,dw=0;
   for(let j=0;j<3;j++){
    if(!weights[i+j])continue;const r=rr[bones[i+j]],d=dd[bones[i+j]],w=weights[i+j]*(r[0]*ref[0]+r[1]*ref[1]+r[2]*ref[2]+r[3]*ref[3]<0?-1:1);
    rx+=r[0]*w;ry+=r[1]*w;rz+=r[2]*w;rw+=r[3]*w;dx+=d[0]*w;dy+=d[1]*w;dz+=d[2]*w;dw+=d[3]*w;
   }
   const inv=1/Math.hypot(rx,ry,rz,rw);rx*=inv;ry*=inv;rz*=inv;rw*=inv;dx*=inv;dy*=inv;dz*=inv;dw*=inv;
   const x=rest[i],y=rest[i+1],z=rest[i+2],cx=2*(ry*z-rz*y),cy=2*(rz*x-rx*z),cz=2*(rx*y-ry*x);
   out[i]=x+rw*cx+ry*cz-rz*cy+2*(-dw*rx+dx*rw-dy*rz+dz*ry);
   out[i+1]=y+rw*cy+rz*cx-rx*cz+2*(-dw*ry+dx*rz+dy*rw-dz*rx);
   out[i+2]=z+rw*cz+rx*cy-ry*cx+2*(-dw*rz-dx*ry+dy*rx+dz*rw);
  }
 }
}
