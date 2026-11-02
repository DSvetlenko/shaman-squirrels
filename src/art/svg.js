// Векторная графика игры. Все спрайты рисуются кодом в одном стиле:
// плоские заливки с мягкими градиентами и тёмный контур #26170d.
// Строки SVG затем превращаются в текстуры Phaser (см. textures.js).

export const OUTLINE = '#26170d';

export function rng(seed) {
  let a = (seed * 2654435761) >>> 0 || 1;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const uni = (r, a, b) => a + (b - a) * r();
const f1 = (n) => Math.round(n * 10) / 10;

const DEFS = {
  earth: `<linearGradient id="earth" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8b5a37"/><stop offset=".55" stop-color="#5e3a24"/><stop offset="1" stop-color="#3a2417"/></linearGradient>
  <linearGradient id="earthShade" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset=".65" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".35"/></linearGradient>`,
  grass: `<linearGradient id="grass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a6d86a"/><stop offset=".5" stop-color="#6fb44a"/><stop offset="1" stop-color="#3f7f37"/></linearGradient>`,
  wood: `<linearGradient id="wood" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d8a26a"/><stop offset=".5" stop-color="#b57a45"/><stop offset="1" stop-color="#7e4f2b"/></linearGradient>`,
  bark: `<linearGradient id="bark" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#5b3b26"/><stop offset=".45" stop-color="#8a5d3b"/><stop offset="1" stop-color="#3f281a"/></linearGradient>`,
  metal: `<radialGradient id="metal" cx=".35" cy=".35" r=".7"><stop offset="0" stop-color="#f4f1ea"/><stop offset=".5" stop-color="#a7a39b"/><stop offset="1" stop-color="#4c4943"/></radialGradient>`,
  hollow: `<radialGradient id="hollow" cx=".5" cy=".45" r=".55"><stop offset="0" stop-color="#0b0604"/><stop offset=".75" stop-color="#1f120a"/><stop offset="1" stop-color="#3a2416"/></radialGradient>`,
  glow: `<radialGradient id="nutGlow" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ffd27a" stop-opacity=".7"/><stop offset="1" stop-color="#ffd27a" stop-opacity="0"/></radialGradient>`,
};

function svgDoc(w, h, body, defs = '') {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs>${defs}</defs>${body}</svg>`;
}

// ---------------------------------------------------------------- белка
// Два кадра бега, вид сбоку, смотрит вправо. viewBox 64×56.
const SQ_A = `
<g stroke="${OUTLINE}" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round">
  <path d="M26 42 C11 45 1 35 3 22 C5 9 17 1 28 6 C37 10 35 22 26 22 C20 22 19 15 23 14 C17 13 12 19 14 27 C16 34 24 36 31 38 Z" fill="#b8541f"/>
  <path d="M8 24 C8 14 16 8 24 10" fill="none" stroke="#e99a5e" stroke-width="2.2" opacity=".85"/>
  <ellipse cx="31" cy="47" rx="8" ry="4.5" fill="#b8541f" transform="rotate(-20 31 47)"/>
  <path d="M25 41 C24 31 32 25 42 27 C50 29 53 36 51 42 C49 48 39 51 31 49 C27 48 25 45 25 41 Z" fill="#d8722e"/>
  <path d="M41 46 C45 47 49 45 50 41 C50 37 48 34 45 34 C43 38 42 42 41 46 Z" fill="#f2d2a6" stroke="none"/>
  <path d="M47 44 L52 51" fill="none"/>
  <circle cx="50" cy="27" r="9" fill="#d8722e"/>
  <path d="M45 20 L46 10 L52 18 Z" fill="#b8541f"/>
  <ellipse cx="57.5" cy="30.5" rx="4.6" ry="3.6" fill="#e99a5e"/>
</g>
<circle cx="61.6" cy="29.6" r="1.5" fill="${OUTLINE}"/>
<circle cx="53" cy="25" r="2.1" fill="#1a0f08"/><circle cx="53.7" cy="24.3" r=".7" fill="#fff"/>`;

const SQ_B = `
<g stroke="${OUTLINE}" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round">
  <path d="M24 40 C9 41 1 31 4 19 C7 7 19 0 29 6 C37 11 34 22 26 21 C20 20 20 14 24 13 C18 12 13 17 14 25 C15 32 23 35 30 37 Z" fill="#b8541f"/>
  <path d="M9 21 C10 12 17 7 25 9" fill="none" stroke="#e99a5e" stroke-width="2.2" opacity=".85"/>
  <path d="M28 44 L18 50" fill="none" stroke-width="4" stroke="${OUTLINE}"/>
  <path d="M28 44 L18 50" fill="none" stroke-width="2" stroke="#b8541f"/>
  <path d="M25 39 C25 30 33 24 43 26 C51 28 54 35 52 41 C50 47 40 49 32 47 C28 46 25 43 25 39 Z" fill="#d8722e"/>
  <path d="M42 44 C46 45 50 43 51 39 C51 35 49 33 46 33 C44 37 43 41 42 44 Z" fill="#f2d2a6" stroke="none"/>
  <path d="M48 43 L57 46" fill="none"/>
  <circle cx="51" cy="25" r="9" fill="#d8722e"/>
  <path d="M46 18 L48 8 L53 16 Z" fill="#b8541f"/>
  <ellipse cx="58.5" cy="28.5" rx="4.6" ry="3.6" fill="#e99a5e"/>
</g>
<circle cx="62.6" cy="27.6" r="1.5" fill="${OUTLINE}"/>
<circle cx="54" cy="23" r="2.1" fill="#1a0f08"/><circle cx="54.7" cy="22.3" r=".7" fill="#fff"/>`;

export function squirrelSVG(frame) {
  return svgDoc(64, 56, frame === 'B' ? SQ_B : SQ_A);
}

// ---------------------------------------------------------------- жёлудь
const NUT = `
<g stroke="${OUTLINE}" stroke-width="1.3" stroke-linejoin="round">
  <path d="M12 27 C5 25 3 19 4 13 L20 13 C21 19 19 25 12 27 Z" fill="#d79a5a"/>
  <path d="M2 12 C2 7 6 4 12 4 C18 4 22 7 22 12 C22 14 20 15 18 15 L6 15 C4 15 2 14 2 12 Z" fill="#7a4b2a"/>
  <path d="M12 4 C12 2 13 1 15 0" fill="none" stroke-linecap="round"/>
</g>
<path d="M7 17 C7 21 9 23 11 24" fill="none" stroke="#f6dcb6" stroke-width="1.6" stroke-linecap="round" opacity=".8"/>
<path d="M6 8 L8 12 M10 7 L12 12 M14 7 L16 12 M18 8 L19 11" stroke="#5a3519" stroke-width="1" opacity=".8"/>`;

export function nutSVG() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="29" viewBox="0 -1 24 29">${NUT}</svg>`;
}

// Куча орехов. Ширина 110, нижняя кромка — поверхность острова.
export function nutPileSVG() {
  const pos = [[-22, 0, 0], [-8, 0, 8], [6, 0, -6], [20, 0, 10], [-15, -11, -12], [0, -12, 4], [13, -11, -4], [-6, -22, 8]];
  const cx = 55, base = 70;
  let body = `<ellipse cx="${cx}" cy="${base - 16}" rx="52" ry="34" fill="url(#nutGlow)"/>`;
  for (const [dx, dy, rot] of pos) {
    body += `<g transform="translate(${cx + dx},${base + dy}) rotate(${rot}) translate(-8,-19) scale(.6667)">${NUT}</g>`;
  }
  return svgDoc(110, 72, body, DEFS.glow);
}

// ---------------------------------------------------------------- пень с дуплом
// Размер 120×150. Поверхность острова — y=146, центр пня x=60.
export function stumpSVG() {
  const x = 17, y = 146, w = 86, h = 118, cx = x + w / 2;
  const trunk = `M${x + 6} ${y} C${x - 8} ${y} ${x - 6} ${y - 12} ${x + 4} ${y - 16} L${x + 8} ${y - h + 10} C${x + 8} ${y - h} ${x + w - 8} ${y - h} ${x + w - 8} ${y - h + 10} L${x + w - 4} ${y - 16} C${x + w + 6} ${y - 12} ${x + w + 10} ${y} ${x + w - 6} ${y} Z`;
  let o = `<path d="${trunk}" fill="url(#bark)" stroke="${OUTLINE}" stroke-width="2" stroke-linejoin="round"/>`;
  [x + 18, x + 30, x + w - 22, x + w - 32].forEach((bx, i) => {
    o += `<path d="M${bx} ${y - h + 18} q${i % 2 ? 2 : -2} ${f1(h * 0.35)} 0 ${f1(h * 0.7)}" stroke="#2f1d12" stroke-width="1.6" fill="none" opacity=".55" stroke-linecap="round"/>`;
  });
  o += `<ellipse cx="${cx}" cy="${y - h + 10}" rx="${w / 2 - 8}" ry="9" fill="#c99566" stroke="${OUTLINE}" stroke-width="2"/>`;
  o += `<ellipse cx="${cx}" cy="${y - h + 10}" rx="${w / 2 - 18}" ry="5.5" fill="none" stroke="#9b6b42" stroke-width="1.3"/>`;
  o += `<ellipse cx="${cx}" cy="${y - h + 10}" rx="${w / 2 - 28}" ry="2.8" fill="none" stroke="#9b6b42" stroke-width="1.3"/>`;
  o += `<path d="M${x + 6} ${y - h + 14} q10 -6 22 -2 q10 -5 18 1 q-14 5 -40 1z" fill="#6aa846" stroke="${OUTLINE}" stroke-width="1.2"/>`;
  const hy = y - h * 0.5;
  o += `<ellipse cx="${cx + 2}" cy="${hy}" rx="19" ry="23" fill="url(#hollow)" stroke="${OUTLINE}" stroke-width="2"/>`;
  o += `<path d="M${cx - 17} ${hy - 6} q19 -26 38 0" stroke="#a87650" stroke-width="3" fill="none" stroke-linecap="round" opacity=".8"/>`;
  // корни у основания
  o += `<path d="M${x - 6} ${y} q6 -6 14 -4 M${x + w + 8} ${y} q-6 -6 -14 -4" stroke="${OUTLINE}" stroke-width="1.6" fill="none"/>`;
  return svgDoc(120, 150, o, DEFS.bark + DEFS.hollow);
}
export const STUMP = { w: 120, h: 150, baseY: 146, hollowY: 87 };

// ---------------------------------------------------------------- доска
export function plankSVG(len, thick = 11) {
  const pad = 3, w = len + pad * 2, h = thick + pad * 2;
  const body = `<rect x="${pad}" y="${pad}" width="${len}" height="${thick}" rx="4.5" fill="url(#wood)" stroke="${OUTLINE}" stroke-width="1.8"/>
  <path d="M${pad + 8} ${pad + 3.5} L${f1(pad + len * 0.45)} ${pad + 3.5} M${f1(pad + len * 0.55)} ${pad + thick - 3.5} L${pad + len - 10} ${pad + thick - 3.5} M${f1(pad + len * 0.2)} ${pad + thick / 2} L${f1(pad + len * 0.7)} ${pad + thick / 2}" stroke="#7e4f2b" stroke-width="1" opacity=".55"/>`;
  return svgDoc(w, h, body, DEFS.wood);
}

export function boltSVG() {
  return svgDoc(12, 12, `<circle cx="6" cy="6" r="4.4" fill="url(#metal)" stroke="${OUTLINE}" stroke-width="1.2"/><path d="M4 4 L8 8" stroke="#3a3832" stroke-width="1"/>`, DEFS.metal);
}

export function crateSVG(s = 40) {
  const p = 2, w = s + p * 2;
  const body = `<rect x="${p}" y="${p}" width="${s}" height="${s}" rx="3" fill="url(#wood)" stroke="${OUTLINE}" stroke-width="1.8"/>
  <path d="M${p + 3} ${p + 3} L${p + s - 3} ${p + s - 3} M${p + s - 3} ${p + 3} L${p + 3} ${p + s - 3}" stroke="#7e4f2b" stroke-width="3.2"/>
  <rect x="${p + 2.5}" y="${p + 2.5}" width="${s - 5}" height="${s - 5}" rx="2" fill="none" stroke="#6b4124" stroke-width="2.2" opacity=".75"/>
  <circle cx="${p + 6}" cy="${p + 6}" r="1.6" fill="#3a2417"/><circle cx="${p + s - 6}" cy="${p + 6}" r="1.6" fill="#3a2417"/>
  <circle cx="${p + 6}" cy="${p + s - 6}" r="1.6" fill="#3a2417"/><circle cx="${p + s - 6}" cy="${p + s - 6}" r="1.6" fill="#3a2417"/>`;
  return svgDoc(w, w, body, DEFS.wood);
}

// Батут: полотно сверху, ножки вниз. Размер 70×30, полотно на y≈8.
export function trampolineSVG() {
  const body = `<path d="M12 28 L19 12 M58 28 L51 12" stroke="${OUTLINE}" stroke-width="5" stroke-linecap="round"/>
  <path d="M12 28 L19 12 M58 28 L51 12" stroke="#596173" stroke-width="2.6" stroke-linecap="round"/>
  <path d="M5 9 Q35 17 65 9" stroke="${OUTLINE}" stroke-width="8" fill="none" stroke-linecap="round"/>
  <path d="M5 9 Q35 17 65 9" stroke="#49c6b8" stroke-width="4.6" fill="none" stroke-linecap="round"/>
  <path d="M10 8.6 Q35 14 60 8.6" stroke="#bff6ee" stroke-width="1.2" fill="none" opacity=".8"/>`;
  return svgDoc(70, 30, body);
}

export function spikesSVG(w) {
  const n = Math.max(2, Math.round(w / 14));
  const step = w / n;
  let d = `M0 20`;
  for (let i = 0; i < n; i++) d += ` L${f1(i * step + step / 2)} 2 L${f1((i + 1) * step)} 20`;
  const body = `<path d="${d} Z" fill="#c9ced8" stroke="${OUTLINE}" stroke-width="1.6" stroke-linejoin="round"/>
  <path d="${Array.from({ length: n }, (_, i) => `M${f1(i * step + step / 2)} 4 L${f1(i * step + step * 0.32)} 18`).join(' ')}" stroke="#fff" stroke-width="1.2" opacity=".7"/>`;
  return svgDoc(Math.ceil(w), 22, body);
}

// ---------------------------------------------------------------- парящий остров
// Возвращает svg, прямоугольник отрисовки и точки корпуса для физики.
// y — поверхность, по которой ходят белки.
export function islandArt({ x, y, w, depth, seed = 1, stone = false }) {
  const r = rng(seed);
  const top = y + 4;
  const tipX = x + w * uni(r, 0.42, 0.62);
  const ptsR = [], ptsL = [];
  const n = 6;
  for (let i = 1; i <= n; i++) {
    const t = i / (n + 1);
    const yy = top + 6 + depth * t;
    const hr = (x + w - tipX) * (1 - Math.pow(t, 1.35));
    const hl = (tipX - x) * (1 - Math.pow(t, 1.35));
    ptsR.push([tipX + hr + uni(r, -6, 3), yy + uni(r, -4, 4)]);
    ptsL.push([tipX - hl + uni(r, -3, 6), yy + uni(r, -4, 4)]);
  }
  const body = [[x + w, top + 2], ...ptsR, [tipX, top + depth], ...ptsL.reverse(), [x, top + 2]];

  const bx = x - 10, by = y - 16, bw = w + 20, bh = depth + 70;
  const tr = (p) => `${f1(p[0] - bx)} ${f1(p[1] - by)}`;
  const d = 'M' + body.map(tr).join(' L') + ' Z';
  const X = (v) => f1(v - bx), Y = (v) => f1(v - by);
  let o = `<path d="${d}" fill="url(#earth)" stroke="${OUTLINE}" stroke-width="2" stroke-linejoin="round"/><path d="${d}" fill="url(#earthShade)"/>`;
  if (stone) o += `<path d="${d}" fill="#7a7f8c" opacity=".35"/>`;
  for (let k = 0; k < 3; k++) {
    const yy = top + 20 + k * depth * 0.2 + uni(r, -3, 3);
    const span = (w * (1 - ((yy - y) / depth) * 0.95)) / 2;
    const cx = tipX + uni(r, -8, 8);
    o += `<path d="M${X(cx - span * 0.85)} ${Y(yy)} Q${X(cx)} ${Y(yy + uni(r, 4, 9))} ${X(cx + span * 0.85)} ${Y(yy - 2)}" stroke="#3a2417" stroke-width="2" fill="none" opacity=".45" stroke-linecap="round"/>`;
  }
  for (let k = 0; k < Math.floor(w / 22); k++) {
    const px = x + 12 + uni(r, 0, w - 24), py = top + 16 + uni(r, 0, depth * 0.3);
    o += `<ellipse cx="${X(px)}" cy="${Y(py)}" rx="${f1(uni(r, 3, 6))}" ry="${f1(uni(r, 2, 3.5))}" fill="#a77a55" opacity=".7"/>`;
  }
  for (let k = 0; k < Math.floor(w / 28) + 1; k++) {
    const sx = x + 10 + uni(r, 0, w - 20);
    const t = Math.min(Math.abs(sx - tipX) / (w / 2), 1);
    const sy = top + depth * (1 - Math.pow(t, 0.8)) * 0.85 + 6;
    const ln = uni(r, 18, 46);
    const col = k % 2 ? '#2f4f2a' : '#3a2417';
    o += `<path d="M${X(sx)} ${Y(sy)} q${f1(uni(r, -6, 6))} ${f1(ln / 2)} ${f1(uni(r, -4, 4))} ${f1(ln)}" stroke="${col}" stroke-width="${k % 2 ? 2 : 1.6}" fill="none" stroke-linecap="round"/>`;
    if (k % 2) o += `<circle cx="${X(sx + uni(r, -3, 3))}" cy="${Y(sy + ln * 0.6)}" r="2.4" fill="#5d9a45"/>`;
  }
  // травяная шапка: верх ровно на y
  const gy = y;
  o += `<path d="M${X(x - 4)} ${Y(gy + 9)} Q${X(x - 4)} ${Y(gy)} ${X(x + 6)} ${Y(gy)} L${X(x + w - 6)} ${Y(gy)} Q${X(x + w + 4)} ${Y(gy)} ${X(x + w + 4)} ${Y(gy + 9)} Q${X(x + w + 2)} ${Y(gy + 17)} ${X(x + w - 8)} ${Y(gy + 16)} L${X(x + 8)} ${Y(gy + 18)} Q${X(x - 2)} ${Y(gy + 17)} ${X(x - 4)} ${Y(gy + 9)} Z" fill="url(#grass)" stroke="${OUTLINE}" stroke-width="2" stroke-linejoin="round"/>`;
  let blades = '';
  for (let b = x + 2; b < x + w - 2; b += uni(r, 5, 11)) {
    const hgt = uni(r, 3, 8);
    blades += `M${X(b)} ${Y(gy + 1)} l${f1(uni(r, 1, 2.5))} ${f1(-hgt)} l${f1(uni(r, 1.5, 3))} ${f1(hgt)} `;
  }
  o += `<path d="${blades}" fill="#8cc85a" stroke="${OUTLINE}" stroke-width="1.1" stroke-linejoin="round"/>`;
  o += `<path d="M${X(x + 4)} ${Y(gy + 1)} L${X(x + w - 4)} ${Y(gy + 1)}" stroke="#d6f0a0" stroke-width="1.4" opacity=".6"/>`;

  return {
    svg: svgDoc(Math.ceil(bw), Math.ceil(bh), o, DEFS.earth + DEFS.grass),
    rect: { x: bx, y: by, w: Math.ceil(bw), h: Math.ceil(bh) },
    body,
  };
}

// ---------------------------------------------------------------- фон
function cloud(cx, cy, s, op, col) {
  const parts = [[-40, 6, 26], [-14, -8, 32], [16, -2, 28], [42, 8, 22], [0, 12, 30]];
  return `<g opacity="${op}">` + parts.map(([dx, dy, rr]) => `<circle cx="${f1(cx + dx * s)}" cy="${f1(cy + dy * s)}" r="${f1(rr * s)}" fill="${col}"/>`).join('') + '</g>';
}
function farIsland(x, y, w, depth, seed, color) {
  const a = islandArt({ x, y, w, depth, seed });
  const d = 'M' + a.body.map((p) => `${f1(p[0])} ${f1(p[1])}`).join(' L') + ' Z';
  return `<path d="${d}" fill="${color}"/><rect x="${x - 2}" y="${y - 2}" width="${w + 4}" height="9" rx="4.5" fill="${color}"/>`;
}

// Палитры миров: небо (5 точек градиента), солнце, дымка, далёкие острова.
export const THEMES = {
  dusk:  { sky: ['#14203a', '#2f4d72', '#c98f7a', '#f2c79a', '#f7dcbc'], sun: ['#fff4d6', '#ffd59a', '#ffb070'], haze: ['#f7dcbc', '#fbe9d6'], far: ['#8ea2bd', '#5c7697', '#4a6487', '#c9a99b'], cloud: ['#fff7ee', '#fdeee0'], sunY: 600 },
  grove: { sky: ['#1d3a3f', '#3f7a73', '#a9c98f', '#f2dc9a', '#f8ecc4'], sun: ['#fffbe6', '#ffe9a6', '#f6c26b'], haze: ['#f8ecc4', '#fbf3dc'], far: ['#9fb9a2', '#6f9a86', '#577f70', '#c9c39b'], cloud: ['#fffaf0', '#f6f1df'], sunY: 560 },
  winds: { sky: ['#152844', '#3f6c9c', '#9cc3e0', '#dfeaf2', '#f2f6f8'], sun: ['#ffffff', '#e6f3ff', '#b4d8f5'], haze: ['#e6eef4', '#f4f8fb'], far: ['#9db3cc', '#6d8db0', '#56769b', '#b9c7d6'], cloud: ['#ffffff', '#eef4f8'], sunY: 520 },
  mist:  { sky: ['#0f1c26', '#1f4148', '#4f7f78', '#8fb5a0', '#c4dccb'], sun: ['#eafff4', '#b9eed5', '#79c9a6'], haze: ['#bfd9c9', '#dbeee2'], far: ['#5d7f80', '#3f6264', '#30504f', '#7f9f95'], cloud: ['#e9f5ee', '#d9ebe0'], sunY: 640 },
  storm: { sky: ['#120f24', '#33295a', '#7a5a8f', '#c98f8f', '#e8c4b0'], sun: ['#ffe9f0', '#f3b6c8', '#c4789a'], haze: ['#e3c4bb', '#f0dcd2'], far: ['#7d6f9c', '#5b4f80', '#463d68', '#a88b9f'], cloud: ['#f6e9ef', '#eadbe3'], sunY: 600 },
};

// Фон мира: небо, далёкие острова, море облаков. Рисуется в DOM за канвасом.
export function backgroundSVG(theme = 'dusk') {
  const W = 400, H = 900;
  const T = THEMES[theme] || THEMES.dusk;
  const sky = T.sky;
  let o = `<defs>
  <linearGradient id="bgsky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${sky[0]}"/><stop offset=".38" stop-color="${sky[1]}"/><stop offset=".68" stop-color="${sky[2]}"/><stop offset=".86" stop-color="${sky[3]}"/><stop offset="1" stop-color="${sky[4]}"/></linearGradient>
  <radialGradient id="bgsun" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="${T.sun[0]}"/><stop offset=".25" stop-color="${T.sun[1]}" stop-opacity=".75"/><stop offset="1" stop-color="${T.sun[2]}" stop-opacity="0"/></radialGradient>
  <linearGradient id="bghaze" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${T.haze[0]}" stop-opacity="0"/><stop offset="1" stop-color="${T.haze[1]}" stop-opacity=".95"/></linearGradient>
  </defs>`;
  o += `<rect width="${W}" height="${H}" fill="url(#bgsky)"/>`;
  const sy = T.sunY;
  o += `<circle cx="300" cy="${sy}" r="190" fill="url(#bgsun)"/>`;
  o += `<g opacity=".09" fill="#fff"><path d="M300 ${sy} L110 0 L165 0 Z"/><path d="M300 ${sy} L262 0 L305 0 Z"/><path d="M300 ${sy} L400 40 L400 130 Z"/></g>`;
  o += farIsland(18, 520, 70, 90, 11, T.far[0]);
  o += farIsland(306, 250, 58, 70, 12, T.far[1]);
  o += farIsland(188, 190, 34, 40, 13, T.far[2]);
  o += farIsland(140, 590, 110, 120, 14, T.far[3]);
  o += cloud(90, 270, 0.8, 0.22, '#fff');
  o += cloud(330, 330, 0.7, 0.18, '#fff');
  o += `<rect x="0" y="600" width="${W}" height="${H - 600}" fill="url(#bghaze)"/>`;
  [[30, 710, 1.3], [130, 690, 1.1], [240, 718, 1.4], [360, 695, 1.2], [80, 770, 1.6], [300, 780, 1.7], [190, 830, 1.8], [20, 860, 1.5], [380, 860, 1.6]]
    .forEach(([cx, cy, s], i) => { o += cloud(cx, cy, s, 0.92, T.cloud[i % 2]); });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice">${o}</svg>`;
}

// ================================================================ новые объекты

// Трещины поверх доски: ветхий мост.
export function plankCrackedSVG(len, thick = 11) {
  const pad = 3, w = len + pad * 2, h = thick + pad * 2;
  const r = rng(len * 7 + 3);
  let cracks = '';
  for (let k = 0; k < Math.max(3, Math.round(len / 28)); k++) {
    const x0 = pad + 10 + uni(r, 0, len - 20);
    cracks += `M${f1(x0)} ${pad + 1} l${f1(uni(r, -3, 3))} ${f1(thick * 0.45)} l${f1(uni(r, -4, 4))} ${f1(thick * 0.5)} `;
  }
  const body = `<rect x="${pad}" y="${pad}" width="${len}" height="${thick}" rx="3" fill="url(#oldwood)" stroke="${OUTLINE}" stroke-width="1.8"/>
  <path d="${cracks}" stroke="#2c1b10" stroke-width="1.4" fill="none" stroke-linecap="round"/>
  <path d="M${pad + 6} ${pad + 3} L${f1(pad + len * 0.35)} ${pad + 3} M${f1(pad + len * 0.6)} ${pad + thick - 3} L${pad + len - 8} ${pad + thick - 3}" stroke="#4f3a2a" stroke-width="1" opacity=".6"/>`;
  return svgDoc(w, h, body, `<linearGradient id="oldwood" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a99079"/><stop offset=".55" stop-color="#7f6650"/><stop offset="1" stop-color="#574333"/></linearGradient>`);
}

// Ворота: деревянная решётка в каменных столбиках. Ширина 26, высота h+10.
export function gateSVG(h, color = '#f2a541') {
  const w = 26, H = h + 10;
  let bars = '';
  for (const x of [8, 13, 18]) bars += `<rect x="${x - 1.6}" y="6" width="3.2" height="${h - 2}" rx="1.2" fill="url(#wood)" stroke="${OUTLINE}" stroke-width="1"/>`;
  const body = `<rect x="2" y="${H - 10}" width="${w - 4}" height="9" rx="2" fill="#7a7f8c" stroke="${OUTLINE}" stroke-width="1.4"/>
  ${bars}
  <rect x="3" y="2" width="${w - 6}" height="7" rx="2.5" fill="url(#wood)" stroke="${OUTLINE}" stroke-width="1.4"/>
  ${[0.35, 0.7].map((t) => `<rect x="4" y="${f1(6 + (h - 4) * t)}" width="${w - 8}" height="4" rx="1.5" fill="#596173" stroke="${OUTLINE}" stroke-width="1"/>`).join('')}
  <circle cx="${w / 2}" cy="5.5" r="2.6" fill="${color}" stroke="${OUTLINE}" stroke-width="1"/>`;
  return svgDoc(w, H, body, DEFS.wood);
}

// Нажимная плита. Ширина w+8, высота 12. Подсветка рисуется отдельно.
export function plateSVG(w, color = '#f2a541') {
  const W = w + 8;
  const body = `<path d="M2 11 L6 4 L${W - 6} 4 L${W - 2} 11 Z" fill="#8a8f9b" stroke="${OUTLINE}" stroke-width="1.5" stroke-linejoin="round"/>
  <rect x="7" y="2" width="${W - 14}" height="4" rx="1.5" fill="#b9bec9" stroke="${OUTLINE}" stroke-width="1.2"/>
  <path d="M${W / 2 - 7} 8.5 h14" stroke="${color}" stroke-width="2" stroke-linecap="round"/>
  <rect x="${W / 2 - 3.5}" y="6.5" width="7" height="4" rx="1" fill="none" stroke="${color}" stroke-width="1.2"/>`;
  return svgDoc(W, 12, body);
}

// Колючий жук, вид сбоку, смотрит вправо. 40×28. Два кадра.
export function beetleSVG(frame = 'A') {
  const legs = frame === 'A'
    ? 'M12 21 l-4 6 M20 22 l1 6 M28 21 l4 6'
    : 'M12 21 l-1 6 M20 22 l-4 6 M28 21 l1 6';
  let spikes = '';
  for (let i = 0; i < 6; i++) {
    const a = Math.PI * (0.92 - i * 0.14);
    const cx = 19 + Math.cos(a) * 13, cy = 19 - Math.sin(a) * 12;
    const tx = 19 + Math.cos(a) * 19, ty = 19 - Math.sin(a) * 17;
    const px = Math.cos(a + Math.PI / 2) * 2.4, py = -Math.sin(a + Math.PI / 2) * 2.4;
    spikes += `<path d="M${f1(cx - px)} ${f1(cy - py)} L${f1(tx)} ${f1(ty)} L${f1(cx + px)} ${f1(cy + py)} Z"/>`;
  }
  const body = `<g stroke="${OUTLINE}" stroke-width="1.6" stroke-linecap="round">
    <path d="${legs}" fill="none"/>
    <g fill="#d9d4e6">${spikes}</g>
    <path d="M5 21 C5 10 12 5 20 5 C29 5 34 11 34 21 Z" fill="#5a3f86"/>
    <path d="M9 18 C10 11 14 8 20 8" fill="none" stroke="#8f74c4" stroke-width="2.2"/>
    <ellipse cx="35" cy="17" rx="5" ry="4.6" fill="#3b2a5a"/>
  </g>
  <circle cx="37" cy="16" r="1.6" fill="#ffd27a"/>`;
  return svgDoc(42, 30, body);
}

// Валун для камнепада. 28×28.
export function rockSVG(seed = 1) {
  const r = rng(seed * 13 + 5);
  const pts = [];
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    const rr = 11 + uni(r, -1.6, 1.4);
    pts.push(`${f1(14 + Math.cos(a) * rr)} ${f1(14 + Math.sin(a) * rr)}`);
  }
  const body = `<path d="M${pts.join(' L')} Z" fill="url(#rock)" stroke="${OUTLINE}" stroke-width="1.6" stroke-linejoin="round"/>
  <path d="M8 11 q3 -4 7 -4 M17 19 q3 0 5 -3" stroke="#c9ced8" stroke-width="1.4" fill="none" stroke-linecap="round" opacity=".7"/>
  <path d="M11 18 l3 2 M18 10 l-2 3" stroke="#3b3e47" stroke-width="1.1" opacity=".6"/>`;
  return svgDoc(28, 28, body, `<radialGradient id="rock" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#a8adb8"/><stop offset=".6" stop-color="#6f7480"/><stop offset="1" stop-color="#454954"/></radialGradient>`);
}

// Портал: светящееся кольцо. 40×60.
export function portalSVG(color = '#7fe3ff', inner = '#2d5a8c') {
  const body = `<ellipse cx="20" cy="30" rx="16" ry="26" fill="url(#pin)"/>
  <ellipse cx="20" cy="30" rx="16" ry="26" fill="none" stroke="${OUTLINE}" stroke-width="5"/>
  <ellipse cx="20" cy="30" rx="16" ry="26" fill="none" stroke="${color}" stroke-width="3"/>
  <ellipse cx="20" cy="30" rx="10" ry="18" fill="none" stroke="#ffffff" stroke-width="1.2" opacity=".55" stroke-dasharray="6 5"/>
  <path d="M20 8 l2 5 l-2 4 l-2 -4 Z M20 52 l2 -5 l-2 -4 l-2 4 Z" fill="#ffffff" opacity=".85"/>`;
  return svgDoc(40, 60, body, `<radialGradient id="pin" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ffffff" stop-opacity=".9"/><stop offset=".35" stop-color="${color}" stop-opacity=".7"/><stop offset="1" stop-color="${inner}" stop-opacity=".95"/></radialGradient>`);
}

// ---------------------------------------------------------------- белка-колдун
// Игрок: сидит в углу экрана с посохом и строит путь для племени. viewBox 100×120.
export function shamanSVG() {
  const O = OUTLINE;
  const defs = `
  <radialGradient id="sg" cx="50%" cy="50%" r="50%">
    <stop offset="0" stop-color="#fff6c9"/><stop offset=".35" stop-color="#ffd36b" stop-opacity=".9"/>
    <stop offset="1" stop-color="#ffb347" stop-opacity="0"/>
  </radialGradient>
  <linearGradient id="sr" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#4a3f7a"/><stop offset="1" stop-color="#2c2550"/>
  </linearGradient>
  <linearGradient id="sh" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#5a4c92"/><stop offset="1" stop-color="#2f2858"/>
  </linearGradient>`;
  const body = `
<g stroke="${O}" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round">
  <!-- хвост -->
  <path d="M34 104 C12 106 2 90 4 70 C6 50 16 36 30 38 C42 40 42 56 33 58 C27 59 25 52 29 50 C22 50 18 60 19 72 C20 86 30 94 40 96 Z" fill="#b8541f"/>
  <path d="M10 72 C10 58 16 47 26 44" fill="none" stroke="#e99a5e" stroke-width="2.6" opacity=".85"/>
  <!-- мантия -->
  <path d="M30 108 C28 92 32 72 44 64 L66 64 C76 72 80 92 78 108 Z" fill="url(#sr)"/>
  <path d="M54 66 L54 108" fill="none" stroke="#1d1838" stroke-width="1.4"/>
  <path d="M30 108 L78 108" fill="none"/>
  <!-- лапки -->
  <ellipse cx="44" cy="109" rx="8" ry="4.2" fill="#b8541f"/>
  <ellipse cx="65" cy="109" rx="8" ry="4.2" fill="#b8541f"/>
  <!-- посох -->
  <path d="M83 112 C82 94 84 74 82 52 C81 44 84 38 88 34" fill="none" stroke="${O}" stroke-width="6"/>
  <path d="M83 112 C82 94 84 74 82 52 C81 44 84 38 88 34" fill="none" stroke="#8a5a2c" stroke-width="3.4"/>
  <path d="M88 34 C92 30 92 24 88 22 C85 21 83 24 85 26" fill="none" stroke="${O}" stroke-width="5"/>
  <path d="M88 34 C92 30 92 24 88 22 C85 21 83 24 85 26" fill="none" stroke="#8a5a2c" stroke-width="2.6"/>
</g>
<circle cx="86" cy="27" r="15" fill="url(#sg)"/>
<g stroke="${O}" stroke-width="1.5" stroke-linejoin="round">
  <path d="M86 21 L90 27 L86 33 L82 27 Z" fill="#ffe08a"/>
  <path d="M86 21 L86 33 M82 27 L90 27" stroke="#f4a94a" stroke-width=".9" fill="none"/>
</g>
<g stroke="${O}" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round">
  <!-- лапа на посохе -->
  <path d="M66 76 C72 74 78 72 82 70" fill="none" stroke="url(#sr)" stroke-width="9"/>
  <path d="M66 71.5 C72 69.5 78 67.5 81 66 M67 80.5 C73 78.5 79 76.5 83 74.5" fill="none"/>
  <circle cx="83" cy="70" r="4.6" fill="#d8722e"/>
  <!-- голова -->
  <path d="M38 50 C36 38 44 30 55 30 C66 30 73 38 71 49 C70 58 62 64 54 64 C45 64 39 58 38 50 Z" fill="#d8722e"/>
  <path d="M50 56 C52 61 60 62 64 57 C62 54 52 53 50 56 Z" fill="#f2d2a6" stroke="none"/>
  <ellipse cx="68" cy="49" rx="5.2" ry="4" fill="#e99a5e"/>
</g>
<circle cx="72.6" cy="48" r="1.7" fill="${O}"/>
<circle cx="61" cy="44" r="2.5" fill="#1a0f08"/><circle cx="61.8" cy="43.2" r=".8" fill="#fff"/>
<circle cx="49" cy="44" r="2.2" fill="#1a0f08"/><circle cx="49.7" cy="43.3" r=".7" fill="#fff"/>
<path d="M45 52 L40 51 M45 54.5 L40 55.5" stroke="${O}" stroke-width=".9" opacity=".6"/>
<!-- ожерелье: бусины и жёлудь -->
<path d="M44 64 C48 70 60 70 66 64" fill="none" stroke="#e8d3a2" stroke-width="1.2"/>
<circle cx="47" cy="67" r="1.6" fill="#7fe3ff" stroke="${O}" stroke-width=".8"/>
<circle cx="63" cy="67" r="1.6" fill="#7fe3ff" stroke="${O}" stroke-width=".8"/>
<g stroke="${O}" stroke-width=".9"><path d="M55 76 C52 75 51 72 51.5 70 L58.5 70 C59 72 58 75 55 76 Z" fill="#d79a5a"/>
<path d="M50.5 70 C50.5 68 52.5 67 55 67 C57.5 67 59.5 68 59.5 70 Z" fill="#7a4b2a"/></g>
<g stroke="${O}" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round">
  <!-- шляпа -->
  <path d="M33 37 C40 31 70 29 77 36 C72 40 40 42 33 37 Z" fill="url(#sh)"/>
  <path d="M40 35 C42 24 46 14 52 8 C56 4 62 2 66 4 C62 6 60 10 60 16 C60 24 64 30 68 34 C60 37 48 37 40 35 Z" fill="url(#sh)"/>
  <path d="M41.5 31 C50 33 60 33 66.5 30.5 L68 34 C60 37 48 37 40 35 Z" fill="#c9783a"/>
  <!-- ухо сквозь шляпу -->
  <path d="M45 30 L43 21 L51 27" fill="#b8541f"/>
</g>
<path d="M56 18 l1.2 2.6 2.8.3 -2.1 1.9 .6 2.8 -2.5-1.4 -2.5 1.4 .6-2.8 -2.1-1.9 2.8-.3 Z" fill="#ffe08a" opacity=".95"/>
<circle cx="50" cy="24" r="1" fill="#ffe08a" opacity=".8"/><circle cx="62" cy="11" r=".9" fill="#ffe08a" opacity=".8"/>
<circle cx="92" cy="12" r="1.3" fill="#fff3c0" opacity=".9"/><circle cx="74" cy="20" r="1" fill="#fff3c0" opacity=".8"/>`;
  return svgDoc(100, 120, body, defs);
}
