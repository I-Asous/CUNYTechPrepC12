// The gallery theme's backdrop: an abstract oil-pastel painting, drawn on a
// canvas the first time the theme is used. It's seeded, so it's the same
// painting every visit. paint() resolves to an object URL of the image.
//
// How it's made: a smooth field of warped noise is cut into bands, one
// palette color each, for the big blocks of color. Then thousands of crayon
// strokes go over it, coarse ones first and fine ones last, mostly running
// one diagonal way, and a grain pass adds the texture of paper.

const SEED = 1966;
const WIDTH = 1600;   // drawing units; the canvas gets more pixels on sharp screens
const HEIGHT = 1000;
const CELL = 5;       // the color field is sampled every 5 units

// One color per band of the field. Neighbouring bands sit next to each
// other in the painting, so they're ordered to clash: teal against mustard,
// blue against orange.
const PALETTE = ["#2f8f7a", "#e2a33a", "#2a4a9a", "#e0702c", "#4f9d5a", "#7b56a3", "#d9b44a", "#1f2f6b"];
const HIGHLIGHTS = ["#efe2c4", "#e79ab8", "#8cc3dd", "#c8d96a", "#ffffff", "#c4508a"];
const SHADOWS = ["#141a3d", "#2a1640", "#1d3b2c"];
const FLOW = -0.55;  // the strokes' main direction: up and to the right

// Coarse strokes first, fine ones last. `spread` is how far (in palette
// steps) a stroke's color may stray from the field under it.
const LAYERS = [
  { count: 2200, length: [40, 110], width: [10, 22], alpha: [0.55, 0.8], spread: 0.25 },
  { count: 9000, length: [18, 50], width: [4, 9], alpha: [0.6, 0.9], spread: 0.45 },
  { count: 1500, length: [10, 30], width: [1, 2], alpha: [0.35, 0.6], spread: 0, colors: SHADOWS },
  { count: 12000, length: [8, 26], width: [1, 2.6], alpha: [0.45, 0.9], spread: 0.6, highlights: 0.08, streaks: 2 },
];
const STROKES_PER_SLICE = 2500;  // then let the page breathe for a moment

function mulberry32(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Smooth 2D value noise on a 256x256 lattice that wraps around.
function valueNoise(random) {
  const values = new Float32Array(256 * 256).map(() => random());
  const ease = (t) => t * t * (3 - 2 * t);
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const tx = ease(x - xi), ty = ease(y - yi);
    const x0 = xi & 255, y0 = yi & 255, x1 = (x0 + 1) & 255, y1 = (y0 + 1) & 255;
    const a = values[x0 + y0 * 256], b = values[x1 + y0 * 256];
    const c = values[x0 + y1 * 256], d = values[x1 + y1 * 256];
    return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
  };
}

function fractal(noise, x, y, octaves) {
  let sum = 0, total = 0, amplitude = 1, frequency = 1;
  for (let i = 0; i < octaves; i++) {
    sum += amplitude * noise(x * frequency, y * frequency);
    total += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }
  return sum / total;
}

// The color field: t in [0, 1) picks a palette band, and angle is the
// direction strokes follow: mostly FLOW, bent a little along the bands.
function colorField(random) {
  const [main, warpX, warpY, wobble] = [valueNoise(random), valueNoise(random), valueNoise(random), valueNoise(random)];
  const cols = WIDTH / CELL + 1, rows = HEIGHT / CELL + 1;
  const t = new Float32Array(cols * rows);
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const u = (i * CELL) / HEIGHT, v = (j * CELL) / HEIGHT;
      const wx = fractal(warpX, u, v, 3), wy = fractal(warpY, u + 7.1, v + 3.7, 3);
      t[i + j * cols] = fractal(main, u * 0.8 + wx * 1.6, v * 0.8 + wy * 1.6, 3);
    }
  }

  // Spread the values evenly over [0, 1), so every palette color gets used.
  const order = Array.from(t.keys()).sort((a, b) => t[a] - t[b]);
  order.forEach((cell, rank) => { t[cell] = rank / order.length; });

  const angle = new Float32Array(cols * rows);
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const at = (ii, jj) => t[Math.min(cols - 1, Math.max(0, ii)) + Math.min(rows - 1, Math.max(0, jj)) * cols];
      const gx = at(i + 1, j) - at(i - 1, j), gy = at(i, j + 1) - at(i, j - 1);
      const flow = FLOW + (fractal(wobble, (i * CELL) / 420, (j * CELL) / 420, 2) - 0.5) * 2.2;
      // The band's direction, taken whichever way is nearer the flow.
      let along = Math.atan2(gy, gx) + Math.PI / 2 - flow;
      along -= Math.PI * Math.round(along / Math.PI);
      angle[i + j * cols] = flow + 0.35 * along;
    }
  }

  const cell = (x, y) => {
    const i = Math.min(cols - 1, Math.max(0, Math.round(x / CELL)));
    const j = Math.min(rows - 1, Math.max(0, Math.round(y / CELL)));
    return i + j * cols;
  };
  return { cols, rows, t, tAt: (x, y) => t[cell(x, y)], angleAt: (x, y) => angle[cell(x, y)] };
}

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const PALETTE_RGB = PALETTE.map(rgb);

// The bands painted at low resolution, to be stretched over the whole
// canvas as the first coat.
function firstCoat(field) {
  const canvas = document.createElement("canvas");
  canvas.width = field.cols;
  canvas.height = field.rows;
  const ctx = canvas.getContext("2d");
  const image = ctx.createImageData(field.cols, field.rows);
  field.t.forEach((t, cell) => {
    image.data.set([...PALETTE_RGB[Math.floor(t * PALETTE.length)], 255], cell * 4);
  });
  ctx.putImageData(image, 0, 0);
  return canvas;
}

// A tile of random grey specks, laid over everything for the paper's grain.
function grain(random) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 192;
  const ctx = canvas.getContext("2d");
  const image = ctx.createImageData(192, 192);
  for (let i = 0; i < image.data.length; i += 4) {
    const value = random() * 255;
    image.data.set([value, value, value, 255], i);
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}

const between = (random, [low, high]) => low + random() * (high - low);
const breathe = () => new Promise((resolve) => setTimeout(resolve, 0));

export async function paint() {
  const random = mulberry32(SEED);
  const scale = Math.min(1.5, Math.max(1, window.devicePixelRatio || 1));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(WIDTH * scale);
  canvas.height = Math.round(HEIGHT * scale);
  const ctx = canvas.getContext("2d");
  ctx.scale(scale, scale);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  const field = colorField(random);
  ctx.imageSmoothingQuality = "high";
  ctx.filter = "blur(6px)";  // softens the bands' stepped edges (ignored where unsupported)
  ctx.drawImage(firstCoat(field), -20, -20, WIDTH + 40, HEIGHT + 40);
  ctx.filter = "none";

  let drawn = 0;
  for (const layer of LAYERS) {
    for (let n = 0; n < layer.count; n++) {
      let x = random() * WIDTH, y = random() * HEIGHT;
      let color;
      if (layer.colors) {
        color = layer.colors[Math.floor(random() * layer.colors.length)];
      } else if (random() < (layer.highlights ?? 0)) {
        color = HIGHLIGHTS[Math.floor(random() * HIGHLIGHTS.length)];
      } else {
        const index = Math.floor(field.tAt(x, y) * PALETTE.length + (random() - 0.5) * 2 * layer.spread);
        const [r, g, b] = PALETTE_RGB[Math.min(PALETTE.length - 1, Math.max(0, index))];
        const shade = (random() - 0.5) * 36;
        color = `rgb(${r + shade}, ${g + shade}, ${b + shade})`;
      }

      // Walk a few steps along the field's flow, either way.
      const length = between(random, layer.length);
      const steps = length > 30 ? 5 : 3;
      const direction = random() < 0.5 ? 1 : -1;
      const points = [[x, y]];
      for (let s = 0; s < steps; s++) {
        const angle = field.angleAt(x, y);
        x += (Math.cos(angle) * direction * length) / steps;
        y += (Math.sin(angle) * direction * length) / steps;
        points.push([x, y]);
      }

      // Fine strokes are a few parallel streaks, like a crayon's edge.
      ctx.strokeStyle = color;
      ctx.lineWidth = between(random, layer.width);
      const angle = field.angleAt(...points[0]);
      for (let streak = 0; streak < (layer.streaks ?? 1); streak++) {
        const offset = streak * ctx.lineWidth * 1.6;
        const [ox, oy] = [-Math.sin(angle) * offset, Math.cos(angle) * offset];
        ctx.globalAlpha = between(random, layer.alpha);
        ctx.beginPath();
        points.forEach(([px, py], i) => (i ? ctx.lineTo(px + ox, py + oy) : ctx.moveTo(px + ox, py + oy)));
        ctx.stroke();
      }

      if (++drawn % STROKES_PER_SLICE === 0) await breathe();
    }
  }

  ctx.globalAlpha = 0.28;
  ctx.globalCompositeOperation = "overlay";
  ctx.fillStyle = ctx.createPattern(grain(random), "repeat");
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.88));
  return URL.createObjectURL(blob);
}
