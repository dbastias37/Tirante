// Geometry shared by the workshop, WebGL and the software renderer.
export const HALF_SPAN = .4;
export const SPAR_OFFSET = -.007;
export const BRIDLE_OFFSET = .008;
const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
export function mountSettings(s={}) {
  if(!s||typeof s!=='object')s={};
  const left=Number.isFinite(s.anchorLeft)?clamp(s.anchorLeft,0,95):55;
  const right=Number.isFinite(s.anchorRight)?clamp(s.anchorRight,0,95):55;
  return {left,right,spread:(left+right)/200,center:(right-left)/200*HALF_SPAN};
}
export function bowHeight(x) { return .12*(1-(x/HALF_SPAN)**2); }
export function sailZ(x,y,time=0,bend=0,wind=0) {
  return -bend*.105*(Math.abs(x)/HALF_SPAN)**1.4 + Math.sin(time*14+x*20+y*15)*.0025*clamp(wind/5,0,1)*Math.abs(x)/HALF_SPAN;
}
export function bridleAnchors(s,time=0,bend=0,wind=0) {
  const m=mountSettings(s),xs=[-HALF_SPAN*m.left/100,HALF_SPAN*m.right/100];
  return [...xs.map(x=>[x,bowHeight(x),sailZ(x,bowHeight(x),time,bend,wind)+BRIDLE_OFFSET]),[0,-.28,BRIDLE_OFFSET]];
}
export function bridleJunction(trim) {
  return [clamp((trim.mountCenter||0)+(trim.lengthBias??trim.bias)*.045,-.22,.22),-.06+(trim.lower-52)*.004,.23];
}
