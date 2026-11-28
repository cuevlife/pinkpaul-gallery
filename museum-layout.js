// The same plan drives the rendered walls and the camera's collision checks.
const PLAYER_RADIUS = 0.28;
const WALL_DEPTH = 0.46;
const atrium = { minX: -8, maxX: 8, minZ: -34, maxZ: 7 };
const west = { minX: -22, maxX: -8, minZ: -34, maxZ: 2 };
const east = { minX: 8, maxX: 22, minZ: -34, maxZ: 2 };
const terrace = { minX: -22, maxX: 22, minZ: -44, maxZ: -34 };
const garden = { minX: -15, maxX: 15, minZ: -74, maxZ: -44 };
const rooms = [atrium, west, east];
const grounds = [...rooms, terrace, garden];

// Wall ranges run along local X. For a side wall the range describes world Z.
// Entries are [center, opening width]; the mesh and collision use the same edges.
const wall = (axis, at, from, to, finish, doors = []) => ({ axis, at, from, to, finish, doors });
const walls = [
  wall('x', -8, -34, 7, 'atrium', [[-25, 4.8], [-9.8, 4.8]]),
  wall('x', 8, -34, 7, 'atrium', [[-25, 4.8], [-9.8, 4.8]]),
  wall('z', 7, -8, 8, 'atrium'),
  wall('z', 2, -22, -8, 'west'),
  wall('x', -22, -34, 2, 'west'),
  wall('z', 2, 8, 22, 'east'),
  wall('x', 22, -34, 2, 'east'),
  wall('z', -34, -22, -8, 'west', [[-14.5, 4.8]]),
  wall('z', -34, -8, 8, 'atrium', [[0, 6.4]]),
  wall('z', -34, 8, 22, 'east', [[14.5, 4.8]]),
];

export function wallSpans({ from, to, doors }) {
  const spans = [];
  let cursor = from;
  for (const [center, width] of doors) {
    spans.push([cursor, center - width / 2]);
    cursor = center + width / 2;
  }
  spans.push([cursor, to]);
  return spans;
}

const plotCenters = Array.from({ length: 6 }, (_, i) => ({
  x: (i % 2 === 0 ? -1 : 1) * 5.1, z: -45.1 - Math.floor(i / 2) * 2,
}));
const pools = [{ x: -8.9, z: -59.3 }, { x: 8.9, z: -59.3 }];
const poolSize = { width: 6.2, depth: 12.4 };
const fountainZ = -68.07;
const sculpture = { x: 0, z: -14.8, radius: 1.65 };
const benches = [{ x: -13.6, z: -15.4 }, { x: 13.6, z: -15.4 }];
const rect = (x, z, w, d) => ({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
const blockers = [
  ...walls.flatMap(segment => wallSpans(segment).map(([start, end]) => segment.axis === 'x'
    ? rect(segment.at, (start + end) / 2, WALL_DEPTH, end - start)
    : rect((start + end) / 2, segment.at, end - start, WALL_DEPTH))),
  ...pools.map(({ x, z }) => rect(x, z, poolSize.width, poolSize.depth)),
  ...plotCenters.map(({ x, z }) => rect(x, z, 1.13, 0.98)),
  ...benches.map(({ x, z }) => rect(x, z, 0.88, 2.7)),
];
const circles = [sculpture, { x: 0, z: fountainZ, radius: 2.76 }];
const inside = ({ minX, maxX, minZ, maxZ }, x, z, pad = 0) =>
  x >= minX - pad && x <= maxX + pad && z >= minZ - pad && z <= maxZ + pad;

function canWalk(x, z) {
  // Check against the union rather than shrinking each room (which would seal its doors).
  return grounds.some(area => inside(area, x, z)) &&
    grounds.some(area => inside(area, x - PLAYER_RADIUS, z)) &&
    grounds.some(area => inside(area, x + PLAYER_RADIUS, z)) &&
    grounds.some(area => inside(area, x, z - PLAYER_RADIUS)) &&
    grounds.some(area => inside(area, x, z + PLAYER_RADIUS)) &&
    !blockers.some(area => inside(area, x, z, PLAYER_RADIUS)) &&
    !circles.some(center => (center.x - x) ** 2 + (center.z - z) ** 2 < (center.radius + PLAYER_RADIUS) ** 2);
}

function locationAt(x, z) {
  if (z < atrium.minZ) return 3;
  return x < atrium.minX ? 1 : x > atrium.maxX ? 2 : 0;
}

const zones = [
  { id: 'atrium', name: 'โถงกลาง', english: 'The Atrium', photo: 0,
    copy: 'เริ่มที่โถงกลาง ชมภาพรอบโถง แล้วเลือกเดินเข้าปีกซ้าย ปีกขวา หรือออกไปลานบัว',
    spawn: { x: 0, z: 4, yaw: 0, pitch: -0.03 } },
  { id: 'west', name: 'ปีกจัดแสดงฝั่งตะวันตก', english: 'West Gallery', photo: 6,
    copy: 'แวะชมภาพในห้องโทนกุหลาบ จากอีกฟากของห้องเดินกลับเข้าโถงหรือออกไปลานบัวได้',
    spawn: { x: -12, z: -4, yaw: Math.PI / 2, pitch: -0.04 } },
  { id: 'east', name: 'ปีกจัดแสดงฝั่งตะวันออก', english: 'East Gallery', photo: 14,
    copy: 'เดินชมภาพตามผนังสีเขียวอมฟ้า แล้วเลือกกลับโถงหรือเดินต่อไปลานบัว',
    spawn: { x: 12, z: -4, yaw: -Math.PI / 2, pitch: -0.04 } },
  { id: 'courtyard', name: 'ลานบัวด้านหลัง', english: 'Lotus Courtyard', photo: 22,
    copy: 'ออกมาชมบัวในสระ รดน้ำแปลงดอกไม้ หรือเดินอ้อมไปดูน้ำพุหัวใจ',
    spawn: { x: 0, z: -41, yaw: 0, pitch: -0.095 } },
];
const trail = [
  { x: 3.6, z: -9.5 }, { x: -17, z: -19 }, { x: 17, z: -19 },
  { x: -4.8, z: -41 }, { x: 3.7, z: -67.5 },
];

export const MUSEUM = {
  zones, trail, canWalk, locationAt,
  grounds, rooms, walls, wallDepth: WALL_DEPTH, plotCenters, sculpture, benches, fountainZ, pools, poolSize,
};
