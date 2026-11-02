// Готовые картинки для интерфейса (лоток предметов, главное меню).
import { plankSVG, crateSVG, trampolineSVG, arrowSVG, bubbleSVG, islandArt, stumpSVG, nutPileSVG, squirrelSVG, STUMP } from '../art/svg.js';
import { ITEMS } from '../config.js';

const uri = (svg) => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);

let itemArt = null;
export function getItemArt() {
  if (!itemArt) {
    itemArt = {
      plank: uri(plankSVG(ITEMS.plank.len)),
      longPlank: uri(plankSVG(ITEMS.longPlank.len)),
      crate: uri(crateSVG(ITEMS.crate.size)),
      trampoline: uri(trampolineSVG()),
      arrow: uri(arrowSVG()),
      bubble: uri(bubbleSVG()),
    };
  }
  return itemArt;
}

// Иллюстрация для главного меню: два острова, мост, дупло и белки.
export function menuArtSVG() {
  const W = 400, H = 330;
  const a = islandArt({ x: 6, y: 170, w: 170, depth: 150, seed: 5 });
  const b = islandArt({ x: 240, y: 200, w: 150, depth: 130, seed: 9 });
  const img = (href, x, y, w, h, extra = '') => `<image href="${href}" x="${x}" y="${y}" width="${w}" height="${h}" ${extra}/>`;
  const sq = uri(squirrelSVG('A')), sqb = uri(squirrelSVG('B'));
  const plankLen = 112;
  const ang = Math.atan2(200 - 170, 250 - 150) * 180 / Math.PI;
  let o = '';
  o += img(uri(b.svg), b.rect.x, b.rect.y, b.rect.w, b.rect.h);
  o += img(uri(a.svg), a.rect.x, a.rect.y, a.rect.w, a.rect.h);
  o += img(uri(stumpSVG()), 60 - STUMP.w / 2 + 10, 170 - STUMP.baseY, STUMP.w, STUMP.h);
  o += img(uri(nutPileSVG()), 330 - 55, 200 - 70, 110, 72);
  o += `<g transform="translate(150,173) rotate(${ang.toFixed(1)})">${img(uri(plankSVG(plankLen)), -3, -8, plankLen + 6, 17)}</g>`;
  o += `<circle cx="74" cy="112" r="2.3" fill="#ffcf73"/><circle cx="84" cy="112" r="2.3" fill="#ffcf73"/>`;
  o += img(sq, 118, 136, 40, 35);
  o += `<g transform="translate(205,186) rotate(${ang.toFixed(1)})">${img(sqb, -20, -33, 40, 35)}</g>`;
  o += `<g transform="translate(300,200) scale(-1,1)">${img(sq, -20, -33, 40, 35)}</g>`;
  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">${o}</svg>`;
}
