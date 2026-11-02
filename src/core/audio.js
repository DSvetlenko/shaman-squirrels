// Звуки через Web Audio. На iOS звук включается после первого касания.
const NAMES = ['click', 'select', 'back', 'place', 'pin', 'creak', 'crate', 'boing', 'release', 'saved', 'nut', 'lost', 'denied', 'win', 'lose', 'star'];
const VOL = { click: 0.5, select: 0.5, back: 0.5, place: 0.8, pin: 0.6, crate: 0.8, boing: 0.45, release: 0.4, saved: 0.7, nut: 0.35, lost: 0.5, denied: 0.5, win: 0.7, lose: 0.6, star: 0.6, creak: 0.4 };

let ctx = null;
let enabled = true;
const buffers = new Map();
let loading = null;
const lastPlay = new Map();

function ensureCtx() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

export function unlockAudio() {
  const c = ensureCtx();
  if (!c) return;
  // Пустой буфер «будит» звук в Safari.
  const b = c.createBuffer(1, 1, 22050);
  const s = c.createBufferSource();
  s.buffer = b; s.connect(c.destination); s.start(0);
  if (!loading) loading = loadAll();
}

async function loadAll() {
  const c = ensureCtx();
  if (!c) return;
  await Promise.all(NAMES.map(async (n) => {
    try {
      const res = await fetch(`assets/audio/${n}.mp3`);
      const arr = await res.arrayBuffer();
      const buf = await new Promise((ok, fail) => c.decodeAudioData(arr, ok, fail));
      buffers.set(n, buf);
    } catch { /* звук необязателен */ }
  }));
}

export function setSoundEnabled(v) { enabled = !!v; }

export function play(name) {
  if (!enabled) return;
  const c = ctx;
  if (!c || !buffers.has(name)) return;
  const now = performance.now();
  if (now - (lastPlay.get(name) || 0) < 45) return;
  lastPlay.set(name, now);
  const src = c.createBufferSource();
  src.buffer = buffers.get(name);
  const g = c.createGain();
  g.gain.value = VOL[name] ?? 0.6;
  src.connect(g).connect(c.destination);
  src.start();
}

export function suspendAudio() { if (ctx && ctx.state === 'running') ctx.suspend().catch(() => {}); }
export function resumeAudio() { if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {}); }
