// Перенос прогресса между устройствами без сервера: через QR-код или текстовый код.
//
// Прогресс упаковывается в компактный вид, сжимается (deflate) и кодируется
// в base64url с префиксом SHAMAN1. На втором устройстве код считывается камерой
// и объединяется с местным прогрессом: по каждому уровню остаётся лучший результат.

import { migrate } from './migrations.js';
import { SAVE_SCHEMA } from '../config.js';

export const PREFIX = 'SHAMAN1.';

// ---------------------------------------------------------------- упаковка
function compact(save) {
  const l = {};
  for (const [id, r] of Object.entries(save.levels)) {
    l[id] = [r.completed ? 1 : 0, r.stars, r.bestSaved, r.bestTimeMs == null ? -1 : Math.round(r.bestTimeMs / 100), r.bestMana == null ? -1 : r.bestMana, r.attempts, r.wins];
  }
  return { v: 1, l, u: save.unlocked, n: save.nuts, a: save.achievements, s: save.stats, c: save.createdAt };
}

function expand(o) {
  if (!o || o.v !== 1 || typeof o.l !== 'object') throw new Error('Код не похож на прогресс игры');
  const levels = {};
  for (const [id, a] of Object.entries(o.l)) {
    levels[id] = {
      completed: !!a[0], stars: a[1], bestSaved: a[2], bestTimeMs: a[3] < 0 ? null : a[3] * 100,
      bestMana: a[4] < 0 ? null : a[4], attempts: a[5], wins: a[6],
    };
  }
  return migrate({ schema: SAVE_SCHEMA, levels, unlocked: o.u || [], nuts: o.n || 0, achievements: o.a || {}, stats: o.s || {}, createdAt: o.c || Date.now() });
}

// ---------------------------------------------------------------- base64url и сжатие
function toB64url(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function fromB64url(s) {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
async function pipe(bytes, stream) {
  const res = new Response(new Blob([bytes]).stream().pipeThrough(stream));
  return new Uint8Array(await res.arrayBuffer());
}
const canZip = () => typeof CompressionStream === 'function' && typeof DecompressionStream === 'function';

export async function encodeTransfer(save) {
  const json = new TextEncoder().encode(JSON.stringify(compact(save)));
  if (canZip()) {
    try { return PREFIX + 'z' + toB64url(await pipe(json, new CompressionStream('deflate-raw'))); } catch { /* ниже — без сжатия */ }
  }
  return PREFIX + 'j' + toB64url(json);
}

export function looksLikeTransfer(text) {
  return typeof text === 'string' && text.trim().startsWith(PREFIX);
}

export async function decodeTransfer(text) {
  const t = text.trim().replace(/\s+/g, '');
  if (!t.startsWith(PREFIX)) throw new Error('Это не код прогресса «Побега Белок»');
  const kind = t[PREFIX.length];
  const bytes = fromB64url(t.slice(PREFIX.length + 1));
  let json;
  if (kind === 'z') {
    if (!canZip()) throw new Error('Браузер не умеет распаковывать код. Обнови iOS или используй файл копии');
    json = await pipe(bytes, new DecompressionStream('deflate-raw'));
  } else if (kind === 'j') json = bytes;
  else throw new Error('Неизвестный формат кода');
  return expand(JSON.parse(new TextDecoder().decode(json)));
}

// ---------------------------------------------------------------- объединение
const minN = (a, b) => (a == null ? b : b == null ? a : Math.min(a, b));

// Объединяет прогресс двух устройств: по каждому уровню — лучший результат,
// открытые уровни и награды — из обоих, счётчики — максимум из двух.
// Настройки остаются местные.
export function mergeSaves(local, other) {
  const out = JSON.parse(JSON.stringify(local));
  for (const [id, r] of Object.entries(other.levels)) {
    const m = out.levels[id];
    if (!m) { out.levels[id] = { ...r }; continue; }
    m.completed = m.completed || r.completed;
    m.stars = Math.max(m.stars, r.stars);
    m.bestSaved = Math.max(m.bestSaved, r.bestSaved);
    m.bestTimeMs = minN(m.bestTimeMs, r.bestTimeMs);
    m.bestMana = minN(m.bestMana, r.bestMana);
    m.attempts = Math.max(m.attempts, r.attempts);
    m.wins = Math.max(m.wins, r.wins);
  }
  out.unlocked = [...new Set([...out.unlocked, ...other.unlocked])];
  out.nuts = Math.max(out.nuts, other.nuts);
  for (const [id, ts] of Object.entries(other.achievements)) {
    out.achievements[id] = out.achievements[id] ? Math.min(out.achievements[id], ts) : ts;
  }
  for (const [k, v] of Object.entries(other.stats)) {
    if (typeof v === 'number') out.stats[k] = Math.max(out.stats[k] || 0, v);
    else if (v && typeof v === 'object') {
      out.stats[k] = out.stats[k] || {};
      for (const [kk, vv] of Object.entries(v)) out.stats[k][kk] = Math.max(out.stats[k][kk] || 0, vv || 0);
    }
  }
  out.createdAt = Math.min(out.createdAt || Date.now(), other.createdAt || Date.now());
  return out;
}

export function summary(save) {
  const done = Object.values(save.levels).filter((l) => l.completed).length;
  const stars = Object.values(save.levels).reduce((a, l) => a + (l.stars || 0), 0);
  return { done, stars };
}
