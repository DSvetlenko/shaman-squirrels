// Особенности уровней, которые появляются после первого мира:
// кучи орехов с ограниченным запасом, нажимные плиты и ворота, ветхие доски,
// восходящие потоки, колючие жуки, камнепад, порталы и ядовитый туман.
//
// Каждый объект работает и в обычной игре, и в проверке уровней без графики
// (scene.headless): вся логика — в tick(), всё рисование — в render().

import { CAT, WORLD, STEP_MS } from '../config.js';

const Matter = () => Phaser.Physics.Matter.Matter;
const COLORS = [0xf2a541, 0x7fe3ff, 0xff8fb6, 0x9ff0c4];
export const COLOR_HEX = ['#f2a541', '#7fe3ff', '#ff8fb6', '#9ff0c4'];

// Язык опасности: всё, что убивает белку, помечено одинаково — красный сигнал,
// тёмный контур и светлое «!». Цвет не единственный признак: есть форма и движение.
export const HAZ = 0xff6b5b, HAZ_DEEP = 0xb3261e, HAZ_LIGHT = 0xfff4e0, HAZ_LINE = 0x26170d;

// Значок «!» в круге (радиус 10 в мировых единицах).
export function drawHazardBadge(g, x, y, s = 1, alpha = 1) {
  g.fillStyle(HAZ, alpha);
  g.fillCircle(x, y, 10 * s);
  g.lineStyle(1.8 * s, HAZ_LINE, alpha);
  g.strokeCircle(x, y, 10 * s);
  g.fillStyle(HAZ_LIGHT, alpha);
  g.fillRoundedRect(x - 1.4 * s, y - 6 * s, 2.8 * s, 7.6 * s, 1.2 * s);
  g.fillCircle(x, y + 4.6 * s, 1.5 * s);
}

function overlaps(b, x0, y0, x1, y1) {
  const bb = b.bounds;
  return bb.max.x > x0 && bb.min.x < x1 && bb.max.y > y0 && bb.min.y < y1;
}

function badge(scene, x, y, text, color = '#ffffff') {
  if (scene.headless) return null;
  return scene.add.text(x, y, text, {
    fontFamily: 'Unbounded, sans-serif', fontSize: '12px', fontStyle: '700', color,
    backgroundColor: 'rgba(13,17,27,0.78)', padding: { x: 6, y: 3 },
  }).setOrigin(0.5).setDepth(45).setResolution(Math.max(2, scene.zoom || 2));
}

// ---------------------------------------------------------------- орехи
export class NutPile {
  constructor(scene, data, i) {
    this.scene = scene;
    this.x = data.x; this.y = data.y;
    this.count = data.count == null ? null : data.count;   // null — без ограничения
    const M = Matter();
    this.sensor = M.Bodies.rectangle(this.x, this.y - 16, 54, 32, {
      isStatic: true, isSensor: true, label: 'nuts',
      collisionFilter: { category: CAT.SENSOR, mask: CAT.SQUIRREL },
    });
    this.sensor.plugin = { pile: this };
    scene.matter.world.add(this.sensor);
    if (!scene.headless) {
      this.sprite = scene.add.image(this.x, this.y + 2, 'nutpile').setOrigin(0.5, 1).setDepth(14).setDisplaySize(110, 72);
      this.tw = scene.tweens.add({ targets: this.sprite, scaleY: this.sprite.scaleY * 1.02, duration: 1400 + i * 120, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      if (this.count != null) this.label = badge(scene, Math.max(24, Math.min(376, this.x)), this.y - 64, '×' + this.count, '#ffe2b8');
    }
  }

  get empty() { return this.count === 0; }

  take() {
    if (this.count === 0) return false;
    if (this.count != null) {
      this.count--;
      if (this.label) this.label.setText(this.count ? '×' + this.count : 'пусто').setColor(this.count ? '#ffe2b8' : '#a3acbf');
      if (this.count === 0 && this.sprite) {
        this.tw.stop();
        this.scene.tweens.add({ targets: this.sprite, alpha: 0.18, duration: 400 });
      }
    }
    return true;
  }
}

// ---------------------------------------------------------------- плита и ворота
export class Gate {
  constructor(scene, data, i) {
    this.scene = scene;
    this.d = { h: 76, ...data };
    this.color = COLORS[i % COLORS.length];
    this.open = false;
    const { x, y, h } = this.d;
    const M = Matter();
    this.body = M.Bodies.rectangle(x, y - h / 2, 14, h, {
      isStatic: true, label: 'gate', friction: 0.2,
      collisionFilter: { category: CAT.TERRAIN, mask: CAT.SQUIRREL | CAT.CRATE | CAT.ROCK },
    });
    scene.matter.world.add(this.body);
    const p = this.d.plate;
    this.plate = { x0: p.x - p.w / 2, x1: p.x + p.w / 2, y: p.y };
    if (!scene.headless) {
      this.sprite = scene.add.image(x, y + 1, 'gate_' + i).setOrigin(0.5, 1).setDepth(18);
      this.sprite.setDisplaySize(26, h + 10);
      this.plateImg = scene.add.image(p.x, p.y + 2, 'plate_' + i).setOrigin(0.5, 1).setDepth(17).setDisplaySize(p.w + 8, 12);
      this.glow = scene.add.graphics().setDepth(16);
    }
  }

  pressed() {
    const { x0, x1, y } = this.plate;
    return this.scene.placed.some((o) => o.kind === 'crate' && overlaps(o.body, x0 + 4, y - 16, x1 - 4, y + 3) && o.body.position.y < y);
  }

  tick() {
    const want = this.pressed();
    if (want === this.open) return;
    this.open = want;
    this.body.collisionFilter.mask = want ? 0 : (CAT.SQUIRREL | CAT.CRATE | CAT.ROCK);
    this.scene.onEventCb('sfx', want ? 'open' : 'crate');
    if (this.sprite) {
      this.scene.tweens.add({ targets: this.sprite, y: this.d.y + 1 - (want ? this.d.h + 6 : 0), alpha: want ? 0.35 : 1, duration: 320, ease: 'Quad.out' });
    }
  }

  render() {
    if (!this.glow) return;
    const g = this.glow;
    g.clear();
    if (!this.open) return;
    const p = this.d.plate;
    g.fillStyle(this.color, 0.35);
    g.fillEllipse(p.x, p.y - 2, p.w + 18, 10);
  }
}

// ---------------------------------------------------------------- восходящий поток
export class Updraft {
  constructor(scene, data) {
    this.scene = scene;
    this.d = { bottom: WORLD.killY, ...data };
    if (!scene.headless) {
      this.g = scene.add.graphics().setDepth(12);
      const n = Math.max(4, Math.round(this.d.w / 9));
      this.streaks = Array.from({ length: n }, (_, k) => ({
        x: this.d.x + 4 + ((k * 37) % Math.max(8, this.d.w - 8)),
        y: this.d.top + ((k * 71) % Math.max(20, (this.d.bottom - this.d.top))),
        len: 14 + (k * 13) % 22, v: 1.4 + (k % 3) * 0.5,
      }));
    }
  }

  contains(x, y) {
    const d = this.d;
    return x > d.x && x < d.x + d.w && y > d.top - 30 && y < d.bottom;
  }

  // Подъёмная сила для белки в воздухе: сильная внизу, сходит на нет у верхней границы.
  apply(s) {
    const d = this.d;
    if (s.grounded || !this.contains(s.x, s.y)) return false;
    const b = s.body;
    const k = Math.max(0, Math.min(1, (s.y - d.top) / 40));
    // У верхней кромки, у края потока по ходу движения — белка выпрыгивает вбок.
    const edge = s.dir > 0 ? d.x + d.w - s.x : s.x - d.x;
    if (k < 0.7 && edge < 8) {
      Matter().Body.setVelocity(b, { x: s.dir * 1.5, y: -1.6 });
      return false;
    }
    const vy = Math.max(-3.2, b.velocity.y - 0.62 * k);
    // Глубоко в потоке белка поднимается почти вертикально, у верха — дрейфует вбок.
    const vx = b.velocity.x + (s.dir * 0.9 * (1 - k) - b.velocity.x) * 0.15;
    Matter().Body.setVelocity(b, { x: vx, y: vy });
    return true;
  }

  render() {
    if (!this.g) return;
    const g = this.g, d = this.d;
    g.clear();
    const h = Math.min(d.bottom, WORLD.h + 80) - d.top;
    // Столб воздуха: светлая полоса с мягкими краями.
    g.fillStyle(0xe6f7ff, 0.10);
    g.fillRoundedRect(d.x, d.top - 14, d.w, h + 14, 16);
    g.fillStyle(0xe6f7ff, 0.08);
    g.fillRoundedRect(d.x + d.w * 0.2, d.top - 14, d.w * 0.6, h + 14, 12);
    for (const st of this.streaks) {
      st.y -= st.v * 1.6;
      if (st.y < d.top - 12) st.y = d.top + h;
      const a = Math.min(1, (st.y - d.top + 12) / 60) * 0.85;
      g.lineStyle(2.4, 0xffffff, a);
      g.lineBetween(st.x, st.y, st.x, st.y + st.len);
    }
    // Шевроны вверх у кромки — откуда белок выносит вбок.
    this.ph = ((this.ph || 0) + 0.6) % 24;
    g.lineStyle(2.2, 0xffffff, 0.7);
    for (let k = 0; k < 2; k++) {
      const yy = d.top + 30 - ((this.ph + k * 12) % 24);
      const cx = d.x + d.w / 2;
      g.beginPath(); g.moveTo(cx - 9, yy + 6); g.lineTo(cx, yy); g.lineTo(cx + 9, yy + 6); g.strokePath();
    }
  }
}

// ---------------------------------------------------------------- колючий жук
export class Beetle {
  constructor(scene, data, i) {
    this.scene = scene;
    this.x0 = data.x0; this.x1 = data.x1; this.y = data.y;
    this.x = data.x ?? (data.x0 + data.x1) / 2;
    this.dir = data.dir || 1;
    this.speed = data.speed || 0.6;
    this.alive = true;
    this.anim = 0;
    const M = Matter();
    this.body = M.Bodies.rectangle(this.x, this.y - 10, 30, 20, {
      isStatic: true, isSensor: true, label: 'beetle',
      collisionFilter: { category: CAT.SENSOR, mask: CAT.SQUIRREL },
    });
    this.body.plugin = { beetle: this };
    scene.matter.world.add(this.body);
    if (!scene.headless) {
      this.sprite = scene.add.image(this.x, this.y + 1, 'beetleA').setOrigin(0.5, 1).setDepth(29).setDisplaySize(36, 26);
    }
  }

  blockedAhead() {
    const ax = this.x + this.dir * 18;
    return this.scene.placed.some((o) => o.kind === 'crate' && !o.gone && overlaps(o.body, ax - 3, this.y - 18, ax + 3, this.y - 2));
  }

  tick() {
    if (!this.alive) return;
    const M = Matter();
    // Раздавлен ящиком или камнем сверху.
    const hit = this.scene.placed.find((o) => o.kind === 'crate' && overlaps(o.body, this.x - 12, this.y - 24, this.x + 12, this.y - 2) && o.body.velocity.y > 0.6)
      || this.scene.rocks.find((r) => overlaps(r.body, this.x - 14, this.y - 22, this.x + 14, this.y) && r.hot > 0);
    if (hit) return this.squash();
    if (this.blockedAhead()) this.dir *= -1;
    this.x += this.dir * this.speed;
    if (this.x > this.x1) { this.x = this.x1; this.dir = -1; }
    if (this.x < this.x0) { this.x = this.x0; this.dir = 1; }
    M.Body.setPosition(this.body, { x: this.x, y: this.y - 10 });
    this.anim++;
  }

  squash() {
    this.alive = false;
    Matter().Composite.remove(this.scene.matter.world.localWorld, this.body);
    this.scene.onEventCb('sfx', 'crate');
    this.scene.beetlesSquashed = (this.scene.beetlesSquashed || 0) + 1;
    if (this.sprite) {
      this.scene.tweens.add({ targets: this.sprite, scaleY: this.sprite.scaleY * 0.25, alpha: 0, duration: 380, onComplete: () => this.sprite.destroy() });
      this.scene.popText(this.x, this.y - 30, 'хрусь', '#cdbbff');
    }
  }

  render() {
    if (!this.sprite || !this.alive) return;
    this.sprite.setPosition(this.x, this.y + 1).setFlipX(this.dir < 0);
    const f = Math.floor(this.anim / 9) % 2 ? 'beetleB' : 'beetleA';
    if (this.sprite.texture.key !== f) this.sprite.setTexture(f);
  }
}

// ---------------------------------------------------------------- камнепад
const ROCK_MASK = CAT.TERRAIN | CAT.PLANK | CAT.CRATE | CAT.ROCK | CAT.SQUIRREL;
const FIRST_ROCK_STEP = 60;   // первый камень не раньше 1 с после «Выпустить»

export class RockFall {
  constructor(scene, data, i) {
    this.scene = scene;
    this.d = { offset: 0, every: 2.6, r: 11, ...data };
    this.idx = i;
    if (!scene.headless) {
      // Предупреждение: столб зоны падения (за островами), тень в точке удара,
      // значок с кольцом отсчёта сверху и демо-камень на подготовке.
      this.column = scene.add.graphics().setDepth(9);
      this.shadow = scene.add.graphics().setDepth(23);
      this.warn = scene.add.graphics().setDepth(44);
      this.demo = scene.add.image(this.d.x, -30, 'rock').setDepth(26).setAlpha(0)
        .setDisplaySize(this.d.r * 2 + 4, this.d.r * 2 + 4);
      this.impactY = null;
      this.impactAge = 999;
      this.lastRock = null;
    }
  }

  // Первая сверху поверхность, о которую ударится камень: острова, доски, ящики.
  // Тот же фильтр столкновений, что у камня; null — камень улетит в пропасть.
  computeImpact() {
    const M = Matter();
    const x = this.d.x, r = this.d.r;
    const bodies = M.Composite.allBodies(this.scene.matter.world.localWorld).filter((b) => !b.isSensor
      && (b.collisionFilter.category & ROCK_MASK & ~(CAT.ROCK | CAT.SQUIRREL)) && (b.collisionFilter.mask & CAT.ROCK)
      && b.bounds.min.x <= x + r && b.bounds.max.x >= x - r);
    if (!bodies.length) return null;
    const probes = [[0, r], [-r * 0.7, r * 0.7], [r * 0.7, r * 0.7], [-r, 0], [r, 0]];
    const hit = (px, py) => bodies.some((b) => (b.parts.length > 1 ? b.parts.slice(1) : [b])
      .some((p) => M.Vertices.contains(p.vertices, { x: px, y: py })));
    for (let cy = -24; cy < WORLD.killY; cy += 2) {
      if (probes.some(([dx, dy]) => hit(x + dx, cy + dy))) return cy + r;
    }
    return null;
  }

  // Шагов до следующего камня. Камни раньше FIRST_ROCK_STEP после «Выпустить»
  // не падают: игрок успевает увидеть предупреждение (ритм остальных не меняется).
  stepsToNext() {
    const at = (s) => {
      const t = s - Math.round(this.d.offset * 60);
      const per = Math.round(this.d.every * 60);
      if (t < 0) return -t;
      return (per - (t % per)) % per;
    };
    const now = this.scene.runSteps;
    const n = at(now);
    return now + n >= FIRST_ROCK_STEP ? n : FIRST_ROCK_STEP - now + at(FIRST_ROCK_STEP);
  }

  tick() {
    if (this.stepsToNext() === 0) this.spawn();
  }

  spawn() {
    const M = Matter();
    const body = M.Bodies.circle(this.d.x, -24, this.d.r, {
      density: 0.004, friction: 0.5, frictionAir: 0.002, restitution: 0.18, label: 'rock',
      collisionFilter: { category: CAT.ROCK, mask: CAT.TERRAIN | CAT.PLANK | CAT.CRATE | CAT.ROCK | CAT.SQUIRREL },
    });
    this.scene.matter.world.add(body);
    const rock = { body, age: 0, rest: 0, hot: 8 };
    body.plugin = { rock };
    if (!this.scene.headless) {
      rock.sprite = this.scene.add.image(this.d.x, -24, 'rock').setDepth(26).setDisplaySize(this.d.r * 2 + 4, this.d.r * 2 + 4);
    }
    this.scene.rocks.push(rock);
    this.lastRock = rock;
  }

  render() {
    if (!this.warn) return;
    const sc = this.scene, g = this.warn, col = this.column, sh = this.shadow;
    g.clear(); col.clear(); sh.clear();
    if (sc.phase !== 'run' && sc.phase !== 'build') { this.demo.setAlpha(0); return; }
    const x = this.d.x, r = this.d.r;
    // Точку удара пересчитываем раз в несколько кадров: доски могут сдвинуться.
    if (++this.impactAge > (sc.phase === 'build' ? 10 : 6)) { this.impactY = this.computeImpact(); this.impactAge = 0; }
    const iy = this.impactY;
    const per = Math.round(this.d.every * 60);
    const n = sc.phase === 'build' ? null : this.stepsToNext();
    // Окно тревоги — не меньше секунды реального времени, в том числе на ×2.
    const win = 60 * Math.max(1, sc.stepsPerFrame || 1);
    const falling = sc.phase === 'run' && this.lastRock && sc.rocks.includes(this.lastRock)
      && iy != null && this.lastRock.body.position.y < iy - r - 2;
    const alarm = sc.phase === 'run' && (n < win || falling) ? (falling ? 1 : 1 - n / win) : 0;
    const pulse = 0.5 + 0.5 * Math.sin(sc.time.now / 1000 * Math.PI * 2 * 0.8);

    // Столб зоны падения: от значка до точки удара (или до низа поля).
    const top = 32, bottom = iy != null ? iy : WORLD.h;
    col.fillStyle(HAZ, 0.08 + 0.14 * alarm + (sc.phase === 'build' ? 0.04 * pulse : 0));
    col.fillRect(x - r - 3, top, 2 * r + 6, bottom - top);
    col.lineStyle(1.5, HAZ_LINE, 0.45);
    for (let y = top; y < bottom; y += 12) {
      const y2 = Math.min(bottom, y + 6);
      col.lineBetween(x - r - 3, y, x - r - 3, y2);
      col.lineBetween(x + r + 3, y, x + r + 3, y2);
    }

    // Тень и красные скобки в точке удара — главное «где именно упадёт».
    if (iy != null) {
      const k = sc.phase === 'build' ? 0.75 + 0.15 * pulse : 0.7 + 0.3 * alarm;
      sh.fillStyle(HAZ_LINE, sc.phase === 'build' ? 0.4 : 0.22 + 0.38 * alarm);
      sh.fillEllipse(x, iy - 1, (2 * r + 8) * k, 7 * k);
      sh.lineStyle(2, HAZ, 0.9);
      const bx = r + 6;
      sh.beginPath(); sh.moveTo(x - bx, iy - 6); sh.lineTo(x - bx, iy); sh.lineTo(x - bx + 5, iy); sh.strokePath();
      sh.beginPath(); sh.moveTo(x + bx, iy - 6); sh.lineTo(x + bx, iy); sh.lineTo(x + bx - 5, iy); sh.strokePath();
    }

    // Значок «!» и кольцо отсчёта до следующего камня.
    const by = 16;
    const s = 1 + 0.12 * alarm * (0.5 + 0.5 * Math.sin(sc.time.now / 1000 * Math.PI * 2 * 2));
    g.fillStyle(HAZ_LINE, 0.5);
    g.fillCircle(x, by, 14);
    drawHazardBadge(g, x, by, s);
    if (n != null) {
      const frac = 1 - n / per;
      g.lineStyle(2.5, alarm > 0 ? HAZ : HAZ_LIGHT, 1);
      g.beginPath();
      g.arc(x, by, 13, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac, false);
      g.strokePath();
    }
    g.fillStyle(HAZ, 1);
    g.fillTriangle(x - 5, 28, x + 5, 28, x, 34);
    g.lineStyle(1.2, HAZ_LINE, 1);
    g.strokeTriangle(x - 5, 28, x + 5, 28, x, 34);

    // Демо-падение на подготовке: полупрозрачный камень раз в 2.4 с.
    if (sc.phase === 'build') {
      const t = (sc.time.now / 1000 + this.d.offset) % 2.4;
      const end = (iy != null ? iy : WORLD.h) - r;
      if (t < 0.8) this.demo.setAlpha(0.5).setPosition(x, 20 + (end - 20) * (t / 0.8) ** 2);
      else this.demo.setAlpha(0);
    } else this.demo.setAlpha(0);
  }
}

// ---------------------------------------------------------------- порталы
export class PortalPair {
  constructor(scene, data, i) {
    this.scene = scene;
    this.ends = [data.a, data.b];
    this.oneWay = !!data.oneWay;          // только из a в b
    if (!scene.headless) {
      this.sprites = this.ends.map((e, k) => {
        const im = scene.add.image(e.x, e.y + 2, 'portal_' + (i % 2)).setOrigin(0.5, 1).setDepth(27).setDisplaySize(32, 50);
        if (this.oneWay && k === 1) im.setAlpha(0.5);
        scene.tweens.add({ targets: im, scaleX: im.scaleX * 0.86, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
        return im;
      });
    }
  }

  // Телепорт срабатывает, когда центр белки входит в портал. Вышедшая из портала
  // белка не уходит обратно, пока не отойдёт от него.
  tick(squirrels) {
    for (const s of squirrels) {
      if (s.state !== 'walk' || !s.body) continue;
      for (let k = 0; k < 2; k++) {
        const e = this.ends[k];
        const dx = Math.abs(s.x - e.x);
        const inY = s.y > e.y - 50 && s.y < e.y + 6;
        if (s.portalLock === e && (dx > 9 || !inY)) s.portalLock = null;
        if (dx < 6 && inY && s.portalLock !== e && !(this.oneWay && k === 1)) { this.teleport(s, k); break; }
      }
    }
  }

  teleport(s, fromEnd) {
    const to = this.ends[1 - fromEnd];
    const v = s.body.velocity;
    Matter().Body.setPosition(s.body, { x: to.x, y: to.y - 12 });
    Matter().Body.setVelocity(s.body, { x: v.x, y: Math.min(v.y, 0.5) });
    s.portalLock = to;
    s.stuckX = to.x; s.stuckT = 0;
    if (s.sprite) s.sprite.setPosition(to.x, to.y - 14);
    this.scene.onEventCb('sfx', 'release');
  }
}

// ---------------------------------------------------------------- ядовитый туман
export class Fog {
  constructor(scene, data) {
    this.scene = scene;
    this.d = { delay: 2, from: WORLD.h + 40, speed: 8, to: 300, ...data };
    this.y = this.d.from;
    if (!scene.headless) {
      this.g = scene.add.graphics().setDepth(36);
      this.mark = scene.add.graphics().setDepth(11);
      this.phase = 0;
    }
  }

  level(steps) {
    const t = steps / 60 - this.d.delay;
    return Math.max(this.d.to, this.d.from - Math.max(0, t) * this.d.speed);
  }

  tick() { this.y = this.level(this.scene.runSteps); }

  render() {
    if (!this.g) return;
    const g = this.g, W = WORLD.w;
    this.phase += 0.04;
    g.clear();
    const top = this.y;
    g.fillStyle(0x3fb58a, 0.42);
    g.beginPath();
    g.moveTo(-60, WORLD.killY + 200);
    for (let x = -60; x <= W + 60; x += 12) g.lineTo(x, top + Math.sin(x * 0.05 + this.phase) * 4);
    g.lineTo(W + 60, WORLD.killY + 200);
    g.closePath();
    g.fillPath();
    g.fillStyle(0x9ff0c4, 0.22);
    g.fillRect(-60, top + 8, W + 120, 10);
    // Пунктир: до какой высоты поднимется туман.
    const m = this.mark;
    m.clear();
    m.lineStyle(1.5, 0x9ff0c4, 0.75);
    for (let x = 0; x < W; x += 14) m.lineBetween(x, this.d.to, x + 7, this.d.to);
  }
}
