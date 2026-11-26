'use strict';

const grid = document.querySelector('#gallery-grid');
const status = document.querySelector('#status');
const lightbox = document.querySelector('#lightbox');
const lightboxImage = document.querySelector('#lightbox-image');
const closeButton = document.querySelector('#close-lightbox');
const previous = document.querySelector('#previous');
const next = document.querySelector('#next');
let photos = [];
let current = 0;
let lastTrigger = null;

function safeImagePath(path) {
  if (typeof path !== 'string' || !path.trim()) return false;
  try {
    const url = new URL(path, document.baseURI);
    return url.origin === location.origin && !url.search && !url.hash &&
      !path.startsWith('//') && !/^[a-z][a-z\d+.-]*:/i.test(path);
  } catch { return false; }
}
function dateValue(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(value)) return null;
  const parsed = Date.parse(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(value) ? `${value}Z` : value);
  return Number.isFinite(parsed) ? parsed : null;
}
function dateLabel(photo) {
  if (photo.timestamp === null) return 'ไม่ทราบวันที่';
  return new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(photo.timestamp));
}
function sourceLabel(photo) {
  if (!photo.dateSource) return '';
  return photo.dateSource.startsWith('source filename') ? 'วันที่อ้างอิงจากชื่อไฟล์' : 'วันที่จากข้อมูลภาพ (EXIF)';
}
function render() {
  grid.replaceChildren();
  document.querySelector('#photo-count').textContent = `${photos.length} ความทรงจำ`;
  photos.forEach((photo, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'photo-card';
    button.setAttribute('aria-label', `ดูภาพความทรงจำที่ ${index + 1}, ${dateLabel(photo)}`);
    const image = document.createElement('img');
    image.src = photo.path;
    image.alt = '';
    image.loading = 'lazy';
    image.decoding = 'async';
    image.addEventListener('error', () => { image.alt = 'ไม่สามารถโหลดภาพได้'; }, { once: true });
    const number = document.createElement('span');
    number.textContent = `MOMENT ${String(index + 1).padStart(2, '0')}`;
    const date = document.createElement('strong');
    date.textContent = dateLabel(photo);
    button.append(image, number, date);
    button.addEventListener('click', () => { current = index; lastTrigger = button; showImage(); lightbox.showModal(); closeButton.focus(); });
    grid.append(button);
  });
}
function showImage() {
  const photo = photos[current];
  const label = `ความทรงจำที่ ${current + 1} — ${dateLabel(photo)}`;
  lightboxImage.src = photo.path;
  lightboxImage.alt = label;
  document.querySelector('#lightbox-title').textContent = label;
  document.querySelector('#lightbox-caption').textContent = sourceLabel(photo);
  previous.disabled = current === 0;
  next.disabled = current === photos.length - 1;
}
function move(step) {
  const target = Math.max(0, Math.min(photos.length - 1, current + step));
  if (target !== current) { current = target; showImage(); }
}
previous.addEventListener('click', () => move(-1));
next.addEventListener('click', () => move(1));
closeButton.addEventListener('click', () => lightbox.close());
lightbox.addEventListener('click', event => { if (event.target === lightbox) lightbox.close(); });
lightbox.addEventListener('close', () => {
  lightboxImage.removeAttribute('src');
  if (lastTrigger && lastTrigger.isConnected) lastTrigger.focus();
});
lightboxImage.addEventListener('error', () => { document.querySelector('#lightbox-caption').textContent = 'ไม่สามารถเปิดภาพนี้ได้ในขณะนี้'; });
lightbox.addEventListener('keydown', event => {
  if (event.altKey || event.ctrlKey || event.metaKey) return;
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    event.preventDefault();
    move(event.key === 'ArrowLeft' ? -1 : 1);
  }
});
const galleryTab = document.querySelector('#gallery-tab');
const gameTab = document.querySelector('#game-tab');
const gallerySection = document.querySelector('#gallery-section');
const gameSection = document.querySelector('#game-section');
const gardenDecoration = document.querySelector('.garden-decoration');
function updateGardenDecoration(value) {
  const count = Number(value);
  const visible = Number.isFinite(count) ? Math.max(0, Math.min(8, Math.floor(count))) : 0;
  const blooms = [];
  for (let i = 0; i < visible; i++) {
    const bloom = document.createElement('span');
    bloom.className = 'garden-bloom';
    bloom.style.setProperty('--bloom-index', i);
    blooms.push(bloom);
  }
  gardenDecoration.replaceChildren(...blooms);
}
document.addEventListener('garden:change', event => updateGardenDecoration(event.detail?.blooms));
updateGardenDecoration(document.documentElement.dataset.gardenBlooms);
function selectSection(showGame) {
  gallerySection.hidden = showGame;
  gameSection.hidden = !showGame;
  galleryTab.setAttribute('aria-pressed', String(!showGame));
  gameTab.setAttribute('aria-pressed', String(showGame));
}
galleryTab.addEventListener('click', () => selectSection(false));
gameTab.addEventListener('click', () => selectSection(true));
document.querySelector('.brand').addEventListener('click', () => selectSection(false));

async function loadGallery() {
  try {
    let entries;
    try {
      const response = await fetch('photo-metadata.json');
      if (!response.ok) throw new Error('Metadata unavailable');
      entries = await response.json();
      if (!Array.isArray(entries)) throw new Error('Invalid metadata');
    } catch {
      const response = await fetch('images.json');
      if (!response.ok) throw new Error('Manifest unavailable');
      const paths = await response.json();
      if (!Array.isArray(paths)) throw new Error('Invalid manifest');
      entries = paths.map(path => ({ path, date: null, dateSource: '' }));
    }
    photos = entries.filter(item => item && safeImagePath(item.path)).map((item, index) => ({
      path: item.path, timestamp: dateValue(item.date),
      dateSource: typeof item.dateSource === 'string' ? item.dateSource : '', index
    })).sort((a, b) => (a.timestamp === null ? Infinity : a.timestamp) - (b.timestamp === null ? Infinity : b.timestamp) || a.index - b.index);
    if (photos.length) {
      const strips = document.createElement('div');
      strips.className = 'backdrop-strips';
      for (let column = 0; column < 6; column++) {
        const strip = document.createElement('div');
        strip.className = 'backdrop-strip';
        for (let copy = 0; copy < 2; copy++) {
          const group = document.createElement('div');
          group.className = 'backdrop-group';
          for (let index = 0; index < 6; index++) {
            const image = document.createElement('img');
            image.src = photos[(column * 6 + index) % photos.length].path;
            image.alt = '';
            image.decoding = 'async';
            group.append(image);
          }
          strip.append(group);
        }
        strips.append(strip);
      }
      document.querySelector('#backdrop').replaceChildren(strips);
    }
    status.textContent = photos.length ? '' : 'ยังไม่มีภาพในอัลบั้ม แล้วกลับมาเก็บความทรงจำด้วยกันนะ';
    render();
  } catch {
    status.textContent = 'ยังเปิดอัลบั้มไม่ได้ กรุณาตรวจสอบไฟล์ข้อมูลภาพและเปิดเว็บไซต์ผ่าน local server';
    render();
  }
}
loadGallery();
