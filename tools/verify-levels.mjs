// Проверка проходимости уровней: node tools/verify-levels.mjs
// Нужен Playwright (npm i -D playwright && npx playwright install chromium).
// Для каждого уровня запускается физика с эталонным решением из levels.json
// и без решения. Уровень считается корректным, если с решением он проходится,
// а без предметов — нет.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = 8765;
const server = spawn(process.execPath, [path.join(root, 'tools/serve.mjs'), String(port)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 400));

const args = process.argv.slice(2);
const src = args.find((a) => a.startsWith('--src='));
const id = args.find((a) => !a.startsWith('--'));
const qs = new URLSearchParams();
if (id) qs.set('only', id);
if (src) qs.set('src', '/' + src.slice(6));
const only = qs.toString() ? '?' + qs : '';
const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(`http://localhost:${port}/tools/sim.html${only}`);
await page.waitForFunction(() => window.__report, null, { timeout: 180000 });
const report = await page.evaluate(() => window.__report);
await browser.close();
server.kill();

let ok = true;
for (const r of report) {
  const s = r.solution, e = r.empty;
  const pass = s.win === true;
  const notTrivial = !e.win;
  const failsOk = (r.fails || []).every((f) => !f.win);
  ok = ok && pass && notTrivial && failsOk;
  const fmt = (x) => x.error ? `ошибка: ${x.error} (спасено ${x.saved ?? '?'})` : `${x.win ? 'победа' : 'поражение'} ${x.saved}/${x.total}, потеряно ${x.lost}${x.lostBy ? ' ' + JSON.stringify(x.lostBy) : ''}, ${x.timeSec.toFixed(1)} с, ★${x.stars}, магия ${x.manaSpent}`;
  console.log(`${pass && notTrivial && failsOk ? 'OK  ' : 'FAIL'} ${r.id} «${r.name}» цель ${r.goal}/${r.total}`);
  console.log(`     с решением: ${fmt(s)}`);
  console.log(`     без решения: ${fmt(e)}`);
  (r.fails || []).forEach((f, i) => console.log(`     ${f.win ? '!! ' : ''}неверное решение ${i + 1}: ${fmt(f)}`));
}
if (errors.length) { console.log('Ошибки JS:', errors); ok = false; }
process.exit(ok ? 0 : 1);
