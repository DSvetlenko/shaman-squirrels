// Общие параметры игры. Баланс предметов и физики собран здесь,
// чтобы уровни (levels/levels.json) содержали только данные.

export const GAME_VERSION = '0.5.0';

// Версия структуры сохранений. Увеличивается при изменении формата,
// старые сохранения переводятся функциями из src/save/migrations.js.
export const SAVE_SCHEMA = 2;

// Размер мира уровня в условных единицах. Всё поле помещается на экран целиком.
export const WORLD = { w: 400, h: 520, killY: 640 };

// Фиксированный шаг симуляции — одинаковый результат на любом устройстве.
export const STEP_MS = 1000 / 60;

export const PHYS = {
  gravityY: 1,
};

export const SQUIRREL = {
  bodyW: 22,
  bodyH: 18,
  speed: 1.35,           // px за шаг по земле
  hopVy: 5.6,            // прыжок через ступеньку (~50 px)
  maxClimbDeg: 38,       // круче — белка разворачивается
  turnCooldown: 18,      // шагов между разворотами
  stuckSteps: 240,       // если белка не двигается 4 с — разворот
  spriteW: 40,
  spriteH: 35,
};

export const TRAMPOLINE = {
  launchVy: 13.4,        // ≈ 290 px вверх
  launchVx: 1.6,
};

export const PIN_RADIUS = 20;   // насколько близко конец доски должен быть к опоре

// Предметы шамана. cost — цена в магии.
export const ITEMS = {
  plank:      { name: 'Доска',   short: 'Доска',   len: 120, thick: 11, cost: 15 },
  longPlank:  { name: 'Длинная доска', short: 'Длинная', len: 180, thick: 11, cost: 25 },
  crate:      { name: 'Ящик',    short: 'Ящик',    size: 40, cost: 10 },
  trampoline: { name: 'Батут',   short: 'Батут',   w: 62, h: 12, cost: 30 },
};
export const ITEM_ORDER = ['plank', 'longPlank', 'crate', 'trampoline'];

// Категории столкновений Matter.
export const CAT = {
  TERRAIN: 0x0001,
  PLANK: 0x0002,
  CRATE: 0x0004,
  STATIC_OBJ: 0x0008,
  SQUIRREL: 0x0010,
  SENSOR: 0x0020,
  ROCK: 0x0040,
};

export const ROTATE_STEP = 5;   // градусов за нажатие кнопки поворота
