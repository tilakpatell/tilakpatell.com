import { describe, expect, it } from 'vitest';
import { MISSIONS, endRun, missionOf, newRun, outcomeOf, tickRun } from './index';
import { STEP_TYPES } from '../quests';
import { RIDES } from '../rides';
import { buildFigure } from '../figures';
import { SURFACE_MODELS } from '../catalog';
import { PROPS } from '../props';
import { siteOf } from '../sites';
import { makeHeight } from '../terrain';

describe('missions played as quests', () => {
  it('reads how a quest went from what the quest engine said', () => {
    expect(outcomeOf([{ type: 'step', step: 1 }, { type: 'done' }])).toBe('won');
    expect(outcomeOf([{ type: 'fail', why: 'time' }])).toBe('lost');
    expect(outcomeOf([{ type: 'count', count: 1, of: 3 }])).toBeNull();
    expect(outcomeOf([])).toBeNull();
  });

  it('gives every mission a ride there is (or none: on foot), and a quest mission steps the engine knows', () => {
    for (const list of Object.values(MISSIONS))
      for (const m of Object.values(list)) {
        if (m.ride) expect(RIDES[m.ride], `${m.id} ride`).toBeTruthy();
        else expect(m.kind, `${m.id} on foot`).toBe('quest');
        if (m.kind !== 'quest') continue;
        expect(m.quest.steps.length).toBeGreaterThan(0);
        for (const s of m.quest.steps) {
          expect(STEP_TYPES, `${m.id} ${s.type}`).toContain(s.type);
          expect(typeof s.text).toBe('string');
          for (const sp of [s.spawn].flat().filter(Boolean)) expect(Boolean(buildFigure(sp.kind) || SURFACE_MODELS[sp.kind] || PROPS[sp.kind]), `${m.id} spawn ${sp.kind}`).toBe(true);
        }
        expect(m.stars[0]).toBeLessThan(m.stars[1]);
      }
  });

  it('runs Lothal’s star map from the landing, between the spires, to the tower', () => {
    const m = missionOf('lothal', 'starmap');
    expect(m?.kind).toBe('quest');
    const site = siteOf('lothal');
    const tower = site.places.find((p) => p.id === 'tower');
    expect(tower?.things.some((t) => t.kind === 'lookout')).toBe(true);
    const race = m.quest.steps.find((s) => s.type === 'race');
    expect(race.ride).toBe('speederbike');
    expect(race.gates.length).toBeGreaterThanOrEqual(5);
    expect(race.time).toBeGreaterThan(0);
    const last = race.gates[race.gates.length - 1];
    expect(Math.hypot(last[0] - tower.at[0], last[1] - tower.at[1])).toBeLessThan(45);
    const use = m.quest.steps.find((s) => s.type === 'use');
    expect(Math.hypot(use.at[0] - tower.at[0], use.at[1] - tower.at[1])).toBeLessThan(tower.r);
    // a bike waits at the landing for anyone, not only the mission
    expect(site.rides.some((r) => r.kind === 'speederbike')).toBe(true);
  });

  it('keeps a quest mission’s clock till it ends, then holds it', () => {
    const m = missionOf('lothal', 'starmap');
    let run = tickRun(tickRun(newRun(), 10), 5);
    expect(run).toEqual({ phase: 'run', t: 15, result: null });
    const won = endRun(run, m, 'won');
    expect(won.result).toEqual({ won: true, t: 15, stars: 3 });
    expect(tickRun(won, 5).t).toBe(15);
    expect(endRun(won, m, 'lost', 'down')).toBe(won);
    expect(endRun(run, m, 'lost', 'time').result).toEqual({ won: false, t: 15, why: 'time' });
    run = tickRun(run, m.stars[1]);
    expect(endRun(run, m, 'won').result.stars).toBe(1);
  });

  it('says how each mission ended, every way it can end', () => {
    for (const list of Object.values(MISSIONS))
      for (const m of Object.values(list)) {
        expect(typeof m.ends.won, `${m.id} won`).toBe('string');
        expect(typeof m.ends.lost, `${m.id} lost`).toBe('string');
        for (const why of m.kind === 'quest' ? ['time', 'down'] : ['lost']) expect(typeof m.ends.why[why], `${m.id} ${why}`).toBe('string');
      }
  });

  it('starts every mission on foot on dry ground', () => {
    for (const list of Object.values(MISSIONS))
      for (const m of Object.values(list)) {
        if (m.ride) continue;
        const site = siteOf(m.system);
        const h = makeHeight(site.ground);
        expect(h(...m.start), `${m.id} start`).toBeGreaterThan((site.water?.level ?? -Infinity) + 0.2);
      }
  });

  it('runs Dagobah’s swamp from the camp to the cave, then raises the X-wing', () => {
    const m = missionOf('dagobah', 'raise');
    expect(m?.kind).toBe('quest');
    expect(m.ride).toBeFalsy();
    const site = siteOf('dagobah');
    const at = (id) => site.places.find((p) => p.id === id).at;
    const near = (a, b, r) => Math.hypot(a[0] - b[0], a[1] - b[1]) < r;
    expect(near(m.start, at('camp'), 20)).toBe(true);
    const race = m.quest.steps[0];
    expect(race.type).toBe('race');
    expect(race.ride).toBeFalsy();
    expect(race.gates.length).toBe(6);
    expect(near(race.gates.at(-1), at('cave'), 25)).toBe(true);
    expect(m.quest.steps.some((s) => s.type === 'shoot' && near(s.spawn.at, at('cave'), 20))).toBe(true);
    const last = m.quest.steps.at(-1);
    expect(last.type).toBe('use');
    expect(near(last.at, at('xwing'), 12)).toBe(true);
    expect(last.end.some((e) => e.signal === 'raise')).toBe(true);
    // (and Again puts it back in the bog)
    expect(m.reset.some((e) => e.signal === 'raise' && e.on === false)).toBe(true);
  });
});
