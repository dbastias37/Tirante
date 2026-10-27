// Depth-tested triangle drawing for the equipment preview when WebGL is absent.
// Sorting whole faces loses the holes and narrow rims at oblique angles.
export function rasterTriangle(target,a,b,c,rgb,rgbB=null,rgbC=null,texture=null){
  const {width,height,depth,data}=target;
  const smooth=rgbB!==null&&rgbC!==null;
  const red0=smooth?rgb[0]-rgbC[0]:0,red1=smooth?rgbB[0]-rgbC[0]:0;
  const green0=smooth?rgb[1]-rgbC[1]:0,green1=smooth?rgbB[1]-rgbC[1]:0;
  const blue0=smooth?rgb[2]-rgbC[2]:0,blue1=smooth?rgbB[2]-rgbC[2]:0;
  const area=(b.y-c.y)*(a.x-c.x)+(c.x-b.x)*(a.y-c.y);
  if(Math.abs(area)<1e-8)return;
  const left=Math.max(0,Math.floor(Math.min(a.x,b.x,c.x))),right=Math.min(width-1,Math.ceil(Math.max(a.x,b.x,c.x)));
  const top=Math.max(0,Math.floor(Math.min(a.y,b.y,c.y))),bottom=Math.min(height-1,Math.ceil(Math.max(a.y,b.y,c.y)));
  const dx0=(b.y-c.y)/area,dy0=(c.x-b.x)/area,dx1=(c.y-a.y)/area,dy1=(a.x-c.x)/area;
  let row0=((b.y-c.y)*(left+.5-c.x)+(c.x-b.x)*(top+.5-c.y))/area;
  let row1=((c.y-a.y)*(left+.5-c.x)+(a.x-c.x)*(top+.5-c.y))/area;
  for(let y=top;y<=bottom;y++,row0+=dy0,row1+=dy1){
    let w0=row0,w1=row1,index=y*width+left;
    for(let x=left;x<=right;x++,index++,w0+=dx0,w1+=dx1){
      if(w0<-.00001||w1<-.00001||w0+w1>1.00001)continue;
      const z=c.z+w0*(a.z-c.z)+w1*(b.z-c.z);
      if(z>=depth[index])continue;
      let r=smooth?rgbC[0]+w0*red0+w1*red1:rgb[0],g=smooth?rgbC[1]+w0*green0+w1*green1:rgb[1],b0=smooth?rgbC[2]+w0*blue0+w1*blue1:rgb[2];
      if(texture){
        const w2=1-w0-w1,den=w0*a.w+w1*b.w+w2*c.w;
        const u=(w0*a.u*a.w+w1*b.u*b.w+w2*c.u*c.w)/den,v=(w0*a.v*a.w+w1*b.v*b.w+w2*c.v*c.w)/den;
        const tx=Math.max(0,Math.min(texture.width-1,Math.round(u*texture.width-.5))),ty=Math.max(0,Math.min(texture.height-1,Math.round((1-v)*texture.height-.5))),at=(ty*texture.width+tx)*4,pixel=texture.data;
        if(pixel[at+3]<(texture.alphaTest??.45)*255)continue;
        r*=pixel[at]/255;g*=pixel[at+1]/255;b0*=pixel[at+2]/255;
      }
      depth[index]=z;const offset=index*4;
      data[offset]=r;data[offset+1]=g;data[offset+2]=b0;data[offset+3]=255;
    }
  }
}
