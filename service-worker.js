// Сгенерировано tools/build.mjs — не редактировать вручную.
// Офлайн-кэш игры. Сохранения хранятся отдельно (IndexedDB) и сюда не попадают.
const VERSION = '6b932062c3c4';
const CACHE = 'shaman-' + VERSION;
const PRECACHE = [
  "./",
  "index.html",
  "manifest.json",
  "css/app.css",
  "src/art/svg.js",
  "src/art/textures.js",
  "src/config.js",
  "src/core/audio.js",
  "src/core/bus.js",
  "src/entities/Squirrel.js",
  "src/entities/features.js",
  "src/entities/props.js",
  "src/levels/loader.js",
  "src/main.js",
  "src/save/migrations.js",
  "src/save/storage.js",
  "src/save/transfer.js",
  "src/scenes/GameScene.js",
  "src/systems/geometry.js",
  "src/systems/progress.js",
  "src/ui/art.js",
  "src/ui/icons.js",
  "src/ui/scanner.js",
  "levels/levels.json",
  "vendor/phaser.min.js",
  "vendor/jsQR.min.js",
  "vendor/qrcode.mjs",
  "assets/audio/back.mp3",
  "assets/audio/boing.mp3",
  "assets/audio/click.mp3",
  "assets/audio/crate.mp3",
  "assets/audio/creak.mp3",
  "assets/audio/denied.mp3",
  "assets/audio/hop.mp3",
  "assets/audio/lose.mp3",
  "assets/audio/lost.mp3",
  "assets/audio/music-game.mp3",
  "assets/audio/music-menu.mp3",
  "assets/audio/music.json",
  "assets/audio/nut.mp3",
  "assets/audio/open.mp3",
  "assets/audio/pin.mp3",
  "assets/audio/place.mp3",
  "assets/audio/pop.mp3",
  "assets/audio/release.mp3",
  "assets/audio/saved.mp3",
  "assets/audio/select.mp3",
  "assets/audio/star.mp3",
  "assets/audio/tick.mp3",
  "assets/audio/win.mp3",
  "assets/fonts/manrope-cyrillic-600-normal.woff2",
  "assets/fonts/manrope-cyrillic-700-normal.woff2",
  "assets/fonts/manrope-cyrillic-800-normal.woff2",
  "assets/fonts/manrope-latin-600-normal.woff2",
  "assets/fonts/manrope-latin-700-normal.woff2",
  "assets/fonts/manrope-latin-800-normal.woff2",
  "assets/fonts/unbounded-cyrillic-500-normal.woff2",
  "assets/fonts/unbounded-cyrillic-700-normal.woff2",
  "assets/fonts/unbounded-latin-500-normal.woff2",
  "assets/fonts/unbounded-latin-700-normal.woff2",
  "assets/icons/apple-touch-icon.png",
  "assets/icons/icon-192.png",
  "assets/icons/icon-512.png",
  "assets/icons/icon-maskable-512.png"
];

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
