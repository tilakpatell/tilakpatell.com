import { describe, expect, it } from 'vitest';
import { clusterView } from './clusterView';
import { createArmory } from './weapons';

const flight = (o = {}) => ({ flying: true, onFoot: false, view: 'chase', crash: false, dive: false, frozen: false, shield: 100, footInfo: null, armory: createArmory('xwing'), ...o });
const walk = (health, troops = 0, hand = null) => flight({ flying: false, onFoot: true, footInfo: { health, troops: Array.from({ length: troops }, () => ({})), hand } });

describe('the universe map’s flight cluster', () => {
  it('is up while flying, the shields full and the line picked, from the start, as the galaxy’s is', () => {
    const v = clusterView(flight());
    expect(v.on).toBe(true);
    expect(v.vitals).toEqual({ value: 100, max: 100, low: false });
    expect(v.arms.name).toBe('Laser cannons');
    expect(v.arms.line).toBe('primary');
    expect(clusterView(flight({ armory: null })).arms).toBe(null);
  });
  it.each([
    ['the nav map', { view: 'map' }],
    ['the shipyard over it', { frozen: true }],
    ['a crash', { crash: true }],
    ['a dive into a world', { dive: true }],
    ['not flying', { flying: false }],
  ])('is down for %s', (_, o) => {
    expect(clusterView(flight(o)).on).toBe(false);
  });
  it('flags the shields low under 35', () => {
    expect(clusterView(flight({ shield: 34 })).vitals.low).toBe(true);
    expect(clusterView(flight({ shield: 35 })).vitals.low).toBe(false);
  });
  it('is the gun in your hand on foot, with its heat, while it’s warm', () => {
    const dl44 = { name: 'DL-44', value: 0.4, locked: false, vent: null };
    const v = clusterView(walk(1, 0, dl44));
    expect(v.on).toBe(true);
    expect(v.arms).toMatchObject({ name: 'DL-44', line: 'hand', heat: 0.4, locked: false, vent: null });
    expect(clusterView(walk(1, 0, { ...dl44, value: 0 })).on).toBe(false);
    expect(clusterView(walk(1, 0, { ...dl44, value: 1, locked: true, vent: 0.3 })).arms).toMatchObject({ locked: true, vent: 0.3 });
  });
  it('is your health on foot, while you’re hurt or there’s trouble, with no arms when there’s no gun', () => {
    const hurt = clusterView(walk(0.6));
    expect(hurt.on).toBe(true);
    expect(hurt.vitals).toEqual({ value: 60, max: 100, low: false });
    expect(hurt.arms).toBe(null);
    expect(clusterView(walk(1, 2)).on).toBe(true);
    expect(clusterView(walk(1)).on).toBe(false);
    expect(clusterView(walk(0.3)).vitals.low).toBe(true);
  });
  it('hides on foot under the shipyard too', () => {
    expect(clusterView({ ...walk(0.6), frozen: true }).on).toBe(false);
  });
  it('fills the record it’s handed, making nothing a frame', () => {
    const out = clusterView(flight());
    const again = clusterView(flight({ shield: 50 }), out);
    expect(again).toBe(out);
    expect(again.vitals).toBe(out.vitals);
    expect(again.vitals.value).toBe(50);
  });
});
