import * as THREE from 'three';

const REST_ANGLE = -0.08;
const POUR_ANGLE = 0.57;
const POUR_TIME = 0.62;
const DROP_INTERVAL = 0.024;
const DROP_COUNT = 13;
const POOL_SIZE = 32;

export function createWatering(scene, camera) {
  const mount = new THREE.Group();
  const can = new THREE.Group();
  mount.name = 'Held watering can';
  mount.visible = false;
  mount.add(can);
  camera.add(mount);

  // Bake soft shading into the small prop so it is readable in any garden light.
  const shaded = new THREE.MeshBasicMaterial({ vertexColors: true });
  const light = new THREE.Vector3(-0.45, 0.8, 0.65).normalize();
  function piece(geometry, color, x = 0, y = 0, z = 0) {
    const normal = geometry.attributes.normal;
    const colors = new Float32Array(normal.count * 3);
    const tint = new THREE.Color(color);
    for (let i = 0; i < normal.count; i++) {
      const shade = 0.64 + 0.36 * Math.max(0, light.x * normal.getX(i) + light.y * normal.getY(i) + light.z * normal.getZ(i));
      colors[i * 3] = shade * tint.r;
      colors[i * 3 + 1] = shade * tint.g;
      colors[i * 3 + 2] = shade * tint.b;
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const mesh = new THREE.Mesh(geometry, shaded);
    mesh.position.set(x, y, z);
    can.add(mesh);
    return mesh;
  }

  const mint = 0x9deacb;
  const pink = 0xf9acc8;
  const pale = 0xffe9f2;
  const outline = [
    [0, -0.116], [0.088, -0.116], [0.122, -0.102], [0.137, -0.073],
    [0.139, -0.03], [0.135, 0.019], [0.119, 0.059], [0.092, 0.078],
    [0.079, 0.086], [0.068, 0.083], [0.065, 0.054], [0, 0.046],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  piece(new THREE.LatheGeometry(outline, 36), mint).scale.z = 0.79;
  const base = piece(new THREE.TorusGeometry(0.097, 0.01, 8, 32), 0x6acbb0, 0, -0.108);
  base.rotation.x = Math.PI / 2;
  base.scale.y = 0.79;
  const rim = piece(new THREE.TorusGeometry(0.074, 0.011, 8, 32), pink, 0, 0.081);
  rim.rotation.x = Math.PI / 2;
  rim.scale.y = 0.79;
  piece(new THREE.CylinderGeometry(0.064, 0.064, 0.004, 28), 0x5aaf9b, 0, 0.056).scale.z = 0.79;

  const handle = new THREE.CatmullRomCurve3([
    [0.094, 0.055], [0.158, 0.093], [0.218, 0.074],
    [0.234, 0.018], [0.199, -0.048], [0.12, -0.073],
  ].map(([x, y]) => new THREE.Vector3(x, y, 0)));
  piece(new THREE.TubeGeometry(handle, 24, 0.018, 10, false), pink);

  const spoutStart = new THREE.Vector3(-0.114, -0.049, 0);
  const spoutEnd = new THREE.Vector3(-0.302, 0.068, 0.024);
  const spoutAxis = spoutEnd.clone().sub(spoutStart).normalize();
  const up = new THREE.Vector3(0, 1, 0);
  const spout = piece(new THREE.CylinderGeometry(0.024, 0.042, spoutStart.distanceTo(spoutEnd), 18), mint);
  spout.position.copy(spoutStart).lerp(spoutEnd, 0.5);
  spout.quaternion.setFromUnitVectors(up, spoutAxis);
  const rose = piece(new THREE.CylinderGeometry(0.048, 0.029, 0.039, 24), pink);
  rose.position.copy(spoutEnd);
  rose.quaternion.copy(spout.quaternion);
  const nozzle = spoutEnd.clone().addScaledVector(spoutAxis, 0.022);
  const face = piece(new THREE.CylinderGeometry(0.039, 0.04, 0.006, 24), pale, nozzle.x, nozzle.y, nozzle.z);
  face.quaternion.copy(rose.quaternion);
  const hole = new THREE.Vector3();
  for (let i = 0; i < 7; i++) {
    const angle = i * Math.PI / 3;
    const radius = i === 6 ? 0 : 0.023;
    hole.set(Math.cos(angle) * radius, 0.004, Math.sin(angle) * radius).applyQuaternion(rose.quaternion).add(nozzle);
    piece(new THREE.SphereGeometry(0.004, 8, 6), 0xb97094, hole.x, hole.y, hole.z);
  }

  // Raised flower on the side facing the player.
  for (let i = 0; i < 5; i++) {
    const angle = i * Math.PI * 2 / 5;
    piece(new THREE.SphereGeometry(0.014, 10, 8), pale, Math.cos(angle) * 0.025, -0.017 + Math.sin(angle) * 0.025, 0.106).scale.z = 0.42;
  }
  piece(new THREE.SphereGeometry(0.014, 10, 8), 0xffc977, 0, -0.017, 0.111).scale.z = 0.55;
  can.rotation.z = REST_ANGLE;

  const spray = new THREE.Group();
  spray.name = 'Water droplets';
  scene.add(spray);
  const dropGeometry = new THREE.SphereGeometry(1, 8, 6);
  const blue = [0x45a9f1, 0x91dcff].map(color => new THREE.MeshBasicMaterial({ color }));
  const drops = Array.from({ length: POOL_SIZE }, (_, i) => {
    const mesh = new THREE.Mesh(dropGeometry, blue[i % blue.length]);
    mesh.visible = false;
    spray.add(mesh);
    return { mesh, from: new THREE.Vector3(), to: new THREE.Vector3(), age: 0, life: 0, arc: 0, size: 0 };
  });

  const motionPreference = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');
  const target = new THREE.Vector3();
  const origin = new THREE.Vector3();
  let held = false;
  let pouring = false;
  let elapsed = 0;
  let emitted = 0;
  let cursor = 0;
  let activeDrops = 0;

  function placeMount() {
    const depth = 0.72;
    const halfHeight = depth * Math.tan(THREE.MathUtils.degToRad(camera.getEffectiveFOV() * 0.5));
    const halfWidth = halfHeight * camera.aspect;
    mount.position.set(halfWidth * 0.59, -halfHeight * 0.61, -depth);
    mount.scale.setScalar(Math.min(halfWidth, halfHeight) * 0.9);
  }

  function setHeld(value) {
    held = Boolean(value);
    mount.visible = held;
    if (held) {
      placeMount();
    } else {
      pouring = false;
      can.rotation.z = REST_ANGLE;
    }
  }

  function spawnDrop(index, age, reduced) {
    const distance = reduced ? 0 : origin.distanceTo(target);
    const life = reduced ? 0.28 : THREE.MathUtils.clamp(0.32 + distance * 0.045, 0.38, 0.83) + (index % 4) * 0.025;
    if (age >= life) return;
    const drop = drops[cursor];
    cursor = (cursor + 1) % POOL_SIZE;
    const angle = index * 2.4;
    const radius = 0.04 + (index % 4) * 0.043;
    drop.from.copy(origin);
    drop.to.copy(target);
    drop.to.x += Math.cos(angle) * radius;
    drop.to.z += Math.sin(angle) * radius;
    drop.to.y += reduced ? 0.08 + (index % 3) * 0.055 : 0.035;
    drop.life = life;
    if (!drop.mesh.visible) activeDrops++;
    drop.age = age;
    drop.arc = reduced ? 0 : THREE.MathUtils.clamp(distance * 0.095, 0.22, 1.25);
    drop.size = reduced ? 0.042 : 0.027 + (index % 3) * 0.005;
    if (reduced) drop.from.copy(drop.to);
    drop.mesh.visible = true;
  }

  function pour(targetVector3) {
    if (!held || ![targetVector3?.x, targetVector3?.y, targetVector3?.z].every(Number.isFinite)) return;
    target.copy(targetVector3);
    spray.worldToLocal(target);
    elapsed = 0;
    emitted = 0;
    pouring = true;
  }

  function update(dt) {
    if (!Number.isFinite(dt) || dt < 0) return;
    if (held) placeMount();
    // Age existing drops first. Newly emitted drops account for their time within this step.
    if (activeDrops) {
      for (const drop of drops) {
        if (!drop.mesh.visible) continue;
        drop.age += dt;
        if (drop.age < drop.life) continue;
        drop.mesh.visible = false;
        activeDrops--;
      }
    }
    if (pouring) {
      elapsed += dt;
      const reduced = Boolean(motionPreference?.matches);
      const tilt = THREE.MathUtils.smoothstep(elapsed, 0, 0.13) * (1 - THREE.MathUtils.smoothstep(elapsed, 0.36, POUR_TIME));
      can.rotation.z = REST_ANGLE + (reduced ? 0 : POUR_ANGLE * tilt);
      if (reduced && emitted === 0) {
        for (let i = 0; i < 7; i++) spawnDrop(i, elapsed, true);
        emitted = DROP_COUNT;
      } else if (!reduced && emitted < DROP_COUNT && elapsed >= 0.075 + emitted * DROP_INTERVAL) {
        can.localToWorld(origin.copy(nozzle));
        spray.worldToLocal(origin);
        while (emitted < DROP_COUNT && elapsed >= 0.075 + emitted * DROP_INTERVAL) {
          spawnDrop(emitted, elapsed - (0.075 + emitted * DROP_INTERVAL), false);
          emitted++;
        }
      }
      if (elapsed >= POUR_TIME) pouring = false;
    }
    if (!activeDrops) return;
    for (const drop of drops) {
      if (!drop.mesh.visible) continue;
      const t = drop.age / drop.life;
      drop.mesh.position.lerpVectors(drop.from, drop.to, t);
      drop.mesh.position.y += 4 * drop.arc * t * (1 - t);
      const size = drop.arc ? drop.size * (0.32 + 0.68 * Math.sin(Math.PI * t)) : drop.size;
      drop.mesh.scale.set(size, size * 1.22, size);
    }
  }

  return { setHeld, pour, update };
}
