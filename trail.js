import * as THREE from 'three';

import { MUSEUM } from './museum-layout.js?v=1';

const names = ['โถงกลาง', 'ปีกจัดแสดงฝั่งตะวันตก', 'ปีกจัดแสดงฝั่งตะวันออก', 'ทางเข้าลานบัว', 'ริมทางก่อนถึงน้ำพุหัวใจ'];
export const stops = MUSEUM.trail.map((position, i) => ({ ...position, name: names[i] }));

export function createTrail(scene, reducedMotion) {
  const heart = new THREE.Shape();
  heart.moveTo(0, -.55);
  heart.bezierCurveTo(-.84, .04, -.52, .68, 0, .36);
  heart.bezierCurveTo(.52, .68, .84, .04, 0, -.55);
  const jewelGeometry = new THREE.ExtrudeGeometry(heart, {
    depth: .12, bevelEnabled: true, bevelThickness: .05, bevelSize: .05, bevelSegments: 2, curveSegments: 12,
  }).translate(0, 0, -.06);
  const jewelMaterial = new THREE.MeshStandardMaterial({ color: 0xff5799, emissive: 0xad234c, emissiveIntensity: .65, roughness: .35 });
  const ringGeometry = new THREE.TorusGeometry(.29, .018, 6, 30);
  const ringMaterial = new THREE.MeshBasicMaterial({ color: 0xffdd9b, fog: false });
  const starGeometry = new THREE.OctahedronGeometry(.042);
  const baseGeometry = new THREE.RingGeometry(.27, .285, 28).rotateX(-Math.PI / 2);
  const baseMaterial = new THREE.MeshBasicMaterial({ color: 0xf9a5bd, side: THREE.DoubleSide });
  const tokens = stops.map(({ x, z }, index) => {
    const marker = new THREE.Group();
    marker.position.set(x, 0, z);
    const base = new THREE.Mesh(baseGeometry, baseMaterial);
    base.position.y = .042;
    marker.add(base);
    const floating = new THREE.Group();
    floating.position.y = 1.31;
    const jewel = new THREE.Mesh(jewelGeometry, jewelMaterial);
    jewel.scale.setScalar(.32);
    jewel.userData.heartIndex = index;
    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    ring.rotation.x = 1.07;
    floating.add(jewel, ring);
    const sparkles = Array.from({ length: 3 }, (_, n) => {
      const sparkle = new THREE.Mesh(starGeometry, ringMaterial);
      sparkle.position.set(n === 1 ? -.21 : .22, n === 2 ? -.17 : .21, 0);
      floating.add(sparkle);
      return sparkle;
    });
    marker.add(floating);
    scene.add(marker);
    return { marker, floating, jewel, sparkles };
  });
  let time = 0;

  function update(dt, yaw) {
    if (!reducedMotion.matches) time += dt;
    tokens.forEach(({ marker, floating, jewel, sparkles }, index) => {
      if (!marker.visible) return;
      marker.rotation.y = yaw;
      floating.position.y = 1.31 + (reducedMotion.matches ? 0 : Math.sin(time * 2.2 + index) * .11);
      jewel.rotation.y = reducedMotion.matches ? 0 : Math.sin(time * 1.7 + index) * .57;
      sparkles.forEach((sparkle, j) => sparkle.scale.setScalar(reducedMotion.matches ? 1 : .85 + .35 * Math.sin(time * 3 + j)));
    });
  }

  function sync(found) {
    tokens.forEach(({ marker }, index) => { marker.visible = !found.has(index); });
  }

  function targets() {
    return tokens.filter(({ marker }) => marker.visible).map(({ jewel }) => jewel);
  }

  function nearby(position) {
    for (const { marker, jewel } of tokens) {
      if (!marker.visible) continue;
      const distance = Math.hypot(marker.position.x - position.x, marker.position.z - position.z);
      if (distance <= 2.75) return { root: jewel, distance };
    }
    return null;
  }

  return { update, sync, targets, nearby };
}
