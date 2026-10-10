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
});
