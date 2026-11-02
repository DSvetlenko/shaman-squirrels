// Точка входа: загрузка сохранения и уровней, запуск Phaser, экраны интерфейса.

import { GAME_VERSION, ITEMS, ITEM_ORDER, ROTATE_STEP, STEP_MS } from './config.js';
import { loadSave, writeSave, primeLastGood, requestPersistence, storageInfo, exportText, parseImport, wipeSave } from './save/storage.js';
import { defaultSave } from './save/migrations.js';
import { loadLevels } from './levels/loader.js';
import { GameScene } from './scenes/GameScene.js';
import { backgroundSVG } from './art/svg.js';
import { icon } from './ui/icons.js';
import { getItemArt, menuArtSVG } from './ui/art.js';
import { unlockAudio, play, setSoundEnabled, suspendAudio, resumeAudio } from './core/audio.js';
import {
  ACHIEVEMENTS, achievementState, totalStars, isUnlocked, nextLevelId, continueLevel,
  recordAttemptStart, applyResult, checkAchievements,
} from './systems/progress.js';

const $ui = document.getElementById('ui');
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmtTime = (sec) => { sec = Math.max(0, Math.round(sec)); return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`; };

const app = {
  save: null,
  levels: [],
  worlds: [],
  game: null,
  scene: null,
  screen: null,
  level: null,
  hud: null,
  placement: null,
  speed2x: false,
  pendingReload: false,
  sessionStart: Date.now(),
};
window.__app = app; // для автотестов

// ------------------------------------------------------------------ запуск
async function boot() {
  document.getElementById('bg').innerHTML = backgroundSVG();
  setupGlobalGuards();
  try {
    const [save, lv] = await Promise.all([loadSave(), loadLevels()]);
    app.save = save;
    app.levels = lv.levels;
    app.worlds = lv.worlds;
  } catch (e) {
    console.error(e);
    app.save = app.save || defaultSave();
    if (!app.levels.length) {
      document.querySelector('#boot span').textContent = 'Не удалось загрузить уровни. Проверь соединение и обнови страницу.';
      return;
    }
  }
  primeLastGood(app.save);
  app.save.stats.sessions++;
  setSoundEnabled(app.save.settings.sound);
  app.speed2x = !!app.save.settings.speed2x;
  persist();
  requestPersistence();
  initPhaser();
  showMenu();
  document.getElementById('boot').classList.add('hide');
  setTimeout(() => document.getElementById('boot').remove(), 500);
  registerSW();
}

function persist() {
  const now = Date.now();
  app.save.stats.playTimeMs += now - app.sessionStart;
  app.sessionStart = now;
  return writeSave(app.save);
}

function setupGlobalGuards() {
  // Без масштабирования, контекстного меню и прокрутки страницы.
  ['gesturestart', 'gesturechange', 'gestureend'].forEach((e) => document.addEventListener(e, (ev) => ev.preventDefault(), { passive: false }));
  document.addEventListener('contextmenu', (e) => e.preventDefault());
  document.addEventListener('dblclick', (e) => e.preventDefault(), { passive: false });
  document.addEventListener('touchmove', (e) => {
    if (!e.target.closest('.scroll, .sheet, textarea')) e.preventDefault();
  }, { passive: false });
  const unlock = () => { unlockAudio(); };
  document.addEventListener('pointerdown', unlock, { passive: true });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      persist();
      suspendAudio();
      if (app.scene && app.scene.phase === 'run' && !app.paused) openPause();
    } else {
      app.sessionStart = Date.now();
      resumeAudio();
    }
  });
  window.addEventListener('pagehide', () => persist());
  window.addEventListener('resize', () => resizeGame());
  if (window.visualViewport) window.visualViewport.addEventListener('resize', () => resizeGame());
}

// ------------------------------------------------------------------ Phaser
function dpr() { return Math.min(window.devicePixelRatio || 1, 3); }
function viewport() { return { w: window.innerWidth, h: window.innerHeight }; }

function initPhaser() {
  const { w, h } = viewport();
  const d = dpr();
  app.game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: Math.round(w * d),
    height: Math.round(h * d),
    transparent: true,
    banner: false,
    audio: { noAudio: true },
    scale: { mode: Phaser.Scale.NONE },
    input: { activePointers: 3 },
    render: { antialias: true, roundPixels: false, powerPreference: 'high-performance' },
    physics: { default: 'matter', matter: { gravity: { y: 1 }, autoUpdate: false, debug: false } },
    scene: [],
  });
  app.game.registry.set('dpr', d);
  app.game.events.once('ready', () => {
    app.game.scene.add('game', GameScene, false);
    resizeGame();
  });
}

function resizeGame() {
  if (!app.game || !app.game.canvas) return;
  const { w, h } = viewport();
  const d = dpr();
  app.game.registry.set('dpr', d);
  app.game.scale.resize(Math.round(w * d), Math.round(h * d));
  app.game.canvas.style.width = w + 'px';
  app.game.canvas.style.height = h + 'px';
  app.game.scale.refresh();
  if (app.scene && app.scene.ready) app.scene.applyLayout(measureInsets());
}

function measureInsets() {
  const hud = $ui.querySelector('.hud');
  const tray = $ui.querySelector('.tray');
  const vh = viewport().h;
  const top = hud ? hud.getBoundingClientRect().bottom + 10 : 110;
  const bottom = tray ? vh - tray.getBoundingClientRect().top + 8 : 220;
  return { top, bottom };
}

// ------------------------------------------------------------------ экраны
function render(html, cls = '') {
  $ui.innerHTML = html;
  $ui.className = cls;
}

function bindClicks(root, map) {
  root.querySelectorAll('[data-act]').forEach((el) => {
    el.addEventListener('click', (e) => {
      const fn = map[el.dataset.act];
      if (fn) { play('click'); fn(el, e); }
    });
  });
}

function stopLevel() {
  if (app.game && app.game.scene.isActive('game')) app.game.scene.stop('game');
  app.scene = null;
  app.level = null;
  app.paused = false;
  if (app.pendingReload) location.reload();
}

function starsOf(id) { return (app.save.levels[id] && app.save.levels[id].stars) || 0; }

function showMenu() {
  stopLevel();
  app.screen = 'menu';
  const cont = continueLevel(app.save, app.levels);
  const idx = app.levels.indexOf(cont) + 1;
  const allDone = app.levels.every((l) => app.save.levels[l.id] && app.save.levels[l.id].completed);
  const stars = totalStars(app.save), maxStars = app.levels.length * 3;
  render(`
  <section class="screen menu dim">
    <div class="hero">
      <span class="eyebrow">Парящие острова</span>
      <h1 class="title-xl">Шаман</h1>
      <p>Белкам нужны орехи с соседних островов. Построй путь над пропастью и верни племя домой.</p>
    </div>
    <div class="art">${menuArtSVG()}</div>
    <div class="actions">
      <button class="btn primary block continue" data-act="play">
        <small>${allDone ? 'Все уровни пройдены · переиграть' : (idx === 1 && !app.save.levels[cont.id] ? 'Начать игру' : 'Продолжить')}</small>
        <span>${idx}. ${esc(cont.name)}</span>
      </button>
      <div class="row3">
        <button class="btn secondary" data-act="levels">${icon('map', 22)}<span>Уровни</span></button>
        <button class="btn secondary" data-act="stats">${icon('award', 22)}<span>Награды</span></button>
        <button class="btn secondary" data-act="settings">${icon('settings', 22)}<span>Настройки</span></button>
      </div>
      <div class="foot">
        <span class="fi">${icon('star', 15)}<b class="num">${stars} / ${maxStars}</b></span>
        <span class="fi">${icon('nut', 15)}<b class="num">${app.save.nuts}</b></span>
        <span class="ver">v${GAME_VERSION}</span>
      </div>
    </div>
  </section>`);
  bindClicks($ui, {
    play: () => startLevel(cont.id),
    levels: () => showLevels(),
    stats: () => showStats(),
    settings: () => showSettings('menu'),
  });
}

function showLevels() {
  stopLevel();
  app.screen = 'levels';
  const cont = continueLevel(app.save, app.levels);
  const total = totalStars(app.save), max = app.levels.length * 3;
  const cards = app.levels.map((l, i) => {
    const unlocked = isUnlocked(app.save, app.levels, l.id);
    const st = starsOf(l.id);
    const cls = ['lv', unlocked ? '' : 'locked', l.id === cont.id && unlocked ? 'cur' : '', l.special ? 'special' : ''].join(' ');
    const stars = [0, 1, 2].map((k) => icon('star', 16, k < st ? 'on' : '')).join('');
    return `<button class="${cls}" data-act="lv" data-id="${l.id}" ${unlocked ? '' : 'aria-disabled="true"'}>
      <span class="n">${i + 1}</span>
      <span class="nm">${esc(l.name)}</span>
      <span class="stars">${stars}</span>
      ${l.special ? '<span class="tag">Испытание</span>' : ''}
      ${unlocked ? '' : `<span class="badge">${icon('lock', 16)}</span>`}
    </button>`;
  }).join('');
  render(`
  <section class="screen dim">
    <div class="topbar">
      <button class="iconbtn glass" data-act="back" aria-label="Назад">${icon('chevron-left', 22)}</button>
      <div class="t"><h2>Уровни</h2></div>
    </div>
    <div class="scroll">
      <div class="worldhead glass">
        <div class="w"><span class="eyebrow">Мир 1</span><b>${esc((app.worlds[0] && app.worlds[0].name) || 'Парящие острова')}</b></div>
        <div class="st">${icon('star', 18)}<span>${total} / ${max}</span></div>
      </div>
      <div class="lvgrid">${cards}</div>
    </div>
  </section>`);
  bindClicks($ui, {
    back: () => showMenu(),
    lv: (el) => {
      const id = el.dataset.id;
      if (!isUnlocked(app.save, app.levels, id)) { toast('Сначала пройди предыдущий уровень'); play('denied'); return; }
      startLevel(id);
    },
  });
}

function showStats() {
  stopLevel();
  app.screen = 'stats';
  const s = app.save.stats;
  const done = app.levels.filter((l) => app.save.levels[l.id] && app.save.levels[l.id].completed).length;
  const placed = Object.values(s.itemsPlaced).reduce((a, b) => a + b, 0);
  const mins = Math.round(s.playTimeMs / 60000);
  const tiles = [
    [`${done} / ${app.levels.length}`, 'уровней пройдено'],
    [`${totalStars(app.save)} / ${app.levels.length * 3}`, 'звёзд собрано'],
    [s.squirrelsSaved, 'белок вернулось домой'],
    [s.squirrelsLost, 'белок потеряно'],
    [placed, 'предметов поставлено'],
    [app.save.nuts, 'орехов в запасе'],
    [s.levelsWon + s.levelsLost, 'забегов сыграно'],
    [mins < 60 ? `${mins} мин` : `${Math.floor(mins / 60)} ч ${mins % 60} мин`, 'в игре'],
  ];
  const ach = ACHIEVEMENTS.map((a) => {
    const st = achievementState(app.save, a);
    const prog = st.prog && !st.unlocked ? `<div class="pbar"><span style="width:${Math.round(st.prog.v / st.prog.max * 100)}%"></span></div>` : '';
    const pv = st.prog && !st.unlocked ? `<span class="pv">${st.prog.v} / ${st.prog.max}</span>` : (st.unlocked ? `<span class="pv" style="color:var(--green)">${icon('check', 18)}</span>` : '');
    return `<div class="ach ${st.unlocked ? 'on' : ''}"><div class="medal">${icon(st.unlocked ? 'trophy' : 'lock', 22)}</div>
      <div class="lbl"><b>${esc(a.title)}</b><small>${esc(a.desc)}</small>${prog}</div>${pv}</div>`;
  }).join('');
  const got = ACHIEVEMENTS.filter((a) => app.save.achievements[a.id]).length;
  render(`
  <section class="screen dim">
    <div class="topbar">
      <button class="iconbtn glass" data-act="back" aria-label="Назад">${icon('chevron-left', 22)}</button>
      <div class="t"><h2>Статистика и награды</h2></div>
    </div>
    <div class="scroll">
      <div class="stats">${tiles.map(([v, l]) => `<div class="stat glass"><b>${esc(v)}</b><span>${esc(l)}</span></div>`).join('')}</div>
      <div class="card glass"><h3>Достижения · ${got} из ${ACHIEVEMENTS.length}</h3>${ach}</div>
    </div>
  </section>`);
  bindClicks($ui, { back: () => showMenu() });
}

function showSettings(from) {
  if (from !== 'pause') stopLevel();
  app.screen = 'settings';
  const st = app.save.settings;
  const sw = (on) => `<span class="switch ${on ? 'on' : ''}"></span>`;
  const where = storageInfo.idb ? 'IndexedDB + резервная копия' : 'localStorage';
  const updated = app.save.updatedAt ? new Date(app.save.updatedAt).toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) : '—';
  render(`
  <section class="screen dim">
    <div class="topbar">
      <button class="iconbtn glass" data-act="back" aria-label="Назад">${icon('chevron-left', 22)}</button>
      <div class="t"><h2>Настройки</h2></div>
    </div>
    <div class="scroll">
      <div class="card glass">
        <h3>Игра</h3>
        <button class="row rowbtn" data-act="t-sound"><span class="lbl"><b>Звук</b><small>Эффекты и мелодии</small></span>${sw(st.sound)}</button>
        <button class="row rowbtn" data-act="t-hints"><span class="lbl"><b>Подсказки</b><small>Советы в начале новых уровней</small></span>${sw(st.hints)}</button>
        <button class="row rowbtn" data-act="t-speed"><span class="lbl"><b>Быстрый забег</b><small>Белки бегут вдвое быстрее по умолчанию</small></span>${sw(st.speed2x)}</button>
      </div>
      <div class="card glass">
        <h3>Сохранения</h3>
        <p class="note">Прогресс хранится только на этом устройстве и сохраняется сам после каждого уровня. Обновления игры его не стирают. Если давно не открывать игру, Safari может очистить данные сайта, поэтому иногда сохраняй копию.</p>
        <button class="row rowbtn" data-act="export"><span class="lbl"><b>Сохранить копию</b><small>Файл JSON с прогрессом, можно положить в «Файлы»</small></span>${icon('download', 20)}</button>
        <button class="row rowbtn" data-act="import"><span class="lbl"><b>Загрузить из файла</b><small>Восстановить прогресс из копии</small></span>${icon('upload', 20)}</button>
        <button class="row rowbtn" data-act="paste"><span class="lbl"><b>Вставить текстом</b><small>Если копия лежит в заметках или сообщении</small></span>${icon('clipboard-paste', 20)}</button>
        <button class="row rowbtn" data-act="reset"><span class="lbl"><b style="color:#ffb4a9">Сбросить прогресс</b><small>Удалить уровни, звёзды и статистику</small></span>${icon('trash-2', 20)}</button>
        <input type="file" accept="application/json,.json,text/plain" hidden id="importFile">
      </div>
      <div class="card glass">
        <h3>О игре</h3>
        <div class="row"><span class="lbl"><b>Версия</b><small>v${GAME_VERSION} · уровней: ${app.levels.length}</small></span></div>
        <div class="row"><span class="lbl"><b>Хранилище</b><small>${where}${storageInfo.persisted ? ' · защищено от очистки' : ''} · сохранено ${esc(updated)}</small></span></div>
        <div class="row"><span class="lbl"><b>Графика и звук</b><small>Своя векторная графика, звуки Kenney (CC0), шрифты Unbounded и Manrope (OFL), иконки Lucide (ISC)</small></span></div>
      </div>
    </div>
  </section>`);
  const back = () => (from === 'pause' ? backToPausedLevel() : showMenu());
  bindClicks($ui, {
    back,
    't-sound': () => { st.sound = !st.sound; setSoundEnabled(st.sound); persist(); showSettings(from); },
    't-hints': () => { st.hints = !st.hints; persist(); showSettings(from); },
    't-speed': () => { st.speed2x = !st.speed2x; app.speed2x = st.speed2x; persist(); showSettings(from); },
    export: () => doExport(),
    import: () => $ui.querySelector('#importFile').click(),
    paste: () => openPaste(from),
    reset: () => openReset(from),
  });
  $ui.querySelector('#importFile').addEventListener('change', async (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    try { applyImported(parseImport(await f.text()), from); } catch (err) { toast(err.message || 'Не удалось прочитать файл'); play('denied'); }
  });
}

async function doExport() {
  await persist();
  const text = exportText(app.save);
  const name = `shaman-save-${new Date().toISOString().slice(0, 10)}.json`;
  try {
    const file = new File([text], name, { type: 'application/json' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: 'Сохранение «Шаман»' });
      toast('Копия сохранена');
      return;
    }
  } catch (e) {
    if (e && e.name === 'AbortError') return;
  }
  try {
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    toast('Файл с копией скачан');
  } catch {
    try { await navigator.clipboard.writeText(text); toast('Копия скопирована в буфер обмена'); } catch { toast('Не удалось сохранить копию'); }
  }
}

function applyImported(data, from) {
  modal(`
    <span class="eyebrow">Восстановление</span>
    <h2>Заменить текущий прогресс?</h2>
    <p class="lead">В копии: пройдено уровней ${Object.values(data.levels).filter((l) => l.completed).length}, звёзд ${totalStars(data)}. Текущий прогресс будет заменён.</p>
    <div class="btns two"><button class="btn secondary" data-act="no">Отмена</button><button class="btn primary" data-act="yes">Заменить</button></div>`, {
    no: () => closeModal(),
    yes: async () => {
      app.save = data;
      setSoundEnabled(data.settings.sound);
      app.speed2x = !!data.settings.speed2x;
      await persist();
      closeModal();
      toast('Прогресс восстановлен');
      showSettings(from === 'pause' ? 'menu' : from);
    },
  });
}

function openPaste(from) {
  modal(`
    <span class="eyebrow">Восстановление</span>
    <h2>Вставь текст копии</h2>
    <p class="lead">Открой файл копии, скопируй всё содержимое и вставь сюда.</p>
    <textarea class="paste" placeholder="{ &quot;format&quot;: &quot;shaman-squirrels-export&quot; … }"></textarea>
    <div class="btns two"><button class="btn secondary" data-act="no">Отмена</button><button class="btn primary" data-act="yes">Загрузить</button></div>`, {
    no: () => closeModal(),
    yes: () => {
      const t = $ui.querySelector('textarea.paste').value.trim();
      try { const d = parseImport(t); closeModal(); applyImported(d, from); } catch (e) { toast(e.message || 'Текст не похож на копию'); play('denied'); }
    },
  });
}

function openReset(from) {
  modal(`
    <span class="eyebrow" style="color:#ff9d91">Внимание</span>
    <h2>Удалить весь прогресс?</h2>
    <p class="lead">Пройденные уровни, звёзды, орехи, награды и статистика пропадут. Отменить это нельзя. Сначала можно сохранить копию.</p>
    <div class="btns"><button class="btn secondary block" data-act="exp">${icon('download', 18)}Сохранить копию</button>
    <button class="btn danger block" data-act="yes">Удалить прогресс</button>
    <button class="btn secondary block" data-act="no">Отмена</button></div>`, {
    no: () => closeModal(),
    exp: () => doExport(),
    yes: () => {
      modal(`
        <span class="eyebrow" style="color:#ff9d91">Последнее подтверждение</span>
        <h2>Точно удалить?</h2>
        <p class="lead">Чтобы подтвердить, напиши слово <b>удалить</b>.</p>
        <input class="confirm-input" autocomplete="off" autocapitalize="off" spellcheck="false">
        <div class="btns two"><button class="btn secondary" data-act="no">Отмена</button><button class="btn danger" data-act="yes">Удалить</button></div>`, {
        no: () => closeModal(),
        yes: async () => {
          const v = $ui.querySelector('.confirm-input').value.trim().toLowerCase();
          if (v !== 'удалить') { toast('Напиши «удалить», чтобы подтвердить'); play('denied'); return; }
          await wipeSave();
          app.save = defaultSave();
          app.save.settings = { ...app.save.settings, sound: true };
          await persist();
          closeModal();
          toast('Прогресс удалён');
          showMenu();
        },
      });
    },
  });
}

// ------------------------------------------------------------------ модальные окна и уведомления
function modal(inner, acts, opts = {}) {
  closeModal();
  const m = document.createElement('div');
  m.className = 'modal';
  m.innerHTML = `<div class="sheet ${opts.center ? 'center' : ''}">${inner}</div>`;
  $ui.appendChild(m);
  bindClicks(m, acts);
  return m;
}
function closeModal() { $ui.querySelectorAll('.modal').forEach((m) => m.remove()); }

function toast(text, top = false) {
  const t = document.createElement('div');
  t.className = 'toast' + (top ? ' top' : '');
  t.textContent = text;
  $ui.appendChild(t);
  setTimeout(() => t.remove(), 2700);
}

// ------------------------------------------------------------------ уровень
function startLevel(id) {
  const level = app.levels.find((l) => l.id === id);
  if (!level || !isUnlocked(app.save, app.levels, id)) return showLevels();
  stopLevel();
  closeModal();
  app.screen = 'game';
  app.level = level;
  app.placement = null;
  app.hud = null;
  app.paused = false;
  recordAttemptStart(app.save, id);
  persist();
  renderGameUI();
  const insets = measureInsets();
  app.game.scene.start('game', {
    level, insets,
    onEvent: (name, payload) => onSceneEvent(name, payload),
  });
  app.scene = app.game.scene.getScene('game');
}

function onSceneEvent(name, p) {
  if (!app.scene) return;
  if (name === 'ready') {
    app.scene.applyLayout(measureInsets());
    app.scene.setSpeed(app.speed2x ? 2 : 1);
    maybeShowTips();
  } else if (name === 'hud') {
    app.hud = p;
    updateHud();
  } else if (name === 'placement') {
    app.placement = p.active ? p : null;
    updateTray();
  } else if (name === 'sfx') {
    play(p);
  } else if (name === 'end') {
    onLevelEnd(p);
  }
}

function renderGameUI() {
  const L = app.level;
  const n = app.levels.indexOf(L) + 1;
  const art = getItemArt();
  const slots = ITEM_ORDER.map((k) => `
    <button class="slot ${L.items[k] ? '' : 'hidden'}" data-act="slot" data-item="${k}">
      <span class="ct">×${L.items[k]}</span>
      <span class="cs">${icon('sparkles', 11)}${ITEMS[k].cost}</span>
      <span class="art"><img src="${art[k]}" alt=""></span>
      <span class="nm">${ITEMS[k].short}</span>
    </button>`).join('');
  render(`
  <div class="pass">
    <div class="hud">
      <button class="iconbtn glass" data-act="pause" aria-label="Пауза">${icon('pause', 20)}</button>
      <div class="lvl glass"><small>${L.special ? 'Испытание' : 'Уровень ' + n}</small><b>${esc(L.name)}</b></div>
      <div class="goal glass">
        <div class="gl">${icon('squirrel', 18, 'sq')}<b><span class="sv">0</span><i>/${L.goal}</i></b><span class="tm">${icon('timer', 14)}<span class="tv">${fmtTime(L.timeLimit)}</span></span></div>
        <div class="bar"><span class="gb" style="width:0%"></span><em style="left:${(L.goal / L.squirrels) * 100}%"></em></div>
      </div>
    </div>
    <div class="chips" hidden></div>
    <div class="tipwrap"></div>
    <div class="tray">
      <div class="slots">${slots}</div>
      <div class="ctl"></div>
    </div>
  </div>`, 'ingame');
  bindClicks($ui, {
    pause: () => openPause(),
    slot: (el) => onSlot(el.dataset.item),
  });
  updateTray();
}

function updateHud() {
  const h = app.hud;
  if (!h || app.screen !== 'game') return;
  const sv = $ui.querySelector('.hud .sv');
  if (!sv) return;
  sv.textContent = h.saved;
  $ui.querySelector('.hud .gb').style.width = `${Math.min(100, (h.saved / h.total) * 100)}%`;
  const tv = $ui.querySelector('.hud .tv');
  const tm = $ui.querySelector('.hud .tm');
  if (h.phase === 'build') { tv.textContent = fmtTime(h.timeLimit); tm.classList.remove('warn'); }
  else { const left = h.timeLimit - h.timeSec; tv.textContent = fmtTime(left); tm.classList.toggle('warn', left < 20); }
  const chips = $ui.querySelector('.chips');
  if (h.phase === 'run' && !app.placement) {
    chips.hidden = false;
    const walking = h.alive - h.carrying;
    chips.innerHTML = [
      `<span class="chip glass">${icon('squirrel', 14, 'a')}в пути <b>${walking + h.inHollow}</b></span>`,
      `<span class="chip glass">${icon('nut', 14, 'a')}с орехом <b>${h.carrying}</b></span>`,
      h.lost ? `<span class="chip glass">${icon('x', 14, 'r')}потеряно <b>${h.lost}</b></span>` : '',
    ].join('');
  } else chips.hidden = true;
  updateTray();
}

function updateTray() {
  const tray = $ui.querySelector('.tray');
  if (!tray || !app.level) return;
  const h = app.hud || { phase: 'build', mana: app.level.mana, manaMax: app.level.mana, items: app.level.items, canUndo: false, canFinish: false };
  const pl = app.placement;
  // Слоты
  tray.querySelectorAll('.slot').forEach((el) => {
    const k = el.dataset.item;
    const count = h.items[k] || 0;
    el.querySelector('.ct').textContent = '×' + count;
    const can = count > 0 && h.mana >= ITEMS[k].cost && h.phase !== 'end';
    el.classList.toggle('off', !can && !(pl && pl.type === k));
    el.classList.toggle('sel', !!(pl && pl.type === k));
  });
  const ctl = tray.querySelector('.ctl');
  const manaHTML = (cost) => {
    const pct = h.manaMax ? (h.mana / h.manaMax) * 100 : 0;
    const cpct = cost && h.manaMax ? Math.min(pct, (cost / h.manaMax) * 100) : 0;
    return `<div class="mana"><div class="mt">${icon('sparkles', 14, 'ice')}<span>Магия</span><b>${h.mana}</b>${cost ? `<i>−${cost}</i>` : ''}</div>
      <div class="mb"><span style="width:${pct}%"></span>${cost ? `<span class="cost" style="left:${pct - cpct}%;width:${cpct}%"></span>` : ''}</div></div>`;
  };
  let mode, html;
  if (pl) {
    mode = 'place:' + pl.type + pl.valid + pl.pinned.join(',');
    const it = ITEMS[pl.type];
    let status, cls = 'ok';
    if (!pl.valid) { status = 'Здесь поставить нельзя'; cls = 'bad'; }
    else if (pl.type === 'plank' || pl.type === 'longPlank') {
      status = pl.pinned.length === 2 ? 'Оба конца прибиты' : pl.pinned.length === 1 ? 'Прибит один конец' : 'Не прибита, упадёт';
      if (pl.pinned.length < 2) cls = '';
    } else if (pl.type === 'crate') { status = 'Упадёт на опору'; cls = ''; }
    else status = 'Подбрасывает белок';
    const rot = pl.type !== 'crate';
    html = `
      ${rot ? `<button class="iconbtn" data-hold="-1" aria-label="Повернуть влево">${icon('rotate-ccw', 20)}</button>
      <button class="iconbtn" data-hold="1" aria-label="Повернуть вправо">${icon('rotate-cw', 20)}</button>` : ''}
      <span class="spacer"></span>
      <button class="iconbtn cancel" data-act="pcancel" aria-label="Отмена">${icon('x', 22)}</button>
      <button class="btn confirm" data-act="pok" ${pl.valid && pl.affordable ? '' : 'disabled'}>${icon('check', 20)}<span>Поставить</span></button>`;
    setPlaceHint(`<b>${it.name}</b><span class="dot">·</span><span>${it.cost} магии</span><span class="st ${cls}">${status}</span>`);
  } else if (h.phase === 'build') {
    mode = 'build' + h.canUndo + h.mana;
    html = `
      <button class="iconbtn" data-act="undo" aria-label="Отменить" ${h.canUndo ? '' : 'disabled'}>${icon('undo-2', 20)}</button>
      ${manaHTML(0)}
      <button class="btn primary go" data-act="release">${icon('play', 18)}<span>Выпустить</span></button>`;
  } else {
    mode = 'run' + app.speed2x + h.canFinish + h.mana;
    html = `
      <button class="speed ${app.speed2x ? 'on' : ''}" data-act="speed" aria-label="Скорость">×2${icon('fast-forward', 16)}</button>
      ${manaHTML(0)}
      ${h.canFinish ? `<button class="btn primary go" data-act="finish">${icon('flag', 18)}<span>Готово</span></button>` : ''}`;
  }
  if (!pl) setPlaceHint('');
  if (ctl.dataset.mode === mode) return;
  ctl.dataset.mode = mode;
  ctl.innerHTML = html;
  bindClicks(ctl, {
    undo: () => { app.scene && app.scene.undo(); },
    release: () => { hideTips(); app.scene && app.scene.release(); },
    speed: () => { app.speed2x = !app.speed2x; app.scene && app.scene.setSpeed(app.speed2x ? 2 : 1); updateTray(); },
    finish: () => { app.scene && app.scene.finishEarly(); },
    pcancel: () => { app.scene && app.scene.cancelPlacement(); },
    pok: () => { app.scene && app.scene.confirmPlacement(); },
  });
  ctl.querySelectorAll('[data-hold]').forEach((b) => {
    let t1 = null, t2 = null;
    const dir = Number(b.dataset.hold);
    const stop = () => { clearTimeout(t1); clearInterval(t2); t1 = t2 = null; };
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      play('select');
      app.scene && app.scene.rotateGhost(dir * ROTATE_STEP);
      t1 = setTimeout(() => { t2 = setInterval(() => app.scene && app.scene.rotateGhost(dir * ROTATE_STEP / 2), 60); }, 320);
    });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => b.addEventListener(ev, stop));
  });
}

function setPlaceHint(html) {
  let el = $ui.querySelector('.placehint');
  if (!html) { if (el) el.remove(); return; }
  if (!el) {
    el = document.createElement('div');
    el.className = 'placehint glass';
    $ui.querySelector('.pass').appendChild(el);
  }
  if (el.innerHTML !== html) el.innerHTML = html;
  const tray = $ui.querySelector('.tray');
  if (tray) el.style.bottom = (viewport().h - tray.getBoundingClientRect().top + 10) + 'px';
}

function onSlot(type) {
  const sc = app.scene;
  if (!sc || !sc.ready || sc.phase === 'end') return;
  if (app.placement && app.placement.type === type) { sc.cancelPlacement(); return; }
  if (!sc.canAfford(type)) {
    play('denied');
    toast(sc.items[type] > 0 ? 'Не хватает магии' : 'Этот предмет закончился', true);
    return;
  }
  hideTips();
  sc.startPlacement(type);
}

// ------------------------------------------------------------------ подсказки
function maybeShowTips() {
  const L = app.level;
  const rec = app.save.levels[L.id];
  if (!app.save.settings.hints || !L.tips.length) return;
  if (rec && rec.completed) return;
  showTip(0);
}
function showTip(i) {
  const wrap = $ui.querySelector('.tipwrap');
  if (!wrap || !app.level) return;
  const tips = app.level.tips;
  if (i >= tips.length) { wrap.innerHTML = ''; return; }
  const dots = tips.length > 1 ? tips.map((_, k) => `<i class="${k === i ? 'on' : ''}"></i>`).join('') : '';
  wrap.innerHTML = `<div class="tip glass">
    <div class="tt"><span class="bulb">${icon('lightbulb', 18)}</span><p>${esc(tips[i])}</p></div>
    <div class="tb"><span class="dots">${dots}</span><button class="btn secondary" data-act="next">${i < tips.length - 1 ? 'Дальше' : 'Понятно'}</button></div>
  </div>`;
  bindClicks(wrap, { next: () => showTip(i + 1) });
}
function hideTips() { const w = $ui.querySelector('.tipwrap'); if (w) w.innerHTML = ''; }

// ------------------------------------------------------------------ пауза и итог
function openPause() {
  if (!app.scene || app.screen !== 'game' || app.scene.phase === 'end') return;
  app.paused = true;
  app.game.scene.pause('game');
  const L = app.level;
  modal(`
    <span class="eyebrow">Пауза</span>
    <h2>${esc(L.name)}</h2>
    <p class="lead">Цель: вернуть домой ${L.goal} из ${L.squirrels} белок с орехами.</p>
    <div class="btns">
      <button class="btn primary block" data-act="resume">${icon('play', 18)}Продолжить</button>
      <button class="btn secondary block" data-act="restart">${icon('refresh-ccw', 18)}Начать заново</button>
      <button class="btn secondary block" data-act="sound">${icon(app.save.settings.sound ? 'volume-2' : 'volume-x', 18)}${app.save.settings.sound ? 'Выключить звук' : 'Включить звук'}</button>
      <button class="btn secondary block" data-act="levels">${icon('map', 18)}К уровням</button>
    </div>`, {
    resume: () => resumeLevel(),
    restart: () => { app.save.stats.restarts++; startLevel(L.id); },
    sound: () => { app.save.settings.sound = !app.save.settings.sound; setSoundEnabled(app.save.settings.sound); persist(); openPause(); },
    levels: () => { closeModal(); showLevels(); },
  }, { center: true });
}

function resumeLevel() {
  closeModal();
  app.paused = false;
  if (app.game.scene.isPaused('game')) app.game.scene.resume('game');
}

function backToPausedLevel() { openPause(); }

function onLevelEnd(r) {
  const L = app.level;
  const out = applyResult(app.save, app.levels, L, r, r.bounces);
  persist();
  play(r.win ? 'win' : 'lose');
  const nextId = nextLevelId(app.levels, L.id);
  const star = (on) => `<span class="st ${on ? 'on' : ''}">${icon('star', 32)}</span>`;
  const mark = (ok) => ok ? `<em class="y">${icon('check', 14)}` : `<em class="n">${icon('x', 14)}`;
  const manaGoal = L.stars.mana;
  const titles = r.win ? (r.stars === 3 ? 'Племя дома' : 'Уровень пройден') : (r.reason === 'time' ? 'Время вышло' : 'Не все вернулись');
  const lead = r.win ? '' : `<p class="lead">Нужно ${L.goal}, вернулось ${r.saved}. Попробуй по-другому расставить предметы.</p>`;
  const ach = out.achievements.map((a) => `<div class="newach">${icon('trophy', 18)}<span>Награда: ${esc(a.title)}</span></div>`).join('');
  const reward = r.win && out.reward ? `<div class="reward">${icon('nut', 18)}<span>+${out.reward} орехов в запас</span>${out.newRecord ? '<i>рекорд</i>' : ''}</div>` : '';
  setTimeout(() => {
    if (app.screen !== 'game' || app.level !== L) return;
    modal(`
      <span class="eyebrow">${L.special ? 'Испытание' : 'Уровень ' + (app.levels.indexOf(L) + 1)} · ${esc(L.name)}</span>
      <h2>${titles}</h2>
      ${lead}
      <div class="stars-big">${star(r.stars >= 1)}${star(r.stars >= 2)}${star(r.stars >= 3)}</div>
      <ul class="crit">
        <li><span>${icon('squirrel', 16)}Вернулись с орехом</span><b>${r.saved} / ${r.total}</b>${mark(r.saved >= L.goal)}цель ${L.goal}</em></li>
        <li><span>${icon('sparkles', 16)}Потрачено магии</span><b>${r.manaSpent}</b>${mark(r.win && r.manaOk)}≤ ${manaGoal}</em></li>
        <li><span>${icon('timer', 16)}Время до цели</span><b>${r.win ? fmtTime(r.timeSec) : '—'}</b>${mark(r.win && r.timeOk)}≤ ${fmtTime(L.stars.timeSec)}</em></li>
      </ul>
      ${reward}${ach}
      <div class="btns two">
        <button class="btn secondary" data-act="again">${icon('refresh-ccw', 18)}Заново</button>
        ${r.win && nextId ? `<button class="btn primary" data-act="next">Дальше${icon('chevron-right', 18)}</button>`
          : `<button class="btn primary" data-act="levels">${icon('map', 18)}Уровни</button>`}
      </div>`, {
      again: () => startLevel(L.id),
      next: () => startLevel(nextId),
      levels: () => { closeModal(); showLevels(); },
    }, { center: true });
    if (r.stars) setTimeout(() => play('star'), 250);
  }, r.win ? 650 : 500);
}

// ------------------------------------------------------------------ service worker
function registerSW() {
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
  navigator.serviceWorker.register('service-worker.js').then((reg) => {
    reg.update().catch(() => {});
  }).catch((e) => console.warn('SW', e));
  let reloaded = false;
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // Первая установка: страница уже свежая, перезагружать не нужно.
    if (reloaded || !hadController) return;
    // Новая версия активна. Во время уровня не мешаем, перезагрузимся в меню.
    if (app.screen === 'game') { app.pendingReload = true; return; }
    reloaded = true;
    persist().then(() => location.reload());
  });
}

boot();
