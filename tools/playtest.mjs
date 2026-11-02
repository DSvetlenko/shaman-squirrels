// Проходит всю кампанию «как игрок»: node tools/playtest.mjs [с какого уровня] [до какого]
//
// Начинает с чистого сохранения на эмулированном iPhone и проходит уровни по порядку
// только касаниями: выбирает предмет в лотке, перетаскивает его пальцем, поворачивает
// (за кольцо доски или кнопками), нажимает «Поставить», «Выпустить», «×2», в конце —
// «Дальше». Предметы ставятся туда, где лежит эталонное решение из levels.json.
// Состояние игры читается только для проверки (как игрок смотрит на экран).
//
// Нужен Playwright: npm i -D playwright && npx playwright install chromium
import { chromium, devices } from 'playwright';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = 8768;
const base = `http://localhost:${port}/`;
const shotsDir = process.env.SHOTS || '';
const fromN = Number(process.argv[2] || 1);
const toN = Number(process.argv[3] || 9999);

const server = spawn(process.execPath, [path.join(root, 'tools/serve.mjs'), String(port)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 400));
const data = JSON.parse(fs.readFileSync(path.join(root, 'levels/levels.json'), 'utf8'));

const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['iPhone 13'], serviceWorkers: 'block' });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

await page.goto(base);
await page.waitForFunction(() => window.__app && document.querySelector('.menu'), null, { timeout: 20000 });

// Чтобы начать не с первого уровня, отмечаем предыдущие пройденными (как будто игрок уже играл).
if (fromN > 1) {
  await page.evaluate((ids) => {
    for (const id of ids) window.__app.save.levels[id] = { completed: true, stars: 1, bestSaved: 1, bestTimeMs: 1, bestMana: 0, attempts: 1, wins: 1 };
    return window.__persist();
  }, data.levels.slice(0, fromN - 1).map((l) => l.id));
  await page.reload();
  await page.waitForFunction(() => window.__app && document.querySelector('.menu'));
}

const sleep = (ms) => page.waitForTimeout(ms);
const scene = (fn, arg) => page.evaluate(fn, arg);

// Мировые координаты → точка на экране (CSS-пиксели).
async function toScreen(x, y) {
  return scene(([x, y]) => {
    const s = window.__app.scene, c = s.cameras.main, d = s.game.registry.get('dpr');
    return { x: (x - c.worldView.x) * c.zoom / d, y: (y - c.worldView.y) * c.zoom / d };
  }, [x, y]);
}

async function drag(from, to, steps = 14) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(from.x + (to.x - from.x) * i / steps, from.y + (to.y - from.y) * i / steps);
    await sleep(8);
  }
  await page.mouse.up();
  await sleep(30);
}

const ghost = () => scene(() => window.__app.scene.ghost && { ...window.__app.scene.ghost });
const LEN = { plank: 120, longPlank: 180 };

async function placeLikeHuman(item) {
  const before = await scene((t) => window.__app.scene.items[t], item.type);
  await page.tap(`.slot[data-item=${item.type}]`);
  await sleep(120);
  let g = await ghost();
  if (!g) throw new Error('не открылась установка ' + item.type);
  // 1) перенос: тянем за середину предмета
  for (let k = 0; k < 4; k++) {
    g = await ghost();
    if (Math.hypot(g.x - item.x, g.y - item.y) < 1) break;
    const a = await toScreen(g.x, g.y);
    const b = await toScreen(item.x, item.y);
    await drag(a, b);
  }
  // 2) поворот
  const want = item.angle || 0;
  if (item.type === 'plank' || item.type === 'longPlank') {
    for (let k = 0; k < 6 && Math.abs((await ghost()).angle - want) > 0.5; k++) {
      g = await ghost();
      const r = LEN[item.type] / 2;
      const ga = g.angle * Math.PI / 180, wa = want * Math.PI / 180;
      const a = await toScreen(g.x + Math.cos(ga) * r, g.y + Math.sin(ga) * r);
      // Палец ставим чуть дальше конца, чтобы угол считался точнее.
      const b = await toScreen(g.x + Math.cos(wa) * r * 1.15, g.y + Math.sin(wa) * r * 1.15);
      await drag(a, b, 10);
    }
  } else if (item.type === 'trampoline' && want) {
    const n = Math.round(Math.abs(want) / 5);
    for (let i = 0; i < n; i++) { await page.tap(`[data-hold="${want > 0 ? 1 : -1}"]`); await sleep(40); }
  }
  g = await ghost();
  // Пальцем угол ставится с точностью до градуса — как у живого игрока.
  if (Math.abs(g.angle - want) > 1) throw new Error(`не удалось повернуть ${item.type}: ${g.angle} вместо ${want}`);
  if (Math.hypot(g.x - item.x, g.y - item.y) > 1.5) throw new Error(`не удалось поставить ${item.type} точно: ${g.x.toFixed(1)},${g.y.toFixed(1)}`);
  await page.tap('[data-act=pok]');
  await sleep(120);
  const after = await scene((t) => window.__app.scene.items[t], item.type);
  if (after !== before - 1) throw new Error(`«Поставить» не сработало для ${item.type}`);
}

async function closeTips() {
  for (let i = 0; i < 6; i++) {
    const b = await page.$('.tipwrap [data-act=next]');
    if (!b) return;
    await b.tap();
    await sleep(80);
  }
}

const results = [];
const levels = data.levels;
for (let n = fromN; n <= Math.min(toN, levels.length); n++) {
  const L = levels[n - 1];
  const t0 = Date.now();
  let outcome = '';
  try {
    // Запуск: из меню «Играть» или кнопкой «Дальше» на экране итога.
    const next = await page.$('.modal [data-act=next]');
    if (next) await next.tap();
    else {
      if (!(await page.$('.menu'))) { await page.evaluate(() => 0); }
      await page.tap('[data-act=play]');
    }
    await page.waitForFunction((id) => window.__app.scene && window.__app.scene.ready && window.__app.level.id === id, L.id, { timeout: 15000 });
    await sleep(150);
    await closeTips();
    const build = (L.solution || []).filter((a) => a.at == null);
    const timed = (L.solution || []).filter((a) => a.at != null).sort((a, b) => a.at - b.at);
    for (const item of build) await placeLikeHuman(item);
    if (shotsDir) await page.screenshot({ path: path.join(shotsDir, `${String(n).padStart(2, '0')}-build.png`) });
    await page.tap('[data-act=release]');
    await sleep(100);
    // ×2 — как сделал бы нетерпеливый игрок (кроме уровней, где надо успеть что-то поставить в забеге)
    if (!timed.length && !(await page.$('.speed.on'))) await page.tap('[data-act=speed]');
    for (const item of timed) {
      await page.waitForFunction((s) => window.__app.scene.runSteps >= s, item.at * 60, { timeout: 60000 });
      await placeLikeHuman(item);
    }
    await page.waitForSelector('.modal .stars-big', { timeout: 200000 });
    await sleep(700);
    const r = await scene(() => window.__app.scene.result);
    const title = await page.textContent('.modal h2');
    if (shotsDir) await page.screenshot({ path: path.join(shotsDir, `${String(n).padStart(2, '0')}-end.png`) });
    outcome = r.win ? `победа ★${r.stars} (${r.saved}/${r.total}, цель ${r.goal})` : `ПОРАЖЕНИЕ «${title}» ${r.saved}/${r.total}`;
    results.push({ n, id: L.id, ok: r.win, outcome });
    if (!r.win) {
      // как игрок: «Заново» и ещё попытка не поможет с тем же планом — останавливаемся
      console.log(`${n}. ${L.name}: ${outcome}`);
      break;
    }
  } catch (e) {
    results.push({ n, id: L.id, ok: false, outcome: 'ошибка: ' + e.message });
    console.log(`${n}. ${L.name}: ошибка: ${e.message}`);
    if (shotsDir) await page.screenshot({ path: path.join(shotsDir, `${String(n).padStart(2, '0')}-error.png`) });
    break;
  }
  console.log(`${n}. ${L.name}: ${outcome} — ${((Date.now() - t0) / 1000).toFixed(0)} с`);
}

// Итог: что открыто после прохождения, и прогресс после перезагрузки.
await page.reload();
await page.waitForFunction(() => window.__app && document.querySelector('.menu'));
const done = await page.evaluate(() => Object.values(window.__app.save.levels).filter((l) => l.completed).length);
console.log(`\nПройдено подряд: ${results.filter((r) => r.ok).length} из ${Math.min(toN, levels.length) - fromN + 1}. После перезагрузки в сохранении пройдено уровней: ${done}.`);
if (errors.length) console.log('Ошибки JS:\n' + errors.slice(0, 10).join('\n'));
await browser.close();
server.kill();
process.exit(results.every((r) => r.ok) && !errors.length ? 0 : 1);
