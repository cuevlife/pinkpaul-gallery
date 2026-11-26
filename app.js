'use strict';

const gallery = document.querySelector('#gallery');
const status = document.querySelector('#gallery-status');
const lightbox = document.querySelector('#lightbox');
const lightboxImage = document.querySelector('#lightbox-image');
const caption = document.querySelector('#lightbox-caption');
const closeButton = document.querySelector('#close-lightbox');
let lastTrigger = null;

function imageLabel(path, index) {
  const filename = path.split('/').pop().replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim();
  return filename ? `ความทรงจำ ${index + 1}: ${filename}` : `ความทรงจำ ${index + 1}`;
}

function safeImagePath(path) {
  if (typeof path !== 'string' || !path.trim()) return false;
  try {
    const url = new URL(path, document.baseURI);
    return url.origin === window.location.origin && !url.search && !url.hash &&
      !path.startsWith('//') && !/^[a-z][a-z\d+.-]*:/i.test(path);
  } catch {
    return false;
  }
}

function openImage(path, label, trigger) {
  lastTrigger = trigger;
  lightboxImage.src = path;
  lightboxImage.alt = label;
  caption.textContent = label;
  lightbox.showModal();
  closeButton.focus();
}

closeButton.addEventListener('click', () => lightbox.close());
lightbox.addEventListener('click', (event) => {
  if (event.target === lightbox) lightbox.close();
});
lightbox.addEventListener('close', () => {
  lightboxImage.removeAttribute('src');
  if (lastTrigger && lastTrigger.isConnected) lastTrigger.focus();
});
lightboxImage.addEventListener('error', () => {
  caption.textContent = 'ไม่สามารถเปิดภาพนี้ได้ในขณะนี้';
});

async function loadGallery() {
  try {
    const response = await fetch('images.json');
    if (!response.ok) throw new Error('Manifest unavailable');
    const paths = await response.json();
    if (!Array.isArray(paths)) throw new Error('Manifest must be an array');
    const validPaths = paths.filter(safeImagePath);
    if (!validPaths.length) {
      status.textContent = 'ยังไม่มีภาพในอัลบั้ม แล้วกลับมาเก็บความทรงจำด้วยกันนะ';
      return;
    }
    status.textContent = '';
    document.querySelectorAll('.film-frame').forEach((frame, index) => {
      frame.style.backgroundImage = `linear-gradient(to top, rgba(30, 20, 16, .55), transparent 50%), url(${JSON.stringify(validPaths[index % validPaths.length])})`;
    });
    let failed = 0;
    validPaths.forEach((path, index) => {
      const label = imageLabel(path, index);
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'gallery-card';
      button.setAttribute('aria-label', `ดูภาพใหญ่ ${label}`);
      const frame = document.createElement('span');
      frame.className = 'gallery-image';
      const image = document.createElement('img');
      image.loading = 'lazy';
      image.alt = '';
      image.addEventListener('error', () => {
        button.remove();
        failed += 1;
        status.textContent = failed === validPaths.length
          ? 'ไม่สามารถโหลดภาพในอัลบั้มได้ กรุณาตรวจสอบไฟล์ภาพ'
          : `ไม่สามารถโหลดภาพได้ ${failed} ภาพ`;
      }, { once: true });
      image.src = path;
      frame.append(image);
      const description = document.createElement('span');
      const title = document.createElement('span');
      title.textContent = `Moment ${String(index + 1).padStart(2, '0')}`;
      const number = document.createElement('small');
      number.textContent = 'VIEW PHOTO';
      description.append(title, number);
      button.append(frame, description);
      button.addEventListener('click', () => openImage(path, label, button));
      gallery.append(button);
    });
  } catch {
    status.textContent = 'ยังเปิดอัลบั้มไม่ได้ กรุณาตรวจสอบ images.json และเปิดเว็บไซต์ผ่าน local server';
  }
}

loadGallery();
