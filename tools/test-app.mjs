// Сквозные проверки в Chromium с эмуляцией iPhone: node tools/test-app.mjs
// Проверяет: отсутствие ошибок JS, загрузку всех уровней на разных экранах,
// порядок открытия уровней, сохранение после перезагрузки, экспорт/импорт,
// миграцию старого формата, совместимость при добавлении уровней и офлайн.
// Это эмуляция в браузере компьютера, а не реальный iPhone.
import { chromium, devices } from 'playwright';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = 8767;
const base = `http://localhost:${port}/`;
const server = spawn(process.execPath, [path.join(root, 'tools/serve.mjs'), String(port)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 400));
const shots = process.env.SHOTS || '';

const results = [];
const ok = (name, cond, info = '') => { results.push([!!cond, name, info]); console.log(`${cond ? 'OK  ' : 'FAIL'} ${name}${info ? ' — ' + info : ''}`); };

const browser = await chromium.launch();

async function newPage(device = 'iPhone 13', ctxOpts = {}) {
  const ctx = await browser.newContext({ ...devices[device], ...ctxOpts });
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') page.errors.push(m.text()); });
  return { ctx, page };
}
const ready = (page) => page.waitForFunction(() => window.__app && window.__app.save && document.querySelector('.menu'), null, { timeout: 15000 });
const levelReady = (page) => page.waitForFunction(() => window.__app.scene && window.__app.scene.ready, null, { timeout: 15000 });

// 1. Все уровни грузятся и рисуются на разных экранах.
for (const dev of ['iPhone SE', 'iPhone 13', 'iPhone 15 Pro Max', 'Pixel 7', 'iPad Mini', 'iPad Pro 11', 'iPad Pro 11 landscape']) {
  const { ctx, page } = await newPage(dev);
  await page.goto(base);
  await ready(page);
  const ids = await page.evaluate(() => window.__app.levels.map((l) => l.id));
  // открываем всё, чтобы пройтись по уровням
  await page.evaluate(() => { window.__app.save.unlocked = window.__app.levels.map((l) => l.id); });
  let bad = [];
  for (const id of ids) {
    await page.evaluate((i) => window.__startLevel(i), id);
    try { await levelReady(page); } catch { bad.push(id); continue; }
    // видимость: весь мир помещается между HUD и лотком
    const fit = await page.evaluate(() => {
      const s = window.__app.scene, cam = s.cameras.main, d = s.game.registry.get('dpr');
      const tr = document.querySelector('.tray').getBoundingClientRect();
      const hud = document.querySelector('.hud').getBoundingClientRect().bottom;
      const side = document.body.classList.contains('side-panel');
      // экранные координаты островов: не под шапкой и не под лотком
      const k = cam.zoom / d;
      const ok = s.level.islands.every((i) => {
        const y = (i.y - cam.worldView.y) * k;
        const x0 = (Math.max(0, i.x) - cam.worldView.x) * k, x1 = (Math.min(400, i.x + i.w) - cam.worldView.x) * k;
        return y > hud && (side ? x1 < tr.left && y < innerHeight : y < tr.top) && x0 >= -1;
      });
      return { ok, zoom: +k.toFixed(2) };
    });
    if (!fit.ok) bad.push(id + ' (не помещается)');
    if (shots && (id === 'w1-03' || id === 'w1-10')) await page.screenshot({ path: `${shots}-${dev.replace(/ /g, '')}-${id}.png` });
  }
  ok(`${dev}: все ${ids.length} уровней загружаются и помещаются на экран`, bad.length === 0, bad.join(', '));
  ok(`${dev}: нет ошибок JS`, page.errors.length === 0, page.errors.slice(0, 3).join(' | '));
  await ctx.close();
}

// 2. Порядок открытия, сохранение и перезагрузка.
{
  const { ctx, page } = await newPage();
  await page.goto(base);
  await ready(page);
  const locked = await page.evaluate(() => {
    const a = window.__app;
    return a.levels.slice(1).every((l) => !window.__isUnlocked(l.id));
  });
  ok('новый игрок: открыт только первый уровень', locked);
  // проходим уровень 1 эталонным решением в реальной сцене
  await page.evaluate(() => window.__startLevel('w1-01'));
  await levelReady(page);
  await page.evaluate(() => { const s = window.__app.scene; s.runSolution(s.level.solution); });
  await page.waitForSelector('.modal .stars-big', { timeout: 5000 });
  const unlocked2 = await page.evaluate(() => window.__isUnlocked('w1-02'));
  ok('после прохождения открывается следующий уровень', unlocked2);
  await page.waitForTimeout(300);
  await page.reload();
  await ready(page);
  const rec = await page.evaluate(() => window.__app.save.levels['w1-01']);
  ok('прогресс сохраняется после перезагрузки', rec && rec.completed && rec.stars >= 1, JSON.stringify(rec));
  // повреждённая основная копия — берётся резервная
  await page.evaluate(async () => {
    localStorage.setItem('shaman-squirrels.save', '{"broken":');
    const db = await new Promise((r) => { const q = indexedDB.open('shaman-squirrels', 1); q.onsuccess = () => r(q.result); });
    await new Promise((r) => { const tx = db.transaction('kv', 'readwrite'); tx.objectStore('kv').put({ json: 'мусор', sum: '0' }, 'save'); tx.oncomplete = r; });
  });
  await page.reload();
  await ready(page);
  const rec2 = await page.evaluate(() => window.__app.save.levels['w1-01']);
  ok('при повреждении основной копии прогресс берётся из резервной', rec2 && rec2.completed);
  // экспорт и импорт
  const exported = await page.evaluate(() => window.__exportText());
  const imported = await page.evaluate((t) => { const d = window.__parseImport(t); return d.levels['w1-01'] && d.levels['w1-01'].completed; }, exported);
  ok('экспорт и импорт JSON сохраняют прогресс', imported);
  // миграция v1
  const mig = await page.evaluate(() => {
    const d = window.__parseImport(JSON.stringify({ version: 1, completed: ['w1-01', 'w1-02'], stars: { 'w1-01': 3 }, sound: false }));
    return d.schema === 2 && d.levels['w1-02'].completed && d.levels['w1-01'].stars === 3 && d.settings.sound === false;
  });
  ok('старый формат сохранения (v1) переводится в текущий', mig);
  ok('нет ошибок JS (сохранения)', page.errors.length === 0, page.errors.slice(0, 3).join(' | '));
  await ctx.close();
}

// 3. Добавили новые уровни — старый прогресс на месте.
// Service worker здесь отключён, чтобы подменить levels.json в запросе.
{
  const { ctx, page } = await newPage('iPhone 13', { serviceWorkers: 'block' });
  await page.goto(base);
  await ready(page);
  await page.evaluate(() => { window.__app.save.levels['w1-05'] = { completed: true, stars: 2, bestSaved: 5, bestTimeMs: 9000, bestMana: 30, attempts: 3, wins: 1 }; window.__app.save.unlocked.push('w1-06'); return window.__persist(); });
  const orig = JSON.parse(fs.readFileSync(path.join(root, 'levels/levels.json'), 'utf8'));
  const extra = JSON.parse(JSON.stringify(orig.levels[0]));
  extra.id = 'w2-01'; extra.name = 'Новый уровень';
  const mod = { ...orig, levels: [extra, ...orig.levels, { ...extra, id: 'w2-02', name: 'Ещё один' }] };
  await page.route('**/levels/levels.json', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify(mod) }));
  await page.reload();
  await ready(page);
  const st = await page.evaluate(() => ({ n: window.__app.levels.length, r: window.__app.save.levels['w1-05'], u6: window.__isUnlocked('w1-06') }));
  ok('после добавления уровней старые результаты и открытые уровни сохраняются', st.n === 12 && st.r && st.r.stars === 2 && st.u6, JSON.stringify(st));
  await ctx.close();
}

// 4. Офлайн после первой загрузки.
{
  const { ctx, page } = await newPage();
  await page.goto(base);
  await ready(page);
  await page.waitForFunction(() => navigator.serviceWorker.controller || navigator.serviceWorker.ready.then(() => true), null, { timeout: 15000 });
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await ready(page);
  const controlled = await page.evaluate(() => !!navigator.serviceWorker.controller);
  ok('service worker установлен и управляет страницей', controlled);
  await ctx.setOffline(true);
  await page.reload();
  let offlineOk = false;
  try {
    await ready(page);
    await page.evaluate(() => window.__startLevel('w1-01'));
    await levelReady(page);
    offlineOk = true;
  } catch { /* */ }
  ok('без интернета игра открывается и уровень запускается', offlineOk);
  const audioCached = await page.evaluate(async () => { const r = await fetch('assets/audio/win.mp3'); return r.ok; });
  ok('звуки доступны офлайн', audioCached);
  await ctx.setOffline(false);
  ok('нет ошибок JS (офлайн)', page.errors.filter((e) => !/Failed to load resource/.test(e)).length === 0, page.errors.slice(0, 3).join(' | '));
  await ctx.close();
}

// 5. Перенос между устройствами: телефон показывает QR, планшет сканирует камерой.
// Камера эмулируется видеофайлом с этим QR-кодом.
{
  const { execSync } = await import('node:child_process');
  const os = await import('node:os');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'shaman-qr-'));
  const { ctx, page } = await newPage('iPhone 13', { serviceWorkers: 'block' });
  await page.goto(base);
  await ready(page);
  await page.evaluate(() => {
    const a = window.__app;
    for (const id of ['w1-01', 'w1-02', 'w1-03']) a.save.levels[id] = { completed: true, stars: 3, bestSaved: 5, bestTimeMs: 9000, bestMana: 15, attempts: 1, wins: 1 };
    a.save.unlocked = ['w1-01', 'w1-02', 'w1-03', 'w1-04'];
    return window.__persist();
  });
  await page.tap('[data-act=settings]');
  await page.tap('[data-act=qr-show]');
  await page.waitForSelector('.qrbox svg');
  await page.locator('.qrbox').screenshot({ path: path.join(tmp, 'qr.png') });
  await ctx.close();
  let scanned = false;
  try {
    execSync(`ffmpeg -v error -y -loop 1 -i ${path.join(tmp, 'qr.png')} -vf "scale=520:-1,pad=1280:720:(ow-iw)/2:(oh-ih)/2:color=0x666666,format=yuv420p" -t 3 -r 15 ${path.join(tmp, 'qr.y4m')}`);
    const cam = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-video-capture=${path.join(tmp, 'qr.y4m')}`] });
    const c2 = await cam.newContext({ ...devices['iPad Pro 11'], serviceWorkers: 'block', permissions: ['camera'] });
    const p2 = await c2.newPage();
    await p2.goto(base);
    await ready(p2);
    await p2.evaluate(() => { window.__app.save.levels['w1-06'] = { completed: true, stars: 2, bestSaved: 5, bestTimeMs: 20000, bestMana: 30, attempts: 1, wins: 1 }; return window.__persist(); });
    await p2.tap('[data-act=settings]');
    await p2.tap('[data-act=qr-scan]');
    await p2.waitForSelector('.crit.merge', { timeout: 15000 });
    await p2.tap('.modal [data-act=yes]');
    await p2.waitForTimeout(300);
    await p2.reload();
    await ready(p2);
    const r = await p2.evaluate(() => ({ done: Object.values(window.__app.save.levels).filter((l) => l.completed).length, u4: window.__isUnlocked('w1-04') }));
    scanned = r.done === 4 && r.u4;
    await cam.close();
  } catch (e) { console.log('   ', String(e).slice(0, 200)); }
  ok('перенос по QR: планшет сканирует код с телефона и объединяет прогресс', scanned);
}

await browser.close();
server.kill();
const failed = results.filter((r) => !r[0]);
console.log(`\nИтого: ${results.length - failed.length} из ${results.length} проверок пройдено`);
process.exit(failed.length ? 1 : 0);
