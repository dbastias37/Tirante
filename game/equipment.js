// Commercial cotton numbers are not millimetres. Diameters below are approximate
// simulation grades; force/wear values are balanced game calibration, not ratings.
export const THREADS=Object.freeze([
  {id:'cotton-24',name:'Algodón fino · Nº 24',material:'Algodón',diameter:.35,mass:.085,strength:72,wear:.8,color:'#528b83',accent:'#deb15d',note:'Poco peso y resistencia al aire. Menos margen en cruces exigentes.'},
  {id:'cotton-10',name:'Algodón clásico · Nº 10',material:'Algodón pulido',diameter:.50,mass:.12,strength:90,wear:1,color:'#365b87',accent:'#d56e54',note:'Equilibrio entre peso, control y resistencia al desgaste.'},
  {id:'cotton-4',name:'Algodón grueso · Nº 4',material:'Algodón pulido',diameter:.65,mass:.20,strength:112,wear:1.3,color:'#b08b39',accent:'#5c796a',note:'Tolera más roce y tensión. Su peso y arrastre se notan con mucho hilo afuera.'},
  {id:'polyester-10',name:'Poliéster · Nº 10',material:'Poliéster',diameter:.45,mass:.10,strength:103,wear:1.12,color:'#bd5949',accent:'#d9a851',note:'Ligero y resistente. Responde con firmeza al recoger.'}
]);
export const REELS=Object.freeze([
  {id:'wood-6',name:'Madera · 6 pulgadas',diameter:15.2,mass:180,holes:5,speed:1,effort:1,color:'#c7a36d',rim:'#466b73',note:'Cinco perforaciones, cuerpo abierto y eje de madera. Un manejo equilibrado.'},
  {id:'wood-8',name:'Madera · 8 pulgadas',diameter:20.3,mass:245,holes:8,speed:1.08,effort:1.08,color:'#c59855',rim:'#4a433a',note:'Ocho perforaciones y aro oscuro. Recoge más hilo por vuelta y pide más esfuerzo.'},
  {id:'wood-10',name:'Madera · 10 pulgadas',diameter:25.4,mass:320,holes:5,speed:1.14,effort:1.16,color:'#d0b585',rim:'#b86a43',note:'Tambor amplio y borde de color. Más recogida por vuelta y más esfuerzo al tensar.'}
]);
export const BEARINGS=Object.freeze([
  {id:'bushing',name:'Buje de deslizamiento',mass:12,speed:.86,effort:1.14,friction:68,note:'Roce alto y giro contenido. Requiere más energía para mover el hilo.'},
  {id:'steel',name:'Rodamiento de bolas',mass:20,speed:1,effort:1,friction:36,note:'Bolas de acero visibles. Giro suave con una respuesta equilibrada.'},
  {id:'sealed',name:'Rodamiento sellado',mass:24,speed:1.08,effort:.92,friction:18,note:'Sellos a ambos lados. Menos fricción y menor gasto al recoger.'}
]);
export const DEFAULT_EQUIPMENT=Object.freeze({lineType:'cotton-10',reelType:'wood-6',bearingType:'steel'});
const pick=(list,id,fallback)=>list.find(x=>x.id===id)||list.find(x=>x.id===fallback);
export function cleanEquipment(value={}){value=value&&typeof value==='object'?value:{};return {lineType:pick(THREADS,value.lineType,DEFAULT_EQUIPMENT.lineType).id,reelType:pick(REELS,value.reelType,DEFAULT_EQUIPMENT.reelType).id,bearingType:pick(BEARINGS,value.bearingType,DEFAULT_EQUIPMENT.bearingType).id};}
export function equipmentStats(value={}){const s=cleanEquipment(value),thread=pick(THREADS,s.lineType),reel=pick(REELS,s.reelType),bearing=pick(BEARINGS,s.bearingType);return {thread,reel,bearing,speed:reel.speed*bearing.speed,effort:reel.effort*bearing.effort};}
