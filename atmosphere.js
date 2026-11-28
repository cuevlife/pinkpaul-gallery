import * as THREE from 'three';

const TAU = Math.PI * 2;
const FOUNTAIN_Z = -68.07;
const PETALS_PER_BANK = 25;
const BLOOM_SIZE = 22;

function makeSparkles(count, core, glow, star) {
  const geometry = new THREE.InstancedBufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3));
  geometry.setIndex([0, 1, 2, 0, 2, 3]);
  const centers = new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3).setUsage(THREE.DynamicDrawUsage);
  const details = new THREE.InstancedBufferAttribute(new Float32Array(count * 2), 2).setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('center', centers);
  geometry.setAttribute('detail', details);
  geometry.instanceCount = 0;
  const material = new THREE.ShaderMaterial({
    uniforms: { core: { value: new THREE.Color(core) }, glow: { value: new THREE.Color(glow) }, star: { value: Number(star) } },
    vertexShader: `attribute vec3 center;
      attribute vec2 detail;
      varying vec2 vCoord;
      varying float vStrength;
      void main() {
        vCoord = position.xy;
        vStrength = detail.y;
        vec4 viewCenter = modelViewMatrix * vec4(center, 1.0);
        viewCenter.xy += position.xy * detail.x;
        gl_Position = projectionMatrix * viewCenter;
      }`,
    fragmentShader: `uniform vec3 core;
      uniform vec3 glow;
      uniform float star;
      varying vec2 vCoord;
      varying float vStrength;
      void main() {
        float r = length(vCoord);
        float halo = pow(max(0.0, 1.0 - r), 2.2);
        float dotCore = 1.0 - smoothstep(0.075, 0.22, r);
        vec2 a = abs(vCoord);
        float ray = pow(max(0.0, 1.0 - min(a.x, a.y) * 8.0 - max(a.x, a.y)), 2.0);
        float light = max(dotCore, star * ray);
        gl_FragColor = vec4(mix(glow, core, light), vStrength * max(light, halo * 0.39));
        #include <colorspace_fragment>
      }`,
    transparent: true, depthWrite: false, toneMapped: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  // Each small batch has explicit distance limits; its moving centers are GPU attributes.
  mesh.frustumCulled = false;
  return {
    mesh,
    set(index, x, y, z, size, strength) {
      centers.setXYZ(index, x, y, z);
      details.setXY(index, size, strength);
    },
    show(count) {
      geometry.instanceCount = count;
      mesh.visible = count > 0;
      if (count) centers.needsUpdate = details.needsUpdate = true;
    },
  };
}

export function createAtmosphere(scene, camera, reducedMotion) {
  const world = scene.getObjectByName('Pinkpaul · Memory Lane');
  const skyUniforms = world?.children.find(object => object.material?.uniforms?.horizon && object.material.uniforms.zenith)?.material.uniforms;
  const fill = world?.children.find(object => object.isHemisphereLight);
  const sun = world?.children.find(object => object.isDirectionalLight);
  // The simple unlit, tone-mapped Icosahedron batch is the pastel cloud bank; keep lanterns and photos untouched.
  const clouds = world?.children.find(object => object.isInstancedMesh && object.geometry.type === 'IcosahedronGeometry' &&
    object.material.isMeshBasicMaterial && object.material.toneMapped && !object.material.transparent);
  const palette = [
    [scene.background, 0x68658a], [scene.fog?.color, 0x68658a],
    [skyUniforms?.horizon.value, 0x68658a], [skyUniforms?.zenith.value, 0x252a54],
    [fill?.color, 0xbdc8fa], [fill?.groundColor, 0xa390b7], [sun?.color, 0xc9d5ff],
    [clouds?.material.color, 0x8e8eb3],
  ].filter(([color]) => color?.isColor).map(([color, night]) => ({ color, day: color.clone(), night: new THREE.Color(night) }));
  const fog = scene.fog?.isFogExp2 ? scene.fog : null;
  const dayDensity = fog?.density;
  const dayFill = fill?.intensity;
  const daySun = sun?.intensity;

  const effects = new THREE.Group();
  effects.name = 'Garden atmosphere';
  scene.add(effects);
  const petalShape = new THREE.Shape();
  petalShape.moveTo(0, -0.51);
  petalShape.bezierCurveTo(-0.28, -0.24, -0.53, 0.30, -0.23, 0.46);
  petalShape.quadraticCurveTo(-0.12, 0.54, 0, 0.40);
  petalShape.quadraticCurveTo(0.17, 0.59, 0.31, 0.42);
  petalShape.bezierCurveTo(0.54, 0.21, 0.26, -0.32, 0, -0.51);
  const petalGeometry = new THREE.ShapeGeometry(petalShape, 5);
  const vertices = petalGeometry.attributes.position;
  for (let i = 0; i < vertices.count; i++) vertices.setZ(i, vertices.getY(i) * vertices.getY(i) * 0.65);
  petalGeometry.computeVertexNormals();
  const petalMaterial = new THREE.MeshLambertMaterial({ side: THREE.DoubleSide, emissive: 0xaf4965, emissiveIntensity: 0.13 });
  const petalBanks = [-44, -51, -57.5, FOUNTAIN_Z + 3.2];
  const petalTints = [0xf4aac4, 0xffb8ce, 0xffd5dc, 0xffe3e6, 0xe995b6].map(color => new THREE.Color(color));
  const dummy = new THREE.Object3D();

  // Seed the weather independently of the garden layout and avoid random work in the frame loop.
  let seed = 23749;
  function random() {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  }

  const banks = petalBanks.map((z, bankIndex) => {
    const mesh = new THREE.InstancedMesh(petalGeometry, petalMaterial, PETALS_PER_BANK);
    mesh.position.z = z;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 2.65, 0), 9);
    mesh.visible = false;
    effects.add(mesh);
    const petals = Array.from({ length: PETALS_PER_BANK }, (_, i) => {
      mesh.setColorAt(i, petalTints[(i + bankIndex) % petalTints.length]);
      return {
        x: (i % 2 ? 1 : -1) * (2.4 + random() * 3.3), z: (random() - 0.5) * 8.6,
        phase: random(), spin: random() * TAU, speed: 0.061 + random() * 0.063, size: 0.10 + random() * 0.11,
      };
    });
    return { mesh, petals };
  });

  const fireflies = makeSparkles(15 * 10, 0xfffac6, 0xffc951, false);
  const fountain = makeSparkles(38, 0xfaffff, 0x68cde4, true);
  const blooms = makeSparkles(BLOOM_SIZE * 3, 0xfff4c6, 0xff90bd, true);
  fountain.mesh.position.z = FOUNTAIN_Z;
  effects.add(fireflies.mesh, fountain.mesh, blooms.mesh);
  fireflies.show(0);
  fountain.show(0);
  blooms.show(0);

  const flies = Array.from({ length: 15 * 10 }, (_, i) => ({
    x: (i % 2 ? 1 : -1) * (1.8 + random() * 3.5), y: 0.4 + random() * 1.65,
    z: -40 - Math.floor(i / 10) * 1.8 + (random() - 0.5) * 2.4,
    phase: random() * TAU, size: 0.095 + random() * 0.085, rate: 0.62 + random() * 0.75,
  }));
  const splash = Array.from({ length: 38 }, (_, i) => ({
    angle: (i < 13 ? i % 5 * TAU / 5 : i % 8 * TAU / 8) + (random() - 0.5) * 0.13,
    top: i < 13, phase: random(), size: 0.084 + random() * 0.10, rate: 0.69 + random() * 0.48,
  }));
  const bloomRays = Array.from({ length: BLOOM_SIZE }, (_, i) => ({
    angle: i * 2.39996 + random() * 0.28, reach: 0.44 + random() * 0.79,
    rise: 0.38 + random() * 0.89, size: 0.10 + random() * 0.11, life: 0.79 + random() * 0.44,
  }));
  const bursts = Array.from({ length: 3 }, () => ({ origin: new THREE.Vector3(), age: Infinity }));
  const cameraWorld = new THREE.Vector3();
  const { lerp, smoothstep } = THREE.MathUtils;
  let burstCursor = 0;
  let targetNight = 0;
  let night = 0;
  let time = 0;

  function isReduced() { return typeof reducedMotion === 'boolean' ? reducedMotion : Boolean(reducedMotion?.matches); }

  function update(dt) {
    if (!Number.isFinite(dt) || dt < 0) return;
    const reduced = isReduced();
    if (!reduced) time += Math.min(dt, 0.08);
    if (targetNight !== night) {
      night = reduced ? targetNight : lerp(night, targetNight, 1 - Math.exp(-2.7 * dt));
      if (Math.abs(night - targetNight) < 0.001) night = targetNight;
      for (const tone of palette) tone.color.lerpColors(tone.day, tone.night, night);
      if (fog) fog.density = lerp(dayDensity, 0.0305, night);
      if (fill) fill.intensity = lerp(dayFill, 1.04, night);
      if (sun) sun.intensity = lerp(daySun, 0.68, night);
    }
    camera.getWorldPosition(cameraWorld);
    for (const { mesh, petals } of banks) {
      const proximity = 1 - smoothstep(Math.abs(cameraWorld.z - mesh.position.z), 18, 28);
      mesh.visible = !reduced && proximity > 0;
      if (!mesh.visible) continue;
      for (let i = 0; i < petals.length; i++) {
        const p = petals[i];
        const fall = (time * p.speed + p.phase) % 1;
        const drift = time * 1.23 + p.spin;
        const size = p.size * proximity * smoothstep(fall, 0, 0.08) * (1 - smoothstep(fall, 0.88, 1));
        dummy.position.set(p.x + Math.sin(drift) * 0.48 + fall * (p.x < 0 ? 2.5 : -2.5), 5.4 - fall * 5.31, p.z + Math.cos(drift * 0.73 + p.spin) * 0.79 - fall);
        dummy.rotation.set(Math.sin(drift) * 0.9, p.spin + drift * 0.74, p.spin + Math.cos(drift * 0.87));
        dummy.scale.set(size, size * 1.24, size);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
    }

    let fireflyCount = 0;
    if (night > 0.003) {
      for (let i = 0; i < flies.length; i++) {
        const fly = flies[i];
        const near = 1 - smoothstep(Math.abs(cameraWorld.z - fly.z), 8, 18);
        if (!near || (reduced && i % 3 !== 0)) continue;
        const a = (reduced ? 0 : time * fly.rate) + fly.phase;
        const pulse = reduced ? 0.66 : 0.24 + 0.76 * (0.5 + 0.5 * Math.sin(a * 2.3 + fly.phase)) ** 2;
        fireflies.set(fireflyCount++, fly.x + Math.cos(a) * 0.51, fly.y + Math.sin(a * 1.17) * 0.33,
          fly.z + Math.sin(a * 0.83) * 0.89, fly.size, near * night * pulse);
      }
    }
    fireflies.show(fireflyCount);

    let fountainCount = 0;
    const fountainNear = 1 - smoothstep(Math.hypot(cameraWorld.x, cameraWorld.z - FOUNTAIN_Z), 20, 38);
    if (fountainNear > 0) {
      for (let i = 0; i < splash.length; i++) {
        const drop = splash[i];
        if (reduced && i % 4 !== 0) continue;
        const t = (drop.phase + (reduced ? 0 : time * drop.rate)) % 1;
        const radius = drop.top ? 0.04 + t * 0.51 : 0.96 + t * 1.0;
        const y = drop.top ? 2.31 + 2.35 * t * (1 - t) : 1.72 + 0.36 * t - 1.4 * t * t;
        const shimmer = reduced ? 0.50 : Math.sin(Math.PI * t) * (0.56 + 0.41 * (0.5 + 0.5 * Math.sin(time * 5 + i * 2.3)));
        fountain.set(fountainCount++, Math.cos(drop.angle) * radius, y, Math.sin(drop.angle) * radius,
          drop.size * (1 + night * 0.24), fountainNear * shimmer);
      }
    }
    fountain.show(fountainCount);

    let sparkCount = 0;
    for (const burst of bursts) {
      if (burst.age >= 1.24) continue;
      burst.age += dt;
      for (let i = 0; i < bloomRays.length; i++) {
        if (reduced && i % 3 !== 0) continue;
        const ray = bloomRays[i];
        const age = burst.age / (reduced ? 0.48 : ray.life);
        if (age >= 1) continue;
        const expand = reduced ? 0.43 : 1 - (1 - age) ** 2;
        const radius = ray.reach * expand;
        const y = 0.1 + ray.rise * expand - (reduced ? 0 : 0.74 * age * age);
        const opacity = smoothstep(age, 0, 0.13) * (1 - smoothstep(age, 0.30, 1));
        blooms.set(sparkCount++, burst.origin.x + Math.cos(ray.angle) * radius, burst.origin.y + y,
          burst.origin.z + Math.sin(ray.angle) * radius, ray.size * (1 - age * 0.4), opacity);
      }
    }
    blooms.show(sparkCount);
  }

  function setNight(value) { targetNight = value ? 1 : 0; }

  function celebrate(worldVector3) {
    if (!Number.isFinite(worldVector3?.x) || !Number.isFinite(worldVector3?.y) || !Number.isFinite(worldVector3?.z)) return;
    const burst = bursts[burstCursor];
    burstCursor = (burstCursor + 1) % bursts.length;
    effects.worldToLocal(burst.origin.copy(worldVector3));
    burst.age = 0;
  }

  return { update, setNight, celebrate };
}
