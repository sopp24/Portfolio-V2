// Planar floor reflection (high tier): the shop is rendered once more through a mirror at y = 0 into a
// half-resolution HDR target, then blended into the linoleum's shader with a Fresnel term and a
// roughness-driven blur. Sunlit crates, sleeves and neon now glint in the floor like a real waxed shop floor.
import * as THREE from "three";

export function createFloorReflection({ renderer, scene, camera, material, hide = [], scale = .5 }) {
  const size = new THREE.Vector2();
  const target = new THREE.WebGLRenderTarget(256, 256, { type: THREE.HalfFloatType, samples: 0 });
  const virtualCamera = new THREE.PerspectiveCamera();
  const textureMatrix = new THREE.Matrix4();
  const clip = new THREE.Plane(new THREE.Vector3(0, 1, 0), -.003);
  const uniforms = {
    tReflect: { value: target.texture },
    uReflMatrix: { value: textureMatrix },
    uReflStrength: { value: 1 },
    uReflTexel: { value: new THREE.Vector2(1 / 256, 1 / 256) }
  };
  let enabled = true;
  let frame = 0;

  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nuniform mat4 uReflMatrix;\nvarying vec4 vReflUv;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvReflUv = uReflMatrix * modelMatrix * vec4(transformed, 1.0);");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform sampler2D tReflect;\nuniform float uReflStrength;\nuniform vec2 uReflTexel;\nvarying vec4 vReflUv;")
      .replace("#include <opaque_fragment>", `
        {
          vec2 ruv = vReflUv.xy / vReflUv.w;
          float blur = 1.0 + roughnessFactor * 5.0;
          vec3 refl = vec3(0.0);
          refl += texture2D(tReflect, ruv).rgb * 0.28;
          refl += texture2D(tReflect, ruv + vec2( 1.0, 0.0) * uReflTexel * blur).rgb * 0.18;
          refl += texture2D(tReflect, ruv + vec2(-1.0, 0.0) * uReflTexel * blur).rgb * 0.18;
          refl += texture2D(tReflect, ruv + vec2(0.0,  1.0) * uReflTexel * blur).rgb * 0.18;
          refl += texture2D(tReflect, ruv + vec2(0.0, -1.0) * uReflTexel * blur).rgb * 0.18;
          float ndv = clamp(dot(normalize(vViewPosition), normal), 0.0, 1.0);
          float fres = 0.05 + 0.95 * pow(1.0 - ndv, 4.0);
          float mask = smoothstep(0.75, 0.25, roughnessFactor);
          outgoingLight += refl * uReflStrength * (0.18 + 0.6 * fres) * (0.35 + 0.65 * mask);
        }
        #include <opaque_fragment>`);
  };
  material.customProgramCacheKey = () => "floorReflection";
  material.needsUpdate = true;

  const mirrorPos = new THREE.Vector3(), camPos = new THREE.Vector3(), view = new THREE.Vector3(), lookAt = new THREE.Vector3(), tgt = new THREE.Vector3();
  const rotation = new THREE.Matrix4();
  const normal = new THREE.Vector3(0, 1, 0);
  const origin = new THREE.Vector3(0, 0, 0);

  function resize() {
    renderer.getDrawingBufferSize(size);
    const w = Math.max(128, Math.round(size.x * scale)), h = Math.max(128, Math.round(size.y * scale));
    if (w !== target.width || h !== target.height) {
      target.setSize(w, h);
      uniforms.uReflTexel.value.set(1 / w, 1 / h);
    }
  }

  function update() {
    if (!enabled) return;
    frame++;
    if (frame % 2) return; // alternate frames: camera motion is slow, this halves the cost
    camPos.setFromMatrixPosition(camera.matrixWorld);
    view.subVectors(origin, camPos);
    if (view.dot(normal) > 0) return;
    view.reflect(normal).negate().add(origin);
    rotation.extractRotation(camera.matrixWorld);
    lookAt.set(0, 0, -1).applyMatrix4(rotation).add(camPos);
    tgt.subVectors(origin, lookAt).reflect(normal).negate().add(origin);
    virtualCamera.position.copy(view);
    virtualCamera.up.set(0, 1, 0).applyMatrix4(rotation).reflect(normal);
    virtualCamera.lookAt(tgt);
    virtualCamera.far = camera.far; virtualCamera.near = camera.near;
    virtualCamera.fov = camera.fov; virtualCamera.aspect = camera.aspect;
    virtualCamera.updateProjectionMatrix();
    virtualCamera.updateMatrixWorld();
    virtualCamera.matrixWorldInverse.copy(virtualCamera.matrixWorld).invert();
    textureMatrix.set(.5, 0, 0, .5, 0, .5, 0, .5, 0, 0, .5, .5, 0, 0, 0, 1);
    textureMatrix.multiply(virtualCamera.projectionMatrix).multiply(virtualCamera.matrixWorldInverse);

    resize();
    const prevTarget = renderer.getRenderTarget();
    const prevAuto = renderer.shadowMap.autoUpdate;
    const prevClip = renderer.clippingPlanes;
    const prevXr = renderer.xr.enabled;
    const states = hide.map((o) => o.visible);
    hide.forEach((o) => { o.visible = false; });
    renderer.shadowMap.autoUpdate = false;
    renderer.xr.enabled = false;
    renderer.clippingPlanes = [clip];
    renderer.setRenderTarget(target);
    renderer.clear();
    renderer.render(scene, virtualCamera);
    renderer.setRenderTarget(prevTarget);
    renderer.clippingPlanes = prevClip;
    renderer.shadowMap.autoUpdate = prevAuto;
    renderer.xr.enabled = prevXr;
    hide.forEach((o, i) => { o.visible = states[i]; });
  }

  return {
    update,
    setEnabled(v) { enabled = !!v; uniforms.uReflStrength.value = enabled ? 1 : 0; },
    dispose() { target.dispose(); }
  };
}
