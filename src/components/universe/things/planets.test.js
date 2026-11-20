import { describe, expect, it } from 'vitest';
import { fullSector, orbitAt, UNIVERSE } from '../../expanse/shared/gen';
import { planetTraits } from '../places/cards';
import { SURVEY_KEY, addSurvey, hazardOf, loadSurveys, promptOf, saveSurveys, surveyPay, verbAt } from '../../../lib/space/planetPlay.js';
import { createLedger } from './rules';
import { createThingPlay } from './index';

const memStore = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), m };
};

describe('playing a planet', () => {
  const sector = fullSector(UNIVERSE, 3, 0, 1);
  const sys = sector.systems.find((s) => s.planets.length);
  const p = sys.planets[0];

  it('surveys it once from orbit, pays by what it has, and keeps it in the log', () => {
    const store = memStore();
    const paid = [];
    const said = [];
    const play = createThingPlay({ sectors: () => [sector], pay: (w, n) => paid.push([w, n]), say: (t) => said.push(t), store });
    const t = 0;
    const at = orbitAt(p, t);
    const state = { ship: { x: at[0] + p.radius * 2, y: at[1], z: at[2] }, clock: 0, shield: 100 };
    play.update(state, 0.3, t);
    expect(play.near()).toMatchObject({ id: p.id, kind: 'planet', verb: 'survey' });
    expect(play.press(state)).toBe(true);
    const tr = planetTraits(p, sys);
    expect(paid).toEqual([['found', surveyPay(tr)]]);
    expect(said.at(-1)).toContain(`Surveyed ${p.name}`);
    expect(loadSurveys(store)).toEqual([p.id]);
    play.update(state, 0.3, t);
    expect(play.near()?.verb ?? null).toBe(tr.anomaly ? 'probe' : null);
  });

  it('asks for the anomaly once it’s surveyed, and for nothing after', () => {
    const ledger = createLedger();
    const tr = { anomaly: { id: 'song' }, tags: ['anomaly'] };
    expect(verbAt(tr, ledger, 'x')).toBe('survey');
    ledger.pay('x:survey', 1, 1);
    expect(verbAt(tr, ledger, 'x')).toBe('probe');
    ledger.pay('x:probe', 1, 1);
    expect(verbAt(tr, ledger, 'x')).toBe(null);
  });

  it('keeps the log once each, newest last, and a broken store is no log', () => {
    expect(addSurvey(addSurvey(['a', 'b'], 'a'), 'c')).toEqual(['b', 'a', 'c']);
    const bad = { getItem: () => '{nope', setItem: () => { throw new Error('full'); } };
    expect(loadSurveys(bad)).toEqual([]);
    expect(() => saveSurveys(bad, ['a'])).not.toThrow();
    expect(SURVEY_KEY).toBe('tp-surveys');
  });
});

describe('what the HUD reads of a planet', () => {
  it('a hazard as a warning or a danger, and pirates as none', () => {
    expect(hazardOf({ hazard: { id: 'heat', level: 1 } })).toEqual({ id: 'heat', level: 'warn', n: 1 });
    expect(hazardOf({ hazard: { id: 'heat', level: 3 } })).toEqual({ id: 'heat', level: 'danger', n: 3 });
    expect(hazardOf({ hazard: { id: 'pirates', level: 2 } })).toBe(null);
    expect(hazardOf({ hazard: null })).toBe(null);
  });
  it('the key and what it does now', () => {
    const ledger = createLedger();
    expect(promptOf({ tags: [] }, ledger, 'p')).toEqual({ key: 'E', verb: 'survey' });
    ledger.pay('p:survey', 1, 1);
    expect(promptOf({ tags: [] }, ledger, 'p')).toBe(null);
  });
});

describe('harvesting a planet', () => {
  it('offers it once surveyed, with a hold to fill, and says what the market says', () => {
    const sector = fullSector(UNIVERSE, 3, 0, 1);
    const sys = sector.systems.find((s) => s.planets.length);
    const p = sys.planets[0];
    const said = [];
    const reap = (o) => (o.id === p.id ? 'Into the hold: 3 iron' : null);
    reap.ready = () => true;
    const play = createThingPlay({ sectors: () => [sector], pay: () => {}, say: (t) => said.push(t), reap });
    const at = orbitAt(p, 0);
    const state = { ship: { x: at[0] + p.radius * 2, y: at[1], z: at[2] }, clock: 0, shield: 100 };
    const ledger = play.ledger;
    ledger.pay(`${p.id}:survey`, 1, 1);
    ledger.pay(`${p.id}:probe`, 1, 1);
    play.update(state, 0.3, 0);
    expect(play.near()).toMatchObject({ id: p.id, verb: 'harvest' });
    expect(play.press(state)).toBe(true);
    expect(said.at(-1)).toBe('Into the hold: 3 iron');
    expect(verbAt({ tags: [], resources: [{ id: 'iron', amount: 1 }] }, ledger, p.id)).toBe(null);
  });
});
