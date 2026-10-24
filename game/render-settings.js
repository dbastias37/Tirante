// Shared by WebGL and the Canvas compatibility renderer.
export const PAPER_OPACITY = .4;
export const FIELD_SIZE = 800;
export const CAMERA_FAR = 1200;
export const SKY_RADIUS = 900;
export const HORIZON_RADIUS = 360;
export const FOG_NEAR = 190;
export const FOG_FAR = 650;

export function renderPixelRatio(deviceRatio = 1, inDuel = false) {
  return Math.min(deviceRatio || 1, inDuel ? 1.25 : 1.5);
}

// The entire 150 m flying radius stays flat, matching the physics ground.
export function terrainHeight(x, z) {
  const fade = Math.max(0, Math.min(1, (Math.hypot(x, z) - 180) / 120));
  return fade * (Math.sin(x * .035 + .4) * 2.1 + Math.sin(z * .035) * 1.3 + .6);
}
