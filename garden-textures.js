import * as THREE from 'three';

function seededRandom(seed) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

// Value noise on a torus: both axes interpolate across the tile boundary.
function tileNoise(columns, rows, random) {
  const values = Float32Array.from({ length: columns * rows }, () => random() * 2 - 1);
  return (u, v) => {
    const x = u * columns;
    const y = v * rows;
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const x0 = (ix % columns + columns) % columns;
    const y0 = (iy % rows + rows) % rows;
    const x1 = (x0 + 1) % columns;
    const y1 = (y0 + 1) % rows;
    const dx = x - ix;
    const dy = y - iy;
    const tx = dx * dx * (3 - 2 * dx);
    const ty = dy * dy * (3 - 2 * dy);
    const a = values[y0 * columns + x0] * (1 - tx) + values[y0 * columns + x1] * tx;
    const b = values[y1 * columns + x0] * (1 - tx) + values[y1 * columns + x1] * tx;
    return a * (1 - ty) + b * ty;
  };
}

// Near-white grayscale is a multiplier, not a new albedo palette. Three decodes
// these sRGB texels before multiplying by the Lambert color and instance tint.
function baseTone(context, random, base, octaves, accent = () => 0) {
  const { width, height } = context.canvas;
  const image = context.createImageData(width, height);
  const layers = octaves.map(([x, y, strength]) => [tileNoise(x, y, random), strength]);
  for (let y = 0, i = 0; y < height; y++) {
    const v = (y + 0.5) / height;
    for (let x = 0; x < width; x++, i += 4) {
      const u = (x + 0.5) / width;
      let shade = base + accent(u, v);
      for (const [noise, strength] of layers) shade += noise(u, v) * strength;
      image.data[i] = image.data[i + 1] = image.data[i + 2] = shade;
      image.data[i + 3] = 255;
    }
  }
  context.putImageData(image, 0, 0);
}

function fleck(context, x, y, rx, ry, angle, tone, alpha) {
  const { width, height } = context.canvas;
  const radius = Math.max(rx, ry);
  const dx = x < radius ? width : x > width - radius ? -width : 0;
  const dy = y < radius ? height : y > height - radius ? -height : 0;
  context.fillStyle = tone;
  context.globalAlpha = alpha;
  for (const offsetX of dx ? [0, dx] : [0]) {
    for (const offsetY of dy ? [0, dy] : [0]) {
      context.beginPath();
      context.ellipse(x + offsetX, y + offsetY, rx, ry, angle, 0, 2 * Math.PI);
      context.fill();
    }
  }
}

function grit(context, random, count, size, strength) {
  const { width, height } = context.canvas;
  for (let i = 0; i < count; i++) {
    const radius = 0.35 + random() ** 2 * size;
    fleck(context, random() * width, random() * height, radius, radius * (0.45 + random() * 0.55),
      random() * Math.PI, random() < 0.72 ? '#555' : '#fff', strength * (0.25 + random() * 0.75));
  }
}

function paintGrass(context, random) {
  baseTone(context, random, 248, [[5, 5, 3], [17, 18, 4], [52, 58, 3]]);
  const { width, height } = context.canvas;
  for (let i = 0; i < 1900; i++) {
    const x = random() * width;
    const y = random() * height;
    const angle = random() * Math.PI;
    for (let blade = 0; blade < 3; blade++) {
      fleck(context, x + blade - 1, y + (blade - 1) * 0.9, 0.42 + random() * 0.38, 1.1 + random() * 2.7,
        angle + (blade - 1) * 0.44, blade === 2 ? '#fff' : '#6e6e6e', 0.10 + random() * 0.10);
    }
  }
}

function paintPath(context, random) {
  baseTone(context, random, 249, [[4, 4, 3], [15, 15, 4], [43, 51, 2]]);
  grit(context, random, 2200, 1.55, 0.20);
}

function paintPaver(context, random) {
  // A shallow worn perimeter, not drawn grout: the actual boxes already have joints.
  baseTone(context, random, 249, [[5, 5, 4], [18, 20, 3]], (u, v) => {
    const edge = Math.min(u, v, 1 - u, 1 - v);
    return -11 * Math.max(0, 1 - edge * 26) ** 2;
  });
  grit(context, random, 950, 1.55, 0.23);
}

function paintEdge(context, random) {
  baseTone(context, random, 249, [[2, 9, 4], [4, 24, 4]], (u) =>
    -10 * Math.max(0, 1 - Math.min(u, 1 - u) * 10) ** 2);
  grit(context, random, 290, 1.25, 0.20);
}

function paintSoil(context, random) {
  baseTone(context, random, 246, [[5, 6, 6], [15, 19, 7], [47, 42, 4]]);
  const { width, height } = context.canvas;
  for (let i = 0; i < 175; i++) {
    const x = random() * width;
    const y = random() * height;
    const r = 0.6 + random() ** 2 * 2.1;
    const angle = random() * Math.PI;
    fleck(context, x, y, r, r * 0.72, angle, '#464646', 0.21);
    fleck(context, x - 0.35, y - 0.55, r * 0.8, r * 0.44, angle, '#fff', 0.36);
  }
  grit(context, random, 1150, 1.35, 0.25);
}

function paintWood(context, random) {
  const warp = tileNoise(4, 3, random);
  const fiber = tileNoise(48, 4, random);
  baseTone(context, random, 250, [[16, 3, 4], [35, 9, 3]], (u, v) => {
    const grain = u + warp(u, v) * 0.025;
    const rings = Math.sin(grain * 2 * Math.PI * 13);
    return -7 * Math.max(0, rings) ** 4 + fiber(grain, v) * 3;
  });
}

function surface(name, width, height, seed, paint, anisotropy, repeatX, repeatY) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { alpha: false });
  paint(context, seededRandom(seed));

  const map = new THREE.CanvasTexture(canvas);
  map.name = `Garden ${name} map`;
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(repeatX, repeatY);
  map.anisotropy = anisotropy;
  return new THREE.MeshLambertMaterial({ name: `Garden ${name}`, color: 0xffffff, map, flatShading: true });
}

/**
 * Shared white Lambert materials for existing instance colors. Each map is
 * generated once on first use; no assets or frame-time drawing are required.
 * Grass/path repeats target the X/Z top faces of the current 58×117 / 2.62×79
 * boxes. Paver, edge, soil and wood use one 0–1 UV tile, with wood grain along V.
 * For ordinary (non-instanced) meshes, clone the material before setting its tint.
 * Call dispose() after removing meshes that use these materials.
 */
export function makeGardenTextures({ anisotropy = 4 } = {}) {
  const materials = new Map();
  function get(name, width, height, seed, paint, repeatX = 1, repeatY = 1) {
    if (!materials.has(name)) {
      materials.set(name, surface(name, width, height, seed, paint, anisotropy, repeatX, repeatY));
    }
    return materials.get(name);
  }

  return {
    get grass() { return get('grass', 256, 256, 1427, paintGrass, 30, 60); },
    get path() { return get('path', 128, 128, 3917, paintPath, 2, 60); },
    get paver() { return get('paver', 128, 128, 4729, paintPaver); },
    get edge() { return get('edge', 32, 128, 6857, paintEdge); },
    get soil() { return get('soil', 128, 128, 7433, paintSoil); },
    get wood() { return get('wood', 128, 128, 8501, paintWood); },
    dispose() {
      for (const material of materials.values()) {
        material.map.dispose();
        material.dispose();
      }
      materials.clear();
    },
  };
}
