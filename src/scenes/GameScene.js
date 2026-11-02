// Игровая сцена: острова, дупло, орехи, белки, предметы шамана.
// Физика идёт фиксированным шагом. На подготовке время стоит,
// после «Выпустить» белки бегут сами.

import { WORLD, STEP_MS, ITEMS, PIN_RADIUS, CAT, SQUIRREL } from '../config.js';
import { islandArt, squirrelSVG, nutSVG, nutPileSVG, stumpSVG, STUMP, plankSVG, boltSVG, crateSVG, trampolineSVG, spikesSVG } from '../art/svg.js';
import { addSVGTexture } from '../art/textures.js';
import { convexHull, pointInPoly, distToPoly, rectCorners, rad } from '../systems/geometry.js';
import { Squirrel } from '../entities/Squirrel.js';
import { createPlank, createCrate, createTrampoline, syncProp, destroyProp, plankEnds, currentEnd, trampNormal } from '../entities/props.js';

const Matter = () => Phaser.Physics.Matter.Matter;

export class GameScene extends Phaser.Scene {
  constructor() { super('game'); }

  init(data) {
    this.level = data.level;
    this.headless = !!data.headless;
    this.onEventCb = data.onEvent || (() => {});
    this.layoutInsets = data.insets || { top: 120, bottom: 220 };
    this.ready = false;
  }

  async create() {
    const L = this.level;
    this.phase = 'build';          // build | run | end
    this.mana = L.mana;
    this.manaSpent = 0;
    this.items = { plank: 0, longPlank: 0, crate: 0, trampoline: 0, ...(L.items || {}) };
    this.placed = [];
    this.undoStack = [];
    this.squirrels = [];
    this.released = 0;
    this.saved = 0;
    this.lost = 0;
    this.runSteps = 0;
    this.goalStep = null;
    this.lastEventStep = 0;
    this.bounces = 0;
    this.spawnTimer = 0;
    this.acc = 0;
    this.stepsPerFrame = 1;
    this.ghost = null;
    this.placementPaused = false;
    this.itemsUsed = { plank: 0, longPlank: 0, crate: 0, trampoline: 0 };

    const world = this.matter.world;
    world.autoUpdate = false;
    const eng = world.engine;
    eng.positionIterations = 10;
    eng.velocityIterations = 8;
    eng.constraintIterations = 4;
    world.setGravity(0, 1);

    if (!this.headless) {
      this.texScale = this.computeTexScale();
      await this.makeTextures();
      if (!this.sys || !this.sys.isActive()) return; // сцену закрыли во время загрузки
    }
    this.buildLevel();
    this.setupInput();
    this.applyLayout();
    this.ready = true;
    this.emitHud();
    this.onEventCb('ready');
  }

  // ---------------------------------------------------------- текстуры
  computeTexScale() {
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const z = this.fitZoom() * dpr;
    return Math.min(4, Math.max(1.5, Math.ceil(z * 2) / 2));
  }

  async makeTextures() {
    const s = this.texScale;
    const L = this.level;
    const jobs = [];
    const tex = (k, svg, sc = s) => { if (!this.textures.exists(k) || this._texScaleUsed !== sc) jobs.push(addSVGTexture(this, k, svg, sc)); };
    tex('sqA', squirrelSVG('A'), s * 40 / 64);
    tex('sqB', squirrelSVG('B'), s * 40 / 64);
    tex('nut', nutSVG(), s * 0.6);
    tex('nutpile', nutPileSVG());
    tex('stump', stumpSVG());
    tex('plank_' + ITEMS.plank.len, plankSVG(ITEMS.plank.len));
    tex('plank_' + ITEMS.longPlank.len, plankSVG(ITEMS.longPlank.len));
    tex('bolt', boltSVG());
    tex('crate', crateSVG(ITEMS.crate.size));
    tex('trampoline', trampolineSVG());
    this.islandArts = L.islands.map((isl, i) => islandArt({ ...isl, seed: isl.seed ?? i + 1 }));
    this.islandArts.forEach((a, i) => jobs.push(addSVGTexture(this, `isl_${L.id}_${i}`, a.svg, s)));
    (L.spikes || []).forEach((sp, i) => jobs.push(addSVGTexture(this, `spk_${L.id}_${i}`, spikesSVG(sp.w), s)));
    await Promise.all(jobs);
    this._texScaleUsed = s;
  }

  // ---------------------------------------------------------- уровень
  buildLevel() {
    const L = this.level;
    const M = Matter();
    const add = (b) => this.matter.world.add(b);
    this.islandPolys = [];
    const arts = this.islandArts || L.islands.map((isl, i) => islandArt({ ...isl, seed: isl.seed ?? i + 1 }));

    L.islands.forEach((isl, i) => {
      const art = arts[i];
      // Корпус острова: выпуклая оболочка + ровная «плита» сверху.
      const hull = convexHull(art.body.concat([[isl.x, isl.y], [isl.x + isl.w, isl.y]]));
      const slab = M.Bodies.rectangle(isl.x + isl.w / 2, isl.y + 10, isl.w, 20, {
        isStatic: true, label: 'terrain', friction: 0.8,
        collisionFilter: { category: CAT.TERRAIN, mask: 0xffff },
      });
      const cx = hull.reduce((a, p) => a + p[0], 0) / hull.length;
      const cy = hull.reduce((a, p) => a + p[1], 0) / hull.length;
      const core = M.Bodies.fromVertices(cx, cy, [hull.map(([x, y]) => ({ x, y }))], {
        isStatic: true, label: 'terrain', friction: 0.8,
        collisionFilter: { category: CAT.TERRAIN, mask: 0xffff },
      });
      // fromVertices центрирует по центру масс — возвращаем на место.
      const b = core.bounds;
      const hb = hull.reduce((a, p) => ({ minX: Math.min(a.minX, p[0]), minY: Math.min(a.minY, p[1]) }), { minX: 1e9, minY: 1e9 });
      M.Body.setPosition(core, { x: core.position.x + (hb.minX - b.min.x), y: core.position.y + (hb.minY - b.min.y) });
      add(slab); add(core);
      const poly = hull;
      this.islandPolys.push({ poly, top: isl.y, x0: isl.x, x1: isl.x + isl.w });
      if (!this.headless) {
        this.add.image(art.rect.x, art.rect.y, `isl_${L.id}_${i}`).setOrigin(0, 0).setDisplaySize(art.rect.w, art.rect.h).setDepth(10);
      }
    });

    // Невидимые стены по краям мира: белки разворачиваются.
    const wallOpts = { isStatic: true, label: 'bound', collisionFilter: { category: CAT.TERRAIN, mask: CAT.SQUIRREL | CAT.CRATE } };
    add(M.Bodies.rectangle(-12, WORLD.h / 2 - 200, 24, WORLD.h + 800, wallOpts));
    add(M.Bodies.rectangle(WORLD.w + 12, WORLD.h / 2 - 200, 24, WORLD.h + 800, wallOpts));

    // Дупло.
    const H = L.hollow;
    this.homeSensor = M.Bodies.rectangle(H.x, H.y - 22, 46, 44, {
      isStatic: true, isSensor: true, label: 'home',
      collisionFilter: { category: CAT.SENSOR, mask: CAT.SQUIRREL },
    });
    add(this.homeSensor);
    if (!this.headless) {
      this.stump = this.add.image(H.x, H.y + (STUMP.h - STUMP.baseY), 'stump').setOrigin(0.5, 1).setDepth(15);
      this.stump.setDisplaySize(STUMP.w, STUMP.h);
      this.hollowEyes = this.add.graphics().setDepth(16);
      this.drawEyes();
    }

    // Орехи.
    const N = L.nuts;
    this.nutSensor = M.Bodies.rectangle(N.x, N.y - 16, 54, 32, {
      isStatic: true, isSensor: true, label: 'nuts',
      collisionFilter: { category: CAT.SENSOR, mask: CAT.SQUIRREL },
    });
    add(this.nutSensor);
    if (!this.headless) {
      this.nutPile = this.add.image(N.x, N.y + 2, 'nutpile').setOrigin(0.5, 1).setDepth(14).setDisplaySize(110, 72);
      this.tweens.add({ targets: this.nutPile, scaleY: this.nutPile.scaleY * 1.02, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    }

    // Шипы.
    (L.spikes || []).forEach((sp, i) => {
      add(M.Bodies.rectangle(sp.x + sp.w / 2, sp.y - 8, sp.w - 4, 14, {
        isStatic: true, isSensor: true, label: 'spikes',
        collisionFilter: { category: CAT.SENSOR, mask: CAT.SQUIRREL },
      }));
      if (!this.headless) this.add.image(sp.x, sp.y + 1, `spk_${L.id}_${i}`).setOrigin(0, 1).setDisplaySize(Math.ceil(sp.w), 22).setDepth(13);
    });

    // Заранее стоящие предметы уровня.
    for (const p of L.props || []) {
      const obj = this.spawnProp(p, p.type === 'plank' || p.type === 'longPlank' ? this.computePins(p) : []);
      obj.preset = true;
    }

    if (!this.headless) {
      this.ghostGfx = this.add.graphics().setDepth(40);
      this.ghostImg = null;
    }
  }

  drawEyes() {
    const g = this.hollowEyes;
    g.clear();
    const remaining = this.level.squirrels - this.released;
    if (remaining <= 0) return;
    const hx = this.level.hollow.x + 2, hy = this.level.hollow.y - (STUMP.baseY - STUMP.hollowY);
    g.fillStyle(0xffcf73, 1);
    g.fillEllipse(hx - 5, hy, 4.6, 5.6);
    g.fillEllipse(hx + 5, hy, 4.6, 5.6);
  }

  // ---------------------------------------------------------- раскладка
  // Поле уровня вписывается в свободную область между панелями интерфейса.
  // На телефоне панели сверху и снизу, на планшете в альбомной ориентации — ещё и справа.
  fitZoom() {
    const cssW = this.scale.gameSize.width / this.dpr();
    const cssH = this.scale.gameSize.height / this.dpr();
    const { top, bottom, left = 0, right = 0 } = this.layoutInsets;
    const availW = Math.max(200, cssW - left - right);
    const availH = Math.max(200, cssH - top - bottom);
    return Math.min(availW / WORLD.w, availH / WORLD.h);
  }
  dpr() { return this.game.registry.get('dpr') || 1; }

  applyLayout(insets) {
    if (insets) this.layoutInsets = insets;
    if (this.headless) return;
    const cam = this.cameras.main;
    const dpr = this.dpr();
    const z = this.fitZoom() * dpr;
    cam.setZoom(z);
    const W = this.scale.gameSize.width, Hh = this.scale.gameSize.height;
    const { top, bottom, left = 0, right = 0 } = this.layoutInsets;
    const desiredX = (left + (W / dpr - left - right) / 2) * dpr;
    const desiredY = (top + (Hh / dpr - top - bottom) / 2) * dpr;
    const dx = desiredX - W / 2, dy = desiredY - Hh / 2;
    cam.centerOn(WORLD.w / 2 - dx / z, WORLD.h / 2 - dy / z);
    this.zoom = z;
  }

  // ---------------------------------------------------------- ввод
  setupInput() {
    if (this.headless) return;
    this.dragging = null;
    this.input.on('pointerdown', (p) => {
      if (!this.ghost) return;
      this.dragging = { x: p.x, y: p.y, id: p.id };
    });
    this.input.on('pointermove', (p) => {
      if (!this.ghost || !this.dragging || this.dragging.id !== p.id || !p.isDown) return;
      const dx = (p.x - this.dragging.x) / this.zoom, dy = (p.y - this.dragging.y) / this.zoom;
      this.dragging.x = p.x; this.dragging.y = p.y;
      this.ghost.x = Phaser.Math.Clamp(this.ghost.x + dx, -30, WORLD.w + 30);
      this.ghost.y = Phaser.Math.Clamp(this.ghost.y + dy, -20, WORLD.h + 40);
      this.refreshGhost();
    });
    const end = (p) => { if (this.dragging && this.dragging.id === p.id) this.dragging = null; };
    this.input.on('pointerup', end);
    this.input.on('pointerupoutside', end);
  }

  // ---------------------------------------------------------- шаман: установка
  canAfford(type) {
    return (this.items[type] || 0) > 0 && this.mana >= ITEMS[type].cost;
  }

  startPlacement(type) {
    if (this.phase === 'end' || !this.canAfford(type)) return false;
    const prev = this.ghost;
    const L = this.level;
    const def = L.ghostStart || { x: (L.hollow.x + L.nuts.x) / 2, y: Math.min(L.hollow.y, L.nuts.y) - 40 };
    this.ghost = { type, x: prev ? prev.x : def.x, y: prev ? prev.y : def.y, angle: prev && prev.type === type ? prev.angle : 0 };
    if (this.phase === 'run') this.placementPaused = true;
    if (!this.headless) {
      if (this.ghostImg) this.ghostImg.destroy();
      const key = type === 'crate' ? 'crate' : type === 'trampoline' ? 'trampoline' : 'plank_' + ITEMS[type].len;
      this.ghostImg = this.add.image(0, 0, key).setDepth(39).setAlpha(0.9);
      if (type === 'crate') this.ghostImg.setDisplaySize(ITEMS.crate.size + 4, ITEMS.crate.size + 4);
      else if (type === 'trampoline') this.ghostImg.setDisplaySize(70, 30).setOrigin(0.5, 9 / 30);
      else this.ghostImg.setDisplaySize(ITEMS[type].len + 6, ITEMS[type].thick + 6);
    }
    this.refreshGhost();
    return true;
  }

  rotateGhost(deltaDeg) {
    if (!this.ghost || this.ghost.type === 'crate') return;
    this.ghost.angle = Phaser.Math.Clamp(this.ghost.angle + deltaDeg, -80, 80);
    this.refreshGhost();
  }

  cancelPlacement() {
    this.ghost = null;
    this.placementPaused = false;
    if (this.ghostImg) { this.ghostImg.destroy(); this.ghostImg = null; }
    if (this.ghostGfx) this.ghostGfx.clear();
    this.onEventCb('placement', { active: false });
  }

  confirmPlacement() {
    const g = this.ghost;
    if (!g) return false;
    const ev = this.evaluate(g);
    if (!ev.valid || !this.canAfford(g.type)) { this.onEventCb('sfx', 'denied'); return false; }
    this.placeItem({ type: g.type, x: g.x, y: g.y, angle: g.angle }, ev.pins);
    this.cancelPlacement();
    return true;
  }

  // Ставит предмет и списывает магию. Используется и игроком, и автотестом.
  placeItem(spec, pins) {
    const it = ITEMS[spec.type];
    this.mana -= it.cost;
    this.manaSpent += it.cost;
    this.items[spec.type]--;
    this.itemsUsed[spec.type]++;
    const obj = this.spawnProp(spec, pins || []);
    if (this.phase === 'build') this.undoStack.push(obj);
    this.onEventCb('sfx', spec.type === 'crate' ? 'crate' : 'place');
    if (pins && pins.length) this.time.delayedCall(90, () => this.onEventCb('sfx', 'pin'));
    this.emitHud();
    return obj;
  }

  spawnProp(spec, pins) {
    let obj;
    if (spec.type === 'crate') obj = createCrate(this, spec);
    else if (spec.type === 'trampoline') obj = createTrampoline(this, spec);
    else obj = createPlank(this, spec, pins);
    this.placed.push(obj);
    syncProp(obj);
    return obj;
  }

  undo() {
    if (this.phase !== 'build') return false;
    const obj = this.undoStack.pop();
    if (!obj) return false;
    // Сначала снимаем доски, прибитые к этой.
    for (const o of [...this.placed]) {
      if (o.kind === 'plank' && o !== obj && o.pins.some((p) => p.kind === 'plank' && p.target === obj)) {
        const M = Matter();
        o.pins = o.pins.filter((p) => {
          if (p.kind === 'plank' && p.target === obj) { M.Composite.remove(this.matter.world.localWorld, p.constraint); return false; }
          return true;
        });
        o.bolts = o.bolts.filter((b) => { const keep = o.pins.some((p) => p.end === b.end); if (!keep) b.img.destroy(); return keep; });
      }
    }
    destroyProp(this, obj);
    this.placed = this.placed.filter((o) => o !== obj);
    const it = ITEMS[obj.type];
    this.mana += it.cost;
    this.manaSpent -= it.cost;
    this.items[obj.type]++;
    this.itemsUsed[obj.type]--;
    this.onEventCb('sfx', 'back');
    this.emitHud();
    return true;
  }

  computePins(spec) {
    if (spec.type !== 'plank' && spec.type !== 'longPlank') return [];
    const ends = plankEnds(spec.x, spec.y, spec.angle, ITEMS[spec.type].len);
    const pins = [];
    ends.forEach((e, end) => {
      // 1) конец другой доски
      let best = null, bd = PIN_RADIUS;
      for (const o of this.placed) {
        if (o.kind !== 'plank') continue;
        for (const te of [0, 1]) {
          const p = currentEnd(o, te);
          const d = Math.hypot(p.x - e.x, p.y - e.y);
          if (d < bd) { bd = d; best = { end, kind: 'plank', target: o, targetEnd: te, point: p }; }
        }
      }
      if (best) { pins.push(best); return; }
      // 2) остров
      for (const isl of this.islandPolys) {
        if (pointInPoly(e.x, e.y, isl.poly) || distToPoly(e.x, e.y, isl.poly) < PIN_RADIUS * 0.75
            || (e.x >= isl.x0 - 6 && e.x <= isl.x1 + 6 && Math.abs(e.y - isl.top) < PIN_RADIUS)) {
          pins.push({ end, kind: 'world', point: { x: e.x, y: e.y } });
          return;
        }
      }
    });
    return pins;
  }

  evaluate(g) {
    const it = ITEMS[g.type];
    let valid = true;
    // Доска может лежать на поверхности и чуть врезаться в край — это нормально.
    // Нельзя только проводить её сквозь толщу острова.
    const inTerrain = (x, y, tol = 3) => this.islandPolys.some((isl) => pointInPoly(x, y, isl.poly) && y > isl.top + tol);
    const inCrate = (x, y) => this.placed.some((o) => o.kind === 'crate' && Math.abs(o.body.position.x - x) < 22 && Math.abs(o.body.position.y - y) < 22);
    let pins = [];
    if (g.type === 'plank' || g.type === 'longPlank') {
      const ends = plankEnds(g.x, g.y, g.angle, it.len);
      for (let t = 0.3; t <= 0.701; t += 0.05) {
        const x = ends[0].x + (ends[1].x - ends[0].x) * t, y = ends[0].y + (ends[1].y - ends[0].y) * t;
        if (inTerrain(x, y, 22) || inCrate(x, y)) { valid = false; break; }
      }
      pins = this.computePins(g);
    } else if (g.type === 'crate') {
      const s = it.size;
      const pts = rectCorners(g.x, g.y, s - 6, s - 6, 0).concat([[g.x, g.y]]);
      if (pts.some(([x, y]) => inTerrain(x, y))) valid = false;
      if (this.placed.some((o) => o.kind === 'crate' && Math.hypot(o.body.position.x - g.x, o.body.position.y - g.y) < s - 2)) valid = false;
    } else if (g.type === 'trampoline') {
      const pts = rectCorners(g.x, g.y, it.w - 6, it.h - 4, rad(g.angle)).concat([[g.x, g.y]]);
      if (pts.some(([x, y]) => inTerrain(x, y) || inCrate(x, y))) valid = false;
    }
    if (g.x < -10 || g.x > WORLD.w + 10 || g.y < 10 || g.y > WORLD.h + 30) valid = false;
    return { valid, pins };
  }

  refreshGhost() {
    const g = this.ghost;
    if (!g) return;
    const ev = this.evaluate(g);
    const it = ITEMS[g.type];
    if (!this.headless) {
      const gfx = this.ghostGfx;
      gfx.clear();
      this.ghostImg.setPosition(g.x, g.y).setRotation(rad(g.angle));
      this.ghostImg.setTint(ev.valid ? 0xffffff : 0xff8a7d);
      const col = ev.valid ? 0x7fe3ff : 0xff6b5b;
      const lw = 1.6 / Math.max(0.5, this.zoom / (this.dpr() || 1));
      if (g.type === 'plank' || g.type === 'longPlank') {
        const ends = plankEnds(g.x, g.y, g.angle, it.len);
        // Свечение под доской.
        gfx.lineStyle(it.thick + 10, col, 0.18);
        gfx.lineBetween(ends[0].x, ends[0].y, ends[1].x, ends[1].y);
        ends.forEach((e, i) => {
          const pinned = ev.pins.some((p) => p.end === i);
          if (pinned) {
            gfx.fillStyle(0x7fe3ff, 0.25); gfx.fillCircle(e.x, e.y, 11);
            gfx.lineStyle(lw * 1.4, 0x7fe3ff, 1); gfx.strokeCircle(e.x, e.y, 9);
            gfx.fillStyle(0xbff1ff, 1); gfx.fillCircle(e.x, e.y, 3);
          } else {
            gfx.lineStyle(lw, 0xffffff, 0.7); gfx.strokeCircle(e.x, e.y, 8);
          }
        });
      } else {
        const w = g.type === 'crate' ? it.size + 10 : it.w + 10, h = g.type === 'crate' ? it.size + 10 : 26;
        const pts = rectCorners(g.x, g.y, w, h, rad(g.angle));
        gfx.lineStyle(lw * 1.2, col, 0.9);
        gfx.strokePoints(pts.map(([x, y]) => ({ x, y })), true);
      }
    }
    const pinned = ev.pins.map((p) => p.end);
    this.onEventCb('placement', { active: true, type: g.type, valid: ev.valid, pinned, affordable: this.canAfford(g.type) });
  }

  // ---------------------------------------------------------- забег
  release() {
    if (this.phase !== 'build') return;
    this.phase = 'run';
    this.undoStack = [];
    this.spawnTimer = 0;
    this.onEventCb('sfx', 'release');
    this.emitHud();
  }

  setSpeed(n) { this.stepsPerFrame = n; }

  update(time, delta) {
    if (!this.ready) return;
    if (this.phase === 'run' && !this.placementPaused) {
      this.acc += Math.min(delta, 100);
      let steps = 0;
      while (this.acc >= STEP_MS && steps < 8) {
        this.acc -= STEP_MS;
        for (let i = 0; i < this.stepsPerFrame && this.phase === 'run'; i++) this.tick();
        steps++;
      }
    } else {
      this.acc = 0;
    }
    if (!this.headless) this.renderFrame();
  }

  renderFrame() {
    for (const s of this.squirrels) s.render();
    for (const o of this.placed) syncProp(o);
  }

  tick() {
    const L = this.level;
    // Выпуск белок по одной.
    if (this.released < L.squirrels) {
      if (this.spawnTimer <= 0) {
        this.spawnSquirrel();
        this.spawnTimer = Math.round((L.spawnInterval || 1.15) * 60);
      }
      this.spawnTimer--;
    }

    // Контакты с прошлого шага.
    const contacts = new Map();
    for (const s of this.squirrels) contacts.set(s.body, []);
    const pairs = this.matter.world.engine.pairs.list;
    const events = [];
    for (const pair of pairs) {
      if (!pair.isActive) continue;
      const a = pair.bodyA.parent || pair.bodyA, b = pair.bodyB.parent || pair.bodyB;
      let sq = null, other = null;
      if (contacts.has(a)) { sq = a; other = b; } else if (contacts.has(b)) { sq = b; other = a; }
      if (!sq) continue;
      const label = other.label;
      if (pair.isSensor || other.isSensor) {
        events.push([sq.plugin.squirrel, label, other]);
        continue;
      }
      const n = pair.collision.normal;
      // Направляем нормаль от опоры к белке.
      const sup = pair.collision.supports && pair.collision.supports[0];
      let ux = n.x, uy = n.y;
      const ref = sup ? { x: sq.position.x - sup.x, y: sq.position.y - sup.y } : { x: sq.position.x - other.position.x, y: sq.position.y - other.position.y };
      if (ux * ref.x + uy * ref.y < 0) { ux = -ux; uy = -uy; }
      contacts.get(sq).push({ label, upN: { x: ux, y: uy }, other });
    }

    for (const [s, label, other] of events) {
      if (s.state !== 'walk') continue;
      if (label === 'tramp') { if (s.launch(other.plugin.obj.normal)) { this.bounces++; this.onEventCb('sfx', 'boing'); } }
      else if (label === 'spikes') this.loseSquirrel(s, 'spikes');
      else if (label === 'nuts' && !s.hasNut) { s.takeNut(); this.onEventCb('sfx', 'nut'); }
      else if (label === 'home' && s.hasNut) this.saveSquirrel(s);
    }

    for (const s of this.squirrels) {
      if (s.state !== 'walk') continue;
      if (s.y > WORLD.killY) { this.loseSquirrel(s, 'fall'); continue; }
      s.step(contacts.get(s.body) || []);
    }
    this.squirrels = this.squirrels.filter((s) => s.state === 'walk');

    this.matter.world.step(STEP_MS);
    this.runSteps++;
    if (this.runSteps % 15 === 0) this.emitHud();
    this.checkEnd();
  }

  spawnSquirrel() {
    const H = this.level.hollow;
    const hy = H.y - (STUMP.baseY - STUMP.hollowY);
    const s = new Squirrel(this, H.x + H.dir * 8, hy + 6, H.dir);
    this.squirrels.push(s);
    this.released++;
    if (!this.headless) this.drawEyes();
  }

  saveSquirrel(s) {
    s.state = 'saved';
    this.lastEventStep = this.runSteps;
    this.saved++;
    if (this.saved === this.level.goal && this.goalStep === null) this.goalStep = this.runSteps;
    this.onEventCb('sfx', 'saved');
    if (!this.headless && s.sprite) {
      const H = this.level.hollow;
      const hy = H.y - (STUMP.baseY - STUMP.hollowY);
      this.matter.world.remove(s.body); s.body = null;
      this.tweens.add({ targets: [s.sprite, s.nutSprite], x: H.x + 2, y: hy, scale: s.sprite.scale * 0.4, alpha: 0, duration: 380, ease: 'Quad.in', onComplete: () => s.destroy() });
      this.popText(H.x, hy - 30, '+1', '#8fe39a');
    } else s.destroy();
    this.emitHud();
  }

  loseSquirrel(s, why) {
    s.state = 'lost';
    this.lastEventStep = this.runSteps;
    this.lost++;
    this.onEventCb('sfx', 'lost');
    if (!this.headless && s.sprite) {
      const x = Phaser.Math.Clamp(s.x, 20, WORLD.w - 20), y = Math.min(s.y, WORLD.h - 10);
      this.popText(x, y - 20, '−1', '#ff8a7d');
      this.matter.world.remove(s.body); s.body = null;
      this.tweens.add({ targets: [s.sprite, s.nutSprite], alpha: 0, angle: 160, y: '+=30', duration: 420, onComplete: () => s.destroy() });
    } else s.destroy();
    this.emitHud();
  }

  popText(x, y, text, color) {
    const t = this.add.text(x, y, text, { fontFamily: 'Unbounded, sans-serif', fontSize: '15px', fontStyle: '700', color, stroke: '#14182a', strokeThickness: 4 })
      .setOrigin(0.5).setDepth(50).setResolution(this.zoom || 2);
    this.tweens.add({ targets: t, y: y - 26, alpha: 0, duration: 900, ease: 'Quad.out', onComplete: () => t.destroy() });
  }

  outcome() {
    const L = this.level;
    const alive = this.squirrels.filter((s) => s.state === 'walk').length;
    const pending = L.squirrels - this.released;
    return { alive, pending, possible: this.saved + alive + pending >= L.goal };
  }

  checkEnd() {
    const L = this.level;
    const o = this.outcome();
    const limit = (L.timeLimit || 150) * 60;
    if (this.saved >= L.goal && o.alive === 0 && o.pending === 0) return this.finish(true, 'all');
    if (!o.possible) return this.finish(false, 'lost');
    if (o.alive === 0 && o.pending === 0) return this.finish(this.saved >= L.goal, 'all');
    if (this.runSteps >= limit) return this.finish(this.saved >= L.goal, 'time');
    // Цель выполнена, а оставшиеся белки давно ходят кругами — засчитываем победу.
    if (this.saved >= L.goal && this.runSteps - this.lastEventStep > 20 * 60) return this.finish(true, 'idle');
  }

  // Игрок может закончить уровень, как только цель выполнена.
  finishEarly() {
    if (this.phase === 'run' && this.saved >= this.level.goal) this.finish(true, 'early');
  }

  finish(win, reason) {
    if (this.phase === 'end') return;
    this.phase = 'end';
    if (this.ghost) this.cancelPlacement();
    const L = this.level;
    const timeSec = (this.goalStep ?? this.runSteps) / 60;
    const manaOk = this.manaSpent <= (L.stars?.mana ?? L.mana);
    const timeOk = timeSec <= (L.stars?.timeSec ?? 999);
    const stars = win ? 1 + (manaOk ? 1 : 0) + (timeOk ? 1 : 0) : 0;
    const result = {
      win, reason, stars, saved: this.saved, lost: this.lost, goal: L.goal, total: L.squirrels,
      manaSpent: this.manaSpent, manaOk, timeSec, timeOk, timeMs: Math.round(timeSec * 1000),
      itemsUsed: { ...this.itemsUsed }, bounces: this.bounces,
    };
    this.result = result;
    this.emitHud();
    this.onEventCb('end', result);
  }

  hudState() {
    const L = this.level;
    const alive = this.squirrels.filter((s) => s.state === 'walk');
    return {
      phase: this.phase, saved: this.saved, lost: this.lost, goal: L.goal, total: L.squirrels,
      carrying: alive.filter((s) => s.hasNut).length, alive: alive.length, inHollow: L.squirrels - this.released,
      mana: this.mana, manaMax: L.mana, items: { ...this.items }, timeSec: this.runSteps / 60,
      timeLimit: L.timeLimit || 150, canUndo: this.phase === 'build' && this.undoStack.length > 0,
      canFinish: this.phase === 'run' && this.saved >= L.goal,
      idleSec: (this.runSteps - this.lastEventStep) / 60,
    };
  }

  emitHud() { this.onEventCb('hud', this.hudState()); }

  // ---------------------------------------------------------- автотест
  // Ставит эталонное решение и прогоняет физику без отрисовки.
  runSolution(solution, maxSteps = 60 * 200, traceEvery = 0) {
    this.trace = traceEvery ? [] : null;
    for (const spec of solution) {
      const pins = this.computePins(spec);
      if (!this.canAfford(spec.type)) return { error: 'не хватает предмета или магии: ' + spec.type };
      const ev = this.evaluate(spec);
      if (!ev.valid) return { error: 'недопустимая позиция: ' + JSON.stringify(spec) };
      this.placeItem(spec, pins);
    }
    this.release();
    let n = 0;
    while (this.phase === 'run' && n < maxSteps) {
      this.tick(); n++;
      if (this.trace && n % traceEvery === 0) {
        this.trace.push({ t: +(n / 60).toFixed(1), s: this.squirrels.map((q) => [Math.round(q.x), Math.round(q.y), q.dir, q.hasNut ? 1 : 0, q.grounded ? 1 : 0]) });
      }
    }
    const r = this.result || { error: 'не завершился за отведённое время', saved: this.saved, lost: this.lost };
    if (this.trace) r.trace = this.trace;
    return r;
  }
}
