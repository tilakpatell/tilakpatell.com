import { describe, expect, it } from 'vitest';
import golden from './fixtures/spawns.json';
import { differs, lines } from './fixtures/golden.js';
import { choose, createSpawnFinder, onDeath, pointZoneMask, zoneBase } from './spawnFinder.js';
import { MAX_PLAYERS_PER_SQUAD, createSpawnWaves, join, timeLeft, update, waiting } from './spawnWaves.js';

const f = Math.fround;

// bf2-web's spawn driver (WebPort/ai/spawn-driver.cpp) played through the JavaScript: every "seen" ray is clear
function replay(script) {
  const out = [];
  const points = [];
  const zones = [];
  let influences = [];
  let finder = null;
  const waves = createSpawnWaves();
  let tick = 0;
  for (const [verb, ...w] of lines(script)) {
    const n = w.map(Number);
    if (verb === 'point') points.push({ position: n.slice(0, 3), team: n[4], enabled: n[5] !== 0 });
    else if (verb === 'zone') zones.push({ team: n[0], enabled: n[1] !== 0, polygon: n.slice(3, 3 + 2 * n[2]) });
    else if (verb === 'level') {
      finder = createSpawnFinder(zones, points);
      out.push({ level: { ok: 1, points: points.length, zones: zones.length, masks: points.map((_, i) => Number(pointZoneMask(finder, i))) } });
    } else if (verb === 'infl') influences.push({ team: n[0], position: n.slice(1, 4), facing: n.slice(4, 6) });
    else if (verb === 'clear') influences = [];
    else if (verb === 'choose') {
      let rays = 0;
      const c = choose(finder, n[0], influences, n[1], () => (rays++, false));
      const nearest = c.point < 0 ? 0 : c.nearest < 1e30 ? f(Math.sqrt(c.nearest)) : null;
      out.push({ choose: { team: n[0], point: c.point, zone: c.zone, score: c.zoneScore, blockers: c.point >= 0 ? c.blockers : 0, seen: c.point >= 0 ? c.seen : 0, rays, accepted: c.accepted, nearest } });
    } else if (verb === 'death') onDeath(finder, n[0], n.slice(1, 4), n[4], n[5]);
    else if (verb === 'base') out.push({ base: { zone: n[0], team: n[1], value: zoneBase(finder, n[0], n[1]) } });
    else if (verb === 'join') out.push({ join: { id: n[0], ok: join(waves, n[0], n[1]) } });
    else if (verb === 'update') {
      for (let k = 0; k < n[0]; k++) {
        tick++;
        const ids = update(waves, 1 / 30);
        if (ids.length) out.push({ spawned: { tick, ids } });
      }
    } else throw new Error(`unknown verb ${verb}`);
  }
  return out;
}

const { script, records } = golden.scenarios.hoth;
const ours = replay(script);
const chooses = ours.filter((r) => r.choose).map((r) => r.choose);
const bases = ours.filter((r) => r.base).map((r) => r.base);

describe('the spawn finder and the waves, against bf2-web', () => {
  it('writes every record the native driver wrote on Hoth’s layer, to the float', () => {
    expect(differs(records, ours)).toBeNull();
  });
});

// bf2-web's gate's checks (WebPort/tests/bot-spawns.mjs), read off the JavaScript
describe('the spawn finder on Hoth_01’s TeamDeathmatch_Global, as bf2-web’s gate reads it', () => {
  it('holds 44 points and 8 zones, each zone holding a point', () => {
    const { level } = ours[0];
    expect(level).toMatchObject({ points: 44, zones: 8 });
    for (let k = 0; k < 8; k++) expect(level.masks.some((m) => (m >> k) & 1)).toBe(true);
  });

  it('sends the first light-side soldier to zone 0, point 26, away from the dark-side player', () => {
    expect(chooses[0]).toMatchObject({ point: 26, zone: 0, score: 0, blockers: 0, accepted: true });
  });

  it('takes three different points for three requests in a row (the ghosts)', () => {
    expect(new Set(chooses.slice(0, 3).map((c) => c.point)).size).toBe(3);
  });

  it('costs the other side 100 a spawn in the chosen zones, for 10 s', () => {
    expect(bases[0]).toEqual({ zone: 0, team: 2, value: -300 });
    expect(bases.slice(16, 24).every((b) => b.value === 0)).toBe(true);
  });

  it('costs the victim’s side −50 × (1 − 5 s / 20 s) = −37 round the body until 10 s later', () => {
    const death = bases.slice(24);
    const n = death.length / 3;
    expect(n).toBeGreaterThan(0);
    expect(death.slice(0, 2 * n).every((b) => b.value === -37)).toBe(true);
    expect(death.slice(2 * n).every((b) => b.value === 0)).toBe(true);
  });

  it('brings a lone soldier back 5 s later, four together 2 s after they fill a wave, a fifth 5 s after that', () => {
    const spawned = ours.filter((r) => r.spawned).map((r) => r.spawned);
    expect(spawned).toEqual([{ tick: 152, ids: [7] }, { tick: 261, ids: [1, 2, 3, 4] }, { tick: 352, ids: [5] }]);
  });
});

describe('the waves’ countdown', () => {
  it('counts down 5 s for a lone soldier and 2 s once the wave is full', () => {
    const w = createSpawnWaves();
    join(w, 1, 1);
    expect(timeLeft(w, 1)).toBe(5);
    update(w, 1);
    expect(timeLeft(w, 1)).toBe(4);
    for (let id = 2; id <= MAX_PLAYERS_PER_SQUAD; id++) join(w, id, 1);
    expect(timeLeft(w, 1)).toBe(2);
    expect(waiting(w, 4)).toBe(true);
    expect(timeLeft(w, 99)).toBe(-1);
  });

  it('keeps the sides in waves of their own and refuses a seventeenth wave', () => {
    const w = createSpawnWaves();
    join(w, 1, 1);
    join(w, 2, 2);
    expect(w.waves.filter((x) => x.ids.length).map((x) => x.team)).toEqual([1, 2]);
    const full = createSpawnWaves();
    for (let id = 0; id < 4 * 16; id++) join(full, id, 1);
    expect(join(full, 999, 2)).toBe(false);
    expect(join(full, 998, 1)).toBe(false);
  });
});
