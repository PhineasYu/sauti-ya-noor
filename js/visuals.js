// Visual system for Sauti ya Noor.
// Kanga tiles (symmetric geometric marks, one per answer), the dot-matrix
// highlands hero, Noor's layered voice waveform and the match-strength orb.

export const PALETTE = {
  red: '#F2582C', sun: '#F7E03C', sky: '#4FA3EC',
  leaf: '#3DBA6B', rose: '#F07FE3', dusk: '#8B5CF6',
  ink: '#141414', paper: '#E4E6E5'
};
const TILE_COLORS = [PALETTE.red, PALETTE.sun, PALETTE.sky, PALETTE.leaf, PALETTE.rose, PALETTE.dusk];
// Soft card colours (periwinkle, violet, orchid, lime, mint, sky). Cool tones only.
const CARD_COLORS = ['#8C9CF2', '#B07CF7', '#F29BEA', '#CFEA4A', '#7FD3A2', '#5FB0F0'];

// Small deterministic PRNG so every answer always gets the same tile.
export function seeded(seed) {
  let h = 2166136261;
  for (const ch of String(seed)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return () => {
    h += 0x6D2B79F5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function accentFor(seed) {
  const r = seeded(seed + ':accent');
  return CARD_COLORS[Math.floor(r() * CARD_COLORS.length)];
}

function cell(shape, x, y, color, rot) {
  const cx = x + 12.5, cy = y + 12.5;
  const t = `transform="rotate(${rot} ${cx} ${cy})"`;
  switch (shape) {
    case 'sq':   return `<rect x="${x}" y="${y}" width="25" height="25" fill="${color}"/>`;
    case 'qc':   return `<path ${t} d="M${x} ${y}L${x + 25} ${y}A25 25 0 0 1 ${x} ${y + 25}Z" fill="${color}"/>`;
    case 'hc':   return `<path ${t} d="M${x} ${y + 25}A12.5 12.5 0 0 1 ${x + 25} ${y + 25}Z" fill="${color}"/>`;
    case 'tri':  return `<path ${t} d="M${x} ${y}L${x + 25} ${y}L${x} ${y + 25}Z" fill="${color}"/>`;
    case 'dots': return [0, 1].flatMap(i => [0, 1].map(j =>
      `<rect x="${x + 4 + j * 11}" y="${y + 4 + i * 11}" width="6" height="6" fill="${color}"/>`)).join('');
    case 'bars': return `<g ${t}>${[0, 1, 2].map(i =>
      `<rect x="${x}" y="${y + 2 + i * 8.5}" width="25" height="4.5" fill="${color}"/>`).join('')}</g>`;
    case 'dot':  return `<circle cx="${cx}" cy="${cy}" r="7" fill="${color}"/>`;
    default:     return '';
  }
}

// Mirror one quadrant four ways, like the reference tile sheet and kanga borders.
export function kangaTile(seed, { muted = false } = {}) {
  const r = seeded(seed);
  const pick = a => a[Math.floor(r() * a.length)];
  const cols = [...TILE_COLORS].sort(() => r() - 0.5).slice(0, 3);
  const shapes = ['sq', 'qc', 'hc', 'tri', 'dots', 'bars', 'qc', 'hc', 'dot', 'none'];
  let q = '';
  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < 2; j++) {
      q += cell(pick(shapes), j * 25, i * 25, pick(cols), Math.floor(r() * 4) * 90);
    }
  }
  const centre = r() > 0.4
    ? `<circle cx="50" cy="50" r="${6 + Math.floor(r() * 6)}" fill="${pick(cols)}"/>`
    : `<rect x="43" y="43" width="14" height="14" transform="rotate(45 50 50)" fill="${pick(cols)}"/>`;
  const filter = muted ? ' style="filter:grayscale(1);opacity:.45"' : '';
  return `<svg viewBox="0 0 100 100" aria-hidden="true" focusable="false"${filter}>
    <g>${q}</g>
    <g transform="translate(100 0) scale(-1 1)">${q}</g>
    <g transform="translate(0 100) scale(1 -1)">${q}</g>
    <g transform="translate(100 100) scale(-1 -1)">${q}</g>
    ${centre}
  </svg>`;
}

// ---------- Hero: dot-matrix highlands at dusk ----------
function noise(x, y) {
  const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return s - Math.floor(s);
}
function mix(a, b, t) { return a.map((v, i) => Math.round(v + (b[i] - v) * t)); }

export function drawHighlands(canvas) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = canvas.clientWidth, h = canvas.clientHeight;
  canvas.width = w * dpr; canvas.height = h * dpr;
  const g = canvas.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, w, h);

  const horizon = h * 0.72;
  const stops = [[0, [79, 163, 236]], [0.45, [139, 92, 246]], [1, [240, 127, 227]]];
  const colourAt = t => {
    for (let i = 1; i < stops.length; i++) {
      if (t <= stops[i][0]) {
        const [t0, c0] = stops[i - 1], [t1, c1] = stops[i];
        return mix(c0, c1, (t - t0) / (t1 - t0));
      }
    }
    return stops[stops.length - 1][1];
  };

  // Dithered sky: dot size carries the gradient, like a riso print.
  const step = 5;
  for (let y = 0; y < horizon; y += step) {
    const t = y / horizon;
    const [r, gg, b] = colourAt(t);
    g.fillStyle = `rgb(${r},${gg},${b})`;
    for (let x = 0; x < w; x += step) {
      const n = noise(x, y);
      const rad = step * 0.5 * (0.45 + 0.55 * n) * (0.55 + 0.45 * Math.sin(t * Math.PI));
      if (rad < 0.6) continue;
      g.beginPath(); g.arc(x + step / 2, y + step / 2, rad, 0, Math.PI * 2); g.fill();
    }
  }

  // Sun, built from yellow dots.
  const sx = w * 0.72, sy = horizon * 0.42, sr = Math.min(w, h) * 0.16;
  g.fillStyle = PALETTE.sun;
  for (let y = sy - sr; y < sy + sr; y += 4) {
    for (let x = sx - sr; x < sx + sr; x += 4) {
      if (Math.hypot(x - sx, y - sy) < sr && noise(x, y) > 0.12) {
        g.beginPath(); g.arc(x, y, 1.8, 0, Math.PI * 2); g.fill();
      }
    }
  }

  // Ridges: far (dusk ink) and near (ink), each with a speckled riso texture.
  const ridge = (base, amps, colour, speckle) => {
    g.fillStyle = colour;
    g.beginPath(); g.moveTo(0, h);
    for (let x = 0; x <= w; x += 4) {
      let y = base;
      amps.forEach(([a, f, p]) => { y += a * Math.sin(x * f + p); });
      g.lineTo(x, y);
    }
    g.lineTo(w, h); g.closePath(); g.fill();
    g.fillStyle = speckle;
    for (let i = 0; i < w * 0.6; i++) {
      const x = noise(i, base) * w, y = base + noise(base, i) * (h - base);
      g.fillRect(x, y, 1.4, 1.4);
    }
  };
  ridge(horizon - 28, [[16, 0.012, 1.2], [9, 0.031, 0.3], [4, 0.09, 2]], '#6A4FD8', 'rgba(240,127,227,.45)');
  ridge(horizon + 4, [[12, 0.018, 3.1], [6, 0.05, 1.1], [2, 0.14, 0.5]], '#2C2A6B', 'rgba(255,255,255,.16)');

  // Terraces: rows of coffee bushes as dots on the slope below the ridges.
  const terraceTop = horizon + 30;
  g.fillStyle = '#CFEA4A';
  g.fillRect(0, terraceTop, w, h - terraceTop);
  const rows = Math.max(4, Math.round((h - terraceTop) / 8));
  for (let k = 0; k < rows; k++) {
    const y0 = terraceTop + 5 + k * ((h - terraceTop) / rows);
    g.fillStyle = k % 2 ? PALETTE.leaf : '#2E9A57';
    for (let x = 2 + (k % 2) * 3; x <= w; x += 6) {
      const y = y0 + 3 * Math.sin(x * 0.02 + k) + 2 * Math.sin(x * 0.055 + k * 2);
      g.beginPath(); g.arc(x, y, 1.9, 0, Math.PI * 2); g.fill();
    }
  }

  // A few coloured "stars": the scattered dot clusters from the reference prints.
  [[0.12, 0.18, PALETTE.sun], [0.2, 0.3, PALETTE.sky], [0.4, 0.12, PALETTE.leaf],
   [0.88, 0.2, PALETTE.sky], [0.55, 0.28, '#ffffff'], [0.3, 0.52, PALETTE.sun]].forEach(([fx, fy, c]) => {
    g.fillStyle = c;
    g.beginPath(); g.arc(fx * w, fy * horizon, 3.2, 0, Math.PI * 2); g.fill();
  });
}

// ---------- Noor's voice waveform: layered, translucent, unique per answer ----------
export class VoiceWave {
  constructor(canvas, seed) {
    this.canvas = canvas;
    const r = seeded(seed + ':wave');
    const n = 96;
    this.layers = [
      { colour: 'rgba(79,163,236,.60)', amp: [] },
      { colour: 'rgba(139,92,246,.70)', amp: [] },
      { colour: 'rgba(242,88,44,.70)', amp: [] },
      { colour: 'rgba(240,127,227,.60)', amp: [] }
    ];
    // Syllable-like bumps so it reads as speech, not noise.
    let env = 0.2;
    const base = [];
    for (let i = 0; i < n; i++) {
      if (r() < 0.12) env = 0.15 + r() * 0.85;
      env *= 0.96;
      base.push(Math.max(0.05, env));
    }
    this.layers.forEach((l, k) => {
      l.amp = base.map(v => Math.min(1, v * (0.55 + r() * 0.7) * (1 - k * 0.08)));
    });
    this.progress = 0;
    this.draw();
  }
  draw() {
    const c = this.canvas;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = c.clientWidth, h = c.clientHeight;
    if (!w) return;
    c.width = w * dpr; c.height = h * dpr;
    const g = c.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    const mid = h / 2;
    const n = this.layers[0].amp.length;
    const bw = w / n;
    this.layers.forEach(l => {
      for (let i = 0; i < n; i++) {
        const played = i / n <= this.progress;
        g.globalAlpha = played ? 1 : 0.32;
        g.fillStyle = l.colour;
        const a = l.amp[i] * (mid - 2);
        g.fillRect(i * bw, mid - a, Math.max(1, bw * 0.7), a * 2);
      }
    });
    g.globalAlpha = 1;
    g.fillStyle = 'rgba(255,255,255,.75)';
    g.fillRect(0, mid - 1, w, 2);
    if (this.progress > 0 && this.progress < 1) g.fillRect(this.progress * w - 1.5, 0, 3, h);
  }
  set(p) { this.progress = p; this.draw(); }
}

// ---------- Match-strength orb: a soft breathing gradient ----------
// A strong match is vivid and bright; a weak one fades towards grey.
export function orbStyle(score) {
  const s = Math.max(0, Math.min(1, score));
  const pct = Math.round(25 + s * 75); // how much colour survives
  const c = hex => `color-mix(in oklab, ${hex} ${pct}%, #C9CCCE)`;
  return `radial-gradient(circle at 32% 28%, rgba(255,255,255,.95) 0 6%, rgba(255,255,255,0) 42%),
    radial-gradient(circle at 70% 75%, ${c(PALETTE.rose)} 0, transparent 55%),
    conic-gradient(from 210deg, ${c(PALETTE.sky)}, ${c(PALETTE.dusk)}, ${c(PALETTE.rose)}, ${c('#FF9A6B')}, ${c(PALETTE.sky)})`;
}
