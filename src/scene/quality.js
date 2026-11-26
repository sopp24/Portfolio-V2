// Device-aware quality tiers. The tier decides texture sizes, shadow resolution and which
// post-processing passes run. The adaptive governor in world.js can step the tier down at runtime.
//
// Art direction v2 ("Midnight Video, but by day") adds the look knobs below. Every new effect is gated here so the
// low tier stays cheap:
//   grade       - strength of the display grade extras (split tone, vibrance, vignette tint, grain)
//   sharpen     - unsharp amount applied inside the grade pass (4 extra taps)  [0 = off]
//   smaa        - SMAA edge anti-aliasing after the grade (medium: the only AA; high uses 4x MSAA, low none)
//   bloomStrength / bloomRadius / bloomThreshold - HDR bloom (neon + windows + sun glints)
//   skyFill     - cool shadow-free "sky" directional fill (coloured shadows)
//   streetBounce - cool street bounce point lights through the windows
//   hazeFog     - atmospheric depth haze (scene.fog) tinted with the sky colour
//   envSize     - PMREM source resolution for the daylight image-based light
//   sunSoft     - sun shadow radius (higher = softer penumbra)
//   dapple      - shadow-only moving leaf canopy in the sun's path (leaf-shaped sunlight patches)
export const TIERS = {
  high: {
    id: "high", textureSize: 1024, coverSize: 1024, shadowMap: 2048, dprCap: 2, msaa: 4,
    ao: true, reflections: true, bloom: true, grade: 1, dof: true, shafts: true, dust: 420, spots: 4, anisotropy: 8, spotShadows: 1,
    sharpen: .16, smaa: false, bloomStrength: .17, bloomRadius: .62, bloomThreshold: 1.9, skyFill: true, streetBounce: true, hazeFog: true, envSize: 256, sunSoft: 2.4, dapple: true
  },
  medium: {
    id: "medium", textureSize: 1024, coverSize: 768, shadowMap: 1024, dprCap: 1.5, msaa: 0,
    ao: false, reflections: false, bloom: true, grade: 1, dof: false, shafts: true, dust: 220, spots: 3, anisotropy: 4, spotShadows: 0,
    sharpen: .1, smaa: true, bloomStrength: .15, bloomRadius: .55, bloomThreshold: 1.9, skyFill: true, streetBounce: false, hazeFog: true, envSize: 128, sunSoft: 2, dapple: true
  },
  low: {
    id: "low", textureSize: 512, coverSize: 512, shadowMap: 1024, dprCap: 1.25, msaa: 0,
    ao: false, reflections: false, bloom: false, grade: 1, dof: false, shafts: true, dust: 90, spots: 1, anisotropy: 2, spotShadows: 0,
    sharpen: 0, smaa: false, bloomStrength: 0, bloomRadius: .5, bloomThreshold: 1.2, skyFill: false, streetBounce: false, hazeFog: true, envSize: 64, sunSoft: 1.5, dapple: false
  }
};

export function detectTier(search = location.search) {
  const forced = new URLSearchParams(search).get("quality");
  if (forced && TIERS[forced]) return TIERS[forced];
  let stored = null;
  try { stored = localStorage.getItem("store.quality"); } catch { /* storage may be blocked */ }
  if (stored && TIERS[stored]) return TIERS[stored];
  const coarse = window.matchMedia?.("(pointer: coarse)").matches;
  const memory = Number(navigator.deviceMemory) || 0;
  const cores = Number(navigator.hardwareConcurrency) || 0;
  const smallScreen = Math.min(screen.width, screen.height) < 600;
  if (coarse || smallScreen) return memory >= 6 && cores >= 8 ? TIERS.medium : TIERS.low;
  if ((memory && memory <= 4) || (cores && cores <= 4)) return TIERS.medium;
  return TIERS.high;
}

export function stepDown(tier) {
  if (tier.id === "high") return TIERS.medium;
  if (tier.id === "medium") return TIERS.low;
  return null;
}

export function prefersReducedMotion() {
  return !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}
