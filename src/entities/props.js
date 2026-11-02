// Предметы шамана и статичные объекты уровня: создание тел и спрайтов.

import { ITEMS, CAT } from '../config.js';
import { rad } from '../systems/geometry.js';

const Matter = () => Phaser.Physics.Matter.Matter;

// Концы доски в мировых координатах.
export function plankEnds(x, y, angleDeg, len) {
  const a = rad(angleDeg);
  const hx = Math.cos(a) * len / 2, hy = Math.sin(a) * len / 2;
  return [{ x: x - hx, y: y - hy }, { x: x + hx, y: y + hy }];
}

// Нормаль «вверх» для батута с поворотом angleDeg.
export function trampNormal(angleDeg) {
  const a = rad(angleDeg);
  return { x: Math.sin(a), y: -Math.cos(a) };
}

export function createPlank(scene, spec, pins) {
  // spec: {type, x, y, angle}; pins: [{end:0|1, kind:'world'|'plank', target, targetEnd, point}]
  const M = Matter();
  const it = ITEMS[spec.type];
  const terrainPinned = pins.some((p) => p.kind === 'world');
  const body = M.Bodies.rectangle(spec.x, spec.y, it.len, it.thick, {
    angle: rad(spec.angle), chamfer: { radius: 4 },
    density: 0.0016, friction: 0.9, frictionStatic: 1, frictionAir: 0.02, restitution: 0,
    label: 'plank',
    collisionFilter: {
      category: CAT.PLANK,
      mask: CAT.SQUIRREL | CAT.CRATE | CAT.ROCK | (terrainPinned ? 0 : CAT.TERRAIN),
    },
  });
  scene.matter.world.add(body);
  const obj = { kind: 'plank', type: spec.type, spec, body, pins: [], len: it.len, sprite: null, bolts: [] };
  body.plugin = { obj };
  const ends = plankEnds(spec.x, spec.y, spec.angle, it.len);
  for (const p of pins) {
    const e = ends[p.end];
    const off = { x: e.x - spec.x, y: e.y - spec.y };
    let c;
    if (p.kind === 'world') {
      c = M.Constraint.create({ pointA: { x: e.x, y: e.y }, bodyB: body, pointB: off, length: 0, stiffness: 0.9, damping: 0.12 });
    } else {
      const t = p.target;
      const te = plankEnds(t.spec.x, t.spec.y, t.spec.angle, t.len)[p.targetEnd];
      // Позиция цели могла уже сдвинуться физикой — берём текущую точку конца.
      const cur = currentEnd(t, p.targetEnd);
      const toff = { x: cur.x - t.body.position.x, y: cur.y - t.body.position.y };
      c = M.Constraint.create({ bodyA: t.body, pointA: toff, bodyB: body, pointB: off, length: 0, stiffness: 0.9, damping: 0.12 });
      void te;
    }
    M.Composite.add(scene.matter.world.localWorld, c);
    obj.pins.push({ ...p, constraint: c });
  }
  if (!scene.headless) {
    obj.sprite = scene.add.image(spec.x, spec.y, 'plank_' + it.len).setDepth(20);
    obj.sprite.setDisplaySize(it.len + 6, it.thick + 6).setRotation(rad(spec.angle));
    for (const p of obj.pins) obj.bolts.push({ end: p.end, img: scene.add.image(0, 0, 'bolt').setDepth(22).setDisplaySize(10, 10) });
  }
  return obj;
}

export function currentEnd(obj, end) {
  const b = obj.body;
  const a = b.angle;
  const hx = Math.cos(a) * obj.len / 2, hy = Math.sin(a) * obj.len / 2;
  return end === 0 ? { x: b.position.x - hx, y: b.position.y - hy } : { x: b.position.x + hx, y: b.position.y + hy };
}

export function createCrate(scene, spec) {
  const M = Matter();
  const s = ITEMS.crate.size;
  const body = M.Bodies.rectangle(spec.x, spec.y, s, s, {
    angle: rad(spec.angle || 0), chamfer: { radius: 3 },
    density: 0.004, friction: 0.9, frictionStatic: 1.2, frictionAir: 0.01, restitution: 0,
    label: 'crate',
    collisionFilter: { category: CAT.CRATE, mask: CAT.TERRAIN | CAT.PLANK | CAT.CRATE | CAT.STATIC_OBJ | CAT.SQUIRREL | CAT.ROCK },
  });
  scene.matter.world.add(body);
  const obj = { kind: 'crate', type: 'crate', spec, body, sprite: null };
  body.plugin = { obj };
  if (!scene.headless) obj.sprite = scene.add.image(spec.x, spec.y, 'crate').setDepth(21).setDisplaySize(s + 4, s + 4);
  return obj;
}

export function createTrampoline(scene, spec) {
  const M = Matter();
  const it = ITEMS.trampoline;
  // Батут — зона-датчик: белка, попавшая на полотно, подлетает вверх.
  const body = M.Bodies.rectangle(spec.x, spec.y, it.w, it.h + 6, {
    angle: rad(spec.angle || 0), isStatic: true, isSensor: true,
    label: 'tramp',
    collisionFilter: { category: CAT.SENSOR, mask: CAT.SQUIRREL },
  });
  scene.matter.world.add(body);
  const obj = { kind: 'trampoline', type: 'trampoline', spec, body, sprite: null, normal: trampNormal(spec.angle || 0) };
  body.plugin = { obj };
  if (!scene.headless) {
    // Полотно батута совпадает с верхом тела; ножки уходят вниз.
    obj.sprite = scene.add.image(spec.x, spec.y, 'trampoline').setDepth(21).setDisplaySize(70, 30);
    obj.sprite.setOrigin(0.5, 9 / 30).setRotation(rad(spec.angle || 0));
  }
  return obj;
}

// Руна пути: белки без ореха поворачивают в её сторону.
export function createArrow(scene, spec) {
  const M = Matter();
  const it = ITEMS.arrow;
  const dir = spec.dir === -1 ? -1 : 1;
  const body = M.Bodies.rectangle(spec.x, spec.y, it.w, it.h, {
    isStatic: true, isSensor: true, label: 'arrow',
    collisionFilter: { category: CAT.SENSOR, mask: CAT.SQUIRREL },
  });
  scene.matter.world.add(body);
  const obj = { kind: 'arrow', type: 'arrow', spec: { ...spec, dir }, body, sprite: null, dir };
  body.plugin = { obj };
  if (!scene.headless) {
    obj.sprite = scene.add.image(spec.x, spec.y, 'arrow').setDepth(19).setDisplaySize(34, 48).setFlipX(dir < 0);
    scene.tweens.add({ targets: obj.sprite, alpha: 0.72, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
  }
  return obj;
}

// Пузырь: висит в воздухе, белка внутри всплывает.
export function createBubble(scene, spec) {
  const M = Matter();
  const it = ITEMS.bubble;
  const body = M.Bodies.circle(spec.x, spec.y, it.r, {
    isStatic: true, isSensor: true, label: 'bubble',
    collisionFilter: { category: CAT.SENSOR, mask: CAT.SQUIRREL },
  });
  scene.matter.world.add(body);
  const obj = { kind: 'bubble', type: 'bubble', spec, body, sprite: null };
  body.plugin = { obj };
  if (!scene.headless) {
    obj.sprite = scene.add.image(spec.x, spec.y, 'bubble').setDepth(19).setDisplaySize(it.r * 2 + 6, it.r * 2 + 6);
    scene.tweens.add({ targets: obj.sprite, scaleX: obj.sprite.scaleX * 1.05, scaleY: obj.sprite.scaleY * 0.96, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
  }
  return obj;
}

export function syncProp(obj) {
  if (!obj.sprite) return;
  const b = obj.body;
  if (obj.kind === 'arrow' || obj.kind === 'bubble') return;
  obj.sprite.setPosition(b.position.x, b.position.y).setRotation(b.angle);
  if (obj.kind === 'plank') {
    for (const bo of obj.bolts) {
      const e = currentEnd(obj, bo.end);
      const a = b.angle, inset = 6;
      const k = bo.end === 0 ? 1 : -1;
      bo.img.setPosition(e.x + Math.cos(a) * inset * k, e.y + Math.sin(a) * inset * k);
    }
  }
}

export function destroyProp(scene, obj) {
  const M = Matter();
  if (obj.pins) for (const p of obj.pins) M.Composite.remove(scene.matter.world.localWorld, p.constraint);
  scene.matter.world.remove(obj.body);
  if (obj.sprite) obj.sprite.destroy();
  if (obj.bolts) obj.bolts.forEach((b) => b.img.destroy());
}
