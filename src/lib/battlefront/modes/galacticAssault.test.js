import { describe, expect, it } from 'vitest';
import { loadRulebook, mapOf, stagesOf, volumeOf } from '../rulebook.js';
import { COUNTER, HOLDS, PROGRESS_MAX, RATING, STAGE_PAUSE, STAGE_SETUP, TICKETS_START, TICKETS_TOP_UP, WAYPOINT_REACH, canRespawn, createAssault, force, onEvent, progressOf, ratingFor, spawnPoints, spawnSets, spawnStep, tick, view } from './galacticAssault.js';
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
    // (the opening room, open as the stage starts)
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
    // both held at once: the stage-won hold, then the next stage
    const out = [];
    for (let t = 0; t < 60.05; t += 0.05) out.push(...tick(ga, 0.05, { soldiers: [...squad('attack', A, 4, 'a'), ...squad('attack', B, 4, 'b')], alive: { attack: 8, defend: 2 } }));
    expect(ga.phase).toBe('pause');
    expect(ga.timer).toBeGreaterThan(HOLDS.won - 0.2);
    // (nobody fell in the stage: 30 or fewer spent is the attackers' "GREAT ATTACK")
    expect(out.find((e) => e.type === 'stageDone')).toMatchObject({ index: 0, spent: 0, rating: 'attack', string: 'ID_FANTASYBATTLES_OBJECTIVE_GREAT_ATTACK' });
    run(ga, STAGE_PAUSE + 0.05);
    expect(ga.stage).toBe(1);
    expect(view(ga).stage.id).toBe('escape');
  });

  it('keeps the prefab’s delays by what each does: 6 s a stage won, 9 s to the pickups, 120 s to the progress step, the client’s 7.2 and 5.8', () => {
    expect(HOLDS).toEqual({ won: 6, pickups: 9, progress: 120, banner: 7.2, head: 5.8, state: [12, 2] });
    expect(STAGE_PAUSE).toBe(6);
    expect(view(createAssault({ rulebook: rb })).holds).toBe(HOLDS);
    const ga = createAssault({ rulebook: rb, setup: 1 });
    run(ga, 1.05);
    expect(ga.phase).toBe('live');
  });

  it('steps the game progress once 120 s into the round and as each stage is done: 1, 2, 3, 4, and 5 at the end', () => {
    const ga = createAssault({ rulebook: rb });
    live(ga);
    expect(progressOf(ga)).toBe(1);
    run(ga, HOLDS.progress - 1);
    expect(progressOf(ga)).toBe(1);
    run(ga, 1.1);
    expect(progressOf(ga)).toBe(2);
    force(ga);
    run(ga, 0.05);
    expect(progressOf(ga)).toBe(3);
    expect(view(ga).progress).toBe(3);
    // the timed step runs once a round: 120 s into the second stage changes nothing
    run(ga, STAGE_PAUSE + 0.05);
    expect(ga.stage).toBe(1);
    run(ga, HOLDS.progress + 1);
    expect(progressOf(ga)).toBe(3);
    force(ga);
    run(ga, 0.05);
    expect(progressOf(ga)).toBe(4);
    run(ga, STAGE_PAUSE + 0.05);
    force(ga);
    run(ga, 0.05);
    expect(ga.result).toMatchObject({ winner: 2, why: 'objectives' });
    expect(progressOf(ga)).toBe(PROGRESS_MAX);
    ga.progress = 9;
    expect(progressOf(ga)).toBe(PROGRESS_MAX);
  });

  it('runs the timed step with the first stage’s done when the stage falls inside its 120 s', () => {
    const ga = createAssault({ rulebook: rb });
    live(ga);
    run(ga, 10);
    force(ga);
    run(ga, 0.05);
    expect(progressOf(ga)).toBe(3);
    // (and not again when the 120 s pass)
    run(ga, HOLDS.progress);
    expect(progressOf(ga)).toBe(3);
  });

  it('counts both sides’ deaths, and rates a stage by what the attackers spent in it: 50 or more a great defence, 30 or fewer a great attack', () => {
    expect(COUNTER).toMatchObject({ maxKills: 65000, enemyWeight: 1, suicideWeight: 1, countSuicide: true, ignoreAI: true, ignoreAIVictims: true });
    expect(RATING).toMatchObject({ defense: { atLeast: 50 }, attack: { atMost: 30 } });
    expect([0, 30, 31, 49, 50, 80].map(ratingFor)).toEqual(['attack', 'attack', null, null, 'defense', 'defense']);
    const ga = createAssault({ rulebook: rb });
    live(ga);
    for (let i = 0; i < 55; i++) onEvent(ga, { type: 'down', side: 'attack' });
    onEvent(ga, { type: 'down', side: 'defend' });
    expect(ga.deaths).toEqual({ attack: 55, defend: 1 });
    expect(ga.tickets).toBe(TICKETS_START - 55);
    force(ga);
    const done = tick(ga, 0.05, nobody).find((e) => e.type === 'stageDone');
    expect(done).toMatchObject({ id: 'walkers', spent: 55, rating: 'defense', string: 'ID_FANTASYBATTLES_OBJECTIVE_GREAT_DEFENSE' });
    // the next stage counts from its own start
    run(ga, STAGE_PAUSE + 0.05);
    for (let i = 0; i < 40; i++) onEvent(ga, { type: 'down', side: 'attack' });
    force(ga);
    expect(tick(ga, 0.05, nobody).find((e) => e.type === 'stageDone')).toMatchObject({ id: 'hangars', spent: 40, rating: null });
  });

  it('names each stage’s areas and points from the wiring: the attackers’ 26, 4 and 3, the defenders’ last stand the neutral three', () => {
    const ids = (list) => list.map((id) => Number(id.split(':')[1]));
    expect(ids(file.stages[0].spawns.attack)).toEqual([1, 2, 5, 9, 16, 18, 19, 22, 31, 32, 34, 36, 38, 40, 42, 47, 48, 49, 52, 55, 59, 60, 65, 66, 69, 70]);
    expect(ids(file.stages[0].spawns.defend)).toEqual([4, 11, 14, 15, 27, 37, 43, 56, 57, 58, 63, 64, 72]);
    expect(ids(file.stages[1].spawns.attack)).toEqual([20, 21, 44, 71]);
    expect(ids(file.stages[1].spawns.defend)).toEqual([30, 46, 53, 61, 74]);
    expect(ids(file.stages[2].spawns.attack)).toEqual([10, 24, 28]);
    expect(ids(file.stages[2].spawns.defend)).toEqual([3, 45, 54]);
    expect(map.polygons.filter((p) => file.stages[2].spawns.defend.includes(p.id)).every((p) => p.team === 0)).toBe(true);
    expect(file.stages.map((s) => s.points.attack.length)).toEqual([97, 19, 10]);
    expect(file.stages.map((s) => s.points.defend.length)).toEqual([66, 17, 12]);
    expect(file.spawnsSource).toBe('wired');
    // every id the file names is in the map
    const known = new Set([...map.polygons, ...map.spawns].map((x) => x.id));
    for (const st of file.stages) for (const id of [...st.spawns.attack, ...st.spawns.defend, ...st.points.attack, ...st.points.defend]) expect(known.has(id)).toBe(true);
  });

  it('walks the walkers’ stage’s spawn areas forward a step a waypoint trigger, the opening rooms shut after 25 s', () => {
    const ids = (list) => list.map((id) => Number(id.split(':')[1]));
    const steps = file.stages[0].steps;
    expect(steps.areas.attack).toHaveLength(8);
    expect(steps.at).toEqual({ 'FantasyBattle_Logic:303': [1, 4, 5, 6, 7, 8, 10], 'FantasyBattle_Logic:123': [1, 3, 4, 5, 6, 8, 11] });
    expect(file.stages[0].opening).toMatchObject({ seconds: 25, areas: { attack: [9], defend: [11] } });
    const ga = createAssault({ rulebook: rb });
    // as the round opens: the first step's three areas and the opening room
    expect(spawnStep(ga)).toBe(0);
    expect(ids(spawnSets(ga).attack)).toEqual([40, 49, 70, 9]);
    expect(ids(spawnSets(ga).defend)).toEqual([27, 37, 64, 11]);
    expect(spawnPoints(ga).attack).toHaveLength(12 + 25);
    live(ga);
    run(ga, 25.05);
    expect(ids(spawnSets(ga).attack)).toEqual([40, 49, 70]);
    expect(spawnPoints(ga).defend).toHaveLength(14);
    // a walker inside the reach of its first trigger's waypoint: the next three areas
    const walker = ga.objectives.find((o) => o.id === 'FantasyBattle_Logic:123');
    walker.walker.dist = walker.marks[1] - WAYPOINT_REACH - 1;
    expect(spawnStep(ga)).toBe(0);
    walker.walker.dist = walker.marks[1] - WAYPOINT_REACH;
    expect(spawnStep(ga)).toBe(1);
    expect(ids(spawnSets(ga).attack)).toEqual([22, 48, 55]);
    expect(ids(spawnSets(ga).defend)).toEqual([27, 37, 64]);
    // the further walker leads; at the path's end, the last step
    walker.walker.dist = walker.marks[4];
    expect(spawnStep(ga)).toBe(3);
    expect(ids(spawnSets(ga).defend)).toEqual([4, 56, 63]);
    walker.walker.dist = walker.walker.length;
    expect(spawnStep(ga)).toBe(7);
    expect(ids(spawnSets(ga).attack)).toEqual([52, 60, 66]);
    expect(view(ga).step).toBe(7);
    // a stage without steps gives its whole set
    force(ga);
    run(ga, 0.05);
    run(ga, STAGE_PAUSE + 0.05);
    expect(spawnStep(ga)).toBe(null);
    expect(ids(spawnSets(ga).attack)).toEqual([20, 21, 44, 71]);
    expect(spawnPoints(ga).attack).toHaveLength(19);
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
