'use strict';

(() => {
  const root = document.querySelector('#game-section #game-root');
  if (!root) return;

  const storageKey = 'pinkpaul-little-garden-v1';
  const plotCount = 6;
  const stages = ['เมล็ด', 'ต้นอ่อน', 'ดอกไม้บาน'];
  let plots = Array(plotCount).fill(0);
  let storageAvailable = true;

  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    if (Array.isArray(saved) && saved.length === plotCount && saved.every(stage => Number.isInteger(stage) && stage >= 0 && stage <= 2)) plots = saved;
  } catch (_) {
    storageAvailable = false;
  }

  root.innerHTML = `<div class="garden-panel">
    <div class="garden-heading"><div><p class="garden-eyebrow">A LITTLE MOMENT TOGETHER</p><h2>Our Little Garden</h2><p class="garden-intro">สวนเล็ก ๆ ที่ค่อย ๆ เติบโตไปด้วยกัน เลือกแปลงแล้วกดฟักบัวรดน้ำ จากเมล็ดเป็นต้นอ่อนจนดอกไม้บาน</p></div><div class="garden-badge" aria-hidden="true">GROW<br>WITH LOVE</div></div>
    <div class="garden-summary"><span class="garden-count"></span><span>เลือกแปลงที่อยากดูแล</span></div>
    <div class="garden-plots" role="group" aria-label="เลือกแปลงดอกไม้"></div>
    <div class="garden-footer"><div><p class="garden-selected"></p><p class="garden-status" role="status" aria-live="polite"></p><p class="garden-storage"></p></div><button class="garden-water" type="button"><svg viewBox="0 0 48 48" aria-hidden="true"><path d="M13 20h23l-3 17H16zM14 22l-5-5-4 2 8 10M34 21c7-8 11 1 4 6M19 20v-4h12v4" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 25v2M8 29v2M3 30v2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg><span>รดน้ำแปลงนี้</span></button></div>
  </div>`;

  const plotsElement = root.querySelector('.garden-plots');
  const count = root.querySelector('.garden-count');
  const selectedLabel = root.querySelector('.garden-selected');
  const status = root.querySelector('.garden-status');
  const storage = root.querySelector('.garden-storage');
  const water = root.querySelector('.garden-water');
  let selected = Math.max(0, plots.findIndex(stage => stage < 2));

  const plant = `<span class="garden-plant" aria-hidden="true"><span class="garden-stem"></span><span class="garden-leaf garden-leaf-left"></span><span class="garden-leaf garden-leaf-right"></span><span class="garden-flower"><i></i><i></i><i></i><i></i><i></i><b></b></span></span><span class="garden-soil" aria-hidden="true"></span>`;
  const buttons = plots.map((_, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'garden-plot';
    button.innerHTML = `${plant}<span class="garden-plot-label"></span>`;
    button.addEventListener('click', () => {
      selected = index;
      render();
      status.textContent = plots[index] === 2 ? 'ดอกไม้นี้บานแล้ว ลองเลือกแปลงอื่นนะ' : 'พร้อมรดน้ำแล้ว';
    });
    plotsElement.append(button);
    return button;
  });

  function publish() {
    const blooms = plots.filter(stage => stage === 2).length;
    document.documentElement.dataset.gardenBlooms = String(blooms);
    document.dispatchEvent(new CustomEvent('garden:change', { detail: { blooms } }));
  }

  function render() {
    const blooms = plots.filter(stage => stage === 2).length;
    count.textContent = `ดอกไม้บาน ${blooms} / ${plotCount} ดอก`;
    buttons.forEach((button, index) => {
      button.dataset.stage = String(plots[index]);
      button.setAttribute('aria-pressed', String(index === selected));
      button.setAttribute('aria-label', `แปลงที่ ${index + 1}: ${stages[plots[index]]}`);
      button.querySelector('.garden-plot-label').textContent = `แปลง ${index + 1} · ${stages[plots[index]]}`;
    });
    selectedLabel.textContent = `แปลงที่ ${selected + 1} · ${stages[plots[selected]]}`;
    water.disabled = plots[selected] === 2;
    water.querySelector('span').textContent = water.disabled ? 'ดอกไม้บานแล้ว' : 'รดน้ำแปลงนี้';
    storage.textContent = storageAvailable ? 'สวนของคุณจะถูกเก็บไว้ในอุปกรณ์นี้' : 'บันทึกลงอุปกรณ์ไม่ได้ ความคืบหน้าจะอยู่จนกว่าจะปิดหน้านี้';
  }

  water.addEventListener('click', () => {
    if (plots[selected] >= 2) return;
    plots[selected]++;
    try {
      localStorage.setItem(storageKey, JSON.stringify(plots));
      storageAvailable = true;
    } catch (_) {
      storageAvailable = false;
    }
    render();
    status.textContent = plots[selected] === 2 ? `แปลงที่ ${selected + 1} ออกดอกแล้ว เลือกแปลงอื่นเพื่อปลูกเพิ่มได้เลย` : `แปลงที่ ${selected + 1} งอกเป็นต้นอ่อนแล้ว รดน้ำอีกครั้งเพื่อให้ดอกไม้บาน`;
    publish();
  });

  render();
  status.textContent = 'เลือกแปลงแล้วรดน้ำได้เลย';
  publish();
})();
