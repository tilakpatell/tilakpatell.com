// An Arcade round on Hoth, Onslaught, as bf2-web plays it (WebPort/ai/arcade-round.{h,cpp}, the source of truth for
// the game since 2026-10-28: docs/decisions/2026-10-28-hoth-on-bf2-web.md). One human team against the AI team, the
// rules the Skirmish logic graphs produce (bf2-web's arcade-flow notes, 2.2, 2.4, 3.4 and 11.3):
//   - the kill counters: the human team's counts AI deaths (EnemyWeight for a kill by a human, SuicideWeight for a
//     death with no inflictor while CountOOBKills), capped at the score limit; the AI team's counts the human's deaths;
//   - the result: the human team wins when its kills reach max(1, ScoreLimit); the countdown starts at its first kill
//     with TimeLimit, gains EliminationBonus seconds each time that count rises, pauses 0.1 s after the human dies and
//     resumes when they spawn; at 0 the AI team wins; with lives the AI team also wins once it has killed the human
//     that many times;
//   - the AI team's pacing: a step per killsPerStep kills, wantedAI = clamp(minAI + steps - deaths × penalty, minAI,
//     maxAI), maxReached latching at maxAI, the squad max(1, min(maxAI, squadAtMax or squadNormal)) and the wait
//     between waves 99999 s once the AI is at its max;
//   - the AI team's spawner: each tick it releases n AI players into the respawn waves (spawnWaves.js).
// The C++ counts in float, so every sum here goes through Math.fround and the round lands on bf2-web's numbers to
// the last bit (arcadeRound.test.js replays the native driver's own scenarios). Pure and deterministic.
//
//   createArcadeRound(rules) → round | null   (null: rules this port doesn't cover, as setup's false)
//   tick(round, dt) → how many AI players the spawner releases now (0 once there is a result)
//   onAIDeath(round, how)   onHumanDeath(round, how)   onHumanSpawned(round)
//   aiTeam(round) → the AI side (1 light, 2 dark)
//     how: DEATH.byEnemy | noInflictor | self | byFriend

const f = Math.fround;

export const MODE = { onslaught: 1 };
export const RESULT = { none: 0, team1: 1, team2: 2, draw: 3 };
export const REASON = { none: 0, kills: 1, time: 2, lives: 3 };
export const DEATH = { byEnemy: 0, noInflictor: 1, self: 2, byFriend: 3 };

// AIPlayerProviderManagerEntityData.MaxAIPlayerCount (the TDM prefab, 2.3)
const MAX_AI_PLAYERS = 20;
// s: the Delay between OnPlayerDied and StopTimer (2.2)
const DEATH_PAUSE = f(0.1);
// s: TimeBetweenWaves once the AI count reached its max (3.4)
const NO_MORE_WAVES = 99999;

// PF_Skirmish_AI_Intensity_Logic's Medium row (3.4)
export const INTENSITY = { killsPerStep: 2, minAI: 6, maxAI: 15, deathPenalty: 0, squadNormal: 2, squadAtMax: 4, timeBetweenWaves: 10 };

// Onslaught's custom-menu defaults (bf2-web's tools/cook-world-arcade.mjs cooks them from the data): the human on
// the dark side, fifteen AI, 100 kills, 40 s and 3 s a kill, unlimited lives; the AI team's spawner releases at
// least two at once (MinCountSpawnSimultaneously); the kill counters' weights (PF_Skirmish_Logic's KillCounterEntityData).
export const ONSLAUGHT = {
  mode: MODE.onslaught, humanTeam: 2, aiPlayers: 15, scoreLimit: 100, aiScoreLimit: 100, timeLimit: 40, eliminationBonus: 3, lives: 0,
  intensity: INTENSITY, minCountSpawn: 2, spawnDelay: 0, enemyWeight: 1, suicideWeight: 1, countOOBKills: true,
};

// KillCounterEntity's max: clamp(MaxKillCount × MaxKillCountModifier 1, 1, 65535)
const counterMax = (limit) => (limit < 1 ? 1 : limit > 65535 ? 65535 : limit);
const u32 = (x) => x >>> 0;

function freshState() {
  return {
    killsHuman: 0, killsAI: 0, limitHuman: 1, limitAI: 1, humanDeaths: 0, aiDeaths: 0,
    steps: 0, wantedAI: 0, squad: 1, maxReached: false, timeBetweenWaves: 0,
    inUse: 0, released: 0, waitTimer: 0, countdown: 0,
    timerStarted: false, timerRunning: false, timerElapsed: 0, timerAdded: 0, pauseIn: -1,
    timeRemaining: 0, active: false, result: RESULT.none, reason: REASON.none, resultTime: -1, roundTime: 0,
  };
}

export function createArcadeRound(given = {}) {
  const rules = { ...ONSLAUGHT, ...given, intensity: { ...INTENSITY, ...given.intensity } };
  const i = rules.intensity;
  if (rules.mode !== MODE.onslaught || (rules.humanTeam !== 1 && rules.humanTeam !== 2)) return null;
  if (i.minAI > i.maxAI || i.killsPerStep === 0 || !(rules.timeLimit >= 0) || !(rules.eliminationBonus >= 0) || !(rules.spawnDelay >= 0)) return null;
  rules.timeLimit = f(rules.timeLimit);
  rules.eliminationBonus = f(rules.eliminationBonus);
  rules.spawnDelay = f(rules.spawnDelay);
  rules.enemyWeight = f(rules.enemyWeight);
  rules.suicideWeight = f(rules.suicideWeight);
  i.timeBetweenWaves = f(i.timeBetweenWaves);
  rules.aiPlayers = Math.min(rules.aiPlayers, MAX_AI_PLAYERS);
  const state = freshState();
  // limitN = max(1, ScoreLimit); the AI team's limit is the lives when there are any
  state.limitHuman = counterMax(Math.max(1, rules.scoreLimit));
  state.limitAI = counterMax(rules.lives !== 0 ? rules.lives : Math.max(1, rules.aiScoreLimit));
  state.timeRemaining = rules.timeLimit;
  state.active = true;
  const round = { rules, state, killsAtLastStep: 0 };
  pace(round);
  return round;
}

export const aiTeam = (round) => (round.rules.humanTeam === 1 ? 2 : 1);

function pace(round) {
  const { state: s, rules } = round;
  const i = rules.intensity;
  const wanted = i.minAI + s.steps - s.humanDeaths * i.deathPenalty;
  s.wantedAI = wanted < i.minAI ? i.minAI : wanted > i.maxAI ? i.maxAI : wanted;
  if (s.wantedAI >= i.maxAI) s.maxReached = true;
  s.squad = Math.max(1, Math.min(i.maxAI, s.maxReached ? i.squadAtMax : i.squadNormal));
  s.timeBetweenWaves = s.maxReached ? NO_MORE_WAVES : i.timeBetweenWaves;
}

function finish(round, winner, reason) {
  const s = round.state;
  if (s.result !== RESULT.none) return;
  s.result = winner;
  s.reason = reason;
  s.resultTime = s.roundTime;
  // roundActive cleared: the counters stop and the AI spawners are switched off (11.8)
  s.active = false;
  s.timerRunning = false;
  s.pauseIn = -1;
}

// The human team's counter: each rise of its whole count starts the countdown (the first), adds the elimination
// bonus, steps the intensity per killsPerStep, and reaching the max wins the round.
function addHuman(round, weight) {
  const { state: s, rules } = round;
  if (!s.active || s.killsHuman >= s.limitHuman) return;
  const before = u32(Math.trunc(s.killsHuman));
  const k = f(s.killsHuman + weight);
  s.killsHuman = k < 0 ? 0 : k > s.limitHuman ? s.limitHuman : k;
  const after = u32(Math.trunc(s.killsHuman));
  for (let kills = before + 1; kills <= after; kills++) {
    if (!s.timerStarted) {
      s.timerStarted = true;
      s.timerRunning = true;
    }
    s.timerAdded = f(s.timerAdded + rules.eliminationBonus);
    if (kills - round.killsAtLastStep >= rules.intensity.killsPerStep) {
      s.steps++;
      round.killsAtLastStep = kills;
    }
  }
  if (s.timerStarted) s.timeRemaining = f(f(rules.timeLimit + s.timerAdded) - s.timerElapsed);
  pace(round);
  if (after >= s.limitHuman) finish(round, rules.humanTeam, REASON.kills);
}

// The AI team's counter ends the round only with lives (Onslaught with unlimited lives closes that gate)
function addAI(round, weight) {
  const { state: s, rules } = round;
  if (!s.active || s.killsAI >= s.limitAI) return;
  const k = f(s.killsAI + weight);
  s.killsAI = k < 0 ? 0 : k > s.limitAI ? s.limitAI : k;
  if (rules.lives !== 0 && u32(Math.trunc(s.killsAI)) >= s.limitAI) finish(round, aiTeam(round), REASON.lives);
}

export function tick(round, dt) {
  const { state: s, rules } = round;
  dt = f(dt);
  if (!s.active || !(dt > 0)) return 0;
  s.roundTime = f(s.roundTime + dt);
  // the countdown's stopwatch: what is left of the 0.1 s pause after a death, then the time while it runs
  if (s.timerRunning && s.pauseIn >= 0) {
    s.timerElapsed = f(s.timerElapsed + (dt < s.pauseIn ? dt : s.pauseIn));
    s.pauseIn = f(s.pauseIn - dt);
    if (s.pauseIn <= 0) {
      s.timerRunning = false;
      s.pauseIn = -1;
    }
  } else if (s.timerRunning) s.timerElapsed = f(s.timerElapsed + dt);
  if (s.timerStarted) {
    s.timeRemaining = f(f(rules.timeLimit + s.timerAdded) - s.timerElapsed);
    if (s.timeRemaining <= 0) {
      // TimeUp: the side the human isn't on wins
      finish(round, aiTeam(round), REASON.time);
      return 0;
    }
  }
  // the spawner (11.3): its wait grows by dt; when its countdown is out it releases a batch and waits SpawnDelay
  s.waitTimer = f(s.waitTimer + dt);
  let n = 0;
  if (s.countdown <= 0) {
    n = s.wantedAI > s.inUse ? s.wantedAI - s.inUse : 0;
    n = Math.min(n, s.squad);
    if (n < rules.minCountSpawn) {
      s.waitTimer = 0;
      n = 0;
    }
    // it waits for a full squad until the time between waves has passed
    if (s.waitTimer < s.timeBetweenWaves && n < s.squad) n = 0;
    n = Math.min(n, rules.aiPlayers - Math.min(rules.aiPlayers, s.inUse));
    s.inUse += n;
    s.released += n;
    s.countdown = rules.spawnDelay;
  } else s.countdown = f(s.countdown - dt);
  return n;
}

export function onAIDeath(round, how) {
  const { state: s, rules } = round;
  // one of the spawner's AI players left its soldier
  if (s.inUse > 0) s.inUse--;
  s.aiDeaths++;
  if (how === DEATH.byEnemy) addHuman(round, rules.enemyWeight);
  else if (how === DEATH.noInflictor && rules.countOOBKills) addHuman(round, rules.suicideWeight);
  // an AI suicide doesn't count for the human team in Onslaught, and friendly fire is off
}

export function onHumanDeath(round, how) {
  const { state: s, rules } = round;
  s.humanDeaths++;
  if (s.timerRunning) s.pauseIn = DEATH_PAUSE;
  if (how === DEATH.byEnemy) addAI(round, rules.enemyWeight);
  else if (how === DEATH.noInflictor && rules.countOOBKills) addAI(round, rules.suicideWeight);
  // a human suicide costs a life
  else if (how === DEATH.self && rules.lives !== 0) addAI(round, rules.suicideWeight);
  pace(round);
}

export function onHumanSpawned(round) {
  const s = round.state;
  // OnPlayerSpawned: in Onslaught, once there is a kill, the countdown runs again
  if (s.active && s.timerStarted) {
    s.pauseIn = -1;
    s.timerRunning = true;
  }
}
