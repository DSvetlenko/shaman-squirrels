// Загрузка уровней из levels/levels.json.
// Порядок уровней — порядок в файле. Прогресс привязан к id уровня,
// поэтому новые уровни можно добавлять в любое место, старые сохранения не сломаются.

import { ITEMS } from '../config.js';

let cache = null;

export async function loadLevels() {
  if (cache) return cache;
  const res = await fetch('levels/levels.json', { cache: 'no-cache' }).catch(() => fetch('levels/levels.json'));
  const data = await res.json();
  const list = (data.levels || []).map(normalizeLevel);
  const ids = new Set();
  for (const l of list) {
    if (ids.has(l.id)) throw new Error('Повтор id уровня: ' + l.id);
    ids.add(l.id);
  }
  cache = { worlds: data.worlds || [], levels: list };
  return cache;
}

export function normalizeLevel(l) {
  const items = {};
  for (const k of Object.keys(ITEMS)) items[k] = (l.items && l.items[k]) || 0;
  return {
    spawnInterval: 1.15,
    timeLimit: 150,
    spikes: [],
    props: [],
    tips: [],
    ...l,
    items,
    stars: { mana: l.mana, timeSec: 999, ...(l.stars || {}) },
  };
}
