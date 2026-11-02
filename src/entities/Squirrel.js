// Белка: физическое тело + простой автопилот.
// Белка идёт в своём направлении, перепрыгивает низкие ступеньки,
// разворачивается у стен и на слишком крутых подъёмах. Взяв орех,
// разворачивается и несёт его к дуплу.

import { SQUIRREL, CAT, TRAMPOLINE } from '../config.js';

const Matter = () => Phaser.Physics.Matter.Matter;

let nextId = 1;

export class Squirrel {
  constructor(scene, x, y, dir) {
    this.id = nextId++;
    this.scene = scene;
    this.dir = dir;
    this.hasNut = false;
    this.state = 'walk';      // walk | grab | saved | lost
    this.grounded = false;
    this.groundN = { x: 0, y: -1 };
    this.turnCd = 0;
    this.hopCd = 0;
    this.sinceHop = 999;
    this.pauseSteps = 0;
    this.trampCd = 0;
    this.anim = 0;
    this.stuckX = x;
    this.stuckT = 0;
    this.airSteps = 0;
    this.portalLock = null;
    this.inDraft = false;

    const M = Matter();
    this.body = M.Bodies.rectangle(x, y, SQUIRREL.bodyW, SQUIRREL.bodyH, {
      chamfer: { radius: 7 },
      friction: 0, frictionStatic: 0, frictionAir: 0.004, restitution: 0,
      density: 0.0012,
      inertia: Infinity, inverseInertia: 0,
      label: 'squirrel',
      collisionFilter: { category: CAT.SQUIRREL, mask: CAT.TERRAIN | CAT.PLANK | CAT.CRATE | CAT.STATIC_OBJ | CAT.SENSOR | CAT.ROCK },
    });
    this.body.plugin = { squirrel: this };
    scene.matter.world.add(this.body);
    M.Body.setVelocity(this.body, { x: dir * 1.4, y: -2.2 });

    if (!scene.headless) {
      this.sprite = scene.add.image(x, y, 'sqA').setDepth(30);
      this.sprite.setDisplaySize(SQUIRREL.spriteW, SQUIRREL.spriteH);
      this.nutSprite = scene.add.image(x, y, 'nut').setDepth(31).setDisplaySize(10, 12).setVisible(false);
    }
  }

  get x() { return this.body.position.x; }
  get y() { return this.body.position.y; }

  turn() {
    if (this.turnCd > 0) return;
    this.dir *= -1;
    this.turnCd = SQUIRREL.turnCooldown;
    this.stuckT = 0;
  }

  // contacts: [{label, upN:{x,y}, other}]
  step(contacts) {
    const M = Matter();
    const b = this.body;
    if (this.turnCd > 0) this.turnCd--;
    if (this.hopCd > 0) this.hopCd--;
    if (this.trampCd > 0) this.trampCd--;
    this.sinceHop++;

    let grounded = false, gN = null, wall = false, steepUp = false, bound = false;
    for (const c of contacts) {
      if (c.label === 'rock') continue;
      if (c.upN.y < -0.62) {
        grounded = true;
        if (!gN || c.upN.y < gN.y) gN = c.upN;
      } else if (Math.abs(c.upN.x) > 0.62 && Math.sign(c.upN.x) === -this.dir) {
        wall = true;
        if (c.label === 'bound') bound = true;
      }
    }
    // Слишком крутой склон в направлении движения считаем стеной.
    if (gN) {
      const slopeDeg = Math.acos(Math.min(1, -gN.y)) * 180 / Math.PI;
      const uphill = gN.x * this.dir < 0;
      if (uphill && slopeDeg > SQUIRREL.maxClimbDeg) steepUp = true;
    }
    this.grounded = grounded;
    this.groundN = gN || { x: 0, y: -1 };
    this.airSteps = grounded ? 0 : this.airSteps + 1;

    if (this.launchedAt === this.scene.runSteps) return;

    if (this.pauseSteps > 0) {
      this.pauseSteps--;
      if (grounded) M.Body.setVelocity(b, { x: 0, y: b.velocity.y });
      return;
    }

    if (bound) { this.turn(); }
    else if (steepUp && grounded) { this.turn(); }
    else if (wall) {
      if (grounded && this.hopCd === 0 && this.sinceHop > 40) {
        M.Body.setVelocity(b, { x: -this.dir * 0.15, y: -SQUIRREL.hopVy });
        this.hopCd = 30;
        this.sinceHop = 0;
        this.scene.onEventCb('sfx', 'hop');
        return;
      }
      if (this.sinceHop > 26 && grounded) this.turn();
    }

    if (grounded && this.sinceHop > 6) {
      // Движение вдоль поверхности, чтобы не «слетать» на спусках.
      const tx = -this.groundN.y, ty = this.groundN.x;
      const s = SQUIRREL.speed;
      M.Body.setVelocity(b, { x: this.dir * s * tx, y: this.dir * s * ty + 0.25 });
    } else if (!grounded && !this.inDraft) {
      // В воздухе — лёгкое управление, чтобы белка не зависала у края.
      const vx = b.velocity.x;
      const target = this.dir * SQUIRREL.speed;
      if (Math.abs(vx) < Math.abs(target) * 0.6 && this.airSteps < 30) {
        M.Body.setVelocity(b, { x: vx + (target - vx) * 0.08, y: b.velocity.y });
      }
    }

    // Защита от вечного застревания.
    this.stuckT++;
    if (Math.abs(this.x - this.stuckX) > 6) { this.stuckX = this.x; this.stuckT = 0; }
    if (this.stuckT > SQUIRREL.stuckSteps) { this.turnCd = 0; this.turn(); }
  }

  // Батут: подбрасывает вверх и вперёд по ходу движения.
  launch(n) {
    if (this.trampCd > 0 || this.body.velocity.y < -2) return false;
    Matter().Body.setVelocity(this.body, {
      x: this.dir * TRAMPOLINE.launchVx + n.x * TRAMPOLINE.launchVy * 0.9,
      y: n.y * TRAMPOLINE.launchVy,
    });
    this.trampCd = 24;
    this.sinceHop = 0;
    this.launchedAt = this.scene.runSteps;
    return true;
  }

  takeNut() {
    this.hasNut = true;
    this.turnCd = 0;
    this.turn();
    this.pauseSteps = 14;
  }

  render(stepCount) {
    if (!this.sprite) return;
    const b = this.body;
    const flip = this.dir < 0;
    if (this.grounded) this.anim++;
    const frame = !this.grounded ? 'sqB' : (Math.floor(this.anim / 7) % 2 ? 'sqB' : 'sqA');
    if (this.sprite.texture.key !== frame) this.sprite.setTexture(frame);
    this.sprite.setFlipX(flip);
    // Наклон по поверхности и в полёте.
    let ang = 0;
    if (this.grounded) ang = Math.atan2(-this.groundN.x, -this.groundN.y) * -1;
    else ang = Math.max(-0.5, Math.min(0.5, b.velocity.y * 0.04 * this.dir));
    this.sprite.rotation += (ang - this.sprite.rotation) * 0.35;
    const ox = 0, oy = -SQUIRREL.spriteH / 2 + SQUIRREL.bodyH / 2 + 2;
    const c = Math.cos(this.sprite.rotation), s = Math.sin(this.sprite.rotation);
    this.sprite.setPosition(b.position.x + ox * c - oy * s, b.position.y + ox * s + oy * c);
    if (this.nutSprite) {
      this.nutSprite.setVisible(this.hasNut);
      if (this.hasNut) {
        const nx = this.dir * 15, ny = -6;
        this.nutSprite.setPosition(b.position.x + nx * c - ny * s, b.position.y + nx * s + ny * c);
        this.nutSprite.rotation = this.sprite.rotation;
      }
    }
  }

  destroy() {
    if (this.body) this.scene.matter.world.remove(this.body);
    this.body = null;
    if (this.sprite) this.sprite.destroy();
    if (this.nutSprite) this.nutSprite.destroy();
  }
}
