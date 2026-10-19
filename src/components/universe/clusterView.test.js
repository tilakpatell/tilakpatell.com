import { describe, expect, it } from 'vitest';
import { clusterView } from './clusterView';
import { createArmory } from './weapons';

const flight = (o = {}) => ({ flying: true, onFoot: false, view: 'chase', crash: false, dive: false, frozen: false, armed: false, shield: 100, footInfo: null, armory: createArmory('xwing'), ...o });
const walk = (health, troops = 0) => flight({ flying: false, onFoot: true, footInfo: { health, troops: Array.from({ length: troops }, () => ({})) } });

describe('the universe map’s flight cluster', () => {
  it('is up while flying, the shields full and no arms till the guns are used', () => {
    const v = clusterView(flight());
    expect(v.on).toBe(true);
    expect(v.vitals).toEqual({ value: 100, max: 100, low: false });
    expect(v.arms).toBe(null);
  });
  it('shows the line picked once the guns are used', () => {
    const v = clusterView(flight({ armed: true }));
    expect(v.arms.name).toBe('Laser cannons');
    expect(v.arms.line).toBe('primary');
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
  it('is your health on foot, while you’re hurt or there’s trouble, with no arms', () => {
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
    const out = clusterView(flight({ armed: true }));
    const again = clusterView(flight({ armed: true, shield: 50 }), out);
    expect(again).toBe(out);
    expect(again.vitals).toBe(out.vitals);
    expect(again.vitals.value).toBe(50);
  });
});
