// Быстрая проверка levels.json без браузера: node tools/check-levels.mjs
// Ловит ошибки, которые сломали бы игру или сохранения:
// повтор id, отсутствие обязательных полей, цель больше числа белок,
// решение дороже доступной магии или требует отсутствующих предметов.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const data = JSON.parse(fs.readFileSync(path.join(root, 'levels/levels.json'), 'utf8'));
const COST = { plank: 15, longPlank: 25, crate: 10, trampoline: 30 };
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
  // Новые механики: базовая проверка полей.
  const piles = Array.isArray(l.nuts) ? l.nuts : [l.nuts];
  const nutsTotal = piles.reduce((a, p) => a + (p && p.count != null ? p.count : Infinity), 0);
  if (nutsTotal < l.goal) errors.push(`${tag}: орехов (${nutsTotal}) меньше, чем нужно белок (${l.goal})`);
  for (const g of l.gates || []) if (!g.plate || g.plate.w == null) errors.push(`${tag}: у ворот нет плиты`);
  for (const u of l.updrafts || []) if (!(u.w > 0) || u.top == null) errors.push(`${tag}: поток без ширины или верха`);
  for (const b of l.beetles || []) if (!(b.x1 > b.x0)) errors.push(`${tag}: у жука неверный участок x0..x1`);
  for (const r of l.rocks || []) if (!(r.every > 0)) errors.push(`${tag}: у камнепада нет периода every`);
  for (const p of l.portals || []) if (!p.a || !p.b) errors.push(`${tag}: у портала нет пары a/b`);
  for (const p of l.props || []) if (p.fragile != null && !(p.fragile > 0)) errors.push(`${tag}: ветхая доска с fragile ≤ 0`);
}
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log(`levels.json в порядке: уровней ${data.levels.length}`);
