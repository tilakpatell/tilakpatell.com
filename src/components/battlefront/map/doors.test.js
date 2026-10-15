import { describe, expect, it } from 'vitest';
import mode from '../../../../public/models/galaxy/bf2017/levels/hoth/ga/mode.json';
import level from '../../../../public/models/galaxy/bf2017/levels/hoth/ga/level.json';
import hoth from '../../../data/bf2017/maps/hoth.json';
import { setInput } from '../../../lib/battlefront/spawnLogic.js';
import { EASE, advance, arrive, controlled, createDoors, destroy, doorFraction, gateStands, inBox, interpolator, leafAt, retarget, shown, stepDoors } from './doors.js';

const origin = level.origin;
const door = (id) => mode.doors.find((d) => d.id === id);
const gate = (id) => mode.gates.find((d) => d.id === id);
const prop = (id) => mode.props.find((p) => p.id === id);
// a soldier stood in the export's frame at a pack-frame place (its feet)
const at = (p, team, side = team === 2 ? 'attack' : 'defend') => ({ at: [p[0] + origin[0], p[1] + origin[1], p[2] + origin[2]], team, side, alive: true });
// the sim's Galactic Assault state, as much as the doors read
const ga = (stage, more = {}) => ({ phase: 'live', stage, objectives: [], attack: 2, defend: 1, map: { prefabs: [], boxes: [], polygons: [], volumes: [] }, ...more });
const run = (state, seconds, input, dt = 1 / 30) => {
  for (let t = 0; t < seconds - 1e-9; t += dt) stepDoors(state, dt, input);
};

describe('the controller’s interpolator', () => {
  it('is the game’s Sine curve, eased out: sin(tπ/2) (1 − its ease-in 1 − cos)', () => {
    for (const t of [0, 0.25, 0.5, 0.9, 1]) expect(EASE.Sine.EaseOut(t)).toBeCloseTo(Math.sin((t * Math.PI) / 2), 12);
    expect(mode.controller).toMatchObject({ curve: 'Sine', mode: 'EaseOut', duration: 1.5 });
  });

  it('runs from where it is to its new In over the whole duration', () => {
    const ip = interpolator({ duration: 1 });
    retarget(ip, 1);
    advance(ip, 0.5);
    expect(ip.value).toBeCloseTo(Math.sin(Math.PI / 4), 6);
    // (turned back halfway: from 0.707 to 0, a full second again)
    retarget(ip, 0);
    advance(ip, 0.5);
    expect(ip.value).toBeCloseTo(Math.sin(Math.PI / 4) * (1 - Math.sin(Math.PI / 4)), 6);
    advance(ip, 0.5);
    expect(ip.value).toBe(0);
  });
});

describe('mode.json, read from the records', () => {
  it('has the base’s ten doors and the two gates with their leaves, slides and durations', () => {
    expect(mode.doors).toHaveLength(10);
    expect(mode.gates).toHaveLength(2);
    // (the double doors 1.98 m each way, the single doors 1.54 m, the hangar gates 8.96 m over 70 s)
    expect(door('FantasyBattle_Logic:26').leaves.map((l) => Math.hypot(...l.slide))).toEqual([1.98, 1.98]);
    expect(door('FantasyBattle_Logic:11').leaves.map((l) => Math.hypot(...l.slide))).toEqual([1.54]);
    expect(gate('FantasyBattle_Logic:91')).toMatchObject({ duration: 70, axis: 'x' });
    expect(gate('FantasyBattle_Logic:91').leaves.map((l) => l.slide[0])).toEqual([8.96, -8.96]);
    // (the Rebels' doors are Team1's, the corridor doors no one's)
    expect(door('FantasyBattle_Logic:26').team).toBe(1);
    expect(door('FantasyBattle_Logic:11').team).toBe(0);
    expect(mode.unmatched).toEqual([]);
  });

  it('stands every door, gate and state prop where the map rulebook’s own reading puts its prefab', () => {
    const things = [...mode.doors, ...mode.gates, ...mode.props.filter((p) => ['pickup', 'charge', 'wreck', 'gateRuin', 'walker'].includes(p.kind))];
    expect(things).toHaveLength(10 + 2 + 11 + 3 + 17 + 2 + 2);
    for (const x of things) {
      const row = hoth.rows.prefabs.find((r) => r.id === x.id);
      expect(row, x.id).toBeTruthy();
      for (let k = 0; k < 3; k++) expect(x.at[k] + origin[k]).toBeCloseTo(row.at[k], 2);
    }
  });

  it('keeps every changing instance out of the still art', () => {
    const c = controlled(mode);
    expect(c.filter((x) => x.kind === 'leaf')).toHaveLength(19);
    const kinds = new Set(c.filter((x) => x.kind === 'prop').map((x) => x.prop.kind));
    expect([...kinds].sort()).toEqual(['charge', 'gateRuin', 'pickup', 'static', 'walker', 'wreck']);
    // (the pickup's crate stands: only its HH-12 comes and goes)
    expect(c.some((x) => /weaponcrate/.test(x.mesh))).toBe(false);
    expect(c.filter((x) => /hh12_pickup/.test(x.mesh))).toHaveLength(11);
  });
});

describe('the base doors', () => {
  it('open as a soldier of the door’s team comes into its box, and shut behind them', () => {
    const s = createDoors(mode, { origin });
    const d = door('FantasyBattle_Logic:26');
    const rebel = at([d.trigger.at[0], d.at[1], d.trigger.at[2]], 1);
    run(s, 0.5, { soldiers: [rebel], ga: ga(0) });
    expect(doorFraction(s, d.id)).toBeCloseTo(Math.sin(Math.PI / 4), 2);
    run(s, 0.6, { soldiers: [rebel], ga: ga(0) });
    expect(doorFraction(s, d.id)).toBe(1);
    // (the leaves at their slide: 1.98 m apart from where they stood)
    const [left] = d.leaves;
    expect(leafAt(left, 1)).toEqual([left.at[0] + left.slide[0], left.at[1] + left.slide[1], left.at[2] + left.slide[2]]);
    run(s, 1.1, { soldiers: [], ga: ga(0) });
    expect(doorFraction(s, d.id)).toBe(0);
  });

  it('stay shut for the other side, and for a soldier outside the box or down', () => {
    const s = createDoors(mode, { origin });
    const d = door('FantasyBattle_Logic:26');
    const p = [d.trigger.at[0], d.at[1], d.trigger.at[2]];
    run(s, 1.2, { soldiers: [at(p, 2), at([p[0] + 20, p[1], p[2]], 1), { ...at(p, 1), alive: false }], ga: ga(0) });
    expect(doorFraction(s, d.id)).toBe(0);
  });

  it('a door of no one’s team opens for either side', () => {
    const s = createDoors(mode, { origin });
    const d = door('FantasyBattle_Logic:11');
    run(s, 1.2, { soldiers: [at([d.trigger.at[0], d.at[1], d.trigger.at[2]], 2)], ga: ga(0) });
    expect(doorFraction(s, d.id)).toBe(1);
  });

  it('a soldier on the floor above or below the box opens nothing', () => {
    const d = door('FantasyBattle_Logic:26');
    const p = [d.trigger.at[0], d.at[1], d.trigger.at[2]];
    expect(inBox(d.trigger, p, 1.8)).toBe(true);
    expect(inBox(d.trigger, [p[0], p[1] + 6, p[2]], 1.8)).toBe(false);
    expect(inBox(d.trigger, [p[0], p[1] - 4, p[2]], 1.8)).toBe(false);
  });

  it('are opened for good 10 s and 15 s after both hangars fall (the level’s OpenDoor delays)', () => {
    const s = createDoors(mode, { origin });
    run(s, 1, { soldiers: [], ga: ga(1) });
    // (the two capture points owned by Team2: the graph's And, its compare, its splitter, its delays)
    for (const id of ['FantasyBattle_Logic:134', 'FantasyBattle_Logic:209']) setInput(s.logic.vm, `${id}.1132020774`, true);
    run(s, 9.5, { soldiers: [], ga: ga(1) });
    expect(doorFraction(s, 'FantasyBattle_Logic:323')).toBe(0);
    run(s, 2, { soldiers: [], ga: ga(2) });
    expect(doorFraction(s, 'FantasyBattle_Logic:323')).toBe(1);
    expect(doorFraction(s, 'FantasyBattle_Logic:26')).toBe(0);
    run(s, 5, { soldiers: [], ga: ga(2) });
    expect(doorFraction(s, 'FantasyBattle_Logic:26')).toBe(1);
    // (held open: no one near, and a soldier of the other side changes nothing)
    run(s, 3, { soldiers: [], ga: ga(2) });
    expect(doorFraction(s, 'FantasyBattle_Logic:26')).toBe(1);
  });
});

describe('the gates', () => {
  it('stay shut through stage 1, whoever stands at them', () => {
    const s = createDoors(mode, { origin });
    const g = gate('FantasyBattle_Logic:91');
    run(s, 5, { soldiers: [at(g.at, 2), at(g.at, 1)], ga: ga(0) });
    expect(doorFraction(s, g.id)).toBe(0);
    expect(gateStands(s, g.id)).toBe(true);
  });

  it('open over 70 s on the controller’s curve when gates.js says so', () => {
    const s = createDoors(mode, { origin });
    const g = gate('FantasyBattle_Logic:91');
    run(s, 35, { soldiers: [], ga: ga(1), gates: { [g.id]: { open: 1 } } }, 0.25);
    expect(doorFraction(s, g.id)).toBeCloseTo(Math.sin(Math.PI / 4), 2);
    run(s, 36, { soldiers: [], ga: ga(1), gates: { [g.id]: { open: 1 } } }, 0.25);
    expect(doorFraction(s, g.id)).toBe(1);
    // (or the leaves' place as gates.js gives it)
    stepDoors(s, 0.1, { ga: ga(1), gates: { [g.id]: { fraction: 0.25 } } });
    expect(doorFraction(s, g.id)).toBe(0.25);
  });

  it('takes gates.js’s run as Galactic Assault’s view lists it, and fires the opened port once', () => {
    const s = createDoors(mode, { origin });
    const id = 'FantasyBattle_Logic:91';
    const fired = () => s.logic.vm.fired.filter((r) => r === `${id}.-1157191321`).length;
    stepDoors(s, 0.1, { ga: ga(1), gates: [{ id, state: 'unlocked', open: 0 }] });
    expect(doorFraction(s, id)).toBe(0);
    stepDoors(s, 0.1, { ga: ga(1), gates: [{ id, state: 'opening', open: 0.3 }] });
    stepDoors(s, 0.1, { ga: ga(1), gates: [{ id, state: 'opening', open: 0.4 }] });
    expect(doorFraction(s, id)).toBe(0.4);
    expect(fired()).toBe(1);
  });

  it('the other gate is blown a second after the first walker reaches its gate: its leaves go, its ruin comes', () => {
    const s = createDoors(mode, { origin });
    const path = mode.logic.nodes['FantasyBattle_Gameplay:56'].path;
    const walker = { alive: true, dist: 100, length: 100 };
    const escort = { type: 'escort', def: { waypoints: path }, path: [[0, 0, 0], [100, 0, 0]], walker };
    run(s, 0.5, { soldiers: [], ga: ga(0, { objectives: [escort] }) });
    run(s, 1.2, { soldiers: [], ga: ga(0, { objectives: [escort] }) });
    // (route :123 ends by the east gate, :307: walker :59 home first blows it, its ruin :297 comes, and the west gate's panel, :91's, is unlocked)
    expect(gateStands(s, 'FantasyBattle_Logic:91')).toBe(true);
    expect(gateStands(s, 'FantasyBattle_Logic:307')).toBe(false);
    expect(shown(s, prop('FantasyBattle_Logic:297'), prop('FantasyBattle_Logic:297').parts[0])).toBe(true);
    expect(shown(s, prop('FantasyBattle_Logic:121'), prop('FantasyBattle_Logic:121').parts[0])).toBe(false);
  });
});

describe('a check’s replays of the game’s events', () => {
  it('a walker home by its route, and a vehicle down and back', () => {
    const s = createDoors(mode, { origin });
    arrive(s, 'FantasyBattle_Logic:303');
    run(s, 1.2, { soldiers: [], ga: ga(0) });
    // (route :303 ends by the west gate: it is blown, the east one's panel unlocked)
    expect(gateStands(s, 'FantasyBattle_Logic:91')).toBe(false);
    expect(gateStands(s, 'FantasyBattle_Logic:307')).toBe(true);
    const df9 = prop('FantasyBattle_Logic:5');
    destroy(s, df9.id);
    expect(shown(s, df9, df9.parts[0])).toBe(true);
    destroy(s, df9.id, false);
    expect(shown(s, df9, df9.parts[0])).toBe(false);
  });
});

describe('the state props', () => {
  const part = (id, re) => prop(id).parts.find((p) => p.instances.some((i) => re.test(i.mesh)));

  it('the wrecks and ruins wait for their vehicle to be destroyed', () => {
    const s = createDoors(mode, { origin });
    const df9 = prop('FantasyBattle_Logic:5');
    expect(shown(s, df9, df9.parts[0])).toBe(false);
    s.destroyed.add(df9.id);
    expect(shown(s, df9, df9.parts[0])).toBe(true);
  });

  it('a charge shows while it is armed, until it goes off', () => {
    const s = createDoors(mode, { origin });
    const c = prop('FantasyBattle_Logic:4');
    const arm = { type: 'arm', def: { prefab: c.id }, armed: false, done: false };
    stepDoors(s, 0.1, { ga: ga(2, { objectives: [arm] }) });
    expect(shown(s, c, c.parts[0])).toBe(false);
    arm.armed = true;
    expect(shown(s, c, c.parts[0])).toBe(true);
    arm.done = true;
    expect(shown(s, c, c.parts[0])).toBe(false);
  });

  it('an HH-12 lies on its crate only once its zone is on: 10 s after a walker passes the zone’s waypoint', () => {
    const s = createDoors(mode, { origin });
    const hh12 = part('FantasyBattle_Logic:2', /hh12/);
    expect(shown(s, prop('FantasyBattle_Logic:2'), hh12)).toBe(false);
    // (the crate always stands)
    expect(shown(s, prop('FantasyBattle_Logic:2'), part('FantasyBattle_Logic:2', /weaponcrate/))).toBe(true);
    const wp = Object.entries(mode.logic.nodes).find(([, n]) => n.type === 'waypoint' && n.path === 'FantasyBattle_Logic:123' && n.at === 3);
    expect(wp).toBeTruthy();
    const pts = Array.from({ length: 12 }, (_, i) => [i * 10, 0, 0]);
    const escort = { type: 'escort', def: { waypoints: 'FantasyBattle_Logic:123' }, path: pts, walker: { alive: true, dist: 31, length: 110 } };
    run(s, 9, { soldiers: [], ga: ga(0, { objectives: [escort] }) });
    const on = () => mode.props.filter((p) => p.kind === 'pickup').filter((p) => shown(s, p, p.parts.find((q) => q.instances.some((i) => /hh12/.test(i.mesh))))).map((p) => p.id);
    expect(on()).toEqual([]);
    run(s, 2, { soldiers: [], ga: ga(0, { objectives: [escort] }) });
    expect(on().length).toBeGreaterThan(0);
  });

  it('the end of round’s room and a walker’s fall are never drawn in a round', () => {
    const s = createDoors(mode, { origin });
    const eor = prop('FantasyBattle_Logic:57');
    for (const p of eor.parts) expect(shown(s, eor, p)).toBe(false);
    const walker = prop('FantasyBattle_Logic:59');
    for (const p of walker.parts) expect(shown(s, walker, p)).toBe(false);
  });
});
