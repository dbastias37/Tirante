// Shared by WebGL and the Canvas compatibility renderer.
export const PAPER_OPACITY = .45;
export const FIELD_SIZE = 2400;
export const CAMERA_NEAR = .15;
export const CAMERA_FAR = 4000;
export const SKY_RADIUS = 3200;
export const HORIZON_RADIUS = 1450;
export const FOG_NEAR = 1050;
export const FOG_FAR = 2800;

export function renderPixelRatio(deviceRatio = 1, inDuel = false) {
  return Math.min(deviceRatio || 1, inDuel ? 1.25 : 1.5);
}

// The entire 1,000 yd flying radius stays flat, matching the physics ground.
export function terrainHeight(x, z) {
  const fade = Math.max(0, Math.min(1, (Math.hypot(x, z) - 960) / 160));
  const edgeFade=Math.max(0,Math.min(1,(FIELD_SIZE/2-Math.max(Math.abs(x),Math.abs(z)))/40));
  return fade * edgeFade * (Math.sin(x * .035 + .4) * 2.1 + Math.sin(z * .035) * 1.3 + .6);
}
