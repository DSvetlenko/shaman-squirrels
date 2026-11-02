// Механики уровня, которые задаются данными в levels.json:
//   winds    — потоки воздуха (вверх, влево, вправо)
//   fragile  — хрупкие мосты, выдерживают ограниченное число проходов
//   portals  — пары порталов
//   plates / gates — нажимные плиты и ворота
//   rocks    — камнепад по расписанию
//   water    — поднимающаяся вода
// Всё детерминировано и считается шагами физики, поэтому проверка уровня
// без графики даёт тот же результат, что и игра.

import { CAT, WORLD } from '../config.js';
import { fragileSVG, gateSVG, plateSVG, rockSVG, portalSVG } from '../art/svg.js';
import { addSVGTexture } from '../art/textures.js';

const Matter = () => Phaser.Physics.Matter.Matter;
const PORTAL_COLORS = ['#b18cff', '#5fe0c2', '#ffb35c'];

export class Mechanics {
  constructor(scene) {
    this.scene = scene;
    const L = scene.level;
    this.L = L;
    this.winds = L.winds || [];
    this.fragile = [];
    this.portals = [];
    this.gates = [];
    this.plates = [];
    this.rocks = [];
    this.rockSpawners = L.rocks || [];
    this.water = L.water ? { ...L.water, level: L.water.start ?? 560 } : null;
  }

  // Текстуры, которые зависят от данных уровня.
  textureJobs(s) {
    const L = this.L, sc = this.scene, jobs = [];
    (L.fragile || []).forEach((f, i) => jobs.push(addSVGTexture(sc, `frg_${L.id}_${i}`, fragileSVG(f.w, i + 1), s)));
    (L.gates || []).forEach((g, i) => jobs.push(addSVGTexture(sc, `gate_${L.id}_${i}`, gateSVG(g.w || 22, g.h || 72), s)));
    if ((L.plates || []).length) {
      jobs.push(addSVGTexture(sc, 'plate0', plateSVG(false), s));
      jobs.push(addSVGTexture(sc, 'plate1', plateSVG(true), s));
    }
    if ((L.rocks || []).length) jobs.push(addSVGTexture(sc, 'rock', rockSVG(), s));
    (L.portals || []).forEach((p, i) => jobs.push(addSVGTexture(sc, `portal${i % 3}`, portalSVG(PORTAL_COLORS[i % 3]), s)));
    return jobs;
  }

  build() {
    const sc = this.scene, L = this.L, M = Matter();
    const add = (b) => sc.matter.world.add(b);
    const vis = !sc.headless;

    // Ветер
    if (vis && this.winds.length) {
      this.windGfx = sc.add.graphics().setDepth(12);
      this.windParts = this.winds.map((w, i) => {
        const n = Math.max(6, Math.round(w.w * w.h / 1600));
        const r = mulberry(i + 11);
        return Array.from({ length: n }, () => ({ u: r(), v: r(), len: 8 + r() * 14, sp: 0.6 + r() * 0.8 }));
      });
    }

    // Хрупкие мосты
    (L.fragile || []).forEach((f, i) => {
      const body = M.Bodies.rectangle(f.x + f.w / 2, f.y + 7, f.w, 14, {
        isStatic: true, label: 'fragile', friction: 0.8,
        collisionFilter: { category: CAT.TERRAIN, mask: 0xffff },
      });
      add(body);
      const o = { ...f, body, left: f.hits ?? 3, on: new Set(), broken: false };
      body.plugin = { fragile: o };
      if (vis) {
        o.img = sc.add.image(f.x, f.y - 2, `frg_${L.id}_${i}`).setOrigin(0, 0).setDisplaySize(Math.ceil(f.w), 16).setDepth(11);
        o.txt = sc.add.text(f.x + f.w / 2, f.y + 20, '', {
          fontFamily: 'Unbounded, sans-serif', fontSize: '12px', fontStyle: '700', color: '#ffe2a8', stroke: '#14182a', strokeThickness: 4,
        }).setOrigin(0.5, 0).setDepth(45).setResolution(sc.zoom || 2);
        this.updateFragileText(o);
      }
      this.fragile.push(o);
    });

    // Порталы
    (L.portals || []).forEach((p, i) => {
      const mk = (pt, side) => {
        const body = M.Bodies.circle(pt.x, pt.y, 15, {
          isStatic: true, isSensor: true, label: 'portal',
          collisionFilter: { category: CAT.SENSOR, mask: CAT.SQUIRREL },
        });
        add(body);
        return body;
      };
      const o = { a: p.a, b: p.b };
      o.bodyA = mk(p.a, 'a'); o.bodyB = mk(p.b, 'b');
      o.bodyA.plugin = { portal: o, to: p.b };
      o.bodyB.plugin = { portal: o, to: p.a };
      if (vis) {
        for (const pt of [p.a, p.b]) {
          const img = sc.add.image(pt.x, pt.y, `portal${i % 3}`).setDepth(18).setDisplaySize(36, 44);
          sc.tweens.add({ targets: img, scaleX: img.scaleX * 0.9, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
        }
      }
      this.portals.push(o);
    });

    // Ворота
    (L.gates || []).forEach((g, i) => {
      const w = g.w || 22, h = g.h || 72;
      const body = M.Bodies.rectangle(g.x, g.y - h / 2, w, h, {
        isStatic: true, label: 'gate', friction: 0,
        collisionFilter: { category: CAT.TERRAIN, mask: 0xffff },
      });
      add(body);
      const o = { ...g, w, h, body, open: false, t: 0 };
      if (vis) o.img = sc.add.image(g.x, g.y, `gate_${L.id}_${i}`).setOrigin(0.5, 1).setDisplaySize(w, h).setDepth(17);
      this.gates.push(o);
    });

    // Плиты
    (L.plates || []).forEach((p) => {
      const o = { ...p, w: p.w || 40, pressed: false };
      if (vis) o.img = sc.add.image(p.x, p.y + 2, 'plate0').setOrigin(0.5, 1).setDisplaySize(44, 12).setDepth(16);
      this.plates.push(o);
    });

    // Камнепад: метки на краю неба
    if (vis && this.rockSpawners.length) {
      this.rockGfx = sc.add.graphics().setDepth(44);
    }

    // Вода
    if (this.water) {
      if (vis) {
        this.waterGfx = sc.add.graphics().setDepth(35);
        this.waterMark = sc.add.graphics().setDepth(34);
        const m = this.waterMark;
        const y = this.water.max;
        m.lineStyle(1.4, 0x7fe3ff, 0.55);
        for (let x = 4; x < WORLD.w; x += 14) m.lineBetween(x, y, x + 7, y);
      }
    }
  }

  updateFragileText(o) {
    if (!o.txt) return;
    o.txt.setText(o.broken ? '' : String(o.left));
    o.txt.setColor(o.left <= 1 ? '#ff9a8a' : '#ffe2a8');
  }

  // Датчики, которых касается белка. Возвращает true, если обработано.
  onSensor(s, label, other) {
    const sc = this.scene;
    if (label === 'portal') {
      if (s.portalCd > 0 || !s.body) return true;
      const to = other.plugin.to;
      Matter().Body.setPosition(s.body, { x: to.x, y: to.y });
      s.portalCd = 40;
      s.stuckT = 0;
      sc.onEventCb('sfx', 'open');
      return true;
    }
    if (label === 'rock') {
      sc.loseSquirrel(s, 'rock');
      this.shatter(other);
      return true;
    }
    return false;
  }

  // Камни — датчики: разбиваются о любую опору, не толкая доски.
  scanPairs(pairs) {
    if (!this.rocks.length) return;
    for (const pair of pairs) {
      if (!pair.isActive) continue;
      const a = pair.bodyA.parent || pair.bodyA, b = pair.bodyB.parent || pair.bodyB;
      for (const [r, o] of [[a, b], [b, a]]) {
        if (r.label !== 'rock' || r.plugin.dead) continue;
        if (o.label === 'squirrel' || o.isSensor) continue;
        this.shatter(r);
      }
    }
  }

  shatter(r) {
    if (r.plugin.dead) return;
    r.plugin.dead = true;
    const sc = this.scene;
    sc.matter.world.remove(r);
    this.rocks = this.rocks.filter((x) => x !== r);
    sc.onEventCb('sfx', 'crate');
    if (r.plugin.img) {
      const img = r.plugin.img;
      sc.tweens.add({ targets: img, alpha: 0, scale: img.scale * 1.5, duration: 220, onComplete: () => img.destroy() });
      for (let k = 0; k < 5; k++) {
        const d = sc.add.circle(r.position.x, r.position.y, 2.2, 0x9a9087).setDepth(33);
        sc.tweens.add({ targets: d, x: r.position.x + (k - 2) * 9, y: r.position.y - 6 - (k % 2) * 8, alpha: 0, duration: 380, onComplete: () => d.destroy() });
      }
    }
  }

  // Каждый шаг забега, после того как белки выбрали движение.
  afterSquirrels(contacts) {
    const sc = this.scene, M = Matter();
    const sq = sc.squirrels.filter((s) => s.state === 'walk' && s.body);

    // Ветер
    for (const w of this.winds) {
      const p = w.power || 1;
      for (const s of sq) {
        if (s.x < w.x || s.x > w.x + w.w || s.y < w.y || s.y > w.y + w.h) continue;
        const v = s.body.velocity;
        if (w.dir === 'up') {
          M.Body.setVelocity(s.body, { x: s.dir * 1.1, y: Math.max(Math.min(v.y, -0.8) - 0.55 * p, -3.6 * p) });
          s.airSteps = 0;
        } else {
          const sx = w.dir === 'left' ? -1 : 1;
          M.Body.setVelocity(s.body, { x: Math.max(-3.4, Math.min(3.4, v.x + sx * 0.16 * p)), y: v.y });
        }
      }
    }

    // Хрупкие мосты: считаем, сколько раз на них ступили.
    for (const f of this.fragile) {
      if (f.broken) continue;
      const now = new Set();
      for (const s of sq) {
        const cs = contacts.get(s.body) || [];
        if (cs.some((c) => c.label === 'fragile' && c.other === f.body && c.upN.y < -0.6)) now.add(s.id);
      }
      for (const id of now) {
        if (f.on.has(id)) continue;
        if (f.left <= 0) { this.breakFragile(f); break; }
        f.left--;
        sc.onEventCb('sfx', 'creak');
        this.updateFragileText(f);
      }
      f.on = now;
    }

    // Плиты и ворота
    if (this.plates.length) {
      const crates = sc.placed.filter((o) => o.kind === 'crate');
      for (const p of this.plates) {
        let pressed = crates.some((o) => Math.abs(o.body.position.x - p.x) < p.w / 2 + 14 && Math.abs(o.body.position.y + 20 - p.y) < 9);
        if (!pressed) pressed = sq.some((s) => Math.abs(s.x - p.x) < p.w / 2 + 6 && Math.abs(s.y + 9 - p.y) < 8);
        if (pressed !== p.pressed) {
          p.pressed = pressed;
          sc.onEventCb('sfx', pressed ? 'pin' : 'tick');
          if (p.img) p.img.setTexture(pressed ? 'plate1' : 'plate0');
        }
      }
      this.gates.forEach((g, i) => {
        const want = this.plates.some((p) => (p.gate ?? 0) === i && p.pressed);
        if (want && !g.open) this.setGate(g, true);
        else if (!want && g.open) {
          // Не закрываем ворота на белке или ящике.
          const blocked = sq.some((s) => Math.abs(s.x - g.x) < g.w / 2 + 12 && s.y > g.y - g.h - 10 && s.y < g.y + 4)
            || crates.some((o) => Math.abs(o.body.position.x - g.x) < g.w / 2 + 20 && o.body.position.y > g.y - g.h - 20 && o.body.position.y < g.y + 10);
          if (!blocked) this.setGate(g, false);
        }
      });
    }

    // Камнепад
    const t = sc.runSteps;
    for (const r of this.rockSpawners) {
      const start = Math.round((r.start ?? 1) * 60), every = Math.round((r.every ?? 3) * 60);
      if (t >= start && (t - start) % every === 0) this.spawnRock(r.x);
    }
    for (const r of [...this.rocks]) if (r.position.y > WORLD.killY) { this.rocks = this.rocks.filter((x) => x !== r); sc.matter.world.remove(r); if (r.plugin.img) r.plugin.img.destroy(); }

    // Вода
    if (this.water) {
      const w = this.water;
      if (t > (w.delay ?? 0) * 60) w.level = Math.max(w.max, w.level - (w.rise ?? 6) / 60);
      for (const s of sq) if (s.y + 6 > w.level) sc.loseSquirrel(s, 'water');
    }
  }

  setGate(g, open) {
    g.open = open;
    g.body.collisionFilter.mask = open ? 0 : 0xffff;
    g.body.collisionFilter.category = open ? 0 : CAT.TERRAIN;
    const sc = this.scene;
    sc.onEventCb('sfx', open ? 'creak' : 'crate');
    if (g.img) {
      sc.tweens.killTweensOf(g.img);
      sc.tweens.add({ targets: g.img, y: open ? g.y - g.h + 8 : g.y, alpha: open ? 0.35 : 1, duration: 260, ease: 'Quad.out' });
    }
  }

  breakFragile(f) {
    f.broken = true;
    const sc = this.scene;
    sc.matter.world.remove(f.body);
    sc.onEventCb('sfx', 'lost');
    if (f.img) {
      sc.tweens.add({ targets: f.img, y: f.y + 120, angle: 12, alpha: 0, duration: 700, ease: 'Quad.in' });
    }
    this.updateFragileText(f);
  }

  spawnRock(x) {
    const sc = this.scene, M = Matter();
    const r = M.Bodies.circle(x, -24, 10, {
      isSensor: true, label: 'rock', frictionAir: 0, density: 0.002,
      collisionFilter: { category: CAT.ROCK, mask: CAT.TERRAIN | CAT.PLANK | CAT.CRATE | CAT.SQUIRREL },
    });
    r.plugin = { dead: false };
    M.Body.setVelocity(r, { x: 0, y: 2 });
    sc.matter.world.add(r);
    this.rocks.push(r);
    if (!sc.headless) r.plugin.img = sc.add.image(x, -24, 'rock').setDepth(33).setDisplaySize(24, 24);
  }

  render() {
    const sc = this.scene;
    const time = sc.time.now / 1000;
    if (this.windGfx) {
      const g = this.windGfx;
      g.clear();
      this.winds.forEach((w, i) => {
        g.fillStyle(0xbfeaff, 0.06);
        g.fillRoundedRect(w.x, w.y, w.w, w.h, 10);
        for (const p of this.windParts[i]) {
          if (w.dir === 'up') {
            const y = w.y + w.h - ((p.v * w.h + time * 60 * p.sp) % w.h);
            const x = w.x + 6 + p.u * (w.w - 12) + Math.sin(time * 2 + p.u * 9) * 3;
            g.lineStyle(1.6, 0xe6f8ff, 0.35);
            g.lineBetween(x, y, x, Math.min(w.y + w.h, y + p.len));
          } else {
            const sx = w.dir === 'left' ? -1 : 1;
            const off = (p.u * w.w + time * 70 * p.sp) % w.w;
            const x = sx > 0 ? w.x + off : w.x + w.w - off;
            const y = w.y + 4 + p.v * (w.h - 8);
            g.lineStyle(1.6, 0xe6f8ff, 0.35);
            g.lineBetween(x, y, Math.max(w.x, Math.min(w.x + w.w, x - sx * p.len)), y);
          }
        }
      });
    }
    for (const r of this.rocks) if (r.plugin.img) r.plugin.img.setPosition(r.position.x, r.position.y).setRotation(r.position.y * 0.05);
    if (this.rockGfx) {
      const g = this.rockGfx;
      g.clear();
      const t = sc.runSteps;
      for (const r of this.rockSpawners) {
        const start = Math.round((r.start ?? 1) * 60), every = Math.round((r.every ?? 3) * 60);
        const until = t < start ? start - t : every - ((t - start) % every);
        const near = sc.phase === 'run' && until < 50;
        const a = sc.phase === 'build' ? 0.55 : near ? 0.9 : 0.35;
        g.fillStyle(0xff9a6b, a);
        const top = sc.viewTop != null ? sc.viewTop + 6 : 6;
        g.fillTriangle(r.x - 7, top, r.x + 7, top, r.x, top + 10);
        if (sc.phase === 'build') {
          g.lineStyle(1, 0xff9a6b, 0.28);
          for (let y = top + 14; y < WORLD.h; y += 12) g.lineBetween(r.x, y, r.x, y + 5);
        }
      }
    }
    if (this.waterGfx && this.water) {
      const g = this.waterGfx, y = this.water.level;
      g.clear();
      if (y < WORLD.h + 140) {
        g.fillStyle(0x2b78a8, 0.55);
        g.beginPath();
        g.moveTo(-40, WORLD.h + 200);
        for (let x = -40; x <= WORLD.w + 40; x += 10) g.lineTo(x, y + Math.sin(x * 0.06 + time * 2.2) * 2.4);
        g.lineTo(WORLD.w + 40, WORLD.h + 200);
        g.closePath();
        g.fillPath();
        g.lineStyle(2, 0xbfeaff, 0.7);
        g.beginPath();
        for (let x = -40; x <= WORLD.w + 40; x += 10) {
          const yy = y + Math.sin(x * 0.06 + time * 2.2) * 2.4;
          if (x === -40) g.moveTo(x, yy); else g.lineTo(x, yy);
        }
        g.strokePath();
      }
    }
  }
}

function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
