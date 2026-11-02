// Рисует иконки и заставки PWA из игровой графики: node tools/make-icons.mjs
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = 8766;
const server = spawn(process.execPath, [path.join(root, 'tools/serve.mjs'), String(port)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 400));
fs.mkdirSync(path.join(root, 'assets/icons'), { recursive: true });
fs.mkdirSync(path.join(root, 'assets/splash'), { recursive: true });

const jobs = [
  ['icon', 512, 512, 'assets/icons/icon-512.png'],
  ['icon', 192, 192, 'assets/icons/icon-192.png'],
  ['icon', 180, 180, 'assets/icons/apple-touch-icon.png'],
  ['maskable', 512, 512, 'assets/icons/icon-maskable-512.png'],
  ...[[1320, 2868], [1290, 2796], [1206, 2622], [1179, 2556], [1170, 2532], [1284, 2778], [1125, 2436], [828, 1792], [750, 1334]]
    .map(([w, h]) => ['splash', w, h, `assets/splash/splash-${w}x${h}.png`]),
  // iPad: вертикально и горизонтально
  ...[[2048, 2732], [1668, 2388], [1640, 2360], [1620, 2160], [1488, 2266]]
    .flatMap(([w, h]) => [['splash', w, h, `assets/splash/splash-${w}x${h}.png`], ['splash', h, w, `assets/splash/splash-${h}x${w}.png`]]),
];

const browser = await chromium.launch();
for (const [kind, w, h, out] of jobs) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await page.goto(`http://localhost:${port}/tools/icons.html?kind=${kind}&w=${w}&h=${h}`);
  await page.waitForFunction(() => window.__done);
  await page.locator('#c').screenshot({ path: path.join(root, out) });
  await page.close();
  console.log(out);
}
await browser.close();
server.kill();
