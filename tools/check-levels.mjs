// Быстрая проверка levels.json без браузера: node tools/check-levels.mjs
// Ловит ошибки, которые сломали бы игру или сохранения:
// повтор id, отсутствие обязательных полей, цель больше числа белок,
// решение дороже доступной магии или требует отсутствующих предметов.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const data = JSON.parse(fs.readFileSync(path.join(root, 'levels/levels.json'), 'utf8'));
import { ITEMS } from '../src/config.js';
const COST = Object.fromEntries(Object.entries(ITEMS).map(([k, v]) => [k, v.cost]));
const errors = [];
const ids = new Set();
for (const [i, l] of (data.levels || []).entries()) {
  const tag = l.id || `#${i + 1}`;
  const need = ['id', 'name', 'squirrels', 'goal', 'mana', 'hollow', 'nuts', 'islands'];
  for (const k of need) if (l[k] === undefined) errors.push(`${tag}: нет поля «${k}»`);
  if (ids.has(l.id)) errors.push(`${tag}: id повторяется`);
  ids.add(l.id);
  if (l.goal > l.squirrels) errors.push(`${tag}: цель больше числа белок`);
  if (!Array.isArray(l.islands) || !l.islands.length) errors.push(`${tag}: нет островов`);
  const items = { ...(l.items || {}) };
  let mana = 0;
  for (const s of l.solution || []) {
    if (!(s.type in COST)) { errors.push(`${tag}: неизвестный предмет «${s.type}» в решении`); continue; }
    items[s.type] = (items[s.type] || 0) - 1;
    if (items[s.type] < 0) errors.push(`${tag}: в решении больше «${s.type}», чем выдано`);
    mana += COST[s.type];
  }
  if (mana > l.mana) errors.push(`${tag}: решению нужно ${mana} магии, а выдано ${l.mana}`);
  if (!l.solution || !l.solution.length) errors.push(`${tag}: нет эталонного решения (поле solution)`);
}
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log(`levels.json в порядке: уровней ${data.levels.length}`);
