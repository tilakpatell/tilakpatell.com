// The AutoPlayers' waves: when the server lets a dead bot back in, and as
// what (bf2-re finding 28 §5). The numbers are the server's settings
// (gameSettings.json). Two tables:
//
//   the command-post modes (Instant Action's own, Supremacy: `cp`), Mode8's rows:
//     soldiers in a window of AP_Waves_SpawnTime_Mode8 (15 s) every
//     AP_Waves_PauseTime_Mode8 (30 s) after it; the heroes' wave first at
//     AP_WavesHeroes_PauseTime_Mode8_Start (90 s), then every 180 s; the
//     specials' (reinforcements') at 60 s then every 90 s; the vehicles' at
//     60 s then every 120 s; at most AP_Heroes_MaxCount_BotTeam_Mode8 (2)
//     heroes out (_HumanTeam_ 1 on a human's side), AP_Specials_MaxCount_*
//     (6, 5) specials, AutoPlayers_Vehicles_MaxCount_Team<n> (2) vehicles
//   the objective modes (Galactic Assault, Strike, Extraction …: Co-op's
//     attack and defend rows, by phase, the stage): the attackers' window
//     AP_Waves_SpawnTime_Attack (5 s) every AP_Waves_PauseTime_<Short|Medium|
//     Long>_Attack (20/30/40 s by the round's length), the defenders' 5 s
//     every AP_Waves_PauseTime_Defend_Phase<n> (12, 6, 3, 0: the defence
//     comes back faster as it loses ground); a bot dead AP_Waves_ForceSpawnTime_
//     <side>_Phase<n> (attack 55 → 40 s, defend 40 → 55 s) comes in whatever the
//     window; the heroes' wave at AP_WavesHeroes_PauseTime_<side>_Start
//     (attack 999 s: never in the first stage; defend 60 s), then each stage's
//     pause (180 → 120 s), at most AP_Heroes_MaxCount_<side>_Phase<n> (1, 1, 2,
//     2, 3); the specials' at AP_WavesSpecials_PauseTime_Coop_Start (45 s) then
//     every 60 s, at most AP_Specials_MaxCount_<side>_Phase<n> (2, 3, 3, 4, 5);
//     the vehicles' at AP_WavesVehicles_PauseTime_<side>_Start (45, 20 s) and
//     _NextSection (3 s) after each stage
//
// A dead bot waits AP_Spawn_Delay (Mode8 4 s, Mode9 1 s) at least. A row the
// settings lack for a phase is the last phase's that they hold. A unit wave
// stays open AP_WavesHeroes_SpawnTime_Attack (5 s). By hand (NOTES.md): the
// kill-ratio rows (AP_Waves_KillRatio_*CP_*, KillRatioDelay 3) are not read,
// what they change being in the bot logic's graph. Pure.
//
//   wavesFor(gs, { cp, side: 'attack' | 'defend', phase, length: 'short' | 'medium' | 'long', human }) → table
//   createWaves(table, now) → w        stage(w, table, now)   (a new phase: the table again, the vehicles' next section)
//   soldiersOpen(w, now) → bool        mayDeploy(w, { since, now }) → bool
//   unitOpen(w, kind, now) → bool      (kind: 'hero' | 'special' | 'vehicle'; opened on its time, closed after its window)

const get = (gs, names, fallback, sources, key) => {
  const s = gs?.settings ?? gs ?? {};
  for (const n of names) if (n in s && s[n] !== null) {
    sources[key] = n;
    return s[n];
  }
  sources[key] = 'hand';
  return fallback;
};

// a row by phase: the phase's own, else the nearest earlier phase the settings hold, else the base
const phased = (base, phase) => [...Array.from({ length: phase }, (_, i) => `${base}_Phase${phase - i}`), base];

export function wavesFor(gs, { cp = false, side = 'attack', phase = 1, length = 'medium', human = false } = {}) {
  const sources = {};
  const n = Math.max(1, Math.min(5, Math.round(phase)));
  const S = side === 'defend' ? 'Defend' : 'Attack';
  const L = { short: 'Short', medium: 'Medium', long: 'Long' }[length] ?? 'Medium';
  const g = (key, names, fallback) => get(gs, names, fallback, sources, key);
  const window = g('unitWindow', ['AP_WavesHeroes_SpawnTime_Attack'], 5);
  if (cp) {
    const team = human ? 'HumanTeam' : 'BotTeam';
    return {
      soldiers: { spawn: g('soldiers.spawn', ['AP_Waves_SpawnTime_Mode8'], 15), pause: g('soldiers.pause', ['AP_Waves_PauseTime_Mode8'], 30), force: g('soldiers.force', ['AP_Waves_ForceSpawnTime'], 60), delay: g('soldiers.delay', ['AP_Spawn_Delay_Mode8'], 4) },
      hero: { start: g('hero.start', ['AP_WavesHeroes_PauseTime_Mode8_Start'], 90), pause: g('hero.pause', ['AP_WavesHeroes_PauseTime_Mode8'], 180), window, max: g('hero.max', [`AP_Heroes_MaxCount_${team}_Mode8`], 2) },
      special: { start: g('special.start', ['AP_WavesSpecials_PauseTime_Mode8_Start'], 60), pause: g('special.pause', ['AP_WavesSpecials_PauseTime_Mode8'], 90), window, max: g('special.max', [`AP_Specials_MaxCount_${team}_Mode8`], 6) },
      vehicle: { start: g('vehicle.start', ['AP_WavesVehicles_PauseTime_Mode8_Start'], 60), pause: g('vehicle.pause', ['AP_WavesVehicles_PauseTime_Mode8'], 120), window, max: g('vehicle.max', ['AutoPlayers_Vehicles_MaxCount_Team1'], 2), next: null },
      sources,
    };
  }
  const pause = side === 'defend' ? g('soldiers.pause', phased('AP_Waves_PauseTime_Defend', n), 15) : g('soldiers.pause', [`AP_Waves_PauseTime_${L}_Attack`, 'AP_Waves_PauseTime_Attack'], 30);
  return {
    soldiers: { spawn: g('soldiers.spawn', [`AP_Waves_SpawnTime_${S}`], 5), pause, force: g('soldiers.force', [...phased(`AP_Waves_ForceSpawnTime_${S}`, n), 'AP_Waves_ForceSpawnTime'], 60), delay: g('soldiers.delay', ['AP_Spawn_Delay_Mode9'], 1) },
    hero: { start: g('hero.start', [`AP_WavesHeroes_PauseTime_${S}_Start`], side === 'defend' ? 60 : 999), pause: g('hero.pause', phased(`AP_WavesHeroes_PauseTime_${S}`, n), 180), window, max: g('hero.max', phased(`AP_Heroes_MaxCount_${side === 'defend' ? 'Defenders' : 'Attackers'}`, n), 1) },
    special: { start: g('special.start', ['AP_WavesSpecials_PauseTime_Coop_Start'], 45), pause: g('special.pause', ['AP_WavesSpecials_PauseTime_Coop'], 60), window, max: g('special.max', phased(`AP_Specials_MaxCount_${side === 'defend' ? 'Defenders' : 'Attackers'}`, n), 2) },
    vehicle: { start: g('vehicle.start', [`AP_WavesVehicles_PauseTime_${S}_Start`], 45), pause: Infinity, window, max: g('vehicle.max', ['AutoPlayers_Vehicles_MaxCount_Team1'], 2), next: g('vehicle.next', [`AP_WavesVehicles_PauseTime_${S}_NextSection`], 3) },
    sources,
  };
}

const KINDS = ['hero', 'special', 'vehicle'];

export function createWaves(table, now = 0) {
  const w = { table, soldiersAt: now, units: {} };
  for (const k of KINDS) w.units[k] = { at: now + table[k].start, until: -Infinity };
  return w;
}

// a new phase (a Galactic Assault stage): its rows; the heroes' next wave on its pause, the vehicles' on the next section
export function stage(w, table, now) {
  w.table = table;
  w.units.hero.at = Math.min(w.units.hero.at, now + table.hero.pause);
  if (table.vehicle.next != null) w.units.vehicle.at = now + table.vehicle.next;
}

// the soldiers' window: open `spawn` seconds, then shut `pause`; a pause of 0 never shuts
export function soldiersOpen(w, now) {
  const { spawn, pause } = w.table.soldiers;
  if (pause <= 0) return true;
  const t = (now - w.soldiersAt) % (spawn + pause);
  return t < spawn - 1e-9;
}

// a dead bot back in: its delay over, and the window open or its forced time come
export function mayDeploy(w, { since, now }) {
  const waited = now - since + 1e-9;
  if (waited < w.table.soldiers.delay) return false;
  return soldiersOpen(w, now) || waited >= w.table.soldiers.force;
}

export function unitOpen(w, kind, now) {
  const u = w.units[kind];
  const row = w.table[kind];
  if (now + 1e-9 >= u.at && u.until < u.at) {
    u.until = u.at + row.window;
    u.at = Number.isFinite(row.pause) ? u.at + row.window + row.pause : Infinity;
  }
  return now <= u.until + 1e-9;
}
