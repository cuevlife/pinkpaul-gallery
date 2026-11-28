import * as THREE from 'three';
import { buildWorld } from './world.js?v=1';
import { createWatering } from './watering.js?v=1';

const stage = document.querySelector('#stage');
const renderer = new THREE.WebGLRenderer({ canvas: stage, antialias: !matchMedia('(pointer: coarse)').matches });
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(59, 1, .05, 110);
scene.add(camera);
renderer.setPixelRatio(Math.min(devicePixelRatio, matchMedia('(pointer: coarse)').matches ? 1.35 : 1.6));

const photos = await fetch('photo-metadata.json').then(response => {
  if (!response.ok) throw new Error('Photo list unavailable');
  return response.json();
});
if (!Array.isArray(photos) || !photos.length) throw new Error('Photo list empty');
photos.sort((a, b) => (a.date || '\uffff').localeCompare(b.date || '\uffff'));

const { photoTargets, plots, setGrowth } = buildWorld(scene, photos);
const watering = createWatering(scene, camera);
const storageKey = 'pinkpaul-little-garden-v1';
let growth = Array(plots.length).fill(0);
try {
  const previous = JSON.parse(localStorage.getItem(storageKey));
  if (Array.isArray(previous) && previous.length === growth.length && previous.every(x => Number.isInteger(x) && x >= 0 && x <= 2)) growth = previous;
} catch { /* The garden remains usable without storage. */ }

const experience = document.querySelector('#experience');
const status = document.querySelector('#status');
const counter = document.querySelector('#bloom-count');
const waterButton = document.querySelector('#water');
const pourButton = document.querySelector('#pour');
const homeButton = document.querySelector('#home');
const albumButton = document.querySelector('#album');
const dialog = document.querySelector('#photo-view');
const closePhoto = document.querySelector('#close-photo');
const photoElement = document.querySelector('#photo');
const previousPhoto = document.querySelector('#prev-photo');
const nextPhoto = document.querySelector('#next-photo');
const photoDate = document.querySelector('#photo-date');
const photoNumber = document.querySelector('#photo-number');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const photoFormat = new Intl.DateTimeFormat('th-TH', { dateStyle: 'long', timeZone: 'UTC' });
const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const target = new THREE.Vector3();
const movement = new THREE.Vector2();
const keyboard = new Set();
const walking = new Map();
const defaultHint = matchMedia('(pointer: coarse)').matches
  ? 'กดลูกศรเพื่อเดิน · ลากฉากเพื่อมอง'
  : 'WASD / ลูกศร เพื่อเดิน · ลากฉากเพื่อมอง';
const wateringHint = 'ถือบัวแล้ว · แตะที่แปลง หรือเล็งแล้วกดรดน้ำ';
let yaw = 0;
let pitch = -.1;
let held = false;
let pointer;
let activePhoto = 0;
let photoTrigger;
let lastPour = -Infinity;
let hasExplored = false;
const intro = document.querySelector('#intro');

function announce(message) { status.textContent = message; }
function updateGarden() {
  setGrowth(growth);
  counter.textContent = `ดอกไม้ ${growth.filter(x => x === 2).length} / ${growth.length}`;
}
function applyLook() { camera.rotation.set(pitch, yaw, 0, 'YXZ'); }
function resetPosition() {
  camera.position.set(0, 1.65, 4);
  yaw = 0;
  pitch = -.1;
  applyLook();
  announce(held ? wateringHint : defaultHint);
}
function explored() {
  if (hasExplored) return;
  hasExplored = true;
  intro.hidden = true;
}
function resize() {
  const { clientWidth, clientHeight } = stage;
  if (!clientWidth || !clientHeight) return;
  camera.aspect = clientWidth / clientHeight;
  camera.fov = camera.aspect >= 1 ? 58 : 70;
  camera.updateProjectionMatrix();
  renderer.setSize(clientWidth, clientHeight, false);
}
function pick(roots, clickX, clickY) {
  ndc.set(0, 0);
  if (clickX !== undefined) {
    const bounds = stage.getBoundingClientRect();
    ndc.set((clickX - bounds.left) / bounds.width * 2 - 1, 1 - (clickY - bounds.top) / bounds.height * 2);
  }
  camera.updateMatrixWorld();
  ray.setFromCamera(ndc, camera);
  const hit = ray.intersectObjects(roots, true)[0];
  if (!hit) return null;
  let root = hit.object;
  while (root && !roots.includes(root)) root = root.parent;
  return root ? { root, distance: hit.distance } : null;
}
function waterPlot(hit) {
  if (!hit || hit.distance > 8) {
    announce(hit ? 'เดินเข้าใกล้แปลงอีกนิดก่อนรดน้ำนะ' : 'เล็งไปที่ดินหรือแตะแปลงที่อยากรดน้ำ');
    return;
  }
  const index = hit.root.userData.plotIndex;
  if (growth[index] === 2) {
    announce(`แปลง ${index + 1} บานแล้ว ลองรดน้ำแปลงอื่นนะ`);
    return;
  }
  if (performance.now() - lastPour < (reducedMotion.matches ? 120 : 470)) return;
  lastPour = performance.now();
  hit.root.getWorldPosition(target);
  target.y = .24;
  watering.pour(target);
  growth[index]++;
  let saved = true;
  try { localStorage.setItem(storageKey, JSON.stringify(growth)); }
  catch { saved = false; }
  updateGarden();
  const message = growth[index] === 2 ? `แปลง ${index + 1} ออกดอกแล้ว!` : `แปลง ${index + 1} งอกแล้ว รดอีกครั้งให้ดอกบาน`;
  announce(saved ? message : `${message} · เบราว์เซอร์ไม่อนุญาตให้บันทึก`);
}
function toggleWater() {
  held = !held;
  watering.setHeld(held);
  waterButton.setAttribute('aria-pressed', String(held));
  waterButton.querySelector('span').textContent = held ? 'เก็บบัว' : 'ถือบัวรดน้ำ';
  experience.toggleAttribute('data-held', held);
  pourButton.hidden = !held;
  announce(held ? wateringHint : defaultHint);
}
function showPhoto(index) {
  activePhoto = index;
  const photo = photos[index];
  const stamp = photo.date ? Date.parse(`${photo.date.slice(0, 10)}T00:00:00Z`) : NaN;
  photoDate.textContent = Number.isFinite(stamp) ? photoFormat.format(new Date(stamp)) : 'ไม่ทราบวันที่';
  photoNumber.textContent = `MOMENT ${String(index + 1).padStart(2, '0')} / ${photos.length}`;
  photoElement.alt = `ภาพความทรงจำ ${index + 1}`;
  photoElement.src = photo.path;
  previousPhoto.disabled = index === 0;
  nextPhoto.disabled = index === photos.length - 1;
}
function openPhoto(index, trigger = albumButton) {
  keyboard.clear();
  walking.clear();
  photoTrigger = trigger;
  showPhoto(index);
  dialog.showModal();
  closePhoto.focus();
}
function interact(x, y) {
  if (held) {
    const plot = pick(plots, x, y);
    if (plot) { waterPlot(plot); return; }
  }
  const frame = pick(photoTargets, x, y);
  if (frame) openPhoto(frame.root.userData.photoIndex);
  else if (held) announce(wateringHint);
}

homeButton.addEventListener('click', resetPosition);
albumButton.addEventListener('click', () => openPhoto(activePhoto));
waterButton.addEventListener('click', toggleWater);
pourButton.addEventListener('click', () => waterPlot(pick(plots)));
closePhoto.addEventListener('click', () => dialog.close());
previousPhoto.addEventListener('click', () => showPhoto(activePhoto - 1));
nextPhoto.addEventListener('click', () => showPhoto(activePhoto + 1));
dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
dialog.addEventListener('close', () => {
  photoElement.removeAttribute('src');
  photoTrigger?.focus();
});

stage.addEventListener('pointerdown', event => {
  if (pointer || event.button !== 0) return;
  stage.setPointerCapture(event.pointerId);
  pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, originX: event.clientX, originY: event.clientY, dragged: false };
});
stage.addEventListener('pointermove', event => {
  if (!pointer || pointer.id !== event.pointerId) return;
  const x = event.clientX, y = event.clientY;
  if (!pointer.dragged && Math.hypot(x - pointer.originX, y - pointer.originY) >= 5) {
    pointer.dragged = true;
    explored();
  }
  if (!pointer.dragged) return;
  yaw -= (x - pointer.x) * .005;
  pitch = THREE.MathUtils.clamp(pitch - (y - pointer.y) * .005, -1.18, .92);
  pointer.x = x;
  pointer.y = y;
  applyLook();
});
stage.addEventListener('pointerup', event => {
  if (!pointer || pointer.id !== event.pointerId) return;
  if (!pointer.dragged) interact(event.clientX, event.clientY);
  pointer = null;
});
stage.addEventListener('lostpointercapture', () => { pointer = null; });

const keys = new Map([['w', 'forward'], ['arrowup', 'forward'], ['s', 'back'], ['arrowdown', 'back'], ['a', 'left'], ['arrowleft', 'left'], ['d', 'right'], ['arrowright', 'right']]);
const lookKeys = new Map([['i', [0, .09]], ['j', [.09, 0]], ['k', [0, -.09]], ['l', [-.09, 0]]]);
window.addEventListener('keydown', event => {
  const key = event.key.toLowerCase();
  if (event.altKey || event.ctrlKey || event.metaKey) return;
  if (dialog.open) {
    if (key === 'arrowleft' && activePhoto > 0) showPhoto(activePhoto - 1);
    if (key === 'arrowright' && activePhoto < photos.length - 1) showPhoto(activePhoto + 1);
    return;
  }
  if (keys.has(key)) {
    event.preventDefault();
    keyboard.add(key);
  } else if (lookKeys.has(key)) {
    const [turn, tilt] = lookKeys.get(key);
    yaw += turn;
    pitch = THREE.MathUtils.clamp(pitch + tilt, -1.18, .92);
    explored();
    applyLook();
  } else if (!event.repeat && key === 'f') toggleWater();
  else if (!event.repeat && key === 'e') {
    if (held) waterPlot(pick(plots));
    else interact();
  }
});
window.addEventListener('keyup', event => keyboard.delete(event.key.toLowerCase()));
window.addEventListener('blur', () => { keyboard.clear(); walking.clear(); pointer = null; });
for (const button of document.querySelectorAll('[data-walk]')) {
  button.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    button.setPointerCapture(event.pointerId);
    walking.set(event.pointerId, button.dataset.walk);
    step(button.dataset.walk, .12);
  });
  button.addEventListener('lostpointercapture', event => walking.delete(event.pointerId));
  button.addEventListener('click', event => { if (event.detail === 0) step(button.dataset.walk, .55); });
}
function step(direction, amount) {
  movement.set(Number(direction === 'right') - Number(direction === 'left'), Number(direction === 'forward') - Number(direction === 'back'));
  translate(amount);
}
function translate(amount) {
  if (!movement.lengthSq()) return;
  explored();
  movement.normalize().multiplyScalar(amount);
  const sin = Math.sin(yaw), cos = Math.cos(yaw);
  camera.position.x = THREE.MathUtils.clamp(camera.position.x + cos * movement.x - sin * movement.y, -5.4, 5.4);
  camera.position.z = THREE.MathUtils.clamp(camera.position.z - sin * movement.x - cos * movement.y, -65, 6);
}

resetPosition();
updateGarden();
resize();
window.addEventListener('resize', resize);
let previousTime = 0;
renderer.setAnimationLoop(time => {
  const delta = Math.min((time - previousTime) / 1000, .05);
  previousTime = time;
  if (!dialog.open) {
    const directions = new Set(walking.values());
    for (const key of keyboard) directions.add(keys.get(key));
    movement.set(Number(directions.has('right')) - Number(directions.has('left')), Number(directions.has('forward')) - Number(directions.has('back')));
    translate(delta * 4.1);
  }
  watering.update(delta);
  renderer.render(scene, camera);
});
homeButton.disabled = false;
albumButton.disabled = false;
document.querySelector('#loading').hidden = true;
document.querySelector('#controls').hidden = false;
