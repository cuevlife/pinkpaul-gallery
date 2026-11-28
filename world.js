import * as THREE from 'three';
import { makeGardenTextures } from './garden-textures.js?v=4';

const colors = {
  sky: 0x9fcbe9, horizon: 0xf5dce6, grass: 0xaad3ad, path: 0xf2c8c1,
  cream: 0xffefd6, blush: 0xf4b5bb, rose: 0xcb788a, wine: 0x884959,
  mint: 0x8abda3, sage: 0x639c81, pine: 0x3c785d, soil: 0x915d54,
  peach: 0xffbd9d, butter: 0xffd481, lilac: 0xc5b1dd,
};

const chapters = [
  { name: 'The Rose Conservatory', story: 'I  /  EVERY MEMORY BEGINS AS A SEED', z: -3.9,
    paving: [0xf1bdba, 0xf5cec3, 0xf9dbcb, 0xedb3b5, 0xf5c7bd], edge: 0xffefd6, hedge: [0x65995c, 0x87ae68, 0x527c57] },
  { name: 'The Keepsake Cinema', story: 'II  /  LITTLE MOMENTS ON THE BIG SCREEN', z: -16.8,
    paving: [0xe3bac7, 0xf1cdb7, 0xd0aabd, 0xf6d8ba, 0xe8c4d2], edge: 0xe8b983, hedge: [0x657c71, 0x796e87, 0x5e8b81] },
  { name: 'The Wisteria Hour', story: 'III  /  STAY UNTIL THE LANTERNS GLOW', z: -36,
    paving: [0xb69ec5, 0xccb4d3, 0xac9ec2, 0xe2c8dd, 0xc1b1d1], edge: 0xe7cded, hedge: [0x627481, 0x718597, 0x575e80] },
  { name: 'The Lotus Gala', story: 'IV  /  KEEP THIS LIGHT WITH YOU', z: -58.7,
    paving: [0x95bfb9, 0xb8d5c8, 0x91b4b6, 0xd1e0cf, 0xb7d2bd], edge: 0xf8ddac, hedge: [0x51897c, 0x689b8b, 0x426f69] },
];

function chapterAt(z) {
  return chapters[z >= -10 ? 0 : z >= -28 ? 1 : z >= -50 ? 2 : 3];
}

const FRAME_SLOTS = 25;
const PHOTO_LOAD_DISTANCE = 34;
const PHOTO_LOAD_LIMIT = 3;
const MAX_FRAME_TEXTURE_EDGE = 420;

export function buildWorld(scene, firstPagePhotos = []) {
  const world = new THREE.Group();
  world.name = 'Pinkpaul · Memory Lane';
  scene.add(world);
  scene.background = new THREE.Color(colors.horizon);
  scene.fog = new THREE.FogExp2(colors.horizon, 0.025);

  const fill = new THREE.HemisphereLight(0xfff0e8, 0xb7bfcc, 2.05);
  const sun = new THREE.DirectionalLight(0xffe0b4, 1.35);
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
  sky.position.set(0, 0, -27);
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

  instance(box, colors.grass, 0, -0.16, -35, 58, 0.31, 117, 0, 0, 0, textures.grass);
  instance(box, colors.path, 0, -0.024, -32, 2.62, 0.064, 79, 0, 0, 0, textures.path);
  for (let i = 0; i < 9; i++) {
    const z = -18 - i * 8.4;
    const side = i % 2 === 0 ? -1 : 1;
    const x = side * (7 + random() * 16);
    const y = 5.7 + random() * 4.3;
    for (let n = 0; n < 4; n++) {
      instance(foliage, n === 1 ? 0xfff9f1 : 0xffedf3, x + (n - 1.5) * 0.91, y + Math.sin(n * Math.PI / 3) * 0.45, z,
        1.39, 0.6 + (n % 2) * 0.23, 0.65, 0, n, 0, clouds);
    }
  }

  for (let row = 0; row < 104; row++) {
    const z = 7 - row * 0.744;
    const { paving: pavers, edge } = chapterAt(z);
    for (const side of [-1, 1]) {
      instance(box, edge, side * 1.29, 0.024, z, 0.1, 0.04, 0.68, 0, 0, 0, textures.edge);
      if (row % 3 === 0) instance(pebble, pavers[2], side * (1.44 + random() * 0.17), 0.018,
        z - random() * 0.36, 0.052, 0.027, 0.085, 0, random() * 3);
    }
    for (let col = 0; col < 4; col++) {
      const x = (col - 1.5) * 0.615 + (row % 2 === 0 ? -0.045 : 0.045);
      instance(box, pavers[Math.floor(random() * pavers.length)], x, 0.009, z, 0.584, 0.024, 0.714, 0, (random() - 0.5) * 0.025, 0, textures.paver);
    }
  }

  const greens = [colors.sage, colors.mint, 0x76aa84, 0x8fb592, colors.pine];
  const blossoms = [colors.blush, 0xeb8da4, colors.cream, colors.peach, colors.lilac, 0xffd2da];
  for (const side of [-1, 1]) {
    for (let i = 0; i < 48; i++) {
      const z = 5.35 - i * 1.53;
      const { edge, hedge } = chapterAt(z);
      const x = side * (6.7 + random() * 0.62);
      if (z > -10 || (z < -46 && z > -50)) {
        instance(box, edge, side * 6.1, 0.38, z, 0.1, 0.76, 0.11);
        instance(pebble, colors.blush, side * 6.1, 0.79, z, 0.105, 0.09, 0.105);
        for (const y of [0.27, 0.52]) instance(box, edge, side * 6.1, y, z - 0.765, 0.07, 0.064, 1.54);
      }
      for (let j = 0; j < 2; j++) {
        instance(foliage, hedge[(i + j) % hedge.length], x, 0.38 + random() * 0.24, z - j * 0.79,
          0.62 + random() * 0.21, 0.47 + random() * 0.31, 0.76, 0, random() * 6);
      }
      if (i % 2 === 0 && z > -54) {
        for (let j = 0; j < 3; j++) flower(side * (4.94 + random() * 0.54), z - random() * 1.63,
          0.18 + random() * 0.34, z < -28 ? [colors.lilac, 0x8885c7, 0xd2a8d5][j] : blossoms[(i + j) % blossoms.length],
          0.7 + random() * 0.6);
      }
    }
    for (let i = 0; i < 12; i++) {
      const z = 3 - i * 6.45 - random() * 1.7;
      const x = side * (7.0 + random() * 3.1);
      tree(x, z, 0.84 + random() * 0.57, i % 3 === 0
        ? [0xf9c9cb, 0xf1a6b6, 0xf2bac8, 0xffd7d0]
        : [0xacce9d, 0x8ab79a, 0x71a388, 0xa5caa9]);
    }
    for (let i = 0; i < 8; i++) {
      instance(foliage, greens[i % greens.length], side * (10.7 + random() * 8), 0.6, 1 - i * 9.7,
        2.6 + random(), 1.1 + random() * 1.3, 3.2, 0, random() * 6);
    }
  }

  // All written signs and date plaques are generated locally into one texture.
  const canvas = document.createElement('canvas');
  const tileW = 256;
  const tileH = 80;
  const atlasColumns = 4;
  canvas.width = tileW * atlasColumns;
  canvas.height = tileH * Math.ceil((FRAME_SLOTS + 10) / atlasColumns);
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
    ink.strokeStyle = '#cd8991';
    ink.lineWidth = 2;
    ink.strokeRect(u + 5, v + 5, tileW - 10, tileH - 10);
    ink.textAlign = 'center';
    ink.textBaseline = 'middle';
    ink.fillStyle = '#794a5b';
    ink.font = subtext ? 'bold 28px Georgia, serif' : 'bold 33px Georgia, serif';
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

  function archCurve(xRadius, rise, bottom, thickness) {
    const points = [];
    for (let i = 0; i <= 20; i++) {
      const angle = i * Math.PI / 20;
      points.push(new THREE.Vector3(xRadius * Math.cos(angle), bottom + rise * Math.sin(angle), 0));
    }
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 28, thickness, 6, false);
  }

  function chapterSign(index, y, trim, face) {
    const { name, story, z } = chapters[index];
    instance(box, trim, 0, y, z + 0.12, 3.32, 0.95, 0.14);
    plaque(world, entryPlots + 6 + index, name, story, 0, y, z + 0.199, 3.2, 0.85, face);
  }

  // I. A roof of open ironwork, with trellises outside the playable aisle.
  const roseIron = 0x3e6955;
  const roseTrim = 0xf2dba8;
  const roseColors = [0xc94f78, 0xf18ca6, 0xfad2be, 0xea7494];
  function climbingRose(x, y, z, size, color) {
    instance(foliage, 0x47794e, x, y, z - 0.07, size * 1.7, size * 1.25, size * 0.9);
    for (let p = 0; p < 5; p++) {
      const a = p * Math.PI * 2 / 5;
      instance(pebble, color, x + Math.sin(a) * size * 0.64, y + Math.cos(a) * size * 0.64, z,
        size * 0.66, size * 0.58, size * 0.44, 0, 0, -a);
    }
    instance(pebble, colors.butter, x, y, z + size * 0.26, size * 0.42, size * 0.33, size * 0.33);
  }
  for (const z of [0.6, chapters[0].z, -8.4]) {
    instance(heart, colors.rose, 0, 5.34, z + 0.06, 0.33, 0.33, 0.26);
    for (const side of [-1, 1]) {
      const x = side * 5.77;
      instance(box, roseIron, x, 1.73, z, 0.19, 3.46, 0.23);
      for (const y of [0.13, 0.4, 3.39]) instance(box, roseTrim, x, y, z, 0.34, 0.13, 0.34);
      beam(roseIron, x, 3.4, z, 0, 5.11, z, 0.18, 0.2);
      beam(roseTrim, x, 3.58, z + 0.13, 0, 5.27, z + 0.13, 0.075);
      beam(roseIron, side * 3.6, 3.34, z, side * 2.7, 4.31, z, 0.072);
      beam(roseIron, x, 3.34, z, side * 3.6, 3.34, z, 0.09);
      for (let n = 0; n < 5; n++) climbingRose(x - side * (n * 0.48), 3.38 + n * 0.14, z + 0.13,
        0.13 + random() * 0.08, roseColors[(n + (side > 0 ? 1 : 0)) % roseColors.length]);
    }
  }
  for (const side of [-1, 1]) {
    for (const [x, y] of [[0, 5.14], [2.9, 4.27], [5.77, 3.42]]) {
      if (x === 0 && side === 1) continue;
      instance(box, roseIron, side * x, y, -3.9, 0.1, 0.11, 9.15);
    }
    for (const z of [-1.65, -6.15]) {
      const x = side * 5.78;
      instance(box, 0xb17c72, x, 0.19, z, 0.64, 0.38, 3.94);
      instance(box, colors.cream, x, 0.37, z, 0.69, 0.095, 4.05);
      instance(box, roseIron, x, 1.97, z, 0.09, 0.1, 4);
      for (const d of [-1.9, -0.96, 0, 0.96, 1.9]) {
        beam(roseIron, x, 0.42, z + d, x, 1.97, z + d, 0.064);
        if (d < 1.9) {
          beam(roseTrim, x, 0.6, z + d, x, 1.94, z + d + 0.94, 0.038);
          beam(roseTrim, x, 1.94, z + d, x, 0.6, z + d + 0.94, 0.038);
        }
        climbingRose(x - side * (0.08 + random() * 0.09), 0.82 + random() * 0.9, z + d,
          0.16 + random() * 0.08, roseColors[Math.floor(random() * roseColors.length)]);
      }
    }
  }
  beam(roseIron, 0, 4.96, chapters[0].z, 0, 3.52, chapters[0].z, 0.09);
  chapterSign(0, 3.56, roseIron, '#fff0d6');

  // II. Recessed, stepped theatre portals and outsize pastel film reels.
  const reelRim = new THREE.TorusGeometry(1, 0.07, 6, 24);
  const reelFace = Math.PI / 2;
  const brass = 0xe8b278;
  const cinemaInk = 0x5a486b;
  for (const [i, z] of [chapters[1].z, -23.65].entries()) {
    for (const side of [-1, 1]) {
      for (let step = 0; step < 3; step++) {
        const x = side * (5.87 + step * 0.19);
        const y = 3.02 + step * 0.15;
        const cap = 4.05 + step * 0.18;
        const depth = z - step * 0.16;
        const color = [cinemaInk, brass, 0x976880][step];
        const width = [0.26, 0.085, 0.14][step];
        beam(color, x, 0.07, depth, x, y, depth, width, 0.34);
        beam(color, x, y, depth, x * 0.69, cap, depth, width, 0.34);
        beam(color, x * 0.69, cap, depth, 0, cap, depth, width, 0.34);
      }
      instance(box, cinemaInk, side * 5.99, 0.15, z, 0.78, 0.3, 0.73);
      for (let n = 0; n < 7; n++) {
        instance(pebble, n % 2 ? 0xffe7ba : 0xffcdde, side * (1.8 + n * 0.31), 4.05, z + 0.19,
          0.041, 0.041, 0.04, 0, 0, 0, candlelight);
      }
      instance(pebble, i ? 0xbad8d5 : 0xffb9d4, side * 4.04, 4.19, z + 0.03, 0.28, 0.39, 0.24, 0, 0, side * 0.2);
    }
    instance(pebble, brass, 0, 4.61, z - 0.24, 0.29, 0.42, 0.21);
  }
  for (const [i, x, y, z, radius, face] of [
    [0, -6.29, 2.43, -15.72, 0.88, 0xe2b4cf], [1, 6.38, 2.02, -15.38, 0.98, 0xadd7c9],
    [2, -6.35, 1.34, -14.62, 0.63, 0xf3c8a8], [3, 6.11, 2.78, -23.22, 0.68, 0xe0b6db],
    [4, -6.13, 1.7, -22.81, 0.69, 0xecc6a2],
    [5, -2.54, 3.59, -20.8, 0.66, 0xe6b5d5], [6, 2.54, 3.59, -20.8, 0.66, 0xb9d9cc],
  ]) {
    if (Math.abs(x) > 5.4) {
      instance(box, cinemaInk, x, 0.1, z, radius * 1.59, 0.2, 0.61);
      instance(box, cinemaInk, x, y * 0.43, z, 0.12, y * 0.86, 0.21);
    } else {
      const supportX = Math.sign(x) * 3.45;
      beam(brass, supportX, 4.39, chapters[1].z - 0.32, supportX, 4.39, -23.97, 0.066);
      beam(cinemaInk, supportX, 4.39, z, x, y + radius * 0.74, z, 0.07);
    }
    instance(barrel, cinemaInk, x, y, z, radius, 0.25, radius, reelFace);
    instance(barrel, face, x, y, z + 0.15, radius * 0.95, 0.14, radius * 0.95, reelFace);
    instance(reelRim, brass, x, y, z + 0.23, radius * 0.88, radius * 0.88, 0.81);
    instance(barrel, brass, x, y, z + 0.24, radius * 0.14, 0.08, radius * 0.14, reelFace);
    for (let n = 0; n < 5; n++) {
      const a = i * 0.45 + n * Math.PI * 2 / 5;
      instance(barrel, cinemaInk, x + Math.sin(a) * radius * 0.5, y + Math.cos(a) * radius * 0.5, z + 0.232,
        radius * 0.21, 0.05, radius * 0.21, reelFace);
    }
  }
  for (const side of [-1, 1]) {
    for (let n = 0; n < 17; n++) {
      const z = -12.8 - n * 0.78;
      instance(box, cinemaInk, side * 1.48, 0.018, z, 0.18, 0.039, 0.73);
      instance(box, brass, side * 1.48, 0.041, z, 0.085, 0.009, 0.27);
    }
  }
  chapterSign(1, 3.76, brass, '#f7e5ea');

  // III. A lavender arbor, with draped flowers and low-poly lanterns above head height.
  const wisteriaInk = 0x564c76;
  const wisteriaTrim = 0xc2afd1;
  const wisteriaColors = [0xb594d7, 0x9e87c8, 0xd5b1df, 0x796eb3, 0xe6c9e7];
  const arbor = archCurve(5.76, 1.61, 3.04, 0.14);
  const arborTrim = archCurve(5.76, 1.61, 3.04, 0.039);
  for (const [i, z] of [chapters[2].z, -39.6, -43.2, -46.8].entries()) {
    instance(arbor, wisteriaInk, 0, 0, z, 1, 1, 1);
    instance(arborTrim, wisteriaTrim, 0, 0, z + 0.14, 1, 1, 1);
    for (const side of [-1, 1]) {
      const x = side * 5.76;
      instance(box, wisteriaInk, x, 1.52, z, 0.26, 3.04, 0.27);
      for (const y of [0.14, 0.41, 2.87]) instance(box, wisteriaTrim, x, y, z, 0.4, 0.15, 0.39);
      for (const y of [0.78, 1.28, 1.78, 2.28]) instance(box, wisteriaTrim, x, y, z + 0.16, 0.12, 0.12, 0.035, 0, 0, Math.PI / 4);
      for (let n = 0; n < 11; n++) {
        const a = 0.12 + n * 0.103;
        const flowerX = side * 5.76 * Math.cos(a);
        const flowerY = 3.04 + 1.61 * Math.sin(a);
        const d = z + 0.14 + (random() - 0.5) * 0.64;
        instance(foliage, n % 2 ? 0x647a83 : 0x686889, flowerX, flowerY, d, 0.35, 0.18, 0.37, 0, 0, side * 0.27);
        if (n < 2) continue;
        for (let p = 0; p < 4; p++) {
          const r = 0.17 - p * 0.032;
          instance(pebble, wisteriaColors[(p + n + i) % wisteriaColors.length],
            flowerX + Math.sin(p * 2) * 0.075, flowerY - 0.11 - p * 0.16, d + 0.14,
            r, 0.13, r, 0.1, p * 2, side * 0.24);
        }
      }
    }
  }
  for (const x of [-5.76, -4.64, -2.8, 0, 2.8, 4.64, 5.76]) {
    const y = 3.04 + 1.61 * Math.sqrt(1 - (x / 5.76) ** 2);
    instance(box, wisteriaInk, x, y, -41.4, 0.088, 0.095, 11.09);
  }
  for (const z of [-37.8, -41.4, -45]) {
    for (const x of [-2.8, 2.8]) {
      const y = 3.8;
      instance(barrel, wisteriaInk, x, 4.12, z, 0.022, 0.49, 0.022);
      instance(box, wisteriaInk, x, y + 0.12, z, 0.34, 0.084, 0.34);
      instance(box, wisteriaInk, x, y - 0.19, z, 0.31, 0.075, 0.31);
      instance(box, 0xffdfa8, x, y - 0.03, z, 0.26, 0.27, 0.26, 0, 0, 0, candlelight);
      instance(panel, 0xffffff, x, y - 0.03, z + 0.2, 0.82, 0.82, 1, 0, 0, 0, halo);
    }
  }
  instance(reelRim, wisteriaTrim, 0, 5.02, chapters[2].z, 0.37, 0.37, 0.58);
  instance(pebble, colors.cream, 0, 5.02, chapters[2].z + 0.04, 0.23, 0.23, 0.051, 0, 0, Math.PI / 8, candlelight);
  for (const x of [-1.35, 1.35]) beam(wisteriaInk, x, 4.58, chapters[2].z, x, 4.17, chapters[2].z, 0.069);
  chapterSign(2, 3.85, wisteriaInk, '#eee3f6');

  const photoTargets = [];
  const pickMaterial = new THREE.MeshBasicMaterial({ visible: false });
  const labelPositions = [];
  const labelUVs = [];
  const labelIndices = [];
  const slots = Array.from({ length: FRAME_SLOTS }, (_, index) => {
    const row = Math.floor(index / 2);
    const z = -5.8 - row * (55 / (Math.ceil(FRAME_SLOTS / 2) - 1));
    const side = index % 2 === 0 ? -1 : 1;
    const x = side * 2.47;
    const frame = new THREE.Group();
    frame.name = `Memory frame ${index + 1}`;
    frame.position.set(x, 1.71, z);
    world.add(frame);

    // Shared frame parts stay batched, with an equal number of instances per slot.
    frameInstance(box, row % 3 === 1 ? colors.mint : colors.rose, x, 1.71, z, 2.05, 1.56, 0.12);
    frameInstance(box, colors.cream, x, 1.71, z + 0.072, 1.93, 1.44, 0.038);
    frameInstance(box, colors.rose, x, 0.79, z + 0.025, 0.89, 0.26, 0.13);
    for (const s of [-1, 1]) {
      frameInstance(box, colors.cream, x + s * 0.67, 0.51, z - 0.012, 0.13, 1.02, 0.16, 0, 0, 0, textures.wood);
      frameInstance(box, colors.blush, x + s * 0.67, 0.078, z, 0.21, 0.15, 0.28);
      frameInstance(box, colors.blush, x + s * 0.96, 2.37, z + 0.097, 0.066, 0.066, 0.023, 0, 0, Math.PI / 4);
    }
    frameInstance(heart, colors.blush, x, 2.53, z + 0.014, 0.155, 0.155, 0.18);
    frameInstance(barrel, row % 2 ? 0xd5e3cd : 0xe8ded2, x, 0.012, z + 0.09, 1.22, 0.039, 0.83);
    frameInstance(shadowDisc, 0xffffff, x + 0.17, 0.011, z - 0.11, 1.14, 1, 0.52, 0, 0, 0, shade);
    for (let n = 0; n < 4; n++) flower(side * (3.56 + random() * 0.58), z + 0.52 - random() * 1.16,
      0.24 + random() * 0.36, blossoms[(row + n) % blossoms.length], 0.76 + random() * 0.48);

    const art = new THREE.Mesh(panel, new THREE.MeshBasicMaterial({ toneMapped: false }));
    art.position.z = 0.101;
    art.scale.set(1.79, 1.28, 1);
    frame.add(art);
    // Keep the backboard and label clickable without rendering separate meshes.
    const hitBoard = new THREE.Mesh(box, pickMaterial);
    hitBoard.scale.set(2.05, 1.56, 0.12);
    const hitLabel = new THREE.Mesh(panel, pickMaterial);
    hitLabel.position.set(0, -0.92, 0.095);
    hitLabel.scale.set(0.82, 0.22, 1);
    frame.add(hitBoard, hitLabel);

    const { position, uv } = panel.attributes;
    for (let i = 0; i < position.count; i++) {
      labelPositions.push(x + position.getX(i) * 0.82, 0.79 + position.getY(i) * 0.22, z + 0.095);
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
  const plots = Array.from({ length: 6 }, (_, index) => {
    const side = index % 2 === 0 ? -1 : 1;
    const x = side * 1.88;
    const z = -0.78 - Math.floor(index / 2) * 1.53;
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

  // Set the blossom banks back so the trunks do not close the outer photo aisle.
  const cherry = [0xf3a4bf, 0xffc7d4, 0xffdce3, 0xe78daf, 0xf5b4ce, 0xffe0dc];
  for (const side of [-1, 1]) {
    tree(side * 7.45, -2.9, 1.7, cherry);
    tree(side * 7.8, -8.2, 1.45, cherry);
    tree(side * 7.94, -41.4, 1.36, [0xada5c8, 0xa39cc0, 0xcfaed6, 0x838aaf]);
    for (let i = 0; i < 16; i++) {
      const x = side * (3.47 + random() * 1.52);
      const z = 1.7 - random() * 10.1;
      instance(pebble, cherry[i % cherry.length], x, 0.021, z, 0.067, 0.021, 0.044, 0, random() * 6);
      if (i % 2 === 0) flower(x, z, 0.24 + random() * 0.35, cherry[i % cherry.length], 0.9 + random() * 0.54);
    }
  }

  // IV. A causeway between reflecting pools, with illuminated lotus crowns.
  const galaInk = 0x387b79;
  const galaGold = 0xf3c88e;
  const galaArch = archCurve(5.94, 1.05, 3.06, 0.13);
  const galaTrim = archCurve(5.94, 1.05, 3.06, 0.043);
  const galaZ = chapters[3].z;
  const water = new THREE.MeshLambertMaterial({ name: 'Garden water', color: 0xffffff, flatShading: true, emissive: 0x173637, emissiveIntensity: 0.36 });
  const ripple = new THREE.TorusGeometry(1, 0.017, 4, 16).rotateX(Math.PI / 2);
  instance(galaArch, galaInk, 0, 0, galaZ, 1, 1, 1);
  instance(galaTrim, galaGold, 0, 0, galaZ + 0.13, 1, 1, 1);
  chapterSign(3, 3.69, galaInk, '#e4f1dc');
  function lotus(x, y, z, radius, color) {
    for (let n = 0; n < 8; n++) {
      const a = n * Math.PI / 4;
      instance(pebble, n % 2 ? color : 0xf3b4b5, x + Math.sin(a) * radius * 0.65, y, z + Math.cos(a) * radius * 0.65,
        radius * 0.33, radius * 0.25, radius * 0.62, 0.55, a);
    }
    instance(pebble, 0xffdfa0, x, y + radius * 0.18, z, radius * 0.31, radius * 0.29, radius * 0.31, 0, 0, 0, candlelight);
  }
  for (const side of [-1, 1]) {
    const x = side * 5.94;
    instance(box, galaInk, x, 1.54, galaZ, 0.25, 3.08, 0.31);
    for (const y of [0.19, 0.52, 2.97]) instance(box, galaGold, x, y, galaZ, 0.41, 0.14, 0.39);
    lotus(x, 3.22, galaZ, 0.47, 0xffdcc3);
    for (const z of [-58.1, -64.1, -70.1]) {
      const pondX = side * 5.72;
      instance(box, 0x76988a, pondX, 0.023, z, 4.31, 0.057, 5.99);
      instance(box, 0x5ea8b0, pondX, 0.042, z, 4.13, 0.043, 5.85, 0, 0, 0, water);
      instance(box, galaGold, side * 3.59, 0.071, z, 0.11, 0.093, 5.93);
      for (let n = 0; n < 4; n++) {
        const padX = side * (4.16 + random() * 2.9);
        const padZ = z + 2.84 - (n + random()) * 1.28;
        const r = 0.19 + random() * 0.25;
        instance(barrel, n % 2 ? 0x7eaf82 : 0x4d8b72, padX, 0.084, padZ, r, 0.023, r * 0.84);
        instance(ripple, 0xa8d8cc, padX, 0.078, padZ, r * 1.42, 0.35, r * 1.2, 0, 0, 0, water);
        if (n % 2 === 0) lotus(padX, 0.14, padZ, r * 0.65, 0xffdac7);
      }
      for (let n = 0; n < 6; n++) {
        const reedX = side * (7.13 + random() * 0.53);
        const reedZ = z + (random() - 0.5) * 5.7;
        const height = 0.68 + random() * 0.58;
        const drift = (random() - 0.5) * 0.3;
        beam(0x587f69, reedX, 0.07, reedZ, reedX + drift, height, reedZ, 0.038);
        instance(pebble, 0xbd946e, reedX + drift, height, reedZ, 0.055, 0.13, 0.057);
        instance(pebble, 0x72a28b, reedX, height * 0.46, reedZ + 0.1, 0.041, height * 0.44, 0.056, 0.45);
      }
    }
    for (const [z, y] of [[-55.2, 1.16], [-62.1, 1.74], [-67, 2.22], [-72.8, 2.84]]) {
      const lampX = side * 6.13;
      instance(tapered, galaInk, lampX, y * 0.48, z, 0.17, y * 0.96, 0.17);
      instance(barrel, galaGold, lampX, 0.23, z, 0.29, 0.11, 0.29);
      instance(barrel, galaGold, lampX, y - 0.13, z, 0.39, 0.11, 0.39);
      lotus(lampX, y, z, 0.53, 0xffddc4);
      instance(panel, 0xffffff, lampX, y + 0.06, z + 0.3, 1.06, 1.06, 1, 0, 0, 0, halo);
    }
  }

  // The fountain sits beyond the walkable boundary; the pavilion crowns the view behind it.
  const fountainZ = -68.07;
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

  const pavilionZ = -75.25;
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
    for (let i = 0; i < 9; i++) flower(side * (2.8 + random() * 0.62), -64.9 - random() * 3.2,
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
      const fit = Math.min(1.73 / width, 1.22 / height);
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
  return { photoTargets, plots, setGrowth, setPhotos, update };
}
