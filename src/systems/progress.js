// Прогресс игрока: открытие уровней, звёзды, валюта, статистика, достижения.
// Уровни идентифицируются по id, а не по номеру. Если в levels.json
// добавить новые уровни, сохранённый прогресс по старым останется.

export const ACHIEVEMENTS = [
  { id: 'first_bridge', title: 'Первый мост', desc: 'Пройди первый уровень', check: (s) => isDone(s, 'w1-01') },
  { id: 'no_loss', title: 'Все дома', desc: 'Пройди уровень, не потеряв ни одной белки', check: (s, ctx) => ctx && ctx.result && ctx.result.win && ctx.result.lost === 0 && ctx.result.saved === ctx.result.total },
  { id: 'three_stars', title: 'Безупречно', desc: 'Получи три звезды на любом уровне', check: (s) => Object.values(s.levels).some((l) => l.stars >= 3) },
  { id: 'stars_15', title: 'Звездочёт', desc: 'Собери 15 звёзд', progress: (s) => [totalStars(s), 15] },
  { id: 'stars_30', title: 'Все звёзды островов', desc: 'Собери 30 звёзд', progress: (s) => [totalStars(s), 30] },
  { id: 'saved_50', title: 'Полное дупло', desc: 'Верни домой 50 белок', progress: (s) => [s.stats.squirrelsSaved, 50] },
  { id: 'carpenter', title: 'Плотник', desc: 'Поставь 20 досок', progress: (s) => [s.stats.itemsPlaced.plank + s.stats.itemsPlaced.longPlank, 20] },
  { id: 'bouncy', title: 'Прыгучие', desc: 'Подбрось белок батутом 30 раз', progress: (s) => [s.stats.bounces || 0, 30] },
  { id: 'all_or_nothing', title: 'Все до одного', desc: 'Пройди уровень «Все до одного»', check: (s) => isDone(s, 'w1-08') },
  { id: 'storm', title: 'Буря позади', desc: 'Пройди испытание «Буря»', check: (s) => isDone(s, 'w1-10') },
];

function isDone(s, id) { return !!(s.levels[id] && s.levels[id].completed); }
export function totalStars(s) { return Object.values(s.levels).reduce((a, l) => a + (l.stars || 0), 0); }

export function achievementState(save, a) {
  const unlocked = !!save.achievements[a.id];
  let prog = null;
  if (a.progress) { const [v, max] = a.progress(save); prog = { v: Math.min(v, max), max }; }
  return { unlocked, prog, at: save.achievements[a.id] || null };
}

// Возвращает список новых достижений.
export function checkAchievements(save, ctx) {
  const got = [];
  for (const a of ACHIEVEMENTS) {
    if (save.achievements[a.id]) continue;
    let ok = false;
    if (a.check) ok = !!a.check(save, ctx);
    else if (a.progress) { const [v, max] = a.progress(save); ok = v >= max; }
    if (ok) { save.achievements[a.id] = Date.now(); got.push(a); }
  }
  return got;
}

export function isUnlocked(save, levels, id) {
  const idx = levels.findIndex((l) => l.id === id);
  if (idx <= 0) return idx === 0;
  if (save.unlocked.includes(id)) return true;
  const prev = levels[idx - 1];
  return isDone(save, prev.id);
}

export function nextLevelId(levels, id) {
  const idx = levels.findIndex((l) => l.id === id);
  return idx >= 0 && idx < levels.length - 1 ? levels[idx + 1].id : null;
}

// Первый непройденный открытый уровень — для кнопки «Играть».
export function continueLevel(save, levels) {
  for (const l of levels) {
    if (!isDone(save, l.id) && isUnlocked(save, levels, l.id)) return l;
  }
  return levels.find((l) => l.id === save.lastLevel) || levels[levels.length - 1];
}

export function levelRecord(save, id) {
  if (!save.levels[id]) save.levels[id] = { completed: false, stars: 0, bestSaved: 0, bestTimeMs: null, bestMana: null, attempts: 0, wins: 0 };
  return save.levels[id];
}

export function recordAttemptStart(save, id) {
  const r = levelRecord(save, id);
  r.attempts++;
  save.lastLevel = id;
}

// Вносит результат уровня. Возвращает награду и сведения о рекордах.
export function applyResult(save, levels, level, result, bounces) {
  const r = levelRecord(save, level.id);
  const st = save.stats;
  st.squirrelsSaved += result.saved;
  st.squirrelsLost += result.lost;
  st.manaSpent += result.manaSpent;
  st.bounces = (st.bounces || 0) + (bounces || 0);
  for (const k of Object.keys(result.itemsUsed)) st.itemsPlaced[k] = (st.itemsPlaced[k] || 0) + result.itemsUsed[k];
  const before = r.stars;
  let reward = 0, newRecord = false;
  if (result.win) {
    st.levelsWon++;
    if (result.lost === 0) st.perfectRuns++;
    r.wins++;
    const firstClear = !r.completed;
    r.completed = true;
    if (result.stars > r.stars) r.stars = result.stars;
    if (result.saved > r.bestSaved) r.bestSaved = result.saved;
    if (r.bestTimeMs === null || result.timeMs < r.bestTimeMs) { if (r.bestTimeMs !== null) newRecord = true; r.bestTimeMs = result.timeMs; }
    if (r.bestMana === null || result.manaSpent < r.bestMana) r.bestMana = result.manaSpent;
    // Орехи: за первое прохождение и за каждую новую звезду.
    reward = (firstClear ? 5 : 0) + Math.max(0, r.stars - before) * 3 + result.saved;
    save.nuts += reward;
    const nxt = nextLevelId(levels, level.id);
    if (nxt && !save.unlocked.includes(nxt)) save.unlocked.push(nxt);
    if (!save.unlocked.includes(level.id)) save.unlocked.push(level.id);
  } else {
    st.levelsLost++;
    if (result.saved > r.bestSaved) r.bestSaved = result.saved;
  }
  const achievements = checkAchievements(save, { result, level });
  return { reward, newStars: Math.max(0, r.stars - before), newRecord, achievements };
}
