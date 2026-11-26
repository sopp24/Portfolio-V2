// Post-processing chain, art direction v2 ("punchy filmic day"):
//   scene (linear HDR) -> GTAO (high) -> bloom -> depth of field (held record, high) -> GRADE (+ SMAA on medium)
// The GRADE pass replaces the old OutputPass + grade pair: ONE full-screen pass does exposure, contrast around mid-grey,
// coloured-shadow / warm-highlight split tone, saturation + vibrance, a colour-preserving tone map (Khronos "PBR Neutral"
// shoulder, so the palette hexes keep their hue), sRGB encoding, a gentle display S-curve, a light tinted vignette,
// fine grain, a luminance unsharp mask (tiers with `sharpen`) and the fade. No chromatic aberration.
import * as THREE from "three";
import { EffectComposer, RenderPass, UnrealBloomPass, GTAOPass, BokehPass, ShaderPass, SMAAPass } from "three-addons";

const GradeShader = {
  name: "StoreGrade",
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uExposure: { value: .8 },
    uContrast: { value: 1.16 },
    uSat: { value: 1.06 },
    uVibrance: { value: .2 },
    uShadowTint: { value: new THREE.Color(.9, .95, 1.12) },   // multiplies shadows: cool blue-violet
    uHighlightTint: { value: new THREE.Color(1.07, 1.0, .9) }, // multiplies highlights: warm orange
    uCurve: { value: .38 },
    uGrain: { value: .035 },
    uGrainAnim: { value: 1 },
    uVignette: { value: .24 },
    uSharpen: { value: 0 },
    uAspect: { value: 1 },
    uFade: { value: 1 },
    uResolution: { value: new THREE.Vector2(1, 1) }
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform float uTime, uExposure, uContrast, uSat, uVibrance, uCurve, uGrain, uGrainAnim, uVignette, uSharpen, uAspect, uFade;
    uniform vec3 uShadowTint, uHighlightTint;
    uniform vec2 uResolution;
    varying vec2 vUv;
    const vec3 LUMA = vec3(.2126, .7152, .0722);

    float hash(vec2 p) {
      vec3 p3 = fract(vec3(p.xyx) * .1031);
      p3 += dot(p3, p3.yzx + 33.33);
      return fract((p3.x + p3.y) * p3.z);
    }
    // Khronos PBR Neutral tone mapper: keeps base colours intact below the shoulder, compresses highlights toward white.
    vec3 toneNeutral(vec3 color) {
      const float startCompression = .8 - .04;
      const float desaturation = .15;
      float x = min(color.r, min(color.g, color.b));
      float offset = x < .08 ? x - 6.25 * x * x : .04;
      color -= offset;
      float peak = max(color.r, max(color.g, color.b));
      if (peak < startCompression) return color;
      float d = 1. - startCompression;
      float newPeak = 1. - d * d / (peak + d - startCompression);
      color *= newPeak / peak;
      float g = 1. - 1. / (desaturation * (peak - newPeak) + 1.);
      return mix(color, vec3(newPeak), g);
    }
    vec3 srgbEncode(vec3 c) {
      c = clamp(c, 0., 1.);
      return mix(c * 12.92, 1.055 * pow(c, vec3(1. / 2.4)) - .055, step(.0031308, c));
    }
    // HDR (linear) -> graded, tone-mapped, still linear display values
    vec3 grade(vec3 c) {
      c = max(c * uExposure, 0.);
      c = pow(c / .18, vec3(uContrast)) * .18;                         // contrast around mid grey
      float l = dot(c, LUMA);
      c *= mix(vec3(1.), uShadowTint, 1. - smoothstep(0., .5, l));      // coloured shadows
      c *= mix(vec3(1.), uHighlightTint, smoothstep(.55, 2.6, l));      // warm sun highlights
      float l2 = dot(c, LUMA);
      float mx = max(c.r, max(c.g, c.b)), mn = min(c.r, min(c.g, c.b));
      float chroma = (mx - mn) / (mx + 1e-4);
      c = mix(vec3(l2), c, uSat + uVibrance * (1. - chroma));           // saturation + vibrance (muted colours gain more)
      return toneNeutral(c);
    }
    void main() {
      vec3 hdr = texture2D(tDiffuse, vUv).rgb;
      vec3 c = grade(hdr);
      if (uSharpen > .001) {
        // luminance-only unsharp mask in a display-like (compressed) domain: 4 extra taps, no colour fringes, no halo on HDR highlights
        vec2 px = 1. / uResolution;
        float ln = (dot(texture2D(tDiffuse, vUv + vec2(px.x, 0.)).rgb, LUMA) + dot(texture2D(tDiffuse, vUv - vec2(px.x, 0.)).rgb, LUMA)
                  + dot(texture2D(tDiffuse, vUv + vec2(0., px.y)).rgb, LUMA) + dot(texture2D(tDiffuse, vUv - vec2(0., px.y)).rgb, LUMA)) * .25;
        float lc = dot(hdr, LUMA);
        c += clamp(lc / (1. + lc) - ln / (1. + ln), -.08, .08) * uSharpen * 2.4;
      }
      vec3 col = srgbEncode(c);
      col = mix(col, col * col * (3. - 2. * col), uCurve);                // display S-curve: punch without crushing
      // light vignette, tinted toward the shadow colour so it reads as sky-blue shade rather than black
      vec2 q = vUv - .5;
      float v = smoothstep(.95, .25, length(q * vec2(uAspect * .8, 1.) * 1.25));
      col *= mix(vec3(1.), mix(vec3(.74, .78, .95), vec3(1.), v), uVignette * 2.);
      // fine grain, luminance-weighted so shadows carry it
      float lum = dot(col, LUMA);
      col += (hash(vUv * uResolution + fract(uTime) * 61. * uGrainAnim) - .5) * uGrain * (1. - lum * .6);
      col *= uFade;
      gl_FragColor = vec4(col, 1.);
    }`
};

export function createPostFX({ renderer, scene, camera, quality, width, height, pixelRatio, aoHide = [], reducedMotion = false }) {
  const target = new THREE.WebGLRenderTarget(width * pixelRatio, height * pixelRatio, {
    type: THREE.HalfFloatType, samples: quality.msaa || 0
  });
  const composer = new EffectComposer(renderer, target);
  composer.setPixelRatio(pixelRatio);
  composer.setSize(width, height);
  const state = { ao: null, bloom: null, bokeh: null, smaa: null, dof: 0 };

  composer.addPass(new RenderPass(scene, camera));

  if (quality.ao) {
    try {
      const ao = new GTAOPass(scene, camera, width, height);
      ao.output = GTAOPass.OUTPUT.Default;
      ao.blendIntensity = .85;
      ao.updateGtaoMaterial({ radius: .55, distanceExponent: 1.5, thickness: 1.2, scale: 1.05, samples: 12, distanceFallOff: 1, screenSpaceRadius: false });
      ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, radiusExponent: 1, rings: 2, samples: 12 });
      // GTAO renders every visible mesh (transparent ones too) as solid geometry into its normal/depth pre-pass: hide the additive
      // light-shaft ribbons from it, otherwise their big slanted quads darken half the frame (a hard diagonal edge).
      const aoRender = ao.render.bind(ao);
      ao.render = (...args) => {
        const was = aoHide.map((o) => o.visible);
        aoHide.forEach((o) => { o.visible = false; });
        try { aoRender(...args); } finally { aoHide.forEach((o, i) => { o.visible = was[i]; }); }
      };
      composer.addPass(ao);
      state.ao = ao;
    } catch (error) { console.warn("GTAO unavailable, continuing without it.", error); }
  }
  if (quality.bloom) {
    // soft, wide bloom: neon tubes, bright windows, sun glints on glossy plastic - not a haze over the whole frame
    const bloom = new UnrealBloomPass(new THREE.Vector2(width, height), quality.bloomStrength ?? .26, quality.bloomRadius ?? .6, quality.bloomThreshold ?? 1.1);
    composer.addPass(bloom);
    state.bloom = bloom;
  }
  if (quality.dof) {
    try {
      const bokeh = new BokehPass(scene, camera, { focus: 1.4, aperture: 0, maxblur: .012 });
      bokeh.enabled = false;
      composer.addPass(bokeh);
      state.bokeh = bokeh;
    } catch (error) { console.warn("DOF unavailable.", error); }
  }
  const grade = new ShaderPass(GradeShader);
  composer.addPass(grade);
  grade.uniforms.uResolution.value.set(width * pixelRatio, height * pixelRatio);
  grade.uniforms.uAspect.value = width / height;
  grade.uniforms.uSharpen.value = quality.sharpen || 0;
  grade.uniforms.uGrainAnim.value = reducedMotion ? 0 : 1; // reduced motion: frozen grain, no flicker
  if (quality.smaa) {
    // SMAA works on perceptual (already graded) values, so it runs after the grade; high uses 4x MSAA instead, low skips AA.
    try {
      const smaa = new SMAAPass();
      composer.addPass(smaa);
      state.smaa = smaa;
    } catch (error) { console.warn("SMAA unavailable.", error); }
  }

  return {
    composer, grade, state,
    render(dt, elapsed) {
      grade.uniforms.uTime.value = elapsed;
      if (state.bokeh) {
        const amount = state.dof;
        state.bokeh.enabled = amount > .02;
        state.bokeh.uniforms.aperture.value = .0017 * amount;
      }
      composer.render(dt);
    },
    setFocus(distance) { if (state.bokeh) state.bokeh.uniforms.focus.value = distance; },
    setDof(amount) { state.dof = amount; },
    setFade(v) { grade.uniforms.uFade.value = v; },
    resize(w, h, ratio) {
      composer.setPixelRatio(ratio);
      composer.setSize(w, h);
      grade.uniforms.uResolution.value.set(w * ratio, h * ratio);
      grade.uniforms.uAspect.value = w / h;
    },
    // look dials (exposure, contrast, saturation, vibrance, curve, grain, vignette, sharpen); `ca` is accepted and ignored (no chromatic aberration in v2)
    setStrength({ grain, vignette, exposure, contrast, saturation, vibrance, curve, sharpen } = {}) {
      const u = grade.uniforms;
      if (grain !== undefined) u.uGrain.value = grain;
      if (vignette !== undefined) u.uVignette.value = vignette;
      if (exposure !== undefined) u.uExposure.value = exposure;
      if (contrast !== undefined) u.uContrast.value = contrast;
      if (saturation !== undefined) u.uSat.value = saturation;
      if (vibrance !== undefined) u.uVibrance.value = vibrance;
      if (curve !== undefined) u.uCurve.value = curve;
      if (sharpen !== undefined) u.uSharpen.value = sharpen;
    },
    dispose() { for (const pass of composer.passes || []) { try { pass.dispose?.(); } catch { /* ignore */ } } composer.dispose?.(); target.dispose(); }
  };
}
