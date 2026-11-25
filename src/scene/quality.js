// Device-aware quality tiers. The tier decides texture sizes, shadow resolution and which
// post-processing passes run. The adaptive governor in world.js can step the tier down at runtime.

export const TIERS = {
  high: {
    id: "high", textureSize: 1024, coverSize: 1024, shadowMap: 2048, dprCap: 2, msaa: 4,
    ao: true, reflections: true, bloom: true, grade: true, dof: true, shafts: true, dust: 420, spots: 4, anisotropy: 8, spotShadows: 1
  },
  medium: {
    id: "medium", textureSize: 1024, coverSize: 768, shadowMap: 1024, dprCap: 1.5, msaa: 0,
    ao: false, reflections: false, bloom: true, grade: true, dof: false, shafts: true, dust: 220, spots: 3, anisotropy: 4, spotShadows: 0
  },
  low: {
    id: "low", textureSize: 512, coverSize: 512, shadowMap: 1024, dprCap: 1.25, msaa: 0,
    ao: false, reflections: false, bloom: false, grade: true, dof: false, shafts: true, dust: 90, spots: 1, anisotropy: 2, spotShadows: 0
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
