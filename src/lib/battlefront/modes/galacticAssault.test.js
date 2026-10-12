import { describe, expect, it } from 'vitest';
import { loadRulebook, mapOf, stagesOf, volumeOf } from '../rulebook.js';
import { COUNTER, HOLDS, LOW, STAGE_PAUSE, STAGE_SETUP, TICKETS_START, TICKETS_TOP_UP, canRespawn, createAssault, force, onEvent, protectFor, spawnPoints, spawnSets, tick, view } from './galacticAssault.js';
import { BOMBING_RUN, UPLINK_RANGE, centroid } from './objectives.js';

const rb = loadRulebook();
const file = stagesOf(rb, 'hoth', 'galacticAssault');
const map = mapOf(rb, 'hoth');
const nobody = { soldiers: [], alive: { attack: 5, defend: 5 } };
const run = (ga, seconds, world = nobody) => {
  for (let t = 0; t < seconds - 1e-9; t += 0.05) tick(ga, 0.05, world);
};
const live = (ga) => run(ga, STAGE_SETUP + 0.05);

describe('Galactic Assault', () => {
  it('opens on the walkers with the setup delay and the starting tickets', () => {
    const ga = createAssault({ rulebook: rb });
    expect(ga.phase).toBe('setup');
    expect(ga.tickets).toBe(TICKETS_START);
    expect(ga.attack).toBe(2);
    live(ga);
    expect(ga.phase).toBe('live');
    const v = view(ga);
    expect(v.stage).toMatchObject({ id: 'walkers', index: 0, count: 3 });
    expect(v.objectives.filter((o) => o.type === 'escort')).toHaveLength(2);
    expect(spawnSets(ga).attack).toContain('FantasyBattle_Shapes:9');
  });

  it('two points, one retaken', () => {
    const ga = createAssault({ rulebook: rb, stages: { attackers: 'dark', stages: [file.stages[1], file.stages[2]] } });
    live(ga);
    const [A, B] = ga.objectives;
    const at = (o) => centroid(o.volume.points);
    const squad = (side, o, n, tag) => Array.from({ length: n }, (_, i) => ({ id: `${tag}${i}`, side, at: [at(o)[0], 0, at(o)[1]], alive: true }));
    // four attackers take A from neutral in the mode's 60 s (no faster than one would)
    run(ga, 60.05, { soldiers: squad('attack', A, 4, 'a'), alive: { attack: 4, defend: 2 } });
    expect(A.done).toBe(true);
    // B taken, while A is drained back to neutral by a defender
    run(ga, 60.05, { soldiers: [...squad('attack', B, 4, 'b'), ...squad('defend', A, 1, 'd')], alive: { attack: 4, defend: 2 } });
    expect(A.meter).toBe(0);
    expect(A.done).toBe(false);
    expect(B.done).toBe(true);
    expect(ga.stage).toBe(0);
    expect(ga.phase).toBe('live');
    // both held at once: the stage-won hold, then the next stage with its spawn-protection window
    run(ga, 60.05, { soldiers: [...squad('attack', A, 4, 'a'), ...squad('attack', B, 4, 'b')], alive: { attack: 8, defend: 2 } });
    expect(ga.phase).toBe('pause');
    expect(ga.timer).toBeGreaterThan(HOLDS.won - 0.1);
    run(ga, STAGE_PAUSE + 0.05);
    expect(ga.stage).toBe(1);
    expect(view(ga).stage.id).toBe('escape');
    expect(protectFor(ga)).toBeCloseTo(HOLDS.window, 0);
    run(ga, HOLDS.window);
    expect(protectFor(ga)).toBe(0);
  });

  it('holds as the prefab’s delay chain: 120 s opening, 9 s won, 6 s window, 7.2 s banner, 5.8 s head', () => {
    expect(HOLDS).toEqual({ opening: 120, won: 9, window: 6, banner: 7.2, head: 5.8, respawnFlip: 12, respawnNormal: 2 });
    expect(STAGE_SETUP).toBe(120);
    expect(STAGE_PAUSE).toBe(9);
    expect(view(createAssault({ rulebook: rb })).holds).toBe(HOLDS);
    // (a shorter opening when asked: the page's checks)
    const ga = createAssault({ rulebook: rb, setup: 1 });
    run(ga, 1.05);
    expect(ga.phase).toBe('live');
  });

  it('counts the attackers’ deaths against the quota and crosses the 50 and 30 lines once', () => {
    expect(LOW).toEqual([50, 30]);
    expect(COUNTER).toMatchObject({ maxKills: 65000, enemyWeight: 1, suicideWeight: 1, ignoreAI: true });
    const ga = createAssault({ rulebook: rb });
    live(ga);
    const lows = [];
    for (let i = 0; i < 45; i++) {
      ga.out = [];
      onEvent(ga, { type: 'down', side: 'attack' });
      lows.push(...ga.out.filter((e) => e.type === 'low').map((e) => e.tickets));
    }
    onEvent(ga, { type: 'down', side: 'defend' });
    expect(ga.deaths).toEqual({ attack: 45, defend: 1 });
    expect(ga.tickets).toBe(TICKETS_START - 45);
    expect(lows).toEqual([50]);
    expect(view(ga).low).toBe(50);
    for (let i = 0; i < 15; i++) onEvent(ga, { type: 'down', side: 'attack' });
    expect(ga.low).toEqual([50, 30]);
  });

  it('names each stage’s areas and points from the wiring: the attackers’ 26, 4 and 3, the defenders’ last stand the neutral three', () => {
    const ids = (list) => list.map((id) => Number(id.split(':')[1]));
    const ga = createAssault({ rulebook: rb });
    expect(ids(spawnSets(ga).attack)).toEqual([1, 2, 5, 9, 16, 18, 19, 22, 31, 32, 34, 36, 38, 40, 42, 47, 48, 49, 52, 55, 59, 60, 65, 66, 69, 70]);
    expect(ids(spawnSets(ga).defend)).toEqual([4, 11, 14, 15, 27, 37, 43, 56, 57, 58, 63, 64, 72]);
    expect(ids(file.stages[1].spawns.attack)).toEqual([20, 21, 44, 71]);
    expect(ids(file.stages[1].spawns.defend)).toEqual([30, 46, 53, 61, 74]);
    expect(ids(file.stages[2].spawns.attack)).toEqual([10, 24, 28]);
    expect(ids(file.stages[2].spawns.defend)).toEqual([3, 45, 54]);
    expect(map.polygons.filter((p) => file.stages[2].spawns.defend.includes(p.id)).every((p) => p.team === 0)).toBe(true);
    expect(spawnPoints(ga).attack.length).toBeGreaterThan(50);
    expect(file.stages.map((s) => s.points.defend.length)).toEqual([66, 18, 13]);
    expect(file.spawnsSource).toBe('wired');
  });

  it('last life', () => {
    const ga = createAssault({ rulebook: rb });
    live(ga);
    ga.tickets = 1;
    expect(onEvent(ga, { type: 'down', side: 'attack' }).respawn).toBe(true);
    expect(ga.tickets).toBe(0);
    expect(canRespawn(ga, 'attack')).toBe(false);
    expect(onEvent(ga, { type: 'down', side: 'attack' }).respawn).toBe(false);
    expect(canRespawn(ga, 'defend')).toBe(true);
    run(ga, 1, { soldiers: [], alive: { attack: 2, defend: 5 } });
    expect(ga.result).toBe(null);
    run(ga, 0.05, { soldiers: [], alive: { attack: 0, defend: 5 } });
    expect(ga.result).toMatchObject({ winner: 1, why: 'wiped', stage: 0 });
  });

  it('gives the round to the defenders when both walkers fall', () => {
    const ga = createAssault({ rulebook: rb });
    live(ga);
    for (const o of ga.objectives.filter((x) => x.type === 'escort')) o.walker.hp = 0;
    run(ga, 0.05);
    expect(ga.result).toMatchObject({ winner: 1, why: 'objectives' });
  });

  it('opens the walkers to fire when an uplink is held', () => {
    const ga = createAssault({ rulebook: rb });
    live(ga);
    const up = ga.objectives.find((o) => o.type === 'uplink');
    const me = { id: 'r1', side: 'defend', at: [up.at[0], 0, up.at[1]], alive: true, interact: true };
    // out of the walkers' reach the console is shut
    run(ga, 6.05, { soldiers: [me], alive: { attack: 5, defend: 5 } });
    expect(up.runs).toBe(0);
    const w = ga.objectives.find((o) => o.type === 'escort').walker;
    w.at[0] = up.at[0];
    w.at[2] = up.at[1] - UPLINK_RANGE + 10;
    run(ga, 6.05, { soldiers: [me], alive: { attack: 5, defend: 5 } });
    expect(ga.objectives.filter((o) => o.type === 'escort').every((o) => o.walker.vulnerable)).toBe(true);
    expect(w.hp).toBeCloseTo(w.hpMax * (1 - BOMBING_RUN), 6);
    // one run at a time: a second console can't call another while it flies
    const other = ga.objectives.filter((o) => o.type === 'uplink')[1];
    run(ga, 6.05, { soldiers: [{ ...me, id: 'r2', at: [other.at[0], 0, other.at[1]] }], alive: { attack: 5, defend: 5 } });
    expect(other.runs).toBe(0);
  });

  it('runs the whole Hoth stage file through, the tickets topped up at each stage', () => {
    const ga = createAssault({ rulebook: rb });
    live(ga);
    for (let i = 0; i < 10; i++) onEvent(ga, { type: 'down', side: 'attack' });
    const seen = [ga.tickets];
    for (let s = 0; s < 3; s++) {
      force(ga);
      run(ga, 0.05);
      if (s < 2) {
        expect(ga.phase).toBe('pause');
        run(ga, STAGE_PAUSE + 0.05);
        seen.push(ga.tickets);
      }
    }
    expect(seen).toEqual([TICKETS_START - 10, TICKETS_START - 10 + TICKETS_TOP_UP, TICKETS_START - 10 + 2 * TICKETS_TOP_UP]);
    expect(ga.result).toMatchObject({ winner: 2, why: 'objectives', stage: 2 });
  });

  it('builds every objective the stage file names from the map', () => {
    for (const st of file.stages)
      for (const o of st.objectives) if (o.volume) expect(volumeOf(map, o.volume).points.length).toBeGreaterThan(2);
  });
});
