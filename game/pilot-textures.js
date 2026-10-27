import * as T from './vendor/three.module.js';
const cache=new Map();
// Each atlas is shared by all instances/LODs. Canvas uses the same pixels and
// UVs as WebGL; vertex colours remain a complete fallback while loading.
export function pilotTextureMaterial(path){
 const mat=new T.MeshStandardMaterial({color:0xffffff,roughness:.94,vertexColors:true,alphaTest:.45});
 if(typeof document==='undefined')return mat;
 let item=cache.get(path);
 if(!item){
  item={materials:[],texture:null,pixels:null};cache.set(path,item);
  new T.TextureLoader().load(new URL(path,import.meta.url).href,texture=>{
   texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=4;
   const canvas=document.createElement('canvas');canvas.width=texture.image.width;canvas.height=texture.image.height;
   const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(texture.image,0,0);
   item.texture=texture;item.pixels={width:canvas.width,height:canvas.height,data:ctx.getImageData(0,0,canvas.width,canvas.height).data,alphaTest:.45};
   for(const material of item.materials){material.map=texture;material.vertexColors=false;material.userData.pixels=item.pixels;material.needsUpdate=true;}
  });
 }
 item.materials.push(mat);
 if(item.texture){mat.map=item.texture;mat.vertexColors=false;mat.userData.pixels=item.pixels;}
 return mat;
}
