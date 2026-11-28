import * as THREE from 'three';

const colors = {
  sky: 0x9fcbe9, horizon: 0xf5dce6, grass: 0xaad3ad, path: 0xf2c8c1,
  cream: 0xffefd6, blush: 0xf4b5bb, rose: 0xcb788a, wine: 0x884959,
  mint: 0x8abda3, sage: 0x639c81, pine: 0x3c785d, soil: 0x915d54,
  peach: 0xffbd9d, butter: 0xffd481, lilac: 0xc5b1dd,
};

export function buildWorld(scene, photos) {
  const world = new THREE.Group();
  world.name = 'Pinkpaul · Memory Lane';
  scene.add(world);
  scene.background = new THREE.Color(colors.horizon);
  scene.fog = new THREE.FogExp2(colors.horizon, 0.025);

  const fill = new THREE.HemisphereLight(0xfff0e8, 0xb7bfcc, 2.05);
  const sun = new THREE.DirectionalLight(0xffe0b4, 1.35);
  sun.position.set(-7, 12, 5);
  world.add(fill, sun);

  const sky = new THREE.Mesh(new THREE.SphereGeometry(115, 24, 12), new THREE.ShaderMaterial({
    uniforms: { horizon: { value: new THREE.Color(colors.horizon) }, zenith: { value: new THREE.Color(colors.sky) } },
    vertexShader: `varying vec3 vSky;
      void main() {
        vSky = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position.z = gl_Position.w;
      }`,
    fragmentShader: `uniform vec3 horizon;
      uniform vec3 zenith;
      varying vec3 vSky;
      void main() {
        gl_FragColor = vec4(mix(horizon, zenith, smoothstep(-0.04, 0.45, normalize(vSky).y)), 1.0);
        #include <colorspace_fragment>
      }`,
    side: THREE.BackSide, depthWrite: false,
  }));
  sky.position.set(0, 0, -27);
  sky.frustumCulled = false;
  sky.renderOrder = -10;
  world.add(sky);

  const box = new THREE.BoxGeometry();
  const panel = new THREE.PlaneGeometry();
  const pebble = new THREE.IcosahedronGeometry(1, 0);
  const foliage = new THREE.IcosahedronGeometry(1, 1);
  const barrel = new THREE.CylinderGeometry(1, 1, 1, 12);
  const tapered = new THREE.CylinderGeometry(0.68, 1, 1, 12);
  const cone = new THREE.ConeGeometry(1, 1, 12);
  const shadowDisc = new THREE.CircleGeometry(1, 24).rotateX(-Math.PI / 2);
  const basic = new Map();
  const lit = new Map();
  const stone = new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true });
  const clouds = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const candlelight = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
  const shade = new THREE.MeshBasicMaterial({ color: 0x674954, transparent: true, opacity: 0.13, depthWrite: false });
  const glowCanvas = document.createElement('canvas');
  glowCanvas.width = glowCanvas.height = 32;
  const glowContext = glowCanvas.getContext('2d');
  const glow = glowContext.createRadialGradient(16, 16, 0, 16, 16, 16);
  glow.addColorStop(0, 'rgba(255, 230, 164, .62)');
  glow.addColorStop(0.36, 'rgba(255, 216, 150, .24)');
  glow.addColorStop(1, 'rgba(255, 202, 130, 0)');
  glowContext.fillStyle = glow;
  glowContext.fillRect(0, 0, 32, 32);
  const glowMap = new THREE.CanvasTexture(glowCanvas);
  glowMap.colorSpace = THREE.SRGBColorSpace;
  const halo = new THREE.MeshBasicMaterial({ map: glowMap, transparent: true, depthWrite: false, toneMapped: false, side: THREE.DoubleSide });
  const shapeBatches = new Map();
  const dummy = new THREE.Object3D();
  const tint = new THREE.Color();
  let randomSeed = 8128;

  function random() {
    randomSeed = (Math.imul(randomSeed, 1664525) + 1013904223) >>> 0;
    return randomSeed / 4294967296;
  }

  // Palette variants share a geometry, material, and draw call via per-instance color.
  function instance(geometry, color, x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0, material = stone) {
    let byMaterial = shapeBatches.get(geometry);
    if (!byMaterial) shapeBatches.set(geometry, byMaterial = new Map());
    let entries = byMaterial.get(material);
    if (!entries) byMaterial.set(material, entries = []);
    dummy.position.set(x, y, z);
    dummy.rotation.set(rx, ry, rz);
    dummy.scale.set(sx, sy, sz);
    dummy.updateMatrix();
    entries.push([dummy.matrix.clone(), color]);
  }

  function shape(parent, geometry, color, x, y, z, sx, sy, sz, unlit = false) {
    const bank = unlit ? basic : lit;
    if (!bank.has(color)) bank.set(color, unlit
      ? new THREE.MeshBasicMaterial({ color })
      : new THREE.MeshLambertMaterial({ color, flatShading: true }));
    const mesh = new THREE.Mesh(geometry, bank.get(color));
    mesh.position.set(x, y, z);
    mesh.scale.set(sx, sy, sz);
    parent.add(mesh);
    return mesh;
  }

  function shadow(x, z, radiusX, radiusZ) {
    instance(shadowDisc, 0xffffff, x, 0.011, z, radiusX, 1, radiusZ, 0, 0, 0, shade);
  }

  function flower(x, z, height, petals, scale = 1) {
    instance(barrel, colors.sage, x, height * 0.5, z, 0.021 * scale, height, 0.021 * scale);
    for (const side of [-1, 1]) {
      instance(pebble, side < 0 ? colors.sage : colors.mint,
        x + side * 0.06 * scale, height * (side < 0 ? 0.38 : 0.62), z, 0.094 * scale, 0.038 * scale, 0.046 * scale, 0, 0, side * 0.52);
    }
    for (let i = 0; i < 5; i++) {
      const angle = i * 2 * Math.PI / 5;
      instance(pebble, petals, x + Math.sin(angle) * 0.079 * scale,
        height + Math.cos(angle) * 0.054 * scale, z + Math.cos(angle) * 0.052 * scale,
        0.061 * scale, 0.041 * scale, 0.067 * scale, -0.4, 0, -angle);
    }
    instance(pebble, colors.butter, x, height + 0.014 * scale, z + 0.025 * scale, 0.049 * scale, 0.042 * scale, 0.055 * scale);
  }

  function tree(x, z, size, palette) {
    shadow(x + 0.27 * size, z - 0.16 * size, 0.9 * size, 0.58 * size);
    instance(tapered, 0x9c7663, x, 1.1 * size, z, 0.15 * size, 2.2 * size, 0.15 * size, 0, 0, 0.04);
    for (const side of [-1, 1]) {
      instance(tapered, 0x9c7663, x + side * 0.31 * size, 1.62 * size, z, 0.075 * size, 1.04 * size, 0.075 * size, 0, 0, -side * 0.67);
    }
    for (let n = 0; n < 6; n++) {
      const angle = n * 2.4;
      const r = n === 0 ? 0 : 0.43 + random() * 0.36;
      const y = n === 0 ? 2.95 : 2.35 + random() * 0.5;
      instance(foliage, palette[n % palette.length], x + Math.sin(angle) * r * size, y * size,
        z + Math.cos(angle) * r * size, size * 0.88, size * (0.71 + random() * 0.35), size * 0.77, 0, angle);
    }
  }

  instance(box, colors.grass, 0, -0.16, -35, 58, 0.31, 117);
  instance(box, colors.path, 0, -0.024, -32, 2.62, 0.064, 79);
  for (let i = 0; i < 9; i++) {
    const z = -18 - i * 8.4;
    const side = i % 2 === 0 ? -1 : 1;
    const x = side * (7 + random() * 16);
    const y = 5.7 + random() * 4.3;
    for (let n = 0; n < 4; n++) {
      instance(foliage, n === 1 ? 0xfff9f1 : 0xffedf3, x + (n - 1.5) * 0.91, y + Math.sin(n * Math.PI / 3) * 0.45, z,
        1.39, 0.6 + (n % 2) * 0.23, 0.65, 0, n, 0, clouds);
    }
  }

  const pavers = [0xf1bdba, 0xf5cec3, 0xf9dbcb, 0xedb3b5, 0xf5c7bd];
  for (let row = 0; row < 104; row++) {
    const z = 7 - row * 0.744;
    for (const side of [-1, 1]) {
      instance(box, colors.cream, side * 1.29, 0.024, z, 0.1, 0.04, 0.68);
      if (row % 3 === 0) instance(pebble, pavers[2], side * (1.44 + random() * 0.17), 0.018,
        z - random() * 0.36, 0.052, 0.027, 0.085, 0, random() * 3);
    }
    for (let col = 0; col < 4; col++) {
      const x = (col - 1.5) * 0.615 + (row % 2 === 0 ? -0.045 : 0.045);
      instance(box, pavers[Math.floor(random() * pavers.length)], x, 0.009, z, 0.584, 0.024, 0.714, 0, (random() - 0.5) * 0.025);
    }
  }

  const greens = [colors.sage, colors.mint, 0x76aa84, 0x8fb592, colors.pine];
  const blossoms = [colors.blush, 0xeb8da4, colors.cream, colors.peach, colors.lilac, 0xffd2da];
  for (const side of [-1, 1]) {
    for (let i = 0; i < 48; i++) {
      const z = 5.35 - i * 1.53;
      const x = side * (6.05 + random() * 0.39);
      instance(box, colors.cream, side * 6.1, 0.43, z, 0.1, 0.86, 0.11);
      instance(pebble, colors.blush, side * 6.1, 0.88, z, 0.105, 0.09, 0.105);
      for (const y of [0.29, 0.57]) instance(box, 0xe1b19e, side * 6.10, y, z - 0.765, 0.07, 0.075, 1.54);
      for (let j = 0; j < 2; j++) {
        instance(foliage, greens[(i + j) % greens.length], x, 0.38 + random() * 0.24, z - j * 0.79,
          0.62 + random() * 0.21, 0.47 + random() * 0.31, 0.76, 0, random() * 6);
      }
      if (i % 2 === 0) {
        for (let j = 0; j < 3; j++) flower(side * (4.94 + random() * 0.54), z - random() * 1.63,
          0.18 + random() * 0.34, blossoms[(i + j) % blossoms.length], 0.7 + random() * 0.6);
      }
    }
    for (let i = 0; i < 12; i++) {
      const z = 3 - i * 6.45 - random() * 1.7;
      const x = side * (7.0 + random() * 3.1);
      tree(x, z, 0.84 + random() * 0.57, i % 3 === 0
        ? [0xf9c9cb, 0xf1a6b6, 0xf2bac8, 0xffd7d0]
        : [0xacce9d, 0x8ab79a, 0x71a388, 0xa5caa9]);
    }
    for (let i = 0; i < 8; i++) {
      instance(foliage, greens[i % greens.length], side * (10.7 + random() * 8), 0.6, 1 - i * 9.7,
        2.6 + random(), 1.1 + random() * 1.3, 3.2, 0, random() * 6);
    }
  }

  // All written signs and date plaques are generated locally into one texture.
  const canvas = document.createElement('canvas');
  const tileW = 256;
  const tileH = 80;
  const atlasColumns = 4;
  canvas.width = tileW * atlasColumns;
  canvas.height = tileH * Math.ceil((photos.length + 10) / atlasColumns);
  const ink = canvas.getContext('2d');
  const atlas = new THREE.CanvasTexture(canvas);
  atlas.colorSpace = THREE.SRGBColorSpace;
  atlas.generateMipmaps = false;
  atlas.minFilter = THREE.LinearFilter;
  const lettering = new THREE.MeshBasicMaterial({ map: atlas, toneMapped: false });

  function plaque(parent, index, text, subtext, x, y, z, width, height, background = '#fff0d6') {
    const u = index % atlasColumns * tileW;
    const v = Math.floor(index / atlasColumns) * tileH;
    ink.fillStyle = background;
    ink.fillRect(u, v, tileW, tileH);
    ink.strokeStyle = '#cd8991';
    ink.lineWidth = 2;
    ink.strokeRect(u + 5, v + 5, tileW - 10, tileH - 10);
    ink.textAlign = 'center';
    ink.textBaseline = 'middle';
    ink.fillStyle = '#794a5b';
    ink.font = subtext ? 'bold 28px Georgia, serif' : 'bold 33px Georgia, serif';
    ink.fillText(text, u + tileW / 2, v + (subtext ? 30 : 42), tileW - 26);
    if (subtext) {
      ink.font = 'bold 13px sans-serif';
      ink.fillText(subtext, u + tileW / 2, v + 57, tileW - 26);
    }
    const geometry = panel.clone();
    const uv = geometry.attributes.uv;
    for (let i = 0; i < uv.count; i++) {
      uv.setXY(i, (u + 1 + uv.getX(i) * (tileW - 2)) / canvas.width,
        1 - (v + 1 + (1 - uv.getY(i)) * (tileH - 2)) / canvas.height);
    }
    const sign = new THREE.Mesh(geometry, lettering);
    sign.position.set(x, y, z);
    sign.scale.set(width, height, 1);
    parent.add(sign);
  }

  const heartPath = new THREE.Shape();
  heartPath.moveTo(0, -0.5);
  heartPath.bezierCurveTo(-1, 0.16, -0.45, 0.75, 0, 0.34);
  heartPath.bezierCurveTo(0.45, 0.75, 1, 0.16, 0, -0.5);
  const heart = new THREE.ExtrudeGeometry(heartPath, { depth: 0.12, bevelEnabled: false, curveSegments: 5 });
  const entryPlots = photos.length;

  function archCurve(xRadius, rise, bottom, thickness) {
    const points = [];
    for (let i = 0; i <= 20; i++) {
      const angle = i * Math.PI / 20;
      points.push(new THREE.Vector3(xRadius * Math.cos(angle), bottom + rise * Math.sin(angle), 0));
    }
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 40, thickness, 6, false);
  }

  const curvedBand = archCurve(4.08, 1.49, 2.65, 0.15);
  const curvedTrim = archCurve(4.08, 1.49, 2.65, 0.043);
  for (const [index, z] of [-4.43, -23.65, -43].entries()) {
    instance(curvedBand, index === 0 ? colors.rose : colors.blush, 0, 0, z, 1, 1, 1);
    instance(curvedTrim, colors.cream, 0, 0, z + 0.14, 1, 1, 1);
    const archWords = ['Pinkpaul', 'Little Moments', 'Always Together'];
    const subtext = ['M E M O R Y   L A N E', 'P H O T O   G A R D E N', 'W I T H   L O V E'];
    instance(box, colors.rose, 0, 3.57, z + 0.01, 2.34, 0.77, 0.16);
    plaque(world, entryPlots + 6 + index, archWords[index], subtext[index], 0, 3.57, z + 0.097, 2.23, 0.7);
    instance(heart, colors.rose, 0, 4.35, z + 0.035, 0.24, 0.24, 0.24);
    for (const side of [-1, 1]) {
      const x = side * 4.08;
      shadow(x, z, 0.52, 0.48);
      instance(box, colors.cream, x, 1.36, z, 0.25, 2.68, 0.28);
      for (const [y, size] of [[0.12, 0.48], [0.32, 0.34], [2.62, 0.36]]) {
        instance(box, y < 0.2 ? colors.rose : colors.blush, x, y, z, size, 0.14, size);
      }
      for (let n = 0; n < 11; n++) {
        const a = n * 0.55;
        const y = n * 0.245 + 0.35;
        const bend = Math.max(0, y - 2.5) * 0.7;
        const dx = Math.sin(a) * 0.24 - side * bend;
        const dz = 0.16 + Math.cos(a) * 0.18;
        instance(foliage, greens[n % greens.length], x + dx, y, z + dz, 0.19, 0.26, 0.15, 0, a, side * 0.46);
        if (n % 3 !== 0) instance(foliage, blossoms[n % blossoms.length], x + dx, y + 0.08, z + dz + 0.105,
          0.13, 0.12, 0.09, 0, -a);
      }
      for (let n = 0; n < 3; n++) instance(heart, n % 2 ? colors.rose : colors.blush,
        side * (1.41 + n * 0.17), 3.67 + (n % 2) * 0.17, z + 0.16, 0.13, 0.13, 0.12, 0, 0, side * (0.18 + n * 0.2));
    }
  }

  const pendingTextures = [];
  const photoTargets = photos.map((photo, index) => {
    const row = Math.floor(index / 2);
    const rows = Math.ceil(photos.length / 2);
    const z = -5.8 - row * Math.min(4.65, 55 / Math.max(1, rows - 1));
    const side = index % 2 === 0 ? -1 : 1;
    const x = side * 2.47;
    const frame = new THREE.Group();
    frame.name = `Memory ${index + 1}`;
    frame.userData.photoIndex = index;
    frame.position.set(x, 1.71, z);
    world.add(frame);

    // A common outer frame keeps sightlines regular; artwork is fit without cropping.
    const front = shape(frame, box, row % 3 === 1 ? colors.mint : colors.rose, 0, 0, 0, 2.05, 1.56, 0.12);
    instance(box, colors.cream, x, 1.71, z + 0.072, 1.93, 1.44, 0.038);
    const artMaterial = new THREE.MeshBasicMaterial({ color: 0xeed2ce, toneMapped: false });
    const art = new THREE.Mesh(panel, artMaterial);
    art.position.z = 0.101;
    art.scale.set(1.79, 1.28, 1);
    frame.add(art);
    if (photo.path) pendingTextures.push([photo.path, artMaterial]);
    const date = typeof photo.date === 'string' ? photo.date.slice(0, 10) : '';
    const number = String(index + 1).padStart(2, '0');
    const caption = /^\d{4}-\d{2}-\d{2}$/.test(date) ? date.replaceAll('-', ' / ') : 'OUR MEMORIES';
    instance(box, colors.rose, x, 0.79, z + 0.025, 0.89, 0.26, 0.13);
    plaque(frame, index, `${number}  ·  ${caption}`, '', 0, -0.92, 0.095, 0.82, 0.22);
    for (const s of [-1, 1]) {
      instance(box, colors.cream, x + s * 0.67, 0.51, z - 0.012, 0.13, 1.02, 0.16);
      instance(box, colors.blush, x + s * 0.67, 0.078, z, 0.21, 0.15, 0.28);
      instance(box, colors.blush, x + s * 0.96, 1.71 + 0.66, z + 0.097, 0.066, 0.066, 0.023, 0, 0, Math.PI / 4);
    }
    instance(heart, colors.blush, x, 2.53, z + 0.014, 0.155, 0.155, 0.18);
    instance(barrel, row % 2 ? 0xd5e3cd : 0xe8ded2, x, 0.012, z + 0.09, 1.22, 0.039, 0.83);
    shadow(x + 0.17, z - 0.11, 1.14, 0.52);
    if (row < 14) {
      for (let n = 0; n < 4; n++) flower(side * (3.56 + random() * 0.58), z + 0.52 - random() * 1.16,
        0.24 + random() * 0.36, blossoms[(row + n) % blossoms.length], 0.76 + random() * 0.48);
    }
    // Backboard, picture, and date plaque all belong to the same pick target.
    front.name = 'Frame backboard';
    return frame;
  });

  const growthMeshes = [];
  const plots = Array.from({ length: 6 }, (_, index) => {
    const side = index % 2 === 0 ? -1 : 1;
    const x = side * 1.88;
    const z = -0.78 - Math.floor(index / 2) * 1.53;
    const plot = new THREE.Group();
    plot.name = `Garden plot ${index + 1}`;
    plot.userData.plotIndex = index;
    plot.position.set(x, 0, z);
    world.add(plot);
    shadow(x + 0.08, z - 0.05, 0.65, 0.54);
    shape(plot, box, colors.rose, 0, 0.09, 0, 1.04, 0.18, 0.91);
    shape(plot, box, colors.blush, 0, 0.178, 0, 1.13, 0.075, 0.98);
    shape(plot, box, colors.soil, 0, 0.204, 0, 0.94, 0.072, 0.79);
    plaque(plot, entryPlots + index, String(index + 1).padStart(2, '0'), '', 0, 0.135, 0.495, 0.28, 0.12);

    for (let bit = 0; bit < 6; bit++) {
      const a = bit * Math.PI / 3 + random() * 0.35;
      instance(pebble, bit % 2 ? 0xb9806b : 0xa3685b, x + Math.sin(a) * (0.22 + random() * 0.1),
        0.243, z + Math.cos(a) * 0.28, 0.046, 0.015, 0.028, 0, a);
    }

    const seed = new THREE.Group();
    for (const dx of [-0.12, 0.12]) {
      const kernel = shape(seed, pebble, colors.butter, dx, 0.265, (random() - 0.5) * 0.16, 0.106, 0.047, 0.069);
      kernel.rotation.y = dx * 6;
    }

    function plant(height, bloom) {
      const growth = new THREE.Group();
      shape(growth, barrel, colors.pine, 0, 0.24 + height / 2, 0, 0.037, height, 0.037);
      for (const leaf of [-1, 1]) {
        const sprig = shape(growth, foliage, leaf < 0 ? colors.sage : colors.mint,
          leaf * 0.104, 0.24 + height * (leaf < 0 ? 0.59 : 0.83), 0.01, 0.151, 0.062, 0.078);
        sprig.rotation.z = leaf * 0.55;
      }
      if (bloom) {
        const y = 0.25 + height;
        const color = [0xf693af, colors.lilac, colors.peach, 0xf1a3c2, colors.butter, 0xed90a5][index];
        for (let i = 0; i < 7; i++) {
          const a = i * 2 * Math.PI / 7;
          const petal = shape(growth, foliage, color, Math.sin(a) * 0.171, y + Math.cos(a) * 0.151,
            0.037 + Math.cos(a) * 0.066, 0.119, 0.163, 0.08);
          petal.rotation.set(0.35, 0, -a);
        }
        shape(growth, foliage, colors.butter, 0, y, 0.101, 0.137, 0.123, 0.081);
        shape(growth, pebble, colors.peach, 0.01, y + 0.008, 0.176, 0.054, 0.048, 0.022);
      } else {
        shape(growth, pebble, 0xb0ce82, 0, 0.24 + height, 0, 0.078, 0.104, 0.062);
      }
      return growth;
    }

    const stages = [seed, plant(0.33, false), plant(0.69, true)];
    plot.add(seed);
    plot.userData.stage = 0;
    growthMeshes.push(stages);
    return plot;
  });

  function setGrowth(stages) {
    plots.forEach((plot, index) => {
      const next = stages?.[index];
      const current = plot.userData.stage;
      if (!Number.isInteger(next) || next < 0 || next > 2 || next === current) return;
      // Detached states stay out of recursive raycasting as well as rendering.
      plot.remove(growthMeshes[index][current]);
      plot.add(growthMeshes[index][next]);
      plot.userData.stage = next;
    });
    world.updateMatrixWorld(true);
  }

  // Cherry blossom banks frame the entrance and the next two arches from outside the aisle.
  const cherry = [0xf3a4bf, 0xffc7d4, 0xffdce3, 0xe78daf, 0xf5b4ce, 0xffe0dc];
  for (const side of [-1, 1]) {
    for (const [x, z, scale] of [[6.08, -2.9, 1.78], [7.45, -8.2, 1.62], [6.15, -22.5, 1.51], [6.25, -42.5, 1.55]]) {
      tree(side * x, z, scale, cherry);
      for (let n = 0; n < 8; n++) {
        const a = n * 2.4;
        const crownX = side * (x - 0.94 + Math.cos(a) * 0.88);
        const crownY = scale * (2.53 + Math.sin(a) * 0.32);
        instance(foliage, cherry[n % cherry.length], crownX, crownY, z + Math.cos(n) * 0.94,
          0.91 * scale, 0.54 * scale, 0.61 * scale, 0.1, a, side * 0.38);
      }
    }
    for (let i = 0; i < 36; i++) {
      const x = side * (3.04 + random() * 2.35);
      const z = 2.16 - random() * 10.1;
      const y = i % 3 === 0 ? 0.025 : 1.2 + random() * 3.38;
      instance(pebble, cherry[i % cherry.length], x, y, z, 0.065, 0.021, 0.043, random() * 2.5, random() * 6, random() * 2.5);
    }
    for (let i = 0; i < 20; i++) {
      const x = side * (3.18 + random() * 1.51);
      const z = -3.85 + (random() - 0.5) * 2.65;
      flower(x, z, 0.19 + random() * 0.3, cherry[i % cherry.length], 0.65 + random() * 0.83);
    }
  }

  const cableLength = 5.14;
  const cablePoints = Array.from({ length: 21 }, (_, index) => {
    const x = cableLength * (index / 10 - 1);
    return new THREE.Vector3(x, 3.85 + 0.85 * (x / cableLength) ** 2, 0);
  });
  const cable = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(cablePoints), 28, 0.018, 5, false);
  for (const [index, z] of [-1.92, -10.6, -17.6, -28.8, -36, -48.8, -56.2, -64.1].entries()) {
    const lift = index === 0 ? 0.56 : 0;
    instance(cable, 0x97625d, 0, lift, z, 1, 1, 1);
    for (const side of [-1, 1]) {
      instance(tapered, colors.rose, side * cableLength, 2.32 + lift / 2, z, 0.081, 4.68 + lift, 0.081);
      instance(barrel, colors.cream, side * cableLength, 0.12, z, 0.185, 0.24, 0.185);
      instance(pebble, colors.butter, side * cableLength, 4.74 + lift, z, 0.12, 0.14, 0.12);
    }
    for (let number = 0; number < 17; number++) {
      const x = (number / 8 - 1) * 4.76;
      const y = 3.85 + lift + 0.85 * (x / cableLength) ** 2;
      instance(barrel, colors.rose, x, y - 0.062, z, 0.035, 0.12, 0.035);
      instance(pebble, number % 3 === 0 ? 0xffe5bc : 0xfff6d5, x, y - 0.128, z, 0.079, 0.098, 0.075,
        0, 0, 0, candlelight);
      instance(panel, 0xffffff, x, y - 0.13, z + 0.08, 0.51, 0.51, 1, 0, 0, 0, halo);
    }
  }

  // The fountain sits beyond the walkable boundary; the pavilion crowns the view behind it.
  const fountainZ = -68.07;
  const water = new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true, emissive: 0x173637, emissiveIntensity: 0.36 });
  const ripple = new THREE.TorusGeometry(1, 0.017, 5, 32).rotateX(Math.PI / 2);
  shadow(0, fountainZ, 2.95, 2.83);
  instance(barrel, colors.rose, 0, 0.125, fountainZ, 2.76, 0.25, 2.76);
  instance(barrel, colors.blush, 0, 0.36, fountainZ, 2.56, 0.33, 2.56);
  instance(barrel, colors.cream, 0, 0.549, fountainZ, 2.64, 0.13, 2.64);
  instance(barrel, 0x98d5d4, 0, 0.62, fountainZ, 2.37, 0.043, 2.37, 0, 0, 0, water);
  for (const [r, shade] of [[2.04, 0xdbf7ef], [1.47, 0xbee8e6], [1.19, 0xeefaf0]]) {
    instance(ripple, shade, 0, 0.645, fountainZ, r, 1, r, 0, 0, 0, candlelight);
  }
  instance(tapered, colors.rose, 0, 0.76, fountainZ, 0.99, 0.34, 0.99);
  instance(tapered, colors.cream, 0, 1.14, fountainZ, 0.46, 0.77, 0.46);
  instance(barrel, colors.blush, 0, 1.46, fountainZ, 1.15, 0.21, 1.15);
  instance(barrel, colors.cream, 0, 1.59, fountainZ, 1.3, 0.12, 1.3);
  instance(barrel, 0xa9e3e0, 0, 1.661, fountainZ, 1.17, 0.034, 1.17, 0, 0, 0, water);
  instance(tapered, colors.rose, 0, 1.917, fountainZ, 0.32, 0.51, 0.32);
  instance(barrel, colors.cream, 0, 2.19, fountainZ, 0.67, 0.16, 0.67);
  instance(barrel, 0xa9e3e0, 0, 2.277, fountainZ, 0.53, 0.028, 0.53, 0, 0, 0, water);
  instance(tapered, colors.rose, 0, 2.69, fountainZ, 0.061, 0.83, 0.061);
  instance(heart, colors.rose, 0, 3.28, fountainZ - 0.02, 0.41, 0.41, 0.51);
  instance(heart, colors.blush, 0, 3.28, fountainZ + 0.05, 0.29, 0.29, 0.24);
  const jetPoints = [[0, 2.25], [0, 2.58], [0.13, 2.79], [0.3, 2.63], [0.48, 2.3]]
    .map(([x, y]) => new THREE.Vector3(x, y, 0));
  const jet = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(jetPoints), 16, 0.04, 6, false);
  for (let n = 0; n < 5; n++) instance(jet, 0xe6f9ef, 0, 0, fountainZ, 1, 1, 1, 0, n * Math.PI * 2 / 5, 0, water);

  const streamPoints = [[0.93, 1.66], [1.29, 1.66], [1.56, 1.38], [1.75, 0.64]]
    .map(([x, y]) => new THREE.Vector3(x, y, 0));
  const stream = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(streamPoints), 15, 0.038, 6, false);
  for (let n = 0; n < 8; n++) {
    const angle = n * Math.PI / 4;
    instance(stream, 0xd3f2ef, 0, 0, fountainZ, 1, 1, 1, 0, angle, 0, water);
    const x = Math.cos(angle) * 1.75;
    const z = fountainZ - Math.sin(angle) * 1.75;
    instance(ripple, 0xecf9ee, x, 0.652, z, 0.28, 0.34, 0.28, 0, 0, 0, candlelight);
    for (let p = 0; p < 3; p++) {
      instance(pebble, 0xe0f7f3, x + (random() - 0.5) * 0.22, 0.73 + p * 0.094, z + (random() - 0.5) * 0.22,
        0.037, 0.067, 0.038, 0, angle, 0, candlelight);
    }
  }

  const pavilionZ = -75.25;
  instance(barrel, colors.rose, 0, 0.085, pavilionZ, 2.48, 0.17, 2.48);
  instance(barrel, colors.cream, 0, 0.19, pavilionZ, 2.29, 0.12, 2.29);
  for (let i = 0; i < 6; i++) {
    const angle = (i + 0.5) * Math.PI / 3;
    const x = Math.sin(angle) * 2;
    const z = pavilionZ + Math.cos(angle) * 2;
    instance(barrel, colors.blush, x, 1.64, z, 0.105, 2.9, 0.105);
    for (const y of [0.34, 2.96]) instance(barrel, colors.rose, x, y, z, 0.157, 0.16, 0.157);
  }
  instance(barrel, colors.cream, 0, 3.14, pavilionZ, 2.56, 0.16, 2.56);
  instance(cone, colors.rose, 0, 3.77, pavilionZ, 2.52, 1.17, 2.52);
  instance(tapered, colors.blush, 0, 4.29, pavilionZ, 0.45, 0.33, 0.45);
  instance(heart, colors.rose, 0, 4.68, pavilionZ, 0.43, 0.43, 0.43);
  instance(box, colors.rose, 0, 2.53, pavilionZ + 1.78, 1.87, 0.63, 0.12);
  plaque(world, entryPlots + 9, 'With Love', 'A L W A Y S', 0, 2.53, pavilionZ + 1.849, 1.77, 0.55);
  for (const side of [-1, 1]) {
    for (let i = 0; i < 12; i++) flower(side * (2.8 + random() * 1.5), -64.9 - random() * 3.2,
      0.27 + random() * 0.39, blossoms[i % blossoms.length], 0.85 + random() * 0.52);
  }

  for (const [geometry, byMaterial] of shapeBatches) {
    for (const [material, entries] of byMaterial) {
      const batch = new THREE.InstancedMesh(geometry, material, entries.length);
      entries.forEach(([matrix, color], index) => {
        batch.setMatrixAt(index, matrix);
        batch.setColorAt(index, tint.setHex(color));
      });
      batch.computeBoundingSphere();
      world.add(batch);
    }
  }

  // Limit concurrent decodes and GPU texture size; sources remain the originals.
  // A simple matte remains visible if the browser cannot load an image.
  function loadNextPhoto() {
    const job = pendingTextures.shift();
    if (!job) return;
    const [path, material] = job;
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => {
      const thumbnail = document.createElement('canvas');
      thumbnail.width = 448;
      thumbnail.height = 320;
      const context = thumbnail.getContext('2d');
      const availableW = thumbnail.width - 16;
      const availableH = thumbnail.height - 16;
      const scale = Math.min(availableW / image.naturalWidth, availableH / image.naturalHeight);
      const w = image.naturalWidth * scale;
      const h = image.naturalHeight * scale;
      context.fillStyle = '#f5e5d7';
      context.fillRect(0, 0, thumbnail.width, thumbnail.height);
      context.imageSmoothingQuality = 'high';
      context.drawImage(image, (thumbnail.width - w) / 2, (thumbnail.height - h) / 2, w, h);
      const texture = new THREE.CanvasTexture(thumbnail);
      texture.colorSpace = THREE.SRGBColorSpace;
      material.map = texture;
      material.color.setHex(0xffffff);
      material.needsUpdate = true;
      loadNextPhoto();
    };
    image.onerror = loadNextPhoto;
    image.src = path;
  }
  for (let i = 0; i < 3; i++) loadNextPhoto();

  world.updateMatrixWorld(true);
  return { photoTargets, plots, setGrowth };
}
