const waterKinds = {
  BoxGeometry: 'pond',
  CylinderGeometry: 'basin',
  TorusGeometry: 'lily',
  TubeGeometry: 'stream',
};

const surfaceVaryings = `
  varying vec3 vWaterPosition;
  varying vec2 vWaterBasin;
  varying float vWaterUp;
`;
const surfaceVertex = `
  vec4 waterVertex = vec4(transformed, 1.0);
  vec4 waterCenter = vec4(0.0, 0.0, 0.0, 1.0);
  #ifdef USE_INSTANCING
    waterVertex = instanceMatrix * waterVertex;
    waterCenter = instanceMatrix * waterCenter;
  #endif
  vWaterPosition = (modelMatrix * waterVertex).xyz;
  vWaterBasin = (modelMatrix * (waterVertex - waterCenter)).xz;
  vWaterUp = normal.y;
`;

// Perturb the reflected sky analytically. No reflected scene, texture, or extra draw pass.
const surfaceFragment = `
  if (vWaterUp > 0.9) {
    vec2 p = vWaterPosition.xz;
    float crossSwell = dot(p, vec2(-2.5, 4.2)) - 1.55 * waterTime;
    float swell = dot(p, vec2(4.3, 2.0)) - 2.10 * waterTime + 0.78 * sin(crossSwell);
    float wave = sin(swell);
    vec2 slope = vec2(0.093, 0.044) * cos(swell) + vec2(-0.038, 0.064) * cos(crossSwell);

    #ifdef GARDEN_FOUNTAIN_BASIN
      float radius = length(vWaterBasin);
      float spread = smoothstep(0.10, 0.29, radius);
      float ring = 15.0 * radius - 6.3 * waterTime + 0.54 * sin(crossSwell);
      slope = slope * 0.49 + 0.23 * spread * (vWaterBasin / max(0.01, radius)) * cos(ring);
      wave = mix(wave, sin(ring), 0.81 * spread);
    #endif

    // Feather unresolved lines at grazing angles instead of letting thin ripples flicker.
    float detail = 1.0 - smoothstep(0.07, 0.31, length(fwidth(p)));
    vec3 eye = normalize(cameraPosition - vWaterPosition);
    vec3 surface = normalize(vec3(-slope.x * detail, 1.0, -slope.y * detail));
    vec3 reflected = reflect(-eye, surface);
    vec3 sky = mix(waterHorizon, waterZenith, smoothstep(-0.14, 0.54, reflected.y));
    float grazing = 1.0 - clamp(dot(eye, surface), 0.0, 1.0);
    float fresnel = 0.05 + 0.47 * grazing * grazing * grazing;
    float crest = smoothstep(0.30, 0.97, wave) * detail;
    float trough = smoothstep(0.20, 0.92, -wave) * detail;
    vec3 body = outgoingLight * (0.84 + 0.12 * crest - 0.10 * trough);
    outgoingLight = mix(body, sky, fresnel) + sky * (0.19 * crest);
  }
`;

const streamVaryings = 'varying vec3 vWaterFlow;';
const streamVertex = `
  float offset = 0.0;
  #ifdef USE_INSTANCING
    offset = dot(instanceMatrix[0].xz, vec2(2.6, 1.7));
  #endif
  float phase = 18.0 * uv.x - 11.0 * waterTime + offset;
  vWaterFlow = vec3(uv, offset);
  float taper = smoothstep(0.0, 0.12, uv.x) * (1.0 - smoothstep(0.88, 1.0, uv.x));
  transformed += normal * (0.006 * taper * sin(phase));
`;
const streamFragment = `
  float flow = sin(18.0 * vWaterFlow.x - 11.0 * waterTime + vWaterFlow.z);
  float pulse = smoothstep(-0.18, 0.98, flow);
  float curvedLight = 0.5 + 0.5 * cos(6.283185 * (vWaterFlow.y - 0.27 * vWaterFlow.x) + 0.68 * flow);
  vec3 streamSky = mix(waterHorizon, waterZenith, 0.27);
  outgoingLight = outgoingLight * (0.63 + 0.38 * pulse) + streamSky * (0.07 + 0.31 * pulse * curvedLight);
`;

const lilyVaryings = 'varying float vWaterPulse;';
const lilyVertex = `
  float offset = 0.0;
  #ifdef USE_INSTANCING
    offset = dot(instanceMatrix[3].xz, vec2(1.69, 0.87));
  #endif
  vWaterPulse = sin(1.91 * waterTime + offset);
  transformed.xz *= 1.0 + 0.095 * vWaterPulse;
`;
const lilyFragment = `
  outgoingLight = mix(outgoingLight * (0.68 - 0.15 * vWaterPulse), waterHorizon, 0.14);
`;

// Call after buildWorld, and pass the same dt in seconds and media query used by the atmosphere.
export function createMovingWater(scene, reducedMotion) {
  const world = scene.getObjectByName('Pinkpaul · Memory Lane');
  const sky = world?.children.find(object => object.material?.uniforms?.horizon && object.material.uniforms.zenith)?.material.uniforms;
  const waterTime = { value: 0 };
  // Reference the colors atmosphere updates, so night and its transition use the same palette.
  const waterHorizon = sky?.horizon ?? { value: scene.background?.isColor ? scene.background : [0.68, 0.76, 0.83] };
  const waterZenith = sky?.zenith ?? { value: [0.38, 0.60, 0.78] };

  scene.traverse(mesh => {
    if (!mesh.isMesh || mesh.material?.name !== 'Garden water') return;
    const kind = waterKinds[mesh.geometry.type];
    if (!kind) return;
    const material = mesh.material.clone();
    const varyings = kind === 'stream' ? streamVaryings : kind === 'lily' ? lilyVaryings : surfaceVaryings;
    const vertex = kind === 'stream' ? streamVertex : kind === 'lily' ? lilyVertex : surfaceVertex;
    const fragment = kind === 'stream' ? streamFragment : kind === 'lily' ? lilyFragment : surfaceFragment;
    material.customProgramCacheKey = () => `garden-water-${kind}`;
    material.onBeforeCompile = shader => {
      Object.assign(shader.uniforms, { waterTime, waterHorizon, waterZenith });
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>\nuniform float waterTime;\n${varyings}`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>\n${vertex}`);
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>
          uniform float waterTime;
          uniform vec3 waterHorizon;
          uniform vec3 waterZenith;
          ${varyings}`)
        .replace('#include <opaque_fragment>', `${kind === 'basin' ? '#define GARDEN_FOUNTAIN_BASIN\n' : ''}${fragment}\n#include <opaque_fragment>`);
    };
    mesh.material = material;
  });

  return {
    update(dt) {
      const reduced = typeof reducedMotion === 'boolean' ? reducedMotion : reducedMotion?.matches;
      if (!reduced && Number.isFinite(dt) && dt > 0) waterTime.value += Math.min(dt, 0.08);
    },
  };
}
