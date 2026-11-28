'use strict';

const PAGE_SIZE = 28;
const grid = document.querySelector('#gallery-grid');
const status = document.querySelector('#status');
const archiveHeading = document.querySelector('#archive-heading');
const albumFilter = document.querySelector('#album-filter');
const pageSelect = document.querySelector('#page-select');
const pagePrevious = document.querySelector('#page-previous');
const pageNext = document.querySelector('#page-next');
const lightbox = document.querySelector('#lightbox');
const lightboxImage = document.querySelector('#lightbox-image');
const lightboxCaption = document.querySelector('#lightbox-caption');
const closeButton = document.querySelector('#close-lightbox');
const previous = document.querySelector('#previous');
const next = document.querySelector('#next');
const dates = new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const numbers = new Intl.NumberFormat('th-TH');
let photos = [];
let albums = [];
let filtered = [];
let page = 0;
let pageCount = 0;
let current = 0;

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
  return photo.timestamp === null ? 'ไม่ทราบวันที่' : dates.format(photo.timestamp);
}
function sourceLabel(photo) {
  if (/filename/i.test(photo.dateSource)) return 'วันที่อ้างอิงจากชื่อไฟล์';
  if (/exif/i.test(photo.dateSource)) return 'วันที่จากข้อมูลภาพ (EXIF)';
  return '';
}
function renderPage() {
  const start = page * PAGE_SIZE;
  const end = Math.min(start + PAGE_SIZE, filtered.length);
  document.querySelector('#photo-range').textContent = filtered.length
    ? `ภาพ ${numbers.format(start + 1)}–${numbers.format(end)} จาก ${numbers.format(filtered.length)} ภาพ`
    : 'ไม่มีภาพในอัลบั้มนี้';
  document.querySelector('#page-number').textContent = `หน้า ${page + 1} / ${pageCount}`;
  pageSelect.value = String(page);
  pagePrevious.disabled = page === 0;
  pageNext.disabled = page + 1 >= pageCount;

  const cards = document.createDocumentFragment();
  filtered.slice(start, end).forEach((photo, offset) => {
    const index = start + offset;
    const dateText = dateLabel(photo);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'photo-card';
    button.setAttribute('aria-label', `ดูภาพที่ ${index + 1}, ${dateText}${photo.album ? `, ${photo.album}` : ''}`);
    const image = document.createElement('img');
    image.alt = '';
    image.loading = 'lazy';
    image.decoding = 'async';
    image.addEventListener('error', () => {
      image.hidden = true;
      placeholder.hidden = false;
    }, { once: true });
    const placeholder = document.createElement('span');
    placeholder.className = 'photo-placeholder';
    placeholder.hidden = true;
    placeholder.textContent = 'แสดงตัวอย่างไม่ได้';
    image.src = photo.thumb;
    const number = document.createElement('span');
    number.className = 'photo-index';
    number.textContent = `MOMENT ${String(index + 1).padStart(2, '0')}`;
    const date = document.createElement('strong');
    date.textContent = dateText;
    button.append(image, placeholder, number, date);
    if (photo.album) {
      const album = document.createElement('span');
      album.className = 'photo-album';
      album.textContent = photo.album;
      button.append(album);
    }
    button.addEventListener('click', () => {
      current = index;
      showImage();
      lightbox.showModal();
      closeButton.focus();
    });
    cards.append(button);
  });
  grid.replaceChildren(cards);
}
function filterAlbum() {
  filtered = albumFilter.value === '' ? photos : photos.filter(photo => photo.album === albums[Number(albumFilter.value)]);
  page = 0;
  pageCount = Math.ceil(filtered.length / PAGE_SIZE);
  pageSelect.replaceChildren(...Array.from({ length: pageCount }, (_, index) => new Option(String(index + 1), String(index))));
  document.querySelector('#page-field').hidden = pageCount <= 1;
  document.querySelector('#archive-pagination').hidden = pageCount <= 1;
  renderPage();
}
function changePage(target) {
  if (target === page || target < 0 || target >= pageCount) return;
  page = target;
  renderPage();
}
albumFilter.addEventListener('change', filterAlbum);
pageSelect.addEventListener('change', () => changePage(Number(pageSelect.value)));
for (const [button, step] of [[pagePrevious, -1], [pageNext, 1]]) {
  button.addEventListener('click', () => {
    changePage(page + step);
    archiveHeading.focus({ preventScroll: true });
    archiveHeading.scrollIntoView({ block: 'start' });
  });
}

function showImage() {
  const photo = filtered[current];
  const label = `ภาพที่ ${current + 1} จาก ${filtered.length} — ${dateLabel(photo)}`;
  lightboxImage.alt = label;
  lightboxImage.src = photo.path;
  document.querySelector('#lightbox-title').textContent = label;
  lightboxCaption.textContent = [photo.album, sourceLabel(photo)].filter(Boolean).join(' · ');
  const focused = document.activeElement;
  previous.disabled = current === 0;
  next.disabled = current === filtered.length - 1;
  if (focused === previous && previous.disabled) next.focus();
  if (focused === next && next.disabled) previous.focus();
}
function move(step) {
  const target = current + step;
  if (target < 0 || target >= filtered.length) return;
  current = target;
  showImage();
}
previous.addEventListener('click', () => move(-1));
next.addEventListener('click', () => move(1));
closeButton.addEventListener('click', () => lightbox.close());
lightbox.addEventListener('click', event => { if (event.target === lightbox) lightbox.close(); });
lightbox.addEventListener('close', () => {
  lightboxImage.removeAttribute('src');
  changePage(Math.floor(current / PAGE_SIZE));
  grid.children[current % PAGE_SIZE]?.focus();
});
lightboxImage.addEventListener('error', () => { lightboxCaption.textContent = 'ไม่สามารถเปิดภาพนี้ได้ในขณะนี้'; });
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
      const response = await fetch('photo-metadata.json?v=archive-2');
      if (!response.ok) throw new Error('Metadata unavailable');
      entries = await response.json();
      if (!Array.isArray(entries)) throw new Error('Invalid metadata');
    } catch {
      const response = await fetch('images.json');
      if (!response.ok) throw new Error('Manifest unavailable');
      const paths = await response.json();
      if (!Array.isArray(paths)) throw new Error('Invalid manifest');
      entries = paths.map(path => ({ path }));
    }
    photos = entries.filter(item => item && safeImagePath(item.path)).map(item => ({
      path: item.path,
      thumb: safeImagePath(item.thumb) ? item.thumb : item.path,
      timestamp: dateValue(item.date),
      dateSource: typeof item.dateSource === 'string' ? item.dateSource : '',
      album: (typeof item.album === 'string' && item.album.trim()) || null
    })).sort((a, b) => (a.timestamp ?? Infinity) - (b.timestamp ?? Infinity) || 0);
    document.querySelector('#photo-count').textContent = `${numbers.format(photos.length)} ความทรงจำ`;
    if (!photos.length) {
      status.textContent = 'ยังไม่มีภาพในอัลบั้ม แล้วกลับมาเก็บความทรงจำด้วยกันนะ';
      return;
    }
    albums = [...new Set(photos.map(photo => photo.album).filter(Boolean))].sort(new Intl.Collator('th').compare);
    if (albums.length) {
      if (photos.some(photo => photo.album === null)) albums.push(null);
      albums.forEach((album, index) => albumFilter.add(new Option(album ?? 'ไม่ระบุอัลบั้ม', String(index))));
      document.querySelector('#album-field').hidden = false;
    }
    document.querySelector('#archive-toolbar').hidden = false;
    status.textContent = '';
    filterAlbum();
  } catch {
    document.querySelector('#photo-count').textContent = 'เปิดอัลบั้มไม่ได้';
    status.textContent = 'ยังเปิดอัลบั้มไม่ได้ ลองรีเฟรชหน้าอีกครั้งนะ';
  }
}
loadGallery();
