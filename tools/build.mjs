// Готовит игру к публикации: node tools/build.mjs
// Собирает список всех файлов игры и пишет service-worker.js
// с версией кэша, вычисленной по содержимому. Любое изменение
// файлов (код, уровни, графика) даёт новую версию — телефон
// скачает обновление, а сохранения останутся в IndexedDB.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const INCLUDE = ['index.html', 'manifest.json', 'css', 'src', 'levels', 'vendor/phaser.min.js', 'vendor/jsQR.min.js', 'vendor/qrcode.mjs', 'assets'];
const files = [];

function walk(rel) {
  const abs = path.join(root, rel);
  const st = fs.statSync(abs);
  if (st.isDirectory()) {
    for (const f of fs.readdirSync(abs).sort()) walk(path.posix.join(rel, f));
  // Заставки iOS берёт сам при установке на экран «Домой», в офлайн-кэш их не кладём.
  } else if (!/(^|\/)\.|\.md$/.test(rel) && !rel.startsWith('assets/splash/')) {
    files.push(rel);
  }
}
INCLUDE.forEach(walk);

const hash = crypto.createHash('sha256');
for (const f of files) { hash.update(f); hash.update(fs.readFileSync(path.join(root, f))); }
const version = hash.digest('hex').slice(0, 12);

const sw = `// Сгенерировано tools/build.mjs — не редактировать вручную.
// Офлайн-кэш игры. Сохранения хранятся отдельно (IndexedDB) и сюда не попадают.
const VERSION = '${version}';
const CACHE = 'shaman-' + VERSION;
const PRECACHE = ${JSON.stringify(['./', ...files], null, 2)};

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // cache: 'reload' — берём файлы с сервера, а не из HTTP-кэша браузера.
    await cache.addAll(PRECACHE.map((u) => new Request(u, { cache: 'reload' })));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith('shaman-') && k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    if (req.mode === 'navigate') {
      const hit = await cache.match('index.html') || await cache.match('./');
      if (hit) return hit;
    }
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    try {
      return await fetch(req);
    } catch (e) {
      return new Response('offline', { status: 503, statusText: 'offline' });
    }
  })());
});

self.addEventListener('message', (event) => {
  if (event.data === 'version') event.source && event.source.postMessage({ version: VERSION });
});
`;
fs.writeFileSync(path.join(root, 'service-worker.js'), sw);
console.log(`service-worker.js: версия ${version}, файлов ${files.length}`);
