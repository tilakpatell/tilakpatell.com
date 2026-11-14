import { describe, expect, it } from 'vitest';
import { THING_KINDS, UNIVERSE, fullSector, rowAt, thingRow, traitsOf } from '../../expanse/shared/gen';
import { atTime } from '../places/ids';
import { resolvePlace } from '../places/resolve';
import { THING_CARDS, placeCard } from '../places/cards';
import { PLACE } from '../words';
import { CATALOGUE_CARDS } from './cards';

const s = fullSector(UNIVERSE, 1, 0, 0);
const rowsOf = (kind) => {
  const out = [];
  for (let i = 0; i < s.things.count; i++) if (THING_KINDS[s.things.kind[i]].kind === kind) out.push(thingRow(s, i));
  return out;
};

describe('lane 4a’s cards', () => {
  it('gives every lattice kind lane 3’s card, in the glossary’s words', () => {
    for (const { kind } of THING_KINDS) {
      expect(THING_CARDS[kind], kind).toBeDefined();
      expect(THING_CARDS[kind].type).toBe(PLACE.thing[kind]);
      expect(THING_CARDS[kind].about).toBe(PLACE.about[kind]);
    }
  });
  it('lands on a rocky rogue world, never on a gas one', () => {
    const rogues = rowsOf('rogue');
    const rocky = rogues.find((r) => traitsOf(r).land);
    const gas = rogues.find((r) => !traitsOf(r).land);
    expect(placeCard({ kind: 'thing', row: rocky, sector: s }).land).toBe(true);
    expect(placeCard({ kind: 'thing', row: gas, sector: s }).land).toBe(false);
    expect(placeCard({ kind: 'thing', row: rowsOf('rock')[0], sector: s }).land).toBe(false);
  });
  it('marks the four new kinds on the chart as dots', () => {
    for (const k of ['outpost', 'beacon', 'relay', 'monolith']) expect(CATALOGUE_CARDS[k].chart, k).toEqual({ shape: 'dot', priority: 20 });
  });
  it('gives the fields, comets and rigs their cards, and moves a comet where its path has it', () => {
    expect(CATALOGUE_CARDS.field).toMatchObject({ type: PLACE.thing.field, solid: false, chart: { shape: 'dot', priority: 15 } });
    expect(CATALOGUE_CARDS.icefield).toMatchObject({ type: PLACE.thing.icefield, solid: false, chart: { shape: 'dot', priority: 15 } });
    expect(CATALOGUE_CARDS.comet).toMatchObject({ type: PLACE.thing.comet, solid: true, chart: { shape: 'dot', priority: 25 } });
    expect(CATALOGUE_CARDS.rig).toMatchObject({ type: PLACE.thing.rig, solid: true, chart: { shape: 'dot', priority: 20 } });
    const comet = s.extras.comet[0];
    expect(atTime(resolvePlace(comet.id, { t: 0, sectors: [s] }), 5000)).toEqual(rowAt(comet, 5000));
  });
  it('gives fleets and shipyards their cards', () => {
    for (const k of ['fleet', 'shipyard']) expect(CATALOGUE_CARDS[k], k).toMatchObject({ type: PLACE.thing[k], about: PLACE.about[k], solid: true, chart: { shape: 'dot', priority: 30 } });
  });
  it('gives the clouds and the life between the systems their cards, the movers where their paths have them', () => {
    for (const k of ['pocket', 'remnant']) expect(CATALOGUE_CARDS[k], k).toMatchObject({ type: PLACE.thing[k], solid: false, chart: { shape: 'cloud', priority: 35 } });
    for (const k of ['storm', 'herd', 'swarm']) {
      expect(CATALOGUE_CARDS[k], k).toMatchObject({ type: PLACE.thing[k], solid: true, chart: { shape: 'dot', priority: 30 } });
      const row = s.extras[k][0];
      expect(CATALOGUE_CARDS[k].move(row, 777), k).toEqual(rowAt(row, 777));
    }
    expect(CATALOGUE_CARDS.debris).toMatchObject({ solid: false, chart: { shape: 'dot', priority: 15 } });
  });
  it('gives the dead stars, the young ones and the wormholes their cards', () => {
    for (const k of ['magnetar', 'protostar']) expect(CATALOGUE_CARDS[k], k).toMatchObject({ type: PLACE.thing[k], solid: true, chart: { shape: 'star', priority: 30 } });
    expect(CATALOGUE_CARDS.wormhole).toMatchObject({ type: PLACE.thing.wormhole, solid: true, chart: { shape: 'hole', priority: 40 } });
    expect(THING_CARDS.pulsar.type).toBe(PLACE.thing.pulsar); // (lane 3's own, for the generated pulsars too)
  });
  it('lists each gargantuan out to 400,000, and parks outside it', () => {
    for (const k of ['hole', 'arc', 'hulk', 'giant', 'dyson']) expect(CATALOGUE_CARDS[k], k).toMatchObject({ type: PLACE.thing[k], about: PLACE.about[k], solid: true, far: 400000 });
    expect(CATALOGUE_CARDS.hole.chart.shape).toBe('hole');
    expect(CATALOGUE_CARDS.dyson.chart.shape).toBe('star');
  });
});
