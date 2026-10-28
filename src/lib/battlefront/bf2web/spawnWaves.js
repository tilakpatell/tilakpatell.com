// When a dead soldier comes back, as bf2-web runs it (WebPort/ai/spawn-waves.{h,cpp}): the TacticalSpawnManager's
// respawn waves, recovered from the retail binary (bf2-web's arcade-flow notes, 11.3). A dead soldier joins its team's
// first open wave (fewer than MaxPlayersPerSquad, 4) at once, and a wave spawns once MaxWaitTime (5 s in Arcade) has
// passed since its first member joined, or MaxSpawnWaitTime (2 s) after it filled. Where the wave's soldiers stand is
// the level's one spawn finder (spawnFinder.js), shared with the player's respawn. Times sum in float, as the C++'s
// do (spawnWaves.test.js replays its driver). Pure.
//
//   createSpawnWaves({ maxWaitTime, maxSpawnWaitTime }?) → waves
//   join(waves, id, team) → false when all sixteen waves are in use
//   update(waves, dt) → the ids that spawn now, wave by wave
//   waiting(waves, id) → bool
//   timeLeft(waves, id) → s until id's wave spawns as update counts it (0: on the next update), -1 in no wave

const f = Math.fround;

export const MAX_PLAYERS_PER_SQUAD = 4;
export const WAVES = 16;

const emptyWave = () => ({ team: 0, ids: [], elapsed: 0, fullElapsed: 0 });

export function createSpawnWaves({ maxWaitTime = 5, maxSpawnWaitTime = 2 } = {}) {
  return { maxWaitTime: f(maxWaitTime), maxSpawnWaitTime: f(maxSpawnWaitTime), waves: Array.from({ length: WAVES }, emptyWave) };
}

export const waiting = (w, id) => w.waves.some((wave) => wave.ids.includes(id));

export function join(w, id, team) {
  if (waiting(w, id)) return true;
  let open = w.waves.find((wave) => wave.ids.length > 0 && wave.ids.length < MAX_PLAYERS_PER_SQUAD && wave.team === team);
  if (!open) {
    const k = w.waves.findIndex((wave) => wave.ids.length === 0);
    if (k < 0) return false;
    open = w.waves[k] = { ...emptyWave(), team };
  }
  open.ids.push(id);
  return true;
}

export function update(w, dt) {
  dt = f(dt);
  const spawned = [];
  w.waves.forEach((wave, k) => {
    if (wave.ids.length === 0) return;
    let spawn = false;
    if (wave.elapsed < w.maxWaitTime) {
      if (wave.ids.length === MAX_PLAYERS_PER_SQUAD) {
        wave.fullElapsed = Math.min(f(wave.fullElapsed + dt), w.maxSpawnWaitTime);
        spawn = wave.fullElapsed >= w.maxSpawnWaitTime;
      } else wave.elapsed = Math.min(f(wave.elapsed + dt), w.maxWaitTime);
    } else spawn = true;
    if (!spawn) return;
    spawned.push(...wave.ids);
    w.waves[k] = emptyWave();
  });
  return spawned;
}

export function timeLeft(w, id) {
  const wave = w.waves.find((x) => x.ids.includes(id));
  if (!wave) return -1;
  if (wave.elapsed >= w.maxWaitTime) return 0;
  if (wave.ids.length === MAX_PLAYERS_PER_SQUAD) return Math.max(f(w.maxSpawnWaitTime - wave.fullElapsed), 0);
  return f(w.maxWaitTime - wave.elapsed);
}
