import * as THREE from 'three';
import { makeGardenTextures } from './garden-textures.js?v=4';
import { MUSEUM } from './museum-layout.js?v=1';
import { addMuseumShell, museumFrames } from './museum-world.js?v=1';
export { MUSEUM };

const colors = {
  sky: 0xaacfe8, horizon: 0xf3d8c8, grass: 0xa6b497,
  cream: 0xf6dfc0, blush: 0xd69b98, rose: 0xad6e73,
  mint: 0x82ad8c, sage: 0x60896d, pine: 0x416a57, soil: 0x916756,
  peach: 0xfbc09d, butter: 0xeeb56d, lilac: 0xc5a6c7,
};

const FRAME_SLOTS = 25;
const PHOTO_LOAD_DISTANCE = 41;
const PHOTO_LOAD_LIMIT = 3;
const MAX_FRAME_TEXTURE_EDGE = 420;

export function buildWorld(scene, firstPagePhotos = []) {
  const world = new THREE.Group();
  world.name = 'Pinkpaul · Memory Lane';
  scene.add(world);
  scene.background = new THREE.Color(colors.horizon);
  scene.fog = new THREE.FogExp2(colors.horizon, 0.015);

  const fill = new THREE.HemisphereLight(0xffebd6, 0xbfb0a3, 2.22);
  const sun = new THREE.DirectionalLight(0xffdfbb, 1.36);
  sun.position.set(-7, 12, 5);
  world.add(fill, sun);

  const sky = new THREE.Mesh(new THREE.SphereGeometry(115, 24, 12), new THREE.ShaderMaterial({
    uniforms: { horizon: { value: new THREE.Color(colors.horizon) }, zenith: { value: new THREE.Color(colors.sky) } },
    vertexShader: `varying vec3 vSky;
      void main() {
        vSky = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position.z = gl_Position.w;
      }`,
    fragmentShader: `uniform vec3 horizon;
      uniform vec3 zenith;
      varying vec3 vSky;
      void main() {
        gl_FragColor = vec4(mix(horizon, zenith, smoothstep(-0.04, 0.45, normalize(vSky).y)), 1.0);
        #include <colorspace_fragment>
      }`,
    side: THREE.BackSide, depthWrite: false,
  }));
  sky.position.set(0, 0, -28);
  sky.frustumCulled = false;
  sky.renderOrder = -10;
  world.add(sky);

  const box = new THREE.BoxGeometry();
  const panel = new THREE.PlaneGeometry();
  const pebble = new THREE.IcosahedronGeometry(1, 0);
  const foliage = new THREE.IcosahedronGeometry(1, 1);
  const barrel = new THREE.CylinderGeometry(1, 1, 1, 12);
  const stem = new THREE.CylinderGeometry(1, 1, 1, 5, 1, true);
  const tapered = new THREE.CylinderGeometry(0.68, 1, 1, 12);
  const cone = new THREE.ConeGeometry(1, 1, 12);
  const shadowDisc = new THREE.CircleGeometry(1, 24).rotateX(-Math.PI / 2);
  const basic = new Map();
  const lit = new Map();
  const stone = new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true });
  const textures = makeGardenTextures();
  const clouds = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const candlelight = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
  const shade = new THREE.MeshBasicMaterial({ color: 0x674954, transparent: true, opacity: 0.13, depthWrite: false });
  const glowCanvas = document.createElement('canvas');
  glowCanvas.width = glowCanvas.height = 32;
  const glowContext = glowCanvas.getContext('2d');
  const glow = glowContext.createRadialGradient(16, 16, 0, 16, 16, 16);
  glow.addColorStop(0, 'rgba(255, 230, 164, .62)');
  glow.addColorStop(0.36, 'rgba(255, 216, 150, .24)');
  glow.addColorStop(1, 'rgba(255, 202, 130, 0)');
  glowContext.fillStyle = glow;
  glowContext.fillRect(0, 0, 32, 32);
  const glowMap = new THREE.CanvasTexture(glowCanvas);
  glowMap.colorSpace = THREE.SRGBColorSpace;
  const halo = new THREE.MeshBasicMaterial({ map: glowMap, transparent: true, depthWrite: false, toneMapped: false, side: THREE.DoubleSide });
  const shapeBatches = new Map();
  const frameBatches = new Map();
  const dummy = new THREE.Object3D();
  const tint = new THREE.Color();
  const axis = new THREE.Vector3(0, 1, 0);
  const direction = new THREE.Vector3();
  const orientation = new THREE.Quaternion();
  const angles = new THREE.Euler();
  let randomSeed = 8128;

  function random() {
    randomSeed = (Math.imul(randomSeed, 1664525) + 1013904223) >>> 0;
    return randomSeed / 4294967296;
  }

  // Palette variants share a geometry, material, and draw call via per-instance color.
  function addInstance(batches, geometry, color, x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0, material = stone) {
    let byMaterial = batches.get(geometry);
    if (!byMaterial) batches.set(geometry, byMaterial = new Map());
    let entries = byMaterial.get(material);
    if (!entries) byMaterial.set(material, entries = []);
    dummy.position.set(x, y, z);
    dummy.rotation.set(rx, ry, rz);
    dummy.scale.set(sx, sy, sz);
    dummy.updateMatrix();
    entries.push([dummy.matrix.clone(), color]);
  }

  const instance = addInstance.bind(null, shapeBatches);
  const frameInstance = addInstance.bind(null, frameBatches);

  function beam(color, x1, y1, z1, x2, y2, z2, thickness, depth = thickness) {
    direction.set(x2 - x1, y2 - y1, z2 - z1);
    const length = direction.length();
    angles.setFromQuaternion(orientation.setFromUnitVectors(axis, direction.multiplyScalar(1 / length)));
    instance(box, color, (x1 + x2) / 2, (y1 + y2) / 2, (z1 + z2) / 2,
      thickness, length, depth, angles.x, angles.y, angles.z);
  }

  function shape(parent, geometry, color, x, y, z, sx, sy, sz, unlit = false) {
    const bank = unlit ? basic : lit;
    if (!bank.has(color)) bank.set(color, unlit
      ? new THREE.MeshBasicMaterial({ color })
      : new THREE.MeshLambertMaterial({ color, flatShading: true }));
    const mesh = new THREE.Mesh(geometry, bank.get(color));
    mesh.position.set(x, y, z);
    mesh.scale.set(sx, sy, sz);
    parent.add(mesh);
    return mesh;
  }

  function shadow(x, z, radiusX, radiusZ) {
    instance(shadowDisc, 0xffffff, x, 0.011, z, radiusX, 1, radiusZ, 0, 0, 0, shade);
  }

  function flower(x, z, height, petals, scale = 1) {
    instance(stem, colors.sage, x, height * 0.5, z, 0.021 * scale, height, 0.021 * scale);
    for (const side of [-1, 1]) {
      instance(pebble, side < 0 ? colors.sage : colors.mint,
        x + side * 0.06 * scale, height * (side < 0 ? 0.38 : 0.62), z, 0.094 * scale, 0.038 * scale, 0.046 * scale, 0, 0, side * 0.52);
    }
    for (let i = 0; i < 5; i++) {
      const angle = i * 2 * Math.PI / 5;
      instance(pebble, petals, x + Math.sin(angle) * 0.079 * scale,
        height + Math.cos(angle) * 0.054 * scale, z + Math.cos(angle) * 0.052 * scale,
        0.061 * scale, 0.041 * scale, 0.067 * scale, -0.4, 0, -angle);
    }
    instance(pebble, colors.butter, x, height + 0.014 * scale, z + 0.025 * scale, 0.049 * scale, 0.042 * scale, 0.055 * scale);
  }

  function tree(x, z, size, palette) {
    shadow(x + 0.27 * size, z - 0.16 * size, 0.9 * size, 0.58 * size);
    instance(tapered, 0x9c7663, x, 1.1 * size, z, 0.15 * size, 2.2 * size, 0.15 * size, 0, 0, 0.04, textures.wood);
    for (const side of [-1, 1]) {
      instance(tapered, 0x9c7663, x + side * 0.31 * size, 1.62 * size, z, 0.075 * size, 1.04 * size, 0.075 * size, 0, 0, -side * 0.67, textures.wood);
    }
    for (let n = 0; n < 6; n++) {
      const angle = n * 2.4;
      const r = n === 0 ? 0 : 0.43 + random() * 0.36;
      const y = n === 0 ? 2.95 : 2.35 + random() * 0.5;
      instance(foliage, palette[n % palette.length], x + Math.sin(angle) * r * size, y * size,
        z + Math.cos(angle) * r * size, size * 0.88, size * (0.71 + random() * 0.35), size * 0.77, 0, angle);
    }
  }


  // All written signs and date plaques are generated locally into one texture.
  const canvas = document.createElement('canvas');
  const tileW = 256;
  const tileH = 80;
  const atlasColumns = 4;
  canvas.width = tileW * atlasColumns;
  canvas.height = tileH * Math.ceil((FRAME_SLOTS + 16) / atlasColumns);
  const ink = canvas.getContext('2d');
  const atlas = new THREE.CanvasTexture(canvas);
  atlas.colorSpace = THREE.SRGBColorSpace;
  atlas.generateMipmaps = false;
  atlas.minFilter = THREE.LinearFilter;
  const lettering = new THREE.MeshBasicMaterial({ map: atlas, toneMapped: false });

  function paintPlaque(index, text, subtext, background = '#fff0d6') {
    const u = index % atlasColumns * tileW;
    const v = Math.floor(index / atlasColumns) * tileH;
    ink.fillStyle = background;
    ink.fillRect(u, v, tileW, tileH);
    const dark = background === '#352825';
    ink.strokeStyle = dark ? '#bc935d' : '#a37963';
    ink.lineWidth = 2;
    ink.strokeRect(u + 5, v + 5, tileW - 10, tileH - 10);
    ink.textAlign = 'center';
    ink.textBaseline = 'middle';
    ink.fillStyle = dark ? '#f4ddbf' : '#643f35';
    ink.font = subtext ? 'bold 33px Georgia, serif' : 'bold 33px Georgia, serif';
    ink.fillText(text, u + tileW / 2, v + (subtext ? 30 : 42), tileW - 26);
    if (subtext) {
      ink.font = 'bold 13px sans-serif';
      ink.fillText(subtext, u + tileW / 2, v + 57, tileW - 26);
    }
  }

  function plaqueUV(index, x, y) {
    return [(index % atlasColumns * tileW + 1 + x * (tileW - 2)) / canvas.width,
      1 - (Math.floor(index / atlasColumns) * tileH + 1 + (1 - y) * (tileH - 2)) / canvas.height];
  }

  function plaque(parent, index, text, subtext, x, y, z, width, height, background) {
    paintPlaque(index, text, subtext, background);
    const geometry = panel.clone();
    const uv = geometry.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, ...plaqueUV(index, uv.getX(i), uv.getY(i)));
    const sign = new THREE.Mesh(geometry, lettering);
    sign.position.set(x, y, z);
    sign.scale.set(width, height, 1);
    parent.add(sign);
  }

  const heartPath = new THREE.Shape();
  heartPath.moveTo(0, -0.5);
  heartPath.bezierCurveTo(-1, 0.16, -0.45, 0.75, 0, 0.34);
  heartPath.bezierCurveTo(0.45, 0.75, 1, 0.16, 0, -0.5);
  const heart = new THREE.ExtrudeGeometry(heartPath, { depth: 0.12, bevelEnabled: false, curveSegments: 5 });
  const entryPlots = FRAME_SLOTS;


  const occluderMaterials = addMuseumShell({ world, box, barrel, panel, foliage, instance, stone, textures, candlelight, plaque, random });
  const occluders = [];

  const photoTargets = [];
  const pickMaterial = new THREE.MeshBasicMaterial({ visible: false });
  const labelPositions = [];
  const labelUVs = [];
  const labelIndices = [];
  const slots = museumFrames.map(([wallX, wallZ, yaw, room], index) => {
    const s = Math.sin(yaw), c = Math.cos(yaw);
    const x = wallX + s * 0.076;
    const z = wallZ + c * 0.076;
    const y = 2.17;
    const frame = new THREE.Group();
    frame.name = `Memory frame ${index + 1}`;
    frame.position.set(x, y, z);
    frame.rotation.y = yaw;
    world.add(frame);

    // Use each frame's wall-facing pose for both display geometry and hit targets.
    const part = (color, dx, dy, dz, sx, sy, sz) => frameInstance(box, color,
      x + c * dx + s * dz, y + dy, z - s * dx + c * dz, sx, sy, sz, 0, yaw);
    part(0x553b32, 0, 0, 0, 2.58, 1.99, 0.14);
    part(0xc59560, 0, 0, 0.077, 2.49, 1.90, 0.041);
    part(0x6b4940, 0, 0, 0.102, 2.39, 1.80, 0.027);
    part(0xf2dfc5, 0, 0, 0.121, 2.31, 1.72, 0.022);
    part(0xb5947f, 0, 0, 0.133, 2.10, 1.55, 0.009);
    part(0xe6ceb6, 0, 0, 0.14, 2.06, 1.51, 0.011);
    part(room === 'terrace' ? 0x6f5548 : 0x624639, 0, -1.19, 0, 1.23, 0.26, 0.13);

    const art = new THREE.Mesh(panel, new THREE.MeshBasicMaterial({ toneMapped: false }));
    art.position.z = 0.149;
    art.scale.set(2.03, 1.48, 1);
    frame.add(art);
    const hitBoard = new THREE.Mesh(box, pickMaterial);
    hitBoard.position.z = 0.05;
    hitBoard.scale.set(2.58, 1.99, 0.20);
    const hitLabel = new THREE.Mesh(panel, pickMaterial);
    hitLabel.position.set(0, -1.19, 0.073);
    hitLabel.scale.set(1.16, 0.2, 1);
    frame.add(hitBoard, hitLabel);

    const { position, uv } = panel.attributes;
    for (let i = 0; i < position.count; i++) {
      const px = position.getX(i) * 1.16;
      labelPositions.push(x + c * px + s * 0.073, y - 1.19 + position.getY(i) * 0.2, z - s * px + c * 0.073);
      labelUVs.push(...plaqueUV(index, uv.getX(i), uv.getY(i)));
    }
    for (const vertex of panel.index.array) labelIndices.push(index * position.count + vertex);
    return { frame, art, source: null, fallback: null, request: null };
  });
  const labelGeometry = new THREE.BufferGeometry();
  labelGeometry.setAttribute('position', new THREE.Float32BufferAttribute(labelPositions, 3));
  labelGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(labelUVs, 2));
  labelGeometry.setIndex(labelIndices);
  const frameLabels = new THREE.Mesh(labelGeometry, lettering);
  world.add(frameLabels);

  const growthMeshes = [];
  const soilSurface = textures.soil.clone();
  soilSurface.color.setHex(colors.soil);
  const plots = MUSEUM.plotCenters.map(({ x, z }, index) => {
    const plot = new THREE.Group();
    plot.name = `Garden plot ${index + 1}`;
    plot.userData.plotIndex = index;
    plot.position.set(x, 0, z);
    world.add(plot);
    shadow(x + 0.08, z - 0.05, 0.65, 0.54);
    shape(plot, box, colors.rose, 0, 0.09, 0, 1.04, 0.18, 0.91);
    shape(plot, box, colors.blush, 0, 0.178, 0, 1.13, 0.075, 0.98);
    shape(plot, box, colors.soil, 0, 0.204, 0, 0.94, 0.072, 0.79).material = soilSurface;
    plaque(plot, entryPlots + index, String(index + 1).padStart(2, '0'), '', 0, 0.135, 0.495, 0.28, 0.12);

    for (let bit = 0; bit < 6; bit++) {
      const a = bit * Math.PI / 3 + random() * 0.35;
      instance(pebble, bit % 2 ? 0xb9806b : 0xa3685b, x + Math.sin(a) * (0.22 + random() * 0.1),
        0.243, z + Math.cos(a) * 0.28, 0.046, 0.015, 0.028, 0, a);
    }

    const seed = new THREE.Group();
    for (const dx of [-0.12, 0.12]) {
      const kernel = shape(seed, pebble, colors.butter, dx, 0.265, (random() - 0.5) * 0.16, 0.106, 0.047, 0.069);
      kernel.rotation.y = dx * 6;
    }

    function plant(height, bloom) {
      const growth = new THREE.Group();
      shape(growth, barrel, colors.pine, 0, 0.24 + height / 2, 0, 0.037, height, 0.037);
      for (const leaf of [-1, 1]) {
        const sprig = shape(growth, foliage, leaf < 0 ? colors.sage : colors.mint,
          leaf * 0.104, 0.24 + height * (leaf < 0 ? 0.59 : 0.83), 0.01, 0.151, 0.062, 0.078);
        sprig.rotation.z = leaf * 0.55;
      }
      if (bloom) {
        const y = 0.25 + height;
        const color = [0xf693af, colors.lilac, colors.peach, 0xf1a3c2, colors.butter, 0xed90a5][index];
        for (let i = 0; i < 7; i++) {
          const a = i * 2 * Math.PI / 7;
          const petal = shape(growth, foliage, color, Math.sin(a) * 0.171, y + Math.cos(a) * 0.151,
            0.037 + Math.cos(a) * 0.066, 0.119, 0.163, 0.08);
          petal.rotation.set(0.35, 0, -a);
        }
        shape(growth, foliage, colors.butter, 0, y, 0.101, 0.137, 0.123, 0.081);
        shape(growth, pebble, colors.peach, 0.01, y + 0.008, 0.176, 0.054, 0.048, 0.022);
      } else {
        shape(growth, pebble, 0xb0ce82, 0, 0.24 + height, 0, 0.078, 0.104, 0.062);
      }
      return growth;
    }

    const stages = [seed, plant(0.33, false), plant(0.69, true)];
    plot.add(seed);
    plot.userData.stage = 0;
    growthMeshes.push(stages);
    return plot;
  });

  function setGrowth(stages) {
    plots.forEach((plot, index) => {
      const next = stages?.[index];
      const current = plot.userData.stage;
      if (!Number.isInteger(next) || next < 0 || next > 2 || next === current) return;
      // Detached states stay out of recursive raycasting as well as rendering.
      plot.remove(growthMeshes[index][current]);
      plot.add(growthMeshes[index][next]);
      plot.userData.stage = next;
    });
    world.updateMatrixWorld(true);
  }


  // An open terrace joins both wings and the main hall before opening onto the lotus garden.
  const galaInk = 0x396d67;
  const galaGold = 0xd6b17a;
  const water = new THREE.MeshLambertMaterial({ name: 'Garden water', color: 0xffffff, flatShading: true, emissive: 0x173637, emissiveIntensity: 0.36 });
  const ripple = new THREE.TorusGeometry(1, 0.017, 4, 16).rotateX(Math.PI / 2);
  const cherry = [0xc78391, 0xe3a4ad, 0xe8bac0, 0xcc879f, 0xe7a9bc, 0xe8b4a5];
  const blossoms = [colors.blush, 0xd98b9d, colors.cream, colors.peach, colors.lilac, 0xe6b8bd];
  instance(box, colors.grass, 0, -0.19, -49, 74, 0.3, 109, 0, 0, 0, textures.grass);
  for (const [x, y, z] of [[-24, 9.2, -83], [19, 7.8, -86], [11, 11.4, -99], [-10, 8.7, -98]]) {
    for (let n = 0; n < 4; n++) instance(foliage, 0xf6e5dc, x + (n - 1.5) * 1.35, y + Math.sin(n) * 0.32, z,
      1.72, 0.47 + n % 2 * 0.3, 0.52, 0, random() * 2, 0, clouds);
  }
  instance(box, 0xad8f7a, 0, -0.069, -39, 44, 0.12, 10);
  for (let i = 0; i < 22; i++) {
    for (let j = 0; j < 5; j++) {
      const x = -21 + i * 2;
      const z = -35 - j * 2;
      const tint = [0xd5b8a0, 0xcbae98, 0xccaa93, 0xc3a592][Math.floor(random() * 4)];
      instance(box, tint, x, -0.016, z, 1.978, 0.04, 1.978, 0, 0, 0, textures.paver);
    }
  }
  for (const side of [-1, 1]) {
    // Low limestone walls edge the tiled terrace without blocking its three entrances.
    instance(box, 0xcdb399, side * 21.95, 0.4, -39, 0.4, 0.8, 9.8);
    instance(box, 0xe2cbb1, side * 21.95, 0.85, -39, 0.51, 0.11, 9.9);
    instance(box, 0xcdb399, side * 18.5, 0.4, -43.97, 7, 0.8, 0.4);
    instance(box, 0xe2cbb1, side * 18.5, 0.85, -43.97, 7.03, 0.11, 0.51);
    // Cypresses outside the route mark the courtyard's edge and soften the museum silhouette.
    for (let i = 0; i < 6; i++) {
      const tx = side * (16.3 + random() * 1.35);
      const tz = -46.3 - i * 5.5;
      tree(tx, tz, 0.82 + random() * 0.48, i % 2 ? [0x6e9176, 0x7e9f83, 0x9ba98a] : cherry);
      for (let j = 0; j < 3; j++) {
        instance(foliage, j % 2 ? 0x7e9776 : 0x859d81, side * (15.55 + random() * 0.86), 0.33, tz - j * 1.51,
          0.82, 0.64 + random() * 0.31, 0.85, 0, random() * 6);
      }
    }
    for (const z of [-43.7, -51.75, -66.8, -73.7]) {
      instance(box, galaGold, side * 3.69, -0.01, z, 0.045, 0.035, 0.8);
    }
  }
  instance(box, 0xb89e8b, 0, -0.045, -59, 7.44, 0.09, 30, 0, 0, 0, textures.path);
  for (const x of [-3.72, 3.72]) instance(box, galaGold, x, 0.011, -59, 0.07, 0.03, 30, 0, 0, 0, textures.edge);
  for (let i = 0; i < 17; i++) {
    const z = -44.9 - i * 1.7;
    const tints = [0xcdb09d, 0xd1b49f, 0xc8a895, 0xcead9a, 0xc1a592];
    for (let j = 0; j < 4; j++) instance(box, tints[(i + j * 3) % tints.length], (j - 1.5) * 1.86, -0.002, z,
      1.844, 0.022, 1.68, 0, 0, 0, textures.paver);
  }
  for (const x of [-2.1, 2.1]) instance(box, 0x9d7566, x, 0.012, -58.65, 0.035, 0.014, 28.6);
  for (const { x, z } of MUSEUM.plotCenters) {
    instance(box, 0xac9b82, x * 1.23, -0.012, z, 3.9, 0.034, 1.985, 0, 0, 0, textures.paver);
  }

  function lotus(x, y, z, radius, color) {
    for (let n = 0; n < 8; n++) {
      const a = n * Math.PI / 4;
      instance(pebble, n % 2 ? color : 0xe7a0a2, x + Math.sin(a) * radius * 0.65, y, z + Math.cos(a) * radius * 0.65,
        radius * 0.33, radius * 0.25, radius * 0.62, 0.55, a);
    }
    instance(pebble, 0xffdfa0, x, y + radius * 0.18, z, radius * 0.31, radius * 0.29, radius * 0.31, 0, 0, 0, candlelight);
  }

  const { width: poolWidth, depth: poolDepth } = MUSEUM.poolSize;
  for (const { x, z } of MUSEUM.pools) {
    instance(box, galaInk, x, 0.12, z, poolWidth, 0.26, poolDepth);
    instance(box, 0x4f999b, x, 0.255, z, poolWidth - 0.33, 0.075, poolDepth - 0.3, 0, 0, 0, water);
    for (const side of [-1, 1]) {
      instance(box, galaGold, x + side * (poolWidth / 2 - 0.085), 0.295, z, 0.17, 0.15, poolDepth);
      instance(box, galaGold, x, 0.296, z + side * (poolDepth / 2 - 0.085), poolWidth - 0.34, 0.15, 0.17);
      // Light the garden paths from within the coping so the aisle stays clear.
      for (const dz of [-4.95, 4.95]) {
        const lampX = x + side * (poolWidth / 2 - 0.3);
        instance(tapered, galaInk, lampX, 0.71, z + dz, 0.12, 0.92, 0.12);
        instance(barrel, galaGold, lampX, 1.15, z + dz, 0.42, 0.105, 0.42);
        lotus(lampX, 1.3, z + dz, 0.48, 0xf6d3b7);
        instance(panel, 0xffffff, lampX, 1.31, z + dz + 0.105, 1.04, 1.04, 1, 0, 0, 0, halo);
      }
    }
    for (let n = 0; n < 22; n++) {
      const padX = x + (random() - 0.5) * (poolWidth - 0.96);
      const padZ = z + (random() - 0.5) * (poolDepth - 1.55);
      const r = 0.14 + random() * 0.31;
      instance(barrel, n % 2 ? 0x81a276 : 0x598b72, padX, 0.305, padZ, r, 0.025, r * 0.86);
      instance(ripple, 0xa6d4c8, padX, 0.297, padZ, r * 1.45, 0.33, r * 1.24, 0, 0, 0, water);
      if (n % 2 === 0) lotus(padX, 0.37, padZ, r * 0.78, 0xf1c1b4);
    }
  }

  // The fountain keeps its original position for water animation and atmosphere.
  const { fountainZ } = MUSEUM;
  shadow(0, fountainZ, 2.95, 2.83);
  instance(barrel, galaInk, 0, 0.125, fountainZ, 2.76, 0.25, 2.76);
  instance(barrel, 0x86aca0, 0, 0.36, fountainZ, 2.56, 0.33, 2.56);
  instance(barrel, colors.cream, 0, 0.549, fountainZ, 2.64, 0.13, 2.64);
  instance(barrel, 0x98d5d4, 0, 0.62, fountainZ, 2.37, 0.043, 2.37, 0, 0, 0, water);
  instance(tapered, colors.rose, 0, 0.76, fountainZ, 0.99, 0.34, 0.99);
  instance(tapered, colors.cream, 0, 1.14, fountainZ, 0.46, 0.77, 0.46);
  instance(barrel, colors.blush, 0, 1.46, fountainZ, 1.15, 0.21, 1.15);
  instance(barrel, colors.cream, 0, 1.59, fountainZ, 1.3, 0.12, 1.3);
  instance(barrel, 0xa9e3e0, 0, 1.661, fountainZ, 1.17, 0.034, 1.17, 0, 0, 0, water);
  instance(tapered, colors.rose, 0, 1.917, fountainZ, 0.32, 0.51, 0.32);
  instance(barrel, colors.cream, 0, 2.19, fountainZ, 0.67, 0.16, 0.67);
  instance(barrel, 0xa9e3e0, 0, 2.277, fountainZ, 0.53, 0.028, 0.53, 0, 0, 0, water);
  instance(tapered, colors.rose, 0, 2.69, fountainZ, 0.061, 0.83, 0.061);
  instance(heart, colors.rose, 0, 3.28, fountainZ - 0.02, 0.41, 0.41, 0.51);
  instance(heart, colors.blush, 0, 3.28, fountainZ + 0.05, 0.29, 0.29, 0.24);
  const jetPoints = [[0, 2.25], [0, 2.58], [0.13, 2.79], [0.3, 2.63], [0.48, 2.3]]
    .map(([x, y]) => new THREE.Vector3(x, y, 0));
  const jet = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(jetPoints), 16, 0.04, 6, false);
  for (let n = 0; n < 5; n++) instance(jet, 0xe6f9ef, 0, 0, fountainZ, 1, 1, 1, 0, n * Math.PI * 2 / 5, 0, water);

  const streamPoints = [[0.93, 1.66], [1.29, 1.66], [1.56, 1.38], [1.75, 0.64]]
    .map(([x, y]) => new THREE.Vector3(x, y, 0));
  const stream = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(streamPoints), 15, 0.038, 6, false);
  for (let n = 0; n < 8; n++) {
    const angle = n * Math.PI / 4;
    instance(stream, 0xd3f2ef, 0, 0, fountainZ, 1, 1, 1, 0, angle, 0, water);
    const x = Math.cos(angle) * 1.75;
    const z = fountainZ - Math.sin(angle) * 1.75;
    instance(ripple, 0xecf9ee, x, 0.652, z, 0.28, 0.34, 0.28, 0, 0, 0, candlelight);
    for (let p = 0; p < 3; p++) {
      instance(pebble, 0xe0f7f3, x + (random() - 0.5) * 0.22, 0.73 + p * 0.094, z + (random() - 0.5) * 0.22,
        0.037, 0.067, 0.038, 0, angle, 0, candlelight);
    }
  }

  const pavilionZ = -78.1;
  instance(barrel, galaInk, 0, 0.085, pavilionZ, 3.71, 0.17, 3.71);
  instance(barrel, 0xb4cab2, 0, 0.19, pavilionZ, 3.46, 0.15, 3.46);
  instance(barrel, galaGold, 0, 0.29, pavilionZ, 3.28, 0.07, 3.28);
  for (let i = 0; i < 8; i++) {
    const a = (i + 0.5) * Math.PI / 4;
    const x = Math.sin(a) * 2.84;
    const z = pavilionZ + Math.cos(a) * 2.84;
    instance(barrel, galaInk, x, 2.07, z, 0.16, 3.51, 0.16);
    for (const y of [0.48, 0.71, 3.62]) instance(barrel, galaGold, x, y, z, 0.23, 0.13, 0.23);
    beam(galaInk, x, 3.39, z, x * 0.78, 3.82, pavilionZ + (z - pavilionZ) * 0.78, 0.12);
    const eaveX = Math.sin(a) * 3.82;
    const eaveZ = pavilionZ + Math.cos(a) * 3.82;
    beam(galaGold, x * 0.53, 4.81, pavilionZ + (z - pavilionZ) * 0.53, eaveX, 3.86, eaveZ, 0.085);
    beam(galaGold, eaveX, 3.86, eaveZ, eaveX * 1.08, 4.19, pavilionZ + (eaveZ - pavilionZ) * 1.08, 0.082);
    instance(pebble, 0xffdfa6, eaveX, 3.67, eaveZ, 0.12, 0.15, 0.12, 0, 0, 0, candlelight);
  }
  instance(barrel, galaGold, 0, 3.85, pavilionZ, 3.88, 0.14, 3.88);
  instance(cone, galaInk, 0, 4.52, pavilionZ, 3.76, 1.25, 3.76);
  instance(barrel, galaGold, 0, 4.79, pavilionZ, 1.75, 0.11, 1.75);
  instance(cone, 0x528e87, 0, 5.27, pavilionZ, 1.68, 0.89, 1.68);
  instance(tapered, galaGold, 0, 5.69, pavilionZ, 0.28, 0.37, 0.28);
  lotus(0, 5.88, pavilionZ, 0.55, 0xffe3c6);
  instance(heart, colors.rose, 0, 6.33, pavilionZ, 0.34, 0.34, 0.34);
  for (const side of [-1, 1]) {
    for (let i = 0; i < 9; i++) flower(side * (6.05 + random() * 0.62), -66.8 - random() * 3.2,
      0.27 + random() * 0.39, blossoms[i % blossoms.length], 0.85 + random() * 0.52);
  }

  // A terraced grove closes the view behind the pavilion without adding another
  // destination. Its taller silhouettes flank the pavilion instead of masking it.
  instance(box, colors.grass, 0, -0.17, -104, 66, 0.32, 22, 0, 0, 0, textures.grass);
  for (const [x, y, z, w, h, d, color] of [
    [-17, -2.18, -97, 20, 5.9, 9.8, 0x83a69a],
    [17, -2.05, -96.8, 20, 5.4, 9.7, 0x809f99],
    [1, -2.61, -98.5, 19, 5.26, 9.5, 0x8cad9d],
    [-12, -1.53, -106, 26, 7.3, 11.5, 0x91a8b3],
    [17, -2.2, -109, 25, 8.7, 12, 0xa2aebe],
  ]) instance(foliage, color, x, y, z, w, h, d);

  const terraceZ = x => -85.8 + 0.012 * x * x;
  for (let x = -22; x < 22; x += 4) {
    const z1 = terraceZ(x);
    const z2 = terraceZ(x + 4);
    const centerZ = (z1 + z2) / 2;
    const length = Math.hypot(4, z2 - z1);
    const yaw = -Math.atan2(z2 - z1, 4);
    instance(box, 0xb3bfa6, x + 2, 0.61, centerZ, length + 0.16, 1.22, 0.58, 0, yaw);
    instance(box, 0xe8d6ad, x + 2, 1.25, centerZ, length + 0.17, 0.17, 0.71, 0, yaw);
    instance(box, 0x7f9c8f, x + 2, 0.2, centerZ, length + 0.15, 0.27, 0.78, 0, yaw);
  }
  for (const x of [-22, -14, -6, 6, 14, 22]) {
    const z = terraceZ(x);
    instance(box, 0x88a596, x, 0.76, z, 0.8, 1.52, 0.83);
    instance(box, galaGold, x, 1.54, z, 0.91, 0.14, 0.92);
    instance(pebble, 0xffd5a4, x, 1.74, z, 0.22, 0.24, 0.22, 0, 0, 0, candlelight);
  }

  for (const side of [-1, 1]) {
    for (let i = 0; i < 7; i++) {
      const x = side * (4.7 + i * 2.6);
      const z = terraceZ(x) + 0.86 + random() * 0.35;
      instance(foliage, i % 3 ? 0x648f7a : 0x929e95, x, 0.48, z, 1.8, 0.86 + random() * 0.39, 0.88);
    }
    tree(side * 8.1, -81.8, 1.58, [0x85aa93, 0x729987, 0x93b4a0]);
    tree(side * 14.1, -81.4, 1.92, [0x97a6a0, 0x82a9a0, 0xa3b7ac]);

    for (let i = 0; i < 7; i++) {
      const x = side * (5.4 + i * 3.1 + random() * 0.7);
      const z = (i % 2 ? -94.5 : -98.5) - random() * 1.6;
      const foot = i % 2 ? 1.15 : 2.45;
      const height = 3.4 + random() * 3.9;
      const width = 0.83 + random() * 0.52;
      const palette = i % 2 ? [0x638881, 0x7b9c8d] : [0x81a3a1, 0x8aaeb1];
      instance(cone, palette[0], x, foot + height * 0.32 - 0.45, z, width, height * 0.73 + 0.9, width, 0, i);
      instance(cone, palette[1], x, foot + height * 0.62, z, width * 0.77, height * 0.76, width * 0.77, 0, i);
    }
  }


  function buildBatches(batches, perSlot = false) {
    const result = [];
    function addBatch(geometry, material, entries) {
      const batch = new THREE.InstancedMesh(geometry, material, entries.length);
      entries.forEach(([matrix, color], index) => {
        batch.setMatrixAt(index, matrix);
        batch.setColorAt(index, tint.setHex(color));
      });
      batch.computeBoundingSphere();
      world.add(batch);
      if (occluderMaterials.has(material)) occluders.push(batch);
      if (perSlot) result.push({ batch, stride: entries.length / FRAME_SLOTS });
    }
    for (const [geometry, byMaterial] of batches) {
      for (const [material, entries] of byMaterial) {
        // Petals and foliage account for most triangles. Subdivide only these batches
        // so the camera can cull entire sections without breaking up the whole world.
        if (!perSlot && material === stone && (geometry === pebble || geometry === foliage)) {
          const sections = [[], [], [], [], []];
          for (const entry of entries) {
            const z = entry[0].elements[14];
            sections[z >= -10 ? 0 : z >= -28 ? 1 : z >= -50 ? 2 : z >= -76 ? 3 : 4].push(entry);
          }
          for (const section of sections) if (section.length) addBatch(geometry, material, section);
        } else {
          addBatch(geometry, material, entries);
        }
      }
    }
    batches.clear();
    return result;
  }
  buildBatches(shapeBatches);
  const adjustableFrames = buildBatches(frameBatches, true);
  let loading = 0;
  let pending = 0;

  function setPhotos(photoPage) {
    const activeCount = Math.min(photoPage.length, FRAME_SLOTS);
    photoTargets.length = 0;
    loading = pending = 0;
    slots.forEach((slot, index) => {
      const { request, frame, art } = slot;
      if (request) {
        request.onload = request.onerror = null;
        request.removeAttribute('src');
        slot.request = null;
      }
      if (art.material.map) {
        art.material.map.dispose();
        art.material.map = null;
        art.material.needsUpdate = true;
      }
      const photo = index < activeCount ? photoPage[index] : null;
      frame.visible = Boolean(photo);
      art.visible = false;
      frame.userData.photo = photo;
      frame.userData.photoIndex = photo ? (photo.index ?? index) : undefined;
      slot.source = photo?.thumb || photo?.path || null;
      slot.fallback = photo?.path && photo.path !== slot.source ? photo.path : null;
      if (!photo) return;
      photoTargets.push(frame);
      if (slot.source) pending++;
      const date = typeof photo.date === 'string' ? photo.date.slice(0, 10) : '';
      const number = String(frame.userData.photoIndex + 1).padStart(2, '0');
      const caption = /^\d{4}-\d{2}-\d{2}$/.test(date) ? date.replaceAll('-', ' / ') : 'OUR MEMORIES';
      paintPlaque(index, `${number}  ·  ${caption}`, '');
    });
    for (const { batch, stride } of adjustableFrames) {
      batch.count = activeCount * stride;
      batch.visible = activeCount > 0;
    }
    frameLabels.visible = activeCount > 0;
    labelGeometry.setDrawRange(0, activeCount * panel.index.count);
    atlas.needsUpdate = true;
  }

  function loadPhoto(slot) {
    const image = new Image();
    const source = slot.source;
    slot.source = null;
    slot.request = image;
    loading++;
    pending--;
    image.decoding = 'async';
    function finish() {
      if (slot.request !== image) return false;
      image.onload = image.onerror = null;
      slot.request = null;
      loading--;
      return true;
    }
    image.onerror = () => {
      if (!finish() || !slot.fallback) return;
      slot.source = slot.fallback;
      slot.fallback = null;
      pending++;
    };
    image.onload = () => {
      if (!finish()) return;
      const { naturalWidth: width, naturalHeight: height } = image;
      if (!width || !height) return;
      let pixels = image;
      // WebP thumbnails already fit the texture budget. Legacy originals may not.
      if (Math.max(width, height) > MAX_FRAME_TEXTURE_EDGE) {
        const scale = MAX_FRAME_TEXTURE_EDGE / Math.max(width, height);
        pixels = document.createElement('canvas');
        pixels.width = Math.max(1, Math.round(width * scale));
        pixels.height = Math.max(1, Math.round(height * scale));
        const context = pixels.getContext('2d');
        context.imageSmoothingQuality = 'high';
        context.drawImage(image, 0, 0, pixels.width, pixels.height);
      }
      const texture = new THREE.Texture(pixels);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.needsUpdate = true;
      const fit = Math.min(2.03 / width, 1.48 / height);
      const { art } = slot;
      art.scale.set(width * fit, height * fit, 1);
      art.material.map = texture;
      art.material.needsUpdate = true;
      art.visible = true;
    };
    image.src = source;
  }

  // Only queue nearby frames on the current page, and reprioritize as the player moves.
  function update(cameraPosition) {
    while (pending && loading < PHOTO_LOAD_LIMIT) {
      let next;
      let nearest = PHOTO_LOAD_DISTANCE ** 2;
      for (const slot of slots) {
        if (!slot.source) continue;
        const { x, z } = slot.frame.position;
        const distance = (x - cameraPosition.x) ** 2 + (z - cameraPosition.z) ** 2;
        if (distance >= nearest) continue;
        next = slot;
        nearest = distance;
      }
      if (!next) return;
      loadPhoto(next);
    }
  }

  setPhotos(firstPagePhotos);
  world.updateMatrixWorld(true);
  return { photoTargets, plots, setGrowth, setPhotos, update, occluders };
}
