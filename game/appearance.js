export const PALETTE=Object.freeze({terracotta:'#c96343',teal:'#397f80',saffron:'#d3a138',plum:'#92709b',sky:'#699ebc',forest:'#426f4e',cream:'#f5edda',charcoal:'#333d3b'});
export const PRINT_ID=/^[a-f0-9]{64}$/;
export function appearance(s={}) {
  if(!s||typeof s!=='object')s={};
  return {
    color:Object.hasOwn(PALETTE,s.color)?s.color:'terracotta',
    paperColor:typeof s.paperColor==='string'&&/^#[a-f0-9]{6}$/i.test(s.paperColor)?s.paperColor.toLowerCase():null,
    sailStyle:['classic','solid','image'].includes(s.sailStyle)?s.sailStyle:'classic',
    printId:typeof s.printId==='string'&&PRINT_ID.test(s.printId)?s.printId:'',
    imageFit:s.imageFit==='contain'?'contain':'cover',
    imageScale:Number.isFinite(s.imageScale)?Math.max(1,Math.min(2.5,s.imageScale)):1
  };
}
export function paperColor(s) {const a=appearance(s);return a.paperColor||PALETTE[a.color];}
export function printURL(id) {return PRINT_ID.test(id)?`/api/prints/${id}`:'';}
