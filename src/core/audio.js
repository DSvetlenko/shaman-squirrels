// Звук игры на Web Audio: эффекты и фоновая музыка с отдельной громкостью.
//
// Особенности iPhone:
// - звук можно включить только внутри касания (touchend/click), поэтому
//   контекст создаётся и «будится» в обработчике первого касания;
// - по умолчанию Safari глушит Web Audio переключателем «Бесшумно».
//   Через Audio Session API (iOS 16.4+) игра может звучать и в этом режиме —
//   это настраивается в «Настройках».

const SFX = ['click', 'select', 'back', 'place', 'pin', 'creak', 'crate', 'boing', 'release', 'saved', 'nut', 'lost',
  'denied', 'win', 'lose', 'star', 'hop', 'pop', 'tick', 'open'];
const VOL = {
  click: 0.45, select: 0.55, back: 0.5, place: 0.8, pin: 0.55, crate: 0.75, boing: 0.45, release: 0.45, saved: 0.7,
  nut: 0.4, lost: 0.5, denied: 0.5, win: 0.75, lose: 0.6, star: 0.6, creak: 0.35, hop: 0.16, pop: 0.3, tick: 0.35, open: 0.35,
};
const MIN_GAP = { hop: 90, pop: 60, tick: 40 };

let ctx = null, master = null, sfxBus = null, musicBus = null, meter = null;
const buffers = new Map();
const music = { meta: null, buffers: new Map(), current: null, wanted: null };
const lastPlay = new Map();
const state = { sfx: true, music: true, sfxVol: 0.8, musicVol: 0.55, ignoreSilent: true, duck: false };
let loading = null;

function applyAudioSession() {
  try {
    if (navigator.audioSession) navigator.audioSession.type = state.ignoreSilent ? 'playback' : 'ambient';
  } catch { /* не поддерживается */ }
}

function ensureCtx() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    applyAudioSession();
    ctx = new AC({ latencyHint: 'interactive' });
    master = ctx.createGain();
    master.connect(ctx.destination);
    meter = ctx.createAnalyser();      // уровень сигнала — для автотестов
    meter.fftSize = 2048;
    master.connect(meter);
    sfxBus = ctx.createGain();
    musicBus = ctx.createGain();
    sfxBus.connect(master);
    musicBus.connect(master);
    applyVolumes(true);
  }
  return ctx;
}

// Вызывать из обработчика касания. Повторные вызовы безопасны.
export function unlockAudio() {
  const c = ensureCtx();
  if (!c) return;
  if (c.state !== 'running') c.resume().catch(() => {});
  // Короткий пустой звук окончательно «будит» вывод в Safari.
  try {
    const b = c.createBuffer(1, 1, 22050);
    const s = c.createBufferSource();
    s.buffer = b; s.connect(c.destination); s.start(0);
  } catch { /* */ }
  if (!loading) loading = loadAll();
}

async function fetchDecode(url) {
  const res = await fetch(url);
  const arr = await res.arrayBuffer();
  return new Promise((ok, fail) => ctx.decodeAudioData(arr, ok, fail));
}

async function loadAll() {
  await Promise.all(SFX.map(async (n) => {
    try { buffers.set(n, await fetchDecode(`assets/audio/${n}.mp3`)); } catch { /* звук необязателен */ }
  }));
  try { music.meta = await (await fetch('assets/audio/music.json')).json(); } catch { music.meta = {}; }
  // Музыку грузим после эффектов — она тяжелее.
  for (const name of ['menu', 'game']) {
    try { music.buffers.set(name, await fetchDecode(`assets/audio/music-${name}.mp3`)); } catch { /* */ }
    if (music.wanted === name) startMusic(name);
  }
}

function applyVolumes(instant = false) {
  if (!ctx) return;
  const t = ctx.currentTime;
  const sv = state.sfx ? state.sfxVol : 0;
  const mv = state.music ? state.musicVol * (state.duck ? 0.35 : 1) : 0;
  const set = (g, v) => {
    g.gain.cancelScheduledValues(t);
    if (instant) g.gain.setValueAtTime(v, t);
    else { g.gain.setValueAtTime(g.gain.value, t); g.gain.linearRampToValueAtTime(v, t + 0.25); }
  };
  set(sfxBus, sv * sv);       // квадрат — громкость на слух ровнее
  set(musicBus, mv * mv * 0.9);
}

export function configureAudio(settings) {
  state.sfx = settings.sound !== false;
  state.music = settings.music !== false;
  state.sfxVol = settings.sfxVolume ?? 0.8;
  state.musicVol = settings.musicVolume ?? 0.55;
  const silentChanged = state.ignoreSilent !== (settings.ignoreSilent !== false);
  state.ignoreSilent = settings.ignoreSilent !== false;
  if (silentChanged) applyAudioSession();
  applyVolumes();
}

export function duckMusic(on) {
  state.duck = !!on;
  applyVolumes();
}

export function play(name, opts = {}) {
  if (!ctx || !state.sfx || state.sfxVol <= 0 || !buffers.has(name)) return;
  const now = performance.now();
  if (now - (lastPlay.get(name) || 0) < (MIN_GAP[name] || 35)) return;
  lastPlay.set(name, now);
  const src = ctx.createBufferSource();
  src.buffer = buffers.get(name);
  if (opts.rate) src.playbackRate.value = opts.rate;
  const g = ctx.createGain();
  g.gain.value = (VOL[name] ?? 0.6) * (opts.vol ?? 1);
  src.connect(g).connect(sfxBus);
  src.start();
}

// ---------------------------------------------------------------- музыка
function startMusic(name) {
  const buf = music.buffers.get(name);
  if (!buf || !ctx) return;
  if (music.current && music.current.name === name) return;
  stopCurrent();
  const src = ctx.createBufferSource();
  src.buffer = buf;
  // MP3 может добавить тишину в начале — пропускаем её и зацикливаем точный отрезок.
  const data = buf.getChannelData(0);
  let lead = 0;
  while (lead < Math.min(data.length, 8192) && Math.abs(data[lead]) < 1e-5) lead++;
  const len = (music.meta && music.meta[name]) || (buf.duration - 0.5);
  src.loop = true;
  src.loopStart = lead / buf.sampleRate;
  src.loopEnd = Math.min(buf.duration, src.loopStart + len);
  const g = ctx.createGain();
  const t = ctx.currentTime;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(1, t + 1.6);
  src.connect(g).connect(musicBus);
  src.start(t, src.loopStart);
  music.current = { name, src, g };
}

function stopCurrent() {
  const c = music.current;
  if (!c) return;
  const t = ctx.currentTime;
  c.g.gain.cancelScheduledValues(t);
  c.g.gain.setValueAtTime(c.g.gain.value, t);
  c.g.gain.linearRampToValueAtTime(0, t + 1.0);
  c.src.stop(t + 1.05);
  music.current = null;
}

// Какой трек должен играть: 'menu', 'game' или null.
export function setMusic(name) {
  music.wanted = name;
  if (!ctx) return;
  if (!name) { stopCurrent(); return; }
  startMusic(name);
}

export function suspendAudio() { if (ctx && ctx.state === 'running') ctx.suspend().catch(() => {}); }
export function resumeAudio() { if (ctx && ctx.state !== 'running') ctx.resume().catch(() => {}); }
export function audioState() {
  let level = 0;
  if (meter) {
    const a = new Float32Array(meter.fftSize);
    meter.getFloatTimeDomainData(a);
    level = Math.sqrt(a.reduce((x, v) => x + v * v, 0) / a.length);
  }
  return { ctx: ctx ? ctx.state : 'none', sfx: buffers.size, music: [...music.buffers.keys()], current: music.current && music.current.name, level: +level.toFixed(4) };
}
