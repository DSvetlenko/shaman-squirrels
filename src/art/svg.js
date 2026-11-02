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

// Фон мира: небо на закате, далёкие острова, море облаков. Рисуется в DOM за канвасом.
export function backgroundSVG(theme = 'dusk') {
  const W = 400, H = 900;
  const sky = theme === 'dusk'
    ? ['#14203a', '#2f4d72', '#c98f7a', '#f2c79a', '#f7dcbc']
    : ['#14203a', '#2f4d72', '#c98f7a', '#f2c79a', '#f7dcbc'];
  let o = `<defs>
  <linearGradient id="bgsky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${sky[0]}"/><stop offset=".38" stop-color="${sky[1]}"/><stop offset=".68" stop-color="${sky[2]}"/><stop offset=".86" stop-color="${sky[3]}"/><stop offset="1" stop-color="${sky[4]}"/></linearGradient>
  <radialGradient id="bgsun" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff4d6"/><stop offset=".25" stop-color="#ffd59a" stop-opacity=".75"/><stop offset="1" stop-color="#ffb070" stop-opacity="0"/></radialGradient>
  <linearGradient id="bghaze" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f7dcbc" stop-opacity="0"/><stop offset="1" stop-color="#fbe9d6" stop-opacity=".95"/></linearGradient>
  </defs>`;
  o += `<rect width="${W}" height="${H}" fill="url(#bgsky)"/>`;
  o += `<circle cx="300" cy="600" r="190" fill="url(#bgsun)"/>`;
  o += `<g opacity=".09" fill="#fff"><path d="M300 600 L110 0 L165 0 Z"/><path d="M300 600 L262 0 L305 0 Z"/><path d="M300 600 L400 40 L400 130 Z"/></g>`;
  o += farIsland(18, 520, 70, 90, 11, '#8ea2bd');
  o += farIsland(306, 250, 58, 70, 12, '#5c7697');
  o += farIsland(188, 190, 34, 40, 13, '#4a6487');
  o += farIsland(140, 590, 110, 120, 14, '#c9a99b');
  o += cloud(90, 270, 0.8, 0.22, '#fff');
  o += cloud(330, 330, 0.7, 0.18, '#fff');
  o += `<rect x="0" y="600" width="${W}" height="${H - 600}" fill="url(#bghaze)"/>`;
  [[30, 710, 1.3], [130, 690, 1.1], [240, 718, 1.4], [360, 695, 1.2], [80, 770, 1.6], [300, 780, 1.7], [190, 830, 1.8], [20, 860, 1.5], [380, 860, 1.6]]
    .forEach(([cx, cy, s], i) => { o += cloud(cx, cy, s, 0.92, i % 2 ? '#fff7ee' : '#fdeee0'); });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice">${o}</svg>`;
}

// ---------------------------------------------------------------- новые механики
// Руна пути: светящийся знак-стрелка, смотрит вправо. 34×48.
export function arrowSVG() {
  const body = `<defs><radialGradient id="rg" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#7fe3ff" stop-opacity=".55"/><stop offset="1" stop-color="#7fe3ff" stop-opacity="0"/></radialGradient></defs>
  <ellipse cx="17" cy="24" rx="17" ry="23" fill="url(#rg)"/>
  <path d="M7 6 L7 42" stroke="#163042" stroke-width="5" stroke-linecap="round"/>
  <path d="M7 6 L7 42" stroke="#9fe9ff" stroke-width="2.4" stroke-linecap="round"/>
  <path d="M7 13 L24 13 L30 20 L24 27 L7 27 Z" fill="#1d4a63" stroke="#163042" stroke-width="2" stroke-linejoin="round"/>
  <path d="M10 16 L23 16 L27 20 L23 24 L10 24 Z" fill="#7fe3ff"/>
  <path d="M12 20 L22 20" stroke="#e8fbff" stroke-width="1.6" stroke-linecap="round"/>
  <circle cx="7" cy="42" r="2.6" fill="#9fe9ff"/>`;
  return svgDoc(34, 48, body);
}

export function bubbleSVG() {
  const body = `<defs><radialGradient id="bb" cx=".38" cy=".34" r=".7"><stop offset="0" stop-color="#ffffff" stop-opacity=".55"/><stop offset=".55" stop-color="#b9f2ff" stop-opacity=".18"/><stop offset="1" stop-color="#7fd8ff" stop-opacity=".5"/></radialGradient></defs>
  <circle cx="22" cy="22" r="19.5" fill="url(#bb)" stroke="#c9f6ff" stroke-width="1.6" opacity=".95"/>
  <path d="M10 15 Q13 9 20 8" stroke="#fff" stroke-width="2.4" fill="none" stroke-linecap="round" opacity=".9"/>
  <circle cx="30" cy="31" r="2" fill="#fff" opacity=".6"/>`;
  return svgDoc(44, 44, body);
}

export function portalSVG(color = '#b18cff') {
  const body = `<defs><radialGradient id="pg" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#140c24"/><stop offset=".6" stop-color="${color}" stop-opacity=".55"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></radialGradient></defs>
  <ellipse cx="22" cy="26" rx="21" ry="25" fill="url(#pg)"/>
  <ellipse cx="22" cy="26" rx="14" ry="20" fill="#0d0818" stroke="${color}" stroke-width="3"/>
  <ellipse cx="22" cy="26" rx="9" ry="14" fill="none" stroke="${color}" stroke-width="1.4" opacity=".7" stroke-dasharray="4 5"/>
  <ellipse cx="22" cy="26" rx="14" ry="20" fill="none" stroke="#fff" stroke-width="1" opacity=".5"/>`;
  return svgDoc(44, 52, body);
}

// Хрупкий мост: каменные плиты на старых верёвках. Высота 16, верх по y=2.
export function fragileSVG(w, seed = 1) {
  const r = rng(seed * 7 + 3);
  const n = Math.max(2, Math.round(w / 26));
  const step = w / n;
  let o = '';
  for (let i = 0; i < n; i++) {
    const x0 = f1(i * step + 1), ww = f1(step - 2);
    const tone = ['#9a8f84', '#8a8075', '#a69b8f'][i % 3];
    o += `<rect x="${x0}" y="2" width="${ww}" height="12" rx="2.5" fill="${tone}" stroke="${OUTLINE}" stroke-width="1.6"/>`;
    o += `<path d="M${f1(i * step + step * uni(r, .3, .6))} 3 l${f1(uni(r, -4, 4))} 5 l${f1(uni(r, -3, 3))} 5" stroke="#4a3f36" stroke-width="1.2" fill="none"/>`;
    o += `<rect x="${f1(i * step + 3)}" y="3.5" width="${f1(step - 8)}" height="2" rx="1" fill="#fff" opacity=".22"/>`;
  }
  o += `<path d="M0 8 L${w} 8" stroke="#6b4a2c" stroke-width="1.4" opacity=".7" stroke-dasharray="2 3"/>`;
  return svgDoc(Math.ceil(w), 16, o);
}

// Ворота: решётка из брёвен. w×h.
export function gateSVG(w, h) {
  let o = `<rect x="1" y="1" width="${w - 2}" height="${h - 2}" rx="3" fill="#2b1d14" stroke="${OUTLINE}" stroke-width="2"/>`;
  const bars = Math.max(2, Math.round(w / 9));
  for (let i = 0; i < bars; i++) {
    const x = f1(3 + (i + 0.5) * (w - 6) / bars);
    o += `<rect x="${f1(x - 2.6)}" y="3" width="5.2" height="${h - 6}" rx="2.6" fill="url(#wood)" stroke="${OUTLINE}" stroke-width="1.2"/>`;
  }
  for (const yy of [h * 0.22, h * 0.72]) o += `<rect x="2" y="${f1(yy)}" width="${w - 4}" height="6" rx="2" fill="#7e4f2b" stroke="${OUTLINE}" stroke-width="1.2"/>`;
  o += `<circle cx="${w / 2}" cy="${f1(h * 0.22 + 3)}" r="2" fill="#d9c27a"/><circle cx="${w / 2}" cy="${f1(h * 0.72 + 3)}" r="2" fill="#d9c27a"/>`;
  return svgDoc(w, h, o, DEFS.wood);
}

// Нажимная плита. 44×12, верх по y=2.
export function plateSVG(on = false) {
  const col = on ? '#ffd27a' : '#c9a24a';
  const body = `<rect x="1" y="5" width="42" height="7" rx="2" fill="#4c4943" stroke="${OUTLINE}" stroke-width="1.4"/>
  <rect x="5" y="${on ? 5 : 1.5}" width="34" height="${on ? 4 : 6}" rx="2" fill="${col}" stroke="${OUTLINE}" stroke-width="1.4"/>
  <path d="M15 ${on ? 7 : 4.5} h14" stroke="#fff6d8" stroke-width="1.2" opacity=".8"/>`;
  return svgDoc(44, 12, body);
}

export function rockSVG() {
  const body = `<path d="M5 14 L8 6 L16 3 L24 7 L27 15 L22 24 L12 26 L5 21 Z" fill="#7d746c" stroke="${OUTLINE}" stroke-width="1.8" stroke-linejoin="round"/>
  <path d="M9 9 L15 6 L20 8" stroke="#b7aea4" stroke-width="2" fill="none" stroke-linecap="round"/>
  <path d="M14 18 l5 -3 M10 15 l2 4" stroke="#4f4842" stroke-width="1.3" fill="none"/>`;
  return svgDoc(30, 30, body);
}

// Тяжёлая шишка вместо ореха.
export function coneSVG() {
  let o = `<ellipse cx="9" cy="12" rx="7" ry="9" fill="#8a5a33" stroke="${OUTLINE}" stroke-width="1.4"/>`;
  for (let i = 0; i < 4; i++) o += `<path d="M3 ${6 + i * 4} Q9 ${9 + i * 4} 15 ${6 + i * 4}" stroke="#4d2f1b" stroke-width="1.2" fill="none"/>`;
  o += `<path d="M9 3 L9 0" stroke="#3d6b2c" stroke-width="2" stroke-linecap="round"/>`;
  return svgDoc(18, 22, o);
}
