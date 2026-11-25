// Post-processing chain: scene -> GTAO (high) -> bloom -> depth of field (while holding a record)
// -> tone mapping/output -> cinematic grade (vignette, grain, chromatic aberration, split-tone).
import * as THREE from "three";
import { EffectComposer, RenderPass, UnrealBloomPass, GTAOPass, OutputPass, BokehPass, ShaderPass } from "three-addons";

const GradeShader = {
  name: "StoreGrade",
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uGrain: { value: .055 },
    uVignette: { value: .46 },
    uCA: { value: .0006 },
    uSat: { value: 1.08 },
    uLift: { value: .018 },
    uAspect: { value: 1 },
    uFade: { value: 1 },
    uWarm: { value: .085 },
    uResolution: { value: new THREE.Vector2(1, 1) }
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform float uTime, uGrain, uVignette, uCA, uSat, uLift, uAspect, uFade, uWarm;
    uniform vec2 uResolution;
    varying vec2 vUv;
    float hash(vec2 p) {
      vec3 p3 = fract(vec3(p.xyx) * .1031);
      p3 += dot(p3, p3.yzx + 33.33);
      return fract((p3.x + p3.y) * p3.z);
    }
    void main() {
      vec2 c = vUv - .5;
      float r2 = dot(c * vec2(uAspect, 1.0), c * vec2(uAspect, 1.0));
      vec2 off = c * r2 * uCA;
      vec3 col;
      col.r = texture2D(tDiffuse, vUv + off).r;
      col.g = texture2D(tDiffuse, vUv).g;
      col.b = texture2D(tDiffuse, vUv - off).b;
      float l = dot(col, vec3(.2126, .7152, .0722));
      // split-tone: warm highlights, cool-teal shadows
      col += vec3(uWarm * .9, uWarm * .35, -uWarm * .55) * smoothstep(.35, 1.0, l);
      col += vec3(-.012, .004, .014) * (1.0 - smoothstep(.0, .4, l));
      col = mix(vec3(l), col, uSat);
      // filmic S-curve + lifted blacks
      col = col * col * (3.0 - 2.0 * col) * .35 + col * .65;
      col += uLift * (1.0 - col);
      // vignette
      float v = smoothstep(.95, .22, length(c * vec2(uAspect * .8, 1.0) * 1.25));
      col *= mix(1.0, v, uVignette);
      // grain (luminance-weighted so shadows carry it)
      float g = hash(vUv * uResolution + fract(uTime) * 61.0) - .5;
      col += g * uGrain * (1.0 - l * .55);
      col *= uFade;
      gl_FragColor = vec4(col, 1.0);
    }`
};

export function createPostFX({ renderer, scene, camera, quality, width, height, pixelRatio }) {
  const target = new THREE.WebGLRenderTarget(width * pixelRatio, height * pixelRatio, {
    type: THREE.HalfFloatType, samples: quality.msaa || 0
  });
  const composer = new EffectComposer(renderer, target);
  composer.setPixelRatio(pixelRatio);
  composer.setSize(width, height);
  const state = { ao: null, bloom: null, bokeh: null, dof: 0 };

  composer.addPass(new RenderPass(scene, camera));

  if (quality.ao) {
    try {
      const ao = new GTAOPass(scene, camera, width, height);
      ao.output = GTAOPass.OUTPUT.Default;
      ao.blendIntensity = .9;
      ao.updateGtaoMaterial({ radius: .45, distanceExponent: 1.4, thickness: 1.2, scale: 1.1, samples: 12, distanceFallOff: 1, screenSpaceRadius: false });
      ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, radiusExponent: 1, rings: 2, samples: 12 });
      composer.addPass(ao);
      state.ao = ao;
    } catch (error) { console.warn("GTAO unavailable, continuing without it.", error); }
  }
  if (quality.bloom) {
    const bloom = new UnrealBloomPass(new THREE.Vector2(width, height), .22, .55, 1.05);
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
  composer.addPass(new OutputPass());
  const grade = new ShaderPass(GradeShader);
  composer.addPass(grade);
  grade.uniforms.uResolution.value.set(width * pixelRatio, height * pixelRatio);
  grade.uniforms.uAspect.value = width / height;

  return {
    composer, grade, state,
    render(dt, elapsed) {
      grade.uniforms.uTime.value = elapsed;
      if (state.bokeh) {
        const amount = state.dof;
        state.bokeh.enabled = amount > .02;
        state.bokeh.uniforms.aperture.value = .0026 * amount;
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
    setStrength({ grain, vignette, ca } = {}) {
      if (grain !== undefined) grade.uniforms.uGrain.value = grain;
      if (vignette !== undefined) grade.uniforms.uVignette.value = vignette;
      if (ca !== undefined) grade.uniforms.uCA.value = ca;
    },
    dispose() { composer.dispose?.(); target.dispose(); }
  };
}
