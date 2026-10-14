import { describe, expect, it } from 'vitest';
import { loadRulebook, mapOf, stagesOf, volumeOf } from '../rulebook.js';
import { STAGE_PAUSE, STAGE_SETUP, TICKETS_START, TICKETS_TOP_UP, canRespawn, createAssault, force, onEvent, spawnSets, tick, view } from './galacticAssault.js';
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
    // four attackers take A from the defenders' end in 30 s
    run(ga, 30.05, { soldiers: squad('attack', A, 4, 'a'), alive: { attack: 4, defend: 2 } });
    expect(A.done).toBe(true);
    // B taken, while A is retaken to −0.2 by its defenders
    run(ga, 72, { soldiers: [...squad('attack', B, 4, 'b'), ...squad('defend', A, 1, 'd')], alive: { attack: 4, defend: 2 } });
    expect(A.meter).toBeCloseTo(-0.2, 1);
    expect(B.done).toBe(true);
    expect(ga.stage).toBe(0);
    expect(ga.phase).toBe('live');
    // both held at once: the pause, then the next stage
    run(ga, 18.05, { soldiers: [...squad('attack', A, 4, 'a'), ...squad('attack', B, 4, 'b')], alive: { attack: 8, defend: 2 } });
    expect(ga.phase).toBe('pause');
    run(ga, STAGE_PAUSE + 0.05);
    expect(ga.stage).toBe(1);
    expect(view(ga).stage.id).toBe('escape');
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

  // the level's own spawn logic (maps/hoth.json's spawnLogic: bf2-re findings/55)
  const areas = (ga, side) => spawnSets(ga)[side].filter((id) => id.startsWith('FantasyBattle_Shapes:')).map((id) => Number(id.split(':')[1])).sort((a, b) => a - b);

  it('takes Hoth’s spawn sets from the level’s graph: one area a side for the opening, then the walkers’ first step', () => {
    const ga = createAssault({ rulebook: rb });
    expect(ga.logic).toBeTruthy();
    live(ga);
    expect([areas(ga, 'attack'), areas(ga, 'defend')]).toEqual([[9], [11]]);
    expect(spawnSets(ga).attack.filter((id) => id.startsWith('FantasyBattle_Logic:'))).toHaveLength(28);
    run(ga, 25.1);
    expect([areas(ga, 'attack'), areas(ga, 'defend')]).toEqual([
      [40, 49, 70],
      [27, 37, 64],
    ]);
  });

  it('moves the sets up as the lead walker passes its path’s triggers', () => {
    const ga = createAssault({ rulebook: rb });
    live(ga);
    run(ga, 25.1);
    const a = ga.objectives.find((o) => o.def.waypoints === 'FantasyBattle_Logic:123');
    const p = a.path;
    // (waypoint by waypoint to 3, its path's triggers at 1 and 3: the graph's 1 s delay drops a second change inside it, as the game's does)
    let d = 0;
    for (let i = 1; i <= 3; i++) {
      d += Math.hypot(p[i][0] - p[i - 1][0], p[i][2] - p[i - 1][2]);
      a.walker.dist = d + 1;
      run(ga, 1.2);
    }
    expect([areas(ga, 'attack'), areas(ga, 'defend')]).toEqual([
      [18, 34, 42],
      [4, 56, 63],
    ]);
  });

  it('an attacker in the approach’s box closes the Rebels’ opening before the 25 s', () => {
    const ga = createAssault({ rulebook: rb });
    live(ga);
    const box = map.boxes.find((b) => b.id === 'FantasyBattle_Shapes:26');
    run(ga, 1, { soldiers: [{ id: 'e1', side: 'attack', at: [...box.at], alive: true }], alive: { attack: 1, defend: 1 } });
    expect(areas(ga, 'defend')).not.toEqual([11]);
  });

  it('a cut-down stage list keeps the files’ own sets', () => {
    const ga = createAssault({ rulebook: rb, stages: { attackers: 'dark', stages: [file.stages[1]] } });
    expect(ga.logic).toBeUndefined();
    expect(spawnSets(ga)).toBe(file.stages[1].spawns);
  });

  it('a walker home unlocks its gate; a second at its panel opens it, and the Empire’s points inside it come on', () => {
    const ga = createAssault({ rulebook: rb });
    live(ga);
    run(ga, 25.1);
    // (the east route's walker, FantasyBattle_Logic:123, home: the west gate, :91, unlocks and the east one is barred)
    const a = ga.objectives.find((o) => o.def.waypoints === 'FantasyBattle_Logic:123');
    a.walker.dist = a.walker.length;
    const out = [];
    for (let t = 0; t < 0.2; t += 0.05) out.push(...tick(ga, 0.05, nobody));
    expect(out).toEqual(expect.arrayContaining([{ type: 'gate', id: 'FantasyBattle_Logic:91', state: 'unlocked' }, { type: 'gate', id: 'FantasyBattle_Logic:307', state: 'barred' }]));
    run(ga, STAGE_PAUSE + 0.1);
    expect(view(ga).stage.id).toBe('hangars');
    const inside = ['FantasyBattle_Logic:173', 'FantasyBattle_Logic:204', 'FantasyBattle_Logic:258'];
    expect(spawnSets(ga).attack).not.toEqual(expect.arrayContaining(inside));
    const panel = ga.gates.list.find((g) => g.id === 'FantasyBattle_Logic:91').panel.at;
    const at = { soldiers: [{ id: 'e1', side: 'attack', at: [...panel], alive: true, interact: true }], alive: { attack: 1, defend: 1 } };
    const opened = [];
    for (let t = 0; t < 1.2; t += 0.05) opened.push(...tick(ga, 0.05, at));
    expect(opened).toContainEqual({ type: 'gate', id: 'FantasyBattle_Logic:91', state: 'opened' });
    expect(spawnSets(ga).attack).toEqual(expect.arrayContaining(inside));
    run(ga, 1.6);
    expect(view(ga).gates.find((g) => g.id === 'FantasyBattle_Logic:91')).toMatchObject({ state: 'open', open: 1 });
  });
});
