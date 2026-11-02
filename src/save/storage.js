// Локальное хранение прогресса.
//
// Основное хранилище — IndexedDB (запись «save»). Перед каждой записью
// предыдущая удачная копия переносится в «save_prev» — резерв на случай
// повреждения. Дополнительно копия пишется в localStorage. При загрузке
// берётся первая целая копия: IDB → резерв IDB → localStorage.
// Каждая копия хранится в обёртке с контрольной суммой.
//
// Кэш service worker сохранений не касается, поэтому обновление игры
// через GitHub Pages прогресс не трогает.

import { SAVE_SCHEMA, GAME_VERSION } from '../config.js';
import { defaultSave, migrate } from './migrations.js';

const DB_NAME = 'shaman-squirrels';
const STORE = 'kv';
const KEY_MAIN = 'save';
const KEY_PREV = 'save_prev';
const LS_MAIN = 'shaman-squirrels.save';
const LS_PREV = 'shaman-squirrels.save.prev';

function hash(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16);
}

function wrap(data) {
  const json = JSON.stringify(data);
  return { format: 'shaman-squirrels-save', schema: SAVE_SCHEMA, savedAt: Date.now(), sum: hash(json), json };
}

function unwrap(w) {
  if (!w || typeof w !== 'object' || typeof w.json !== 'string') return null;
  if (hash(w.json) !== w.sum) return null;
  try { return migrate(JSON.parse(w.json)); } catch { return null; }
}

// ---------------------------------------------------------------- IndexedDB
let dbPromise = null;
function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (!('indexedDB' in self)) return reject(new Error('no idb'));
    let req;
    try { req = indexedDB.open(DB_NAME, 1); } catch (e) { return reject(e); }
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => db.close();
      resolve(db);
    };
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('idb blocked'));
  }).catch((e) => { dbPromise = null; throw e; });
  return dbPromise;
}

async function idbGet(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const r = tx.objectStore(STORE).get(key);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

async function idbPutMany(entries) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const st = tx.objectStore(STORE);
    for (const [k, v] of entries) st.put(v, k);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

async function idbClear() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function lsGet(k) {
  try { const s = localStorage.getItem(k); return s ? JSON.parse(s) : null; } catch { return null; }
}
function lsSet(k, v) {
  try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; }
}

// ---------------------------------------------------------------- API
export const storageInfo = { idb: false, source: 'new', persisted: false, lastError: null };

export async function loadSave() {
  const candidates = [];
  try {
    candidates.push(['idb', await idbGet(KEY_MAIN)]);
    candidates.push(['idb-prev', await idbGet(KEY_PREV)]);
    storageInfo.idb = true;
  } catch (e) {
    storageInfo.lastError = String(e && e.message || e);
  }
  candidates.push(['ls', lsGet(LS_MAIN)]);
  candidates.push(['ls-prev', lsGet(LS_PREV)]);

  // Самая свежая целая копия.
  let best = null;
  for (const [src, w] of candidates) {
    const d = unwrap(w);
    if (d && (!best || (w.savedAt || 0) > best.at)) best = { d, src, at: w.savedAt || 0 };
  }
  if (best) {
    storageInfo.source = best.src;
    return best.d;
  }
  storageInfo.source = 'new';
  return defaultSave();
}

let lastGoodWrap = null;
let writing = Promise.resolve();

export function writeSave(data) {
  data.updatedAt = Date.now();
  data.gameVersion = GAME_VERSION;
  data.schema = SAVE_SCHEMA;
  const w = wrap(data);
  const prev = lastGoodWrap;
  // Синхронная копия в localStorage: успевает записаться даже при закрытии вкладки.
  if (prev) lsSet(LS_PREV, prev);
  lsSet(LS_MAIN, w);
  writing = writing.then(async () => {
    try {
      const entries = [[KEY_MAIN, w]];
      if (prev) entries.push([KEY_PREV, prev]);
      await idbPutMany(entries);
      storageInfo.idb = true;
    } catch (e) {
      storageInfo.lastError = String(e && e.message || e);
    }
  });
  lastGoodWrap = w;
  return writing;
}

export function primeLastGood(data) {
  lastGoodWrap = wrap(data);
}

export async function requestPersistence() {
  try {
    if (navigator.storage && navigator.storage.persist) {
      storageInfo.persisted = await navigator.storage.persisted() || await navigator.storage.persist();
    }
  } catch { /* браузер может не поддерживать */ }
  return storageInfo.persisted;
}

export function exportText(data) {
  return JSON.stringify({ format: 'shaman-squirrels-export', exportedAt: new Date().toISOString(), schema: SAVE_SCHEMA, save: data }, null, 2);
}

// Принимает экспорт игры, «сырое» сохранение или обёртку из хранилища.
export function parseImport(text) {
  let obj;
  try { obj = JSON.parse(text); } catch { throw new Error('Файл не похож на JSON'); }
  if (obj && obj.format === 'shaman-squirrels-export' && obj.save) return migrate(obj.save);
  if (obj && obj.format === 'shaman-squirrels-save') {
    const d = unwrap(obj);
    if (!d) throw new Error('Сохранение повреждено');
    return d;
  }
  return migrate(obj);
}

export async function wipeSave() {
  lastGoodWrap = null;
  try { localStorage.removeItem(LS_MAIN); localStorage.removeItem(LS_PREV); } catch { /* */ }
  try { await idbClear(); } catch { /* */ }
}
