// The AutoPlayers' waves (bf2-re finding 28 §5, ai.autoplayer.json's
// `waves`): the server brings its bots back in waves, not one by one. A
// wave opens every `SpawnTime` + `PauseTime` seconds, the attackers' pause
// `AP_Waves_PauseTime_Attack` (30 s), the defenders' by phase
// (`_Defend_Phase1..4`: 12, 6, 3, 0 s; 15 s past them), shortened by the
// kill ratio for the capture points the side holds (`_1CP/2CP/3CP` 1.1 /
// 1.2 / 1.3: the pause over the ratio, by hand). A bot that has waited
// `ForceSpawnTime` (attack 55 → 40 s by phase, defend 40 → 55 s) comes back
// outside the wave. Pure.
//
//   createWaves(ap, side) → w        side: 'attack' | 'defend'
//   pauseOf(ap, side, { phase, held }) → seconds     forceOf(ap, side, { phase }) → seconds
//   due(w, now, { phase, held }) → true once at each wave (and schedules the next)
//   forced(w, since, now, { phase }) → true when a bot dead since `since` must come back now

export const createWaves = (ap, side) => ({ ap, side, next: ap.waves.spawnTime[side] ?? ap.waves.spawnTime.attack });

const byPhase = (list, phase, fallback) => (list && phase >= 1 && phase <= list.length ? list[phase - 1] : fallback);

export function pauseOf(ap, side, { phase = 1, held = 0 } = {}) {
  const w = ap.waves;
  const base = side === 'defend' ? byPhase(w.pause.defendByPhase, phase, w.pause.defend) : w.pause.attack;
  const ratios = w.killRatio[side] ?? w.killRatio.attack;
  const ratio = held > 0 ? ratios[Math.min(held, ratios.length) - 1] : 1;
  return base / ratio;
}

export function forceOf(ap, side, { phase = 1 } = {}) {
  const w = ap.waves;
  return side === 'defend' ? byPhase(w.force.defendByPhase, phase, w.force.defend) : byPhase(w.force.attackByPhase, phase, w.force.default);
}

export function due(w, now, { phase = 1, held = 0 } = {}) {
  if (now + 1e-9 < w.next) return false;
  const spawn = w.ap.waves.spawnTime[w.side] ?? w.ap.waves.spawnTime.attack;
  w.next = now + spawn + pauseOf(w.ap, w.side, { phase, held });
  return true;
}

export const forced = (w, since, now, { phase = 1 } = {}) => now - since >= forceOf(w.ap, w.side, { phase }) - 1e-9;
