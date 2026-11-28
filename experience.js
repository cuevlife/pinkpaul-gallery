import * as THREE from 'three';
import { buildWorld } from './world.js?v=4';
import { createMovingWater } from './moving-water.js?v=4';
import { createWatering } from './watering.js?v=1';
import { createAtmosphere } from './atmosphere.js?v=2';
import { createTrail, stops } from './trail.js?v=3';

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
const atmosphere = createAtmosphere(scene, camera, reducedMotion);
const movingWater = createMovingWater(scene, reducedMotion);
const trail = createTrail(scene, reducedMotion);
const trailButton = document.querySelector('#trail');
const nearbyButton = document.querySelector('#collect-nearby');
const nightButton = document.querySelector('#night');
const trailView = document.querySelector('#trail-view');
const trailNote = document.querySelector('#trail-note');
const trailStops = document.querySelector('#trail-stops');
const letter = document.querySelector('#birthday-letter');
const chapterButton = document.querySelector('#chapters');
const chapterView = document.querySelector('#chapter-view');
const chapterList = document.querySelector('#chapter-list');
const chapterLabel = document.querySelector('#chapter-label');
const stickerButton = document.querySelector('#stickers');
const stickerView = document.querySelector('#sticker-view');
const stickerMotion = document.querySelector('#sticker-motion');
const stickerStatus = document.querySelector('#sticker-status');
const stickerImages = [...stickerView.querySelectorAll('[data-gif]')];
let animateStickers = !reducedMotion.matches;
const chapters = [
  { name: 'เรือนกุหลาบ', english: 'The Rose Conservatory', start: 4, from: Infinity, photo: 0,
    copy: 'เริ่มที่เรือนกุหลาบ เลือกดอกไม้สักแปลง รดน้ำให้เมล็ดงอก แล้วแวะดูภาพแรก ๆ ที่เก็บไว้ในสวน' },
  { name: 'โรงหนังความทรงจำ', english: 'The Keepsake Cinema', start: -11, from: -10, photo: 7,
    copy: 'เหมือนกลับไปดูหนังเรื่องเดิมที่ยังทำให้ยิ้มได้ ลองเดินผ่านม้วนฟิล์มแล้วเลือกภาพหนึ่งมาเปิดดูอีกครั้ง' },
  { name: 'โมงยามวิสทีเรีย', english: 'The Wisteria Hour', start: -31, from: -28, photo: 14,
    copy: 'พักใต้ซุ้มดอกไม้สีม่วง แล้วลองเปิดไฟกลางคืน มองหาหิ่งห้อยข้างทางและหัวใจที่ซ่อนไว้' },
  { name: 'งานเลี้ยงริมบัว', english: 'The Lotus Gala', start: -53, from: -50, photo: 22,
    copy: 'เดินผ่านบัวไปถึงน้ำพุหัวใจ ที่นี่คือช่วงสุดท้ายของทางเดิน แต่ยังมีจดหมายวันเกิดรออยู่เมื่อเก็บหัวใจครบ' },
];
const chapterSpots = [];
let currentChapter = -1;
const journeyKey = 'pinkpaul-heart-trail-v1';
const found = new Set();
let night = false;
try {
  const saved = JSON.parse(localStorage.getItem(journeyKey));
  if (Array.isArray(saved?.found)) {
    for (const index of saved.found) if (Number.isInteger(index) && index >= 0 && index < stops.length) found.add(index);
  }
  night = saved?.night === true;
} catch { /* Exploration is available even without storage. */ }
const photoFormat = new Intl.DateTimeFormat('th-TH', { dateStyle: 'long', timeZone: 'UTC' });
const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const target = new THREE.Vector3();
const movement = new THREE.Vector2();
const keyboard = new Set();
const walking = new Map();
const defaultHint = 'เปิดสมุดบันทึกสวนเพื่อเลือกจุดแวะชม';
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
function saveJourney() {
  try { localStorage.setItem(journeyKey, JSON.stringify({ found: [...found], night })); }
  catch { /* Keep the current session playable. */ }
}
function showNight() {
  atmosphere.setNight(night);
  nightButton.setAttribute('aria-pressed', String(night));
  nightButton.querySelector('span').textContent = night ? 'กลับเป็นกลางวัน' : 'เปิดไฟกลางคืน';
}
function updateTrail() {
  trail.sync(found);
  const finished = found.size === stops.length;
  trailButton.querySelector('span').textContent = finished ? 'จดหมายวันเกิด' : `หัวใจ ${found.size} / ${stops.length}`;
  trailNote.textContent = finished ? 'เก็บหัวใจครบแล้ว! จดหมายฉบับนี้ฝากไว้ให้ Pinkpaul' : 'เดินตามทางแล้วแตะหัวใจที่ลอยอยู่ใกล้ ๆ ให้ครบ เพื่อเปิดจดหมายวันเกิด';
  trailStops.hidden = finished;
  letter.hidden = !finished;
  trailStops.replaceChildren(...stops.map(({ name }, index) => {
    const item = document.createElement('li');
    item.textContent = found.has(index) ? `${name} — เจอแล้ว` : name;
    item.classList.toggle('found', found.has(index));
    return item;
  }));
}
function collectHeart(hit) {
  if (!hit || hit.distance > 7) return false;
  const index = hit.root.userData.heartIndex;
  hit.root.getWorldPosition(target);
  atmosphere.celebrate(target);
  found.add(index);
  updateTrail();
  saveJourney();
  announce(found.size === stops.length ? 'เจอครบแล้ว! เปิดจดหมายวันเกิดที่มุมขวาบนได้เลย' : `เจอหัวใจแล้ว ${found.size} / ${stops.length}`);
  return true;
}
function updateGarden() {
  setGrowth(growth);
  counter.textContent = `ดอกไม้ ${growth.filter(x => x === 2).length} / ${growth.length}`;
}
function applyLook() { camera.rotation.set(pitch, yaw, 0, 'YXZ'); }
function updateLocation() {
  const index = chapters.findLastIndex(chapter => camera.position.z <= chapter.from);
  if (index === currentChapter) return;
  currentChapter = index;
  chapterLabel.textContent = `${String(index + 1).padStart(2, '0')} / ${chapters[index].name}`;
  chapterSpots.forEach((card, i) => card.setAttribute('aria-current', i === index ? 'location' : 'false'));
}
function enterChapter(index) {
  keyboard.clear();
  walking.clear();
  camera.position.set(0, 1.65, chapters[index].start);
  yaw = 0;
  pitch = -.1;
  applyLook();
  updateLocation();
}
function resetPosition() {
  enterChapter(0);
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
  if (growth[index] === 2) {
    target.y = 1.02;
    atmosphere.celebrate(target);
  }
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
  const heart = pick(trail.targets(), x, y);
  if (collectHeart(heart) || (x === undefined && !held && collectHeart(trail.nearby(camera.position)))) return;
  if (held) {
    const plot = pick(plots, x, y);
    if (plot || x === undefined) { waterPlot(plot); return; }
  }
  const frame = pick(photoTargets, x, y);
  if (frame) openPhoto(frame.root.userData.photoIndex);
  else if (held) announce(wateringHint);
}

nightButton.addEventListener('click', () => {
  night = !night;
  showNight();
  saveJourney();
  announce(night ? 'กลางคืนแล้ว · ลองมองหาหิ่งห้อยข้างทาง' : 'กลับมาชมสวนตอนกลางวันแล้ว');
});
trailButton.addEventListener('click', () => {
  keyboard.clear();
  walking.clear();
  trailView.showModal();
});
nearbyButton.addEventListener('click', () => {
  if (collectHeart(trail.nearby(camera.position))) trailButton.focus();
});
trailView.addEventListener('click', event => { if (event.target === trailView) trailView.close(); });
trailView.addEventListener('close', () => trailButton.focus());

chapters.forEach((chapter, index) => {
  const card = document.createElement('button');
  card.type = 'button';
  card.className = 'chapter-card';
  const preview = document.createElement('img');
  preview.alt = '';
  preview.loading = 'lazy';
  preview.src = photos[Math.min(chapter.photo, photos.length - 1)].path;
  const number = document.createElement('span');
  number.className = 'chapter-number';
  number.textContent = `${String(index + 1).padStart(2, '0')} · ${chapter.english}`;
  const name = document.createElement('strong');
  name.className = 'chapter-name';
  name.textContent = chapter.name;
  const copy = document.createElement('span');
  copy.className = 'chapter-copy';
  copy.textContent = chapter.copy;
  card.append(preview, number, name, copy);
  card.addEventListener('click', () => {
    enterChapter(index);
    explored();
    chapterView.close();
    announce(`มาถึง${chapter.name}แล้ว`);
  });
  chapterSpots.push(card);
  chapterList.append(card);
});
chapterButton.addEventListener('click', () => {
  keyboard.clear();
  walking.clear();
  chapterView.showModal();
});
chapterView.addEventListener('click', event => { if (event.target === chapterView) chapterView.close(); });
chapterView.addEventListener('close', () => chapterButton.focus());

function syncStickers() {
  const play = stickerView.open && animateStickers;
  stickerMotion.textContent = animateStickers ? 'พัก GIF' : 'เล่น GIF';
  stickerStatus.textContent = play ? '' : 'พักภาพเคลื่อนไหวอยู่';
  for (const image of stickerImages) {
    if (play) {
      image.hidden = false;
      if (!image.hasAttribute('src')) image.src = image.dataset.gif;
    } else {
      image.hidden = true;
      image.removeAttribute('src');
    }
  }
}
for (const image of stickerImages) {
  image.addEventListener('error', () => {
    if (!image.hasAttribute('src')) return;
    image.hidden = true;
    stickerStatus.textContent = 'โหลด GIF ไม่สำเร็จ ลองเปิดจากลิงก์ต้นฉบับ';
  });
}
stickerButton.addEventListener('click', () => {
  keyboard.clear();
  walking.clear();
  stickerView.showModal();
  syncStickers();
});
stickerView.addEventListener('close', () => {
  syncStickers();
  stickerButton.focus();
});
stickerView.addEventListener('click', event => { if (event.target === stickerView) stickerView.close(); });
stickerMotion.addEventListener('click', () => { animateStickers = !animateStickers; syncStickers(); });
reducedMotion.addEventListener('change', () => { animateStickers = !reducedMotion.matches; syncStickers(); });

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

stage.addEventListener('contextmenu', event => event.preventDefault());
stage.addEventListener('pointerdown', event => {
  if (pointer || (event.button !== 0 && event.button !== 2)) return;
  event.preventDefault();
  stage.setPointerCapture(event.pointerId);
  pointer = { id: event.pointerId, button: event.button, x: event.clientX, y: event.clientY, originX: event.clientX, originY: event.clientY, dragged: false };
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
  const activate = !pointer.dragged && pointer.button === 0 && event.button === 0;
  pointer = null;
  if (activate) interact(event.clientX, event.clientY);
});
for (const type of ['pointercancel', 'lostpointercapture']) {
  stage.addEventListener(type, event => { if (pointer?.id === event.pointerId) pointer = null; });
}

const keys = new Map([['w', 'forward'], ['arrowup', 'forward'], ['s', 'back'], ['arrowdown', 'back'], ['a', 'left'], ['arrowleft', 'left'], ['d', 'right'], ['arrowright', 'right']]);
const lookKeys = new Map([['i', [0, .09]], ['j', [.09, 0]], ['k', [0, -.09]], ['l', [-.09, 0]]]);
function controlKey(event) {
  // Physical key positions keep WASD usable on Thai and other keyboard layouts.
  return /^Key[A-Z]$/.test(event.code) ? event.code.slice(3).toLowerCase() : event.key.toLowerCase();
}
window.addEventListener('keydown', event => {
  const key = controlKey(event);
  if (event.altKey || event.ctrlKey || event.metaKey || event.isComposing || trailView.open || chapterView.open || stickerView.open) return;
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
  else if (!event.repeat && key === 'e') interact();
});
window.addEventListener('keyup', event => keyboard.delete(controlKey(event)));
function releaseControls() { keyboard.clear(); walking.clear(); pointer = null; }
window.addEventListener('blur', releaseControls);
document.addEventListener('visibilitychange', () => { if (document.hidden) releaseControls(); });
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
  updateLocation();
}

resetPosition();
updateGarden();
updateTrail();
showNight();
resize();
window.addEventListener('resize', resize);
let previousTime = 0;
renderer.setAnimationLoop(time => {
  const delta = Math.min((time - previousTime) / 1000, .05);
  previousTime = time;
  const modalOpen = dialog.open || trailView.open || chapterView.open || stickerView.open;
  if (!modalOpen) {
    const directions = new Set(walking.values());
    for (const key of keyboard) directions.add(keys.get(key));
    movement.set(Number(directions.has('right')) - Number(directions.has('left')), Number(directions.has('forward')) - Number(directions.has('back')));
    translate(delta * 4.1);
  }
  watering.update(delta);
  atmosphere.update(delta);
  movingWater.update(delta);
  trail.update(delta, yaw);
  const hideNearby = modalOpen || !trail.nearby(camera.position);
  if (nearbyButton.hidden !== hideNearby) nearbyButton.hidden = hideNearby;
  renderer.render(scene, camera);
});
homeButton.disabled = false;
albumButton.disabled = false;
nightButton.disabled = false;
trailButton.disabled = false;
chapterButton.disabled = false;
stickerButton.disabled = false;
document.querySelector('#loading').hidden = true;
document.querySelector('#controls').hidden = false;
