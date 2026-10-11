import { describe, expect, it } from 'vitest';
import { seeded } from '../../seeded.js';
import { loadRulebook, teamsFor } from '../rulebook.js';
import { createPoints, earn } from '../battlePoints.js';
import { capture, carry } from '../modes/objectives.js';
import { buildNav, lineClear, shields } from '../nav.js';
import { assign, createCommander, spend, wave } from './commander.js';
import { createBrain, think } from './soldierBrain.js';
import { aiOf, classOf, weaponOf } from '../rulebook.js';
import { newSoldier } from '../soldier.js';
import { WAVE } from '../spawn.js';

const rb = loadRulebook();
const t = teamsFor(rb, 'hoth');
const box = (x, z) => ({ points: [[x - 5, z - 5], [x + 5, z - 5], [x + 5, z + 5], [x - 5, z + 5]] });
const ga = (objectives) => ({ phase: 'live', objectives });
const sq = (id, centre, members = []) => ({ id, centre, members, leader: members[0] ?? null });
const soldier = (id, team, at) => ({ id, team, kind: 'soldier', alive: true, at: [at[0], 0, at[1]] });

describe('the commander', () => {
  it('sends an attacker squad to a lying objective, and once it is carried to its drop-off', () => {
    const o = carry.create({ at: [10, 0], to: [90, 0] });
    const c = createCommander({ team: 2, side: 'attack', ga: ga([o]), squads: [sq('2.1', [0, -50])] });
    expect(assign(c, { entities: [], now: 0 }).get('2.1')).toMatchObject({ objective: 0, role: 'take', task: { at: [10, 0], radius: 0 } });
    o.carrier = 'b1';
    expect(assign(c, { entities: [], now: 5 }).get('2.1').task.at).toEqual([90, 0]);
  });

  it('sends two squads to two points, and the third to the one with fewer attackers', () => {
    const A = capture.create({ volume: box(0, 0) });
    const B = capture.create({ volume: box(100, 0) });
    const squads = [sq('2.1', [0, -50]), sq('2.2', [100, -50]), sq('2.3', [40, -50])];
    const c = createCommander({ team: 2, side: 'attack', ga: ga([A, B]), squads });
    const ents = [soldier('x', 2, [0, 0]), soldier('y', 2, [1, 1])];
    const plan = assign(c, { entities: ents, now: 0 });
    const to = (id) => plan.get(id).objective;
    expect(new Set([to('2.1'), to('2.2')])).toEqual(new Set([0, 1]));
    expect(to('2.3')).toBe(1);
    expect(plan.get('2.1').role).toBe('take');
  });

  it('holds the threatened point with one squad and counters with the rest', () => {
    const A = capture.create({ volume: box(0, 0) });
    const B = capture.create({ volume: box(200, 0) });
    const squads = [sq('1.1', [0, 60]), sq('1.2', [200, 60]), sq('1.3', [100, 60])];
    const c = createCommander({ team: 1, side: 'defend', ga: ga([A, B]), squads });
    const ents = [soldier('a', 2, [1, 0]), soldier('b', 2, [2, 2]), soldier('c', 2, [-3, 1])];
    const plan = assign(c, { entities: ents, now: 0 });
    const roles = [...plan.values()].map((p) => p.role).sort();
    expect(roles).toEqual(['counter', 'counter', 'hold']);
    expect(plan.get('1.1')).toMatchObject({ objective: 0, role: 'hold' });
    expect(Math.abs(plan.get('1.2').task.at[0])).toBeLessThan(5);
  });

  it('gives each member of a squad its task', () => {
    const A = capture.create({ volume: box(0, 0) });
    const s = newSoldier(classOf(rb, 'd-orig-assault'), { id: 'b1', team: 2, at: [0, 0, -40], weapon: weaponOf(rb, classOf(rb, 'd-orig-assault').weapon) });
    s.brain = createBrain(s, { ai: aiOf(rb), rand: seeded(1) });
    const c = createCommander({ team: 2, side: 'attack', ga: ga([A]), squads: [sq('2.1', [0, -40], ['b1'])] });
    assign(c, { entities: [s], now: 0 });
    expect(s.brain.task).toMatchObject({ at: [0, 0], role: 'take', radius: 5 });
  });

  it('one hero at a time', () => {
    const bp = createPoints({ rulebook: rb, teams: { 1: t.light, 2: t.dark } });
    earn(bp, 'b1', 'kill', 90);
    const c = createCommander({ team: 2, side: 'attack', ga: ga([]), squads: [], bp, rand: seeded(1), rulebook: rb });
    expect(spend(c, 'b1', { out: { heroes: 0, reinforcements: 0 } }).kind).toBe('hero');
    expect(spend(c, 'b1', { out: { heroes: 1, reinforcements: 0 } }).kind).toBe('reinforcement');
    expect(spend(c, 'b1', { out: { heroes: 1, reinforcements: 4 } }).kind).toBe('class');
  });

  it('never gives a squad two officers or two specialists', () => {
    const bp = createPoints({ rulebook: rb, teams: { 1: t.light, 2: t.dark } });
    const c = createCommander({ team: 1, side: 'defend', ga: ga([]), squads: [], bp, rulebook: rb });
    const squad = [];
    for (let i = 0; i < 8; i++) {
      const kind = spend(c, `b${i}`, { squadClasses: squad.map((x) => x.split('-').at(-1)) }).id;
      squad.push(kind);
    }
    expect(squad.filter((x) => x.endsWith('officer'))).toHaveLength(1);
    expect(squad.filter((x) => x.endsWith('specialist'))).toHaveLength(1);
  });

  it('deploys on the wave', () => {
    const c = createCommander({ team: 1, side: 'defend', ga: ga([]), squads: [] });
    expect(wave(c, 0)).toBe(true);
    expect(wave(c, 3)).toBe(false);
    expect(wave(c, WAVE)).toBe(true);
  });

  it('sends an attacker inside an arm volume with nobody near to interact', () => {
    const nav = buildNav({ heightAt: () => 0, bounds: { min: [-50, -50], max: [50, 50] }, cell: 2, solids: [], cover: aiOf(rb).cover.constants });
    const cls = classOf(rb, 'd-orig-assault');
    const s = newSoldier(cls, { id: 'b1', team: 2, at: [1, 0, 1], weapon: weaponOf(rb, cls.weapon) });
    const b = createBrain(s, { ai: aiOf(rb), rand: seeded(1) });
    const armObj = { type: 'arm', at: [1, 1], armed: false, done: false };
    const c = createCommander({ team: 2, side: 'attack', ga: ga([armObj]), squads: [sq('2.1', [1, 1], ['b1'])], nav });
    s.brain = b;
    assign(c, { entities: [s], now: 0 });
    expect(b.task.interact).toBe(true);
    const intent = think(b, { nav, lineClear: (x, y) => lineClear(nav, x, y), shields, squad: null, objective: b.task.at, task: b.task, enemies: [], taken: new Map() }, 1);
    expect(intent.mode).toBe('interact');
    expect(intent.interact).toBe(true);
  });
});
