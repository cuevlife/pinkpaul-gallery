'use strict';

const scene = document.querySelector('#scene');
const viewer = document.querySelector('#viewer');
const status = document.querySelector('#status');
const previous = document.querySelector('#previous');
const next = document.querySelector('#next');
const openButton = document.querySelector('#open');
const lightbox = document.querySelector('#lightbox');
const lightboxImage = document.querySelector('#lightbox-image');
const closeButton = document.querySelector('#close-lightbox');
let photos = [];
let current = 0;
let lastTrigger = null;
let touchStart = null;

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
  scene.replaceChildren();
  const total = photos.length;
  previous.disabled = !total || current === 0;
  next.disabled = !total || current === total - 1;
  openButton.disabled = !total;
  document.querySelector('#photo-count').textContent = `${total} ความทรงจำ`;
  document.querySelector('#current-number').textContent = `${String(total ? current + 1 : 0).padStart(2, '0')} / ${String(total).padStart(2, '0')}`;
  document.querySelector('#current-date').textContent = total ? dateLabel(photos[current]) : 'ไม่มีภาพให้แสดง';
  document.querySelector('#current-source').textContent = total ? sourceLabel(photos[current]) : '';
  document.querySelector('#progress-bar').style.width = `${total ? (current + 1) / total * 100 : 0}%`;
  photos.forEach((photo, index) => {
    const offset = index - current;
    if (Math.abs(offset) > 2) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'memory';
    button.style.setProperty('--offset', offset);
    button.style.setProperty('--depth', Math.abs(offset));
    button.style.setProperty('--direction', Math.sign(offset));
    button.style.setProperty('--z', 5 - Math.abs(offset));
    button.style.setProperty('--opacity', Math.abs(offset) === 2 ? '.45' : '1');
    button.setAttribute('aria-label', `ความทรงจำที่ ${index + 1}, ${dateLabel(photo)}${offset === 0 ? ', ดูภาพเต็ม' : ', เลือกภาพนี้'}`);
    const image = document.createElement('img');
    image.src = photo.path;
    image.alt = '';
    image.addEventListener('error', () => { image.alt = 'ไม่สามารถโหลดภาพได้'; }, { once: true });
    const label = document.createElement('span');
    label.className = 'memory-caption';
    const number = document.createElement('span');
    number.textContent = `MOMENT ${String(index + 1).padStart(2, '0')}`;
    const date = document.createElement('span');
    date.textContent = dateLabel(photo);
    label.append(number, date);
    button.append(image, label);
    button.addEventListener('click', () => {
      if (index === current) openImage(button);
      else { current = index; render(); }
    });
    scene.append(button);
  });
}

function move(step) {
  const target = Math.max(0, Math.min(photos.length - 1, current + step));
  if (target !== current) { current = target; render(); }
}

function openImage(trigger) {
  if (!photos.length) return;
  lastTrigger = trigger;
  const photo = photos[current];
  const label = `ความทรงจำที่ ${current + 1} — ${dateLabel(photo)}`;
  lightboxImage.src = photo.path;
  lightboxImage.alt = label;
  document.querySelector('#lightbox-title').textContent = label;
  document.querySelector('#lightbox-caption').textContent = sourceLabel(photo);
  lightbox.showModal();
  closeButton.focus();
}

previous.addEventListener('click', () => move(-1));
next.addEventListener('click', () => move(1));
openButton.addEventListener('click', () => openImage(openButton));
closeButton.addEventListener('click', () => lightbox.close());
lightbox.addEventListener('click', event => { if (event.target === lightbox) lightbox.close(); });
lightbox.addEventListener('close', () => {
  lightboxImage.removeAttribute('src');
  if (lastTrigger && lastTrigger.isConnected) lastTrigger.focus();
  else openButton.focus();
});
lightboxImage.addEventListener('error', () => { document.querySelector('#lightbox-caption').textContent = 'ไม่สามารถเปิดภาพนี้ได้ในขณะนี้'; });
document.addEventListener('keydown', event => {
  if (lightbox.open || event.altKey || event.ctrlKey || event.metaKey) return;
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    event.preventDefault();
    move(event.key === 'ArrowLeft' ? -1 : 1);
  }
});
viewer.addEventListener('touchstart', event => { touchStart = event.touches.length === 1 ? event.touches[0].clientX : null; }, { passive: true });
viewer.addEventListener('touchend', event => {
  if (touchStart === null || !event.changedTouches.length) return;
  const difference = event.changedTouches[0].clientX - touchStart;
  touchStart = null;
  if (Math.abs(difference) > 45) move(difference < 0 ? 1 : -1);
}, { passive: true });
viewer.addEventListener('touchcancel', () => { touchStart = null; });

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
      path: item.path,
      timestamp: dateValue(item.date),
      dateSource: typeof item.dateSource === 'string' ? item.dateSource : '',
      index
    })).sort((a, b) => (a.timestamp === null ? Infinity : a.timestamp) - (b.timestamp === null ? Infinity : b.timestamp) || a.index - b.index);
    const backdrop = document.querySelector('#backdrop');
    if (photos.length) {
      const strip = document.createElement('div');
      strip.className = 'backdrop-strip';
      const selection = Array.from({ length: 8 }, (_, index) => photos[Math.floor(index * photos.length / 8)]);
      for (let copy = 0; copy < 2; copy++) {
        const group = document.createElement('div');
        group.className = 'backdrop-group';
        selection.forEach(photo => {
          const image = document.createElement('img');
          image.src = photo.path;
          image.alt = '';
          image.decoding = 'async';
          group.append(image);
        });
        strip.append(group);
      }
      backdrop.replaceChildren(strip);
    }
    status.textContent = photos.length ? '' : 'ยังไม่มีภาพในอัลบั้ม แล้วกลับมาเก็บความทรงจำด้วยกันนะ';
    render();
  } catch {
    status.textContent = 'ยังเปิดอัลบั้มไม่ได้ กรุณาตรวจสอบไฟล์ข้อมูลภาพและเปิดเว็บไซต์ผ่าน local server';
    render();
  }
}

render();
loadGallery();
