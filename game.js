'use strict';

(() => {
  const root = document.querySelector('#game-root');
  if (!root) return;

  root.innerHTML = `<div class="game-panel">
    <div class="game-heading"><div><p class="game-eyebrow">PINKPAUL LITTLE GAME</p><h2>เก็บหัวใจไปด้วยกัน</h2><p class="game-instructions" id="game-instructions">ขยับตะกร้าเก็บหัวใจให้ได้คะแนน และหลบก้อนเมฆให้ได้ ใช้ปุ่มซ้ายขวา แตะหน้าจอ หรือกดปุ่มลูกศรซ้ายและขวา</p></div><button type="button" class="game-action">เริ่มเล่น</button></div>
    <div class="game-progress"><span class="game-score">คะแนน 0</span><span class="game-lives">เหลือโอกาส 3 ครั้ง</span></div>
    <p class="game-status" role="status" aria-live="polite">พร้อมแล้วกดเริ่มเล่นได้เลย</p>
    <div class="game-field" role="img" aria-label="สนามเกม มี 3 ช่อง ตะกร้าเริ่มอยู่ตรงกลาง" aria-describedby="game-instructions"><div class="game-lanes" aria-hidden="true"></div><div class="game-objects" aria-hidden="true"></div><div class="game-player" aria-hidden="true"><span>ตะกร้า</span></div></div>
    <div class="game-controls" aria-label="ปุ่มควบคุมเกม"><button type="button" class="game-left" aria-label="ขยับตะกร้าไปทางซ้าย">ซ้าย</button><button type="button" class="game-right" aria-label="ขยับตะกร้าไปทางขวา">ขวา</button></div>
  </div>`;

  const field = root.querySelector('.game-field');
  const objectsLayer = root.querySelector('.game-objects');
  const player = root.querySelector('.game-player');
  const status = root.querySelector('.game-status');
  const scoreLabel = root.querySelector('.game-score');
  const livesLabel = root.querySelector('.game-lives');
  const action = root.querySelector('.game-action');
  const left = root.querySelector('.game-left');
  const right = root.querySelector('.game-right');
  let running = false;
  let paused = false;
  let lane = 1;
  let score = 0;
  let lives = 3;
  let objects = [];
  let frame = 0;
  let previousTime = 0;
  let spawnTime = 0;

  function updatePlayer() {
    player.style.left = `${(lane + 0.5) * 100 / 3}%`;
    field.setAttribute('aria-label', `สนามเกม 3 ช่อง ตะกร้าอยู่ช่อง${['ซ้าย', 'กลาง', 'ขวา'][lane]} คะแนน ${score} เหลือโอกาส ${lives} ครั้ง`);
  }

  function move(direction) {
    if (!running || paused) return;
    lane = Math.max(0, Math.min(2, lane + direction));
    updatePlayer();
  }

  function setControls() {
    left.disabled = right.disabled = !running || paused;
  }

  function start() {
    cancelAnimationFrame(frame);
    objectsLayer.replaceChildren();
    objects = [];
    lane = 1;
    score = 0;
    lives = 3;
    previousTime = 0;
    spawnTime = 0;
    running = true;
    paused = false;
    action.textContent = 'เล่นใหม่';
    scoreLabel.textContent = 'คะแนน 0';
    livesLabel.textContent = 'เหลือโอกาส 3 ครั้ง';
    status.textContent = 'เริ่มแล้ว เก็บหัวใจและหลบก้อนเมฆ';
    setControls();
    updatePlayer();
    frame = requestAnimationFrame(tick);
  }

  function end() {
    running = false;
    paused = false;
    cancelAnimationFrame(frame);
    action.textContent = 'เล่นอีกครั้ง';
    status.textContent = `จบเกมแล้ว ได้ ${score} คะแนน กดเล่นอีกครั้งได้เลย`;
    setControls();
  }

  function spawn() {
    const obstacle = Math.random() < 0.32;
    const object = { lane: Math.floor(Math.random() * 3), y: -12, obstacle, element: document.createElement('span') };
    object.element.className = obstacle ? 'game-object game-cloud' : 'game-object game-heart';
    object.element.textContent = obstacle ? 'เมฆ' : '♥';
    object.element.style.left = `${(object.lane + 0.5) * 100 / 3}%`;
    objectsLayer.append(object.element);
    objects.push(object);
  }

  function tick(time) {
    if (!running || paused) return;
    if (document.hidden || root.closest('[hidden]')) { pause(); return; }
    if (!previousTime) previousTime = time;
    const elapsed = Math.min(time - previousTime, 50);
    previousTime = time;
    spawnTime += elapsed;
    if (spawnTime >= 1000) { spawnTime = 0; spawn(); }
    for (const object of objects) {
      object.y += elapsed * 0.032;
      object.element.style.top = `${object.y}%`;
      if (object.y >= 80) {
        object.done = true;
        object.element.remove();
        if (object.lane === lane) {
          if (object.obstacle) {
            lives--;
            livesLabel.textContent = `เหลือโอกาส ${lives} ครั้ง`;
            status.textContent = `ชนก้อนเมฆ เหลือโอกาส ${lives} ครั้ง`;
          } else {
            score++;
            scoreLabel.textContent = `คะแนน ${score}`;
            if (score % 5 === 0) status.textContent = `เก็บหัวใจได้ ${score} คะแนน`;
          }
          updatePlayer();
        }
      }
    }
    objects = objects.filter(object => !object.done);
    if (lives <= 0) { end(); return; }
    frame = requestAnimationFrame(tick);
  }

  function pause() {
    if (!running || paused) return;
    paused = true;
    cancelAnimationFrame(frame);
    previousTime = 0;
    action.textContent = 'เล่นต่อ';
    status.textContent = 'พักเกมไว้แล้ว กดเล่นต่อเมื่อพร้อม';
    setControls();
  }

  function resume() {
    if (!running || !paused || document.hidden || root.closest('[hidden]')) return;
    paused = false;
    previousTime = 0;
    action.textContent = 'เล่นใหม่';
    status.textContent = 'เล่นต่อได้เลย เก็บหัวใจและหลบก้อนเมฆ';
    setControls();
    frame = requestAnimationFrame(tick);
  }

  action.addEventListener('click', () => paused ? resume() : start());
  left.addEventListener('click', () => move(-1));
  right.addEventListener('click', () => move(1));
  document.addEventListener('keydown', event => {
    if (!running || paused || root.closest('[hidden]') || event.altKey || event.ctrlKey || event.metaKey || event.repeat) return;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      move(event.key === 'ArrowLeft' ? -1 : 1);
    }
  });
  field.addEventListener('pointerdown', event => {
    if (!running || paused) return;
    const rect = field.getBoundingClientRect();
    lane = Math.max(0, Math.min(2, Math.floor((event.clientX - rect.left) / rect.width * 3)));
    updatePlayer();
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
  const section = root.closest('#game-section');
  if (section) new MutationObserver(() => { if (section.hidden) pause(); }).observe(section, { attributes: true, attributeFilter: ['hidden'] });
  setControls();
  updatePlayer();
})();
