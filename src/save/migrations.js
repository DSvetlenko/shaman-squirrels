// Миграции формата сохранений. Каждая функция переводит данные
// со схемы N на N+1. Добавляя поле в будущем, увеличь SAVE_SCHEMA
// в config.js и допиши функцию сюда — старые сохранения не потеряются.

import { SAVE_SCHEMA, GAME_VERSION } from '../config.js';

export function defaultSettings() {
  return { sound: true, hints: true, haptics: true, speed2x: false };
}

export function defaultStats() {
  return {
    squirrelsSaved: 0, squirrelsLost: 0, nutsCarried: 0,
    itemsPlaced: { plank: 0, longPlank: 0, crate: 0, trampoline: 0 },
    manaSpent: 0, levelsWon: 0, levelsLost: 0, restarts: 0,
    playTimeMs: 0, sessions: 0, perfectRuns: 0,
  };
}

export function defaultSave() {
  const now = Date.now();
  return {
    schema: SAVE_SCHEMA,
    gameVersion: GAME_VERSION,
    createdAt: now,
    updatedAt: now,
    levels: {},
    unlocked: [],
    nuts: 0,
    achievements: {},
    stats: defaultStats(),
    settings: defaultSettings(),
    lastLevel: null,
  };
}

// v1 — ранний формат (прототип): плоские списки пройденных уровней и звёзд.
// { version: 1, completed: ['w1-01'], stars: { 'w1-01': 2 }, sound: true }
function v1to2(old) {
  const s = defaultSave();
  s.createdAt = old.createdAt || Date.now();
  for (const id of old.completed || []) {
    s.levels[id] = {
      completed: true, stars: (old.stars && old.stars[id]) || 1, bestSaved: 0,
      bestTimeMs: null, bestMana: null, attempts: 1, wins: 1,
    };
    if (!s.unlocked.includes(id)) s.unlocked.push(id);
  }
  if (typeof old.sound === 'boolean') s.settings.sound = old.sound;
  return s;
}

const STEPS = { 1: v1to2 };

function schemaOf(d) {
  if (!d || typeof d !== 'object') return 0;
  if (typeof d.schema === 'number') return d.schema;
  if (typeof d.version === 'number') return d.version;
  return 0;
}

// Приводит любое известное сохранение к текущей схеме и заполняет
// недостающие поля значениями по умолчанию.
export function migrate(data) {
  let d = data;
  let v = schemaOf(d);
  if (v === 0) throw new Error('Неизвестный формат сохранения');
  if (v > SAVE_SCHEMA) throw new Error('Сохранение из более новой версии игры');
  while (v < SAVE_SCHEMA) {
    const step = STEPS[v];
    if (!step) throw new Error('Нет миграции со схемы ' + v);
    d = step(d);
    v = schemaOf(d);
  }
  return normalize(d);
}

function normalize(d) {
  const base = defaultSave();
  const out = { ...base, ...d };
  out.schema = SAVE_SCHEMA;
  out.levels = (d.levels && typeof d.levels === 'object') ? d.levels : {};
  for (const id of Object.keys(out.levels)) {
    const l = out.levels[id] || {};
    out.levels[id] = {
      completed: !!l.completed, stars: clampInt(l.stars, 0, 3), bestSaved: clampInt(l.bestSaved, 0, 999),
      bestTimeMs: Number.isFinite(l.bestTimeMs) ? l.bestTimeMs : null,
      bestMana: Number.isFinite(l.bestMana) ? l.bestMana : null,
      attempts: clampInt(l.attempts, 0, 1e7), wins: clampInt(l.wins, 0, 1e7),
    };
  }
  out.unlocked = Array.isArray(d.unlocked) ? [...new Set(d.unlocked.filter((x) => typeof x === 'string'))] : [];
  out.nuts = clampInt(d.nuts, 0, 1e9);
  out.achievements = (d.achievements && typeof d.achievements === 'object') ? d.achievements : {};
  out.stats = { ...defaultStats(), ...(d.stats || {}) };
  out.stats.itemsPlaced = { ...defaultStats().itemsPlaced, ...((d.stats && d.stats.itemsPlaced) || {}) };
  out.settings = { ...defaultSettings(), ...(d.settings || {}) };
  return out;
}

function clampInt(v, a, b) {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.max(a, Math.min(b, n)) : a;
}
