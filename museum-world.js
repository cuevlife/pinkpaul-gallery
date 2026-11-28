import * as THREE from 'three';
import { MUSEUM, wallSpans } from './museum-layout.js?v=1';

const plaster = { atrium: 0xd2ae91, west: 0xae777f, east: 0x719087 };
const wood = { atrium: 0x513732, west: 0x5b3843, east: 0x314c48 };
const limestone = 0xe0c3a5;
const bronze = 0x624333;
const brass = 0xd2a668;
const ceiling = 0x9c765d;
const pillar = 0xcc9e78;

const halfTurn = Math.PI;
const quarterTurn = Math.PI / 2;
const wallFace = MUSEUM.wallDepth / 2;

// Position is at the wall face; yaw points the art into the visitor's room.
const leftFace = -8 + wallFace;
const rightFace = 8 - wallFace;
const rearFace = -34 + wallFace;
export const museumFrames = [
  [leftFace, -14.15, quarterTurn, 'atrium'], [rightFace, -14.15, -quarterTurn, 'atrium'],
  [leftFace, -18.75, quarterTurn, 'atrium'], [rightFace, -18.75, -quarterTurn, 'atrium'],
  [-5.55, rearFace, 0, 'atrium'], [5.55, rearFace, 0, 'atrium'],
  ...[-4, -9, -14, -19, -24].map(z => [-22 + wallFace, z, quarterTurn, 'west']),
  [-16.3, 2 - wallFace, halfTurn, 'west'],
  [-10.4, rearFace, 0, 'west'], [-8 - wallFace, -17, -quarterTurn, 'west'],
  ...[-4, -9, -14, -19, -24].map(z => [22 - wallFace, z, -quarterTurn, 'east']),
  [16.3, 2 - wallFace, halfTurn, 'east'],
  [10.4, rearFace, 0, 'east'], [8 + wallFace, -17, quarterTurn, 'east'],
  [-18.7, -34 - wallFace, halfTurn, 'terrace'], [5.55, -34 - wallFace, halfTurn, 'terrace'],
  [18.7, -34 - wallFace, halfTurn, 'terrace'],
];

const openingSpring = 3.15;
const openingRadiusY = 1.15;
const portalProfiles = new Map();

function portalProfile(width, height) {
  const key = `${width}/${height}`;
  if (portalProfiles.has(key)) return portalProfiles.get(key);
  const radius = width / 2;
  const fill = new THREE.Shape();
  const casing = new THREE.Shape();
  fill.moveTo(-radius, openingSpring);
  casing.moveTo(-radius, openingSpring);
  for (let i = 1; i <= 22; i++) {
    const angle = Math.PI * (1 - i / 22);
    const v = Math.sin(angle);
    fill.lineTo(radius * Math.cos(angle), openingSpring + openingRadiusY * v);
    casing.lineTo(radius * Math.cos(angle), openingSpring + openingRadiusY * v);
  }
  fill.lineTo(radius, height);
  fill.lineTo(-radius, height);
  fill.closePath();
  for (let i = 22; i >= 0; i--) {
    const angle = Math.PI * (1 - i / 22);
    casing.lineTo((radius + 0.24) * Math.cos(angle), openingSpring + (openingRadiusY + 0.24) * Math.sin(angle));
  }
  casing.closePath();
  const geometry = (shape, depth) => new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false }).translate(0, 0, -depth / 2);
  const profile = [geometry(fill, MUSEUM.wallDepth), geometry(casing, MUSEUM.wallDepth + 0.18)];
  portalProfiles.set(key, profile);
  return profile;
}

export function addMuseumShell({ world, box, barrel, panel, foliage, instance, stone, textures, candlelight, plaque, random }) {
  const structural = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const occluderMaterials = new Set([structural]);
  const slab = (color, x, y, z, sx, sy, sz, material = stone) =>
    instance(box, color, x, y, z, sx, sy, sz, 0, 0, 0, material);
  const surface = (color, x, z, width, depth, material = stone, elevation = 0.005) =>
    slab(color, x, elevation - 0.018, z, width, 0.036, depth, material);

  // Contrasting perimeter and center inlays make the open circulation readable.
  MUSEUM.rooms.forEach(({ minX, maxX, minZ, maxZ }, index) => {
    const x = (minX + maxX) / 2;
    const z = (minZ + maxZ) / 2;
    const width = maxX - minX;
    const depth = maxZ - minZ;
    slab(0x6f5146, x, -0.085, z, width, 0.15, depth);
    const columns = index === 0 ? 8 : 7;
    const rows = Math.round(depth / 2);
    const dx = width / columns;
    const dz = depth / rows;
    const stoneTints = index === 0 ? [0xbfa18a, 0xc6aa92, 0xccac96, 0xc2a590]
      : index === 1 ? [0xab877a, 0xb39084, 0xbb978a, 0xb49287] : [0x87968b, 0x8f9e92, 0x95a296, 0x94a29a];
    for (let i = 0; i < columns; i++) {
      for (let j = 0; j < rows; j++) {
        surface(stoneTints[Math.floor(random() * stoneTints.length)], minX + dx * (i + 0.5), minZ + dz * (j + 0.5),
          dx - 0.017, dz - 0.017, textures.paver);
      }
    }
    for (const side of [-1, 1]) {
      surface(wood[MUSEUM.zones[index].id], x + side * (width / 2 - 1.16), z, 0.11, depth - 0.65, stone, 0.012);
      surface(brass, x + side * (width / 2 - 1.02), z, 0.038, depth - 0.65, stone, 0.013);
    }
  });
  for (const x of [-3.57, 3.57]) {
    surface(0x794f41, x, -13.5, 0.16, 40.7, stone, 0.014);
    surface(brass, x + Math.sign(x) * 0.15, -13.5, 0.037, 40.7, stone, 0.015);
  }
  for (const z of [-3.9, -23.2, -32.9]) surface(brass, 0, z, 7.54, 0.047, stone, 0.015);

  for (const segment of MUSEUM.walls) {
    const { axis, at, doors, finish } = segment;
    const sideWall = axis === 'x';
    const outer = at === -34 || at === 7 || Math.abs(at) === 22 || at === 2;
    const height = (finish === 'atrium' && at !== -34) ? 7.35 : 5.75;
    const shell = (color, center, y, length, h, depth, offset = 0, material = stone) => {
      if (sideWall) slab(color, at + offset, y, center, depth, h, length, material);
      else slab(color, center, y, at + offset, length, h, depth, material);
    };
    for (const [start, end] of wallSpans(segment)) {
      const center = (start + end) / 2;
      const length = end - start;
      shell(plaster[finish], center, height / 2, length, height, MUSEUM.wallDepth, 0, structural);
      for (const side of [-1, 1]) {
        const face = side * wallFace;
        const wing = sideWall && Math.abs(at) === 8 && Math.sign(at) === side
          ? (side > 0 ? 'east' : 'west') : finish;
        const outsideRear = at === -34 && side === -1;
        if (wing !== finish || outsideRear) shell(outsideRear ? 0xcdb197 : plaster[wing], center, height / 2,
          length, height, 0.025, face);
        const wainscot = outsideRear ? 0x89685b : wood[wing];
        shell(wainscot, center, 0.37, length, 0.74, 0.055, face);
        shell(bronze, center, 0.1, length, 0.2, 0.12, face);
        shell(brass, center, 0.76, length, 0.048, 0.085, face);
        shell(limestone, center, 0.83, length, 0.095, 0.11, face);
        shell(bronze, center, 5.32, length, 0.2, 0.1, face);
        shell(brass, center, 5.44, length, 0.045, 0.12, face);
        for (let i = 0, count = Math.max(1, Math.round(length / 1.5)); i < count; i++) {
          const s = start + (i + 0.5) * length / count;
          shell(outsideRear ? 0xaa8973 : 0x856051, s, 0.42, Math.min(0.96, length - 0.24), 0.023, 0.078, face);
        }
        if (sideWall && Math.abs(at) === 22 && side === -Math.sign(at)) {
          for (const s of [-26.65, -16.55, -6.55]) {
            shell(wood[finish], s, 3.05, 0.13, 4.32, 0.09, face);
            shell(brass, s, 3.05, 0.024, 4.2, 0.108, face);
          }
        }
      }
      if (outer) shell(limestone, center, height - 0.04, length + 0.02, 0.18, 0.65);
    }
    for (const [center, width] of doors) {
      const [upper, molding] = portalProfile(width, height);
      const yaw = sideWall ? -quarterTurn : 0;
      const x = sideWall ? at : center;
      const z = sideWall ? center : at;
      instance(upper, plaster[finish], x, 0, z, 1, 1, 1, 0, yaw, 0, structural);
      instance(molding, limestone, x, 0, z, 1, 1, 1, 0, yaw);
      for (const side of [-1, 1]) {
        const end = center + side * (width / 2 + 0.15);
        shell(pillar, end, 1.57, 0.3, 3.14, 0.68);
        for (const [y, h, w] of [[0.14, 0.28, 0.48], [0.42, 0.09, 0.41], [2.98, 0.12, 0.45], [3.14, 0.075, 0.47]]) {
          shell(y > 2.9 ? limestone : bronze, end, y, w, h, w + 0.31);
        }
      }
      shell(brass, center, 0.01, width, 0.022, 0.58);
    }
  }

  // Deep coves and open brass skylight ribs lift the atrium above the two wings.
  for (const side of [-1, 1]) {
    slab(ceiling, side * 6.23, 7.34, -13.5, 3.55, 0.25, 41);
    slab(bronze, side * 4.52, 7.17, -13.5, 0.22, 0.31, 41);
    slab(brass, side * 4.39, 7.08, -13.5, 0.06, 0.06, 41);
    slab(0xefd4ab, side * 4.68, 7.006, -13.5, 0.084, 0.018, 40.65, candlelight);
    slab(0xeac9a7, side * 14.97, 5.74, -16, 14.08, 0.24, 36);
    for (const d of [-5.9, -2.22, 2.22, 5.9]) slab(wood[side < 0 ? 'west' : 'east'], side * 15 + d, 5.52, -16, 0.19, 0.26, 36);
    for (const z of [-31, -24.9, -18.8, -12.7, -6.6, -0.5]) {
      slab(pillar, side * 15, 5.47, z, 13.62, 0.14, 0.19);
      slab(brass, side * 15, 5.31, z, 2.12, 0.15, 0.33);
      slab(0xffdeb0, side * 15, 5.225, z, 1.88, 0.04, 0.18, candlelight);
    }
  }
  for (let z = 5.75; z > -34; z -= 3.5) {
    slab(bronze, 0, 7.3, z, 9.05, 0.28, 0.17);
    slab(brass, 0, 7.137, z, 8.87, 0.055, 0.071);
  }
  for (const x of [-2.95, 0, 2.95]) slab(bronze, x, 7.52, -13.5, 0.14, 0.22, 41);
  slab(ceiling, 0, 6.42, -34, 16, 1.7, 0.45);

  function sign(id, heading, details, x, y, z, w, h, yaw = 0) {
    instance(box, bronze, x, y, z, w + 0.15, h + 0.13, 0.075, 0, yaw);
    const group = new THREE.Group();
    group.position.set(x, y, z);
    group.rotation.y = yaw;
    world.add(group);
    plaque(group, id, heading, details, 0, 0, 0.047, w, h, '#352825');
  }
  sign(31, 'PINKPAUL', 'T H E   M E M O R Y   M U S E U M', 0, 5.82, -33.70, 6.35, 1.52);
  sign(32, 'West Gallery', '02  /  G A L L E R Y', -7.69, 4.89, -25, 3.3, 0.82, quarterTurn);
  sign(33, 'East Gallery', '03  /  G A L L E R Y', 7.69, 4.89, -25, 3.3, 0.82, -quarterTurn);
  sign(34, 'Lotus Courtyard', '04  /  O P E N   A I R', 0, 4.7, -34.31, 3.7, 0.91, halfTurn);
  sign(35, 'The Atrium', '01  /  Y O U   A R E   H E R E', 0, 2.5, 6.69, 4.4, 1.0, halfTurn);
  sign(36, 'West Gallery', 'W E L C O M E   B A C K', -14.5, 4.7, -34.31, 3.3, 0.86, halfTurn);
  sign(37, 'East Gallery', 'W E L C O M E   B A C K', 14.5, 4.7, -34.31, 3.3, 0.86, halfTurn);
  // Hang wayfinding signs high enough to leave the openings and art in view.
  sign(38, 'WEST GALLERY', '02  /  R O S E   R O O M', -5.92, 3.65, -8.5, 2.8, 0.67);
  sign(39, 'EAST GALLERY', '03  /  S A G E   R O O M', 5.92, 3.65, -8.5, 2.8, 0.67);
  for (const x of [-7.03, -4.81, 4.81, 7.03]) slab(bronze, x, 5.59, -8.5, 0.028, 3.24, 0.026);

  const { x, z, radius } = MUSEUM.sculpture;
  const ring = new THREE.TorusGeometry(1, 0.014, 5, 40).rotateX(quarterTurn);
  const circle = new THREE.CylinderGeometry(1, 1, 1, 40);
  instance(circle, 0x765249, x, 0.075, z, radius, 0.15, radius);
  instance(circle, brass, x, 0.16, z, radius * 0.97, 0.045, radius * 0.97);
  instance(circle, 0xa77c68, x, 0.26, z, 1.16, 0.2, 1.16);
  instance(circle, 0xc69479, x, 0.5, z, 0.86, 0.34, 0.86);
  instance(ring, brass, x, 0.024, z, 2.17, 0.9, 2.17);
  instance(ring, bronze, x, 0.024, z, 2.38, 0.9, 2.38);
  const petalShape = new THREE.Shape();
  petalShape.moveTo(0, -0.46);
  petalShape.bezierCurveTo(-0.58, -0.21, -0.55, 0.42, 0, 0.77);
  petalShape.bezierCurveTo(0.52, 0.47, 0.56, -0.13, 0, -0.46);
  const petal = new THREE.ExtrudeGeometry(petalShape, { depth: 0.065, steps: 1, curveSegments: 8,
    bevelEnabled: true, bevelSize: 0.028, bevelThickness: 0.026, bevelSegments: 1 });
  for (let i = 0; i < 9; i++) {
    const a = i * 2 * Math.PI / 9;
    instance(petal, i % 2 ? 0xcb7382 : 0xe898a0, x + Math.sin(a) * 0.61, 1.08, z + Math.cos(a) * 0.61,
      0.72, 1.05, 1, 0.67, a, 0);
    if (i % 2 === 0) instance(foliage, brass, x + Math.sin(a) * 0.27, 1.23, z + Math.cos(a) * 0.27, 0.084, 0.27, 0.08, 0.31, a);
  }
  instance(foliage, 0xf9cb82, x, 1.34, z, 0.26, 0.19, 0.26);
  sign(40, 'Lotus in Bronze', 'T H E   A T R I U M   C O L L E C T I O N', x, 0.47, z + 0.83, 0.79, 0.23);

  instance(barrel, bronze, x, 6.7, z, 0.045, 1.3, 0.045);
  instance(barrel, brass, x, 6.04, z, 0.33, 0.17, 0.33);
  for (const [r, y] of [[1.86, 5.71], [1.31, 5.39], [0.76, 5.09]]) {
    instance(ring, brass, x, y, z, r, 3.8, r);
    instance(ring, bronze, x, y - 0.062, z, r * 1.013, 2.8, r * 1.013);
    for (let i = 0; i < 10; i++) {
      const a = i * 2 * Math.PI / 10;
      instance(barrel, 0xffdca4, x + Math.cos(a) * r, y + 0.058, z + Math.sin(a) * r,
        0.037, 0.105, 0.037, 0, 0, 0, candlelight);
    }
  }
  for (const side of [-1, 1]) {
    slab(bronze, x + side * 0.91, 5.83, z, 1.83, 0.032, 0.035);
    slab(brass, x + side * 1.32, 5.57, z, 0.032, 0.32, 0.032);
    slab(brass, x + side * 0.75, 5.25, z, 0.032, 0.32, 0.032);
  }

  for (const { x: bx, z: bz } of MUSEUM.benches) {
    const side = Math.sign(bx);
    slab(wood[side < 0 ? 'west' : 'east'], bx, 0.44, bz, 0.88, 0.24, 2.7, textures.wood);
    slab(side < 0 ? 0x8a4f63 : 0x477169, bx, 0.6, bz, 0.79, 0.12, 2.57);
    for (const offset of [-1.02, 1.02]) {
      slab(bronze, bx, 0.2, bz + offset, 0.64, 0.38, 0.16);
      slab(brass, bx, 0.067, bz + offset, 0.89, 0.092, 0.19);
    }
  }

  const washCanvas = document.createElement('canvas');
  washCanvas.width = washCanvas.height = 96;
  const ctx = washCanvas.getContext('2d');
  const gradient = ctx.createRadialGradient(48, 22, 3, 48, 33, 47);
  gradient.addColorStop(0, 'rgba(255,214,156,.45)');
  gradient.addColorStop(0.4, 'rgba(255,214,156,.16)');
  gradient.addColorStop(1, 'rgba(255,214,156,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(1, 1, 94, 94);
  const washTexture = new THREE.CanvasTexture(washCanvas);
  washTexture.colorSpace = THREE.SRGBColorSpace;
  const wash = new THREE.MeshBasicMaterial({ map: washTexture, transparent: true, depthWrite: false });
  for (const [fx, fz, yaw, room] of museumFrames) {
    const sin = Math.sin(yaw), cos = Math.cos(yaw);
    if (room !== 'terrace') instance(panel, 0xffffff, fx + sin * 0.017, 2.76, fz + cos * 0.017, 3.4, 4.15, 1, 0, yaw, 0, wash);
    instance(box, bronze, fx + sin * 0.12, 3.61, fz + cos * 0.12, 0.134, 0.075, 0.2, 0, yaw);
    instance(box, brass, fx + sin * 0.23, 3.57, fz + cos * 0.23, 1.27, 0.09, 0.12, 0, yaw);
    instance(box, 0xffdfab, fx + sin * 0.23, 3.516, fz + cos * 0.23, 1.13, 0.029, 0.093, 0, yaw, 0, candlelight);
  }

  return occluderMaterials;
}
