import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { seeded } from '../../lib/seeded';
import { createSkirmishes } from './skirmishes';

// a fleet as glbFleet.js is one, its models only groups (wingmen.test.js's)
const fakeFleet = () => ({
  want: vi.fn(),
  loaded: () => false,
  make: (kind) => ({ kind, group: new THREE.Group(), size: new THREE.Vector3(1, 1, 1), fit: 1, update() {}, dispose: vi.fn() }),
});
const at = { x: 400, y: 30, z: -900 }; // (out in the open, nothing solid near)

// (seeded: the skirmish is already going when it starts, its pre-roll a fight,
// and about one start in 3,000 lost an escort in it, so a test of what each
// body answers wants the same start every time)
const started = (seed = 7) => {
  const s = createSkirmishes(new THREE.Group(), { fleet: fakeFleet(), rand: seeded(seed) });
  s.start({ at, heading: 0.4, faction: 'empire', escort: 'xwing', civil: 'freighter', size: 3 });
  s.update(1 / 60, 0, null);
  return s;
};

describe('a skirmish, as bodies for ship contact', () => {
  it('answers its hunters as foes, its escort as friends and its freighter as civil', () => {
    const s = started();
    const bodies = s.bodies;
    const foes = bodies.filter((b) => b.side === 'foe');
    const friends = bodies.filter((b) => b.side === 'friend');
    const civil = bodies.filter((b) => b.side === 'civil');
    expect(foes.length).toBeGreaterThan(0);
    for (const b of foes) expect(b.key).toBe(`sk:h:${b.id}`);
    expect(friends).toHaveLength(2);
    for (const b of friends) expect(b.key).toBe(`sk:w:${b.id}`);
    expect(civil).toHaveLength(1);
    expect(civil[0]).toMatchObject({ key: 'sk:f', kind: 'freighter', size: 0.7 });
    expect(civil[0].at).toMatchObject({ x: expect.any(Number), y: expect.any(Number), z: expect.any(Number) });
    s.dispose();
  });

  it('takes a ram on one of its hunters as a shot’s hit, and none on its escort or its freighter', () => {
    const s = started();
    const foe = s.bodies.find((b) => b.side === 'foe');
    const r = foe.hit(4);
    expect(r).toMatchObject({ id: foe.id, down: true });
    expect(s.bodies.some((b) => b.key === foe.key)).toBe(false);
    for (const b of s.bodies.filter((o) => o.side !== 'foe')) expect(b.hit(4)).toBeNull();
    s.dispose();
  });

  it('answers nothing when there is no skirmish', () => {
    const s = createSkirmishes(new THREE.Group(), { fleet: fakeFleet() });
    expect(s.bodies).toEqual([]);
    s.dispose();
  });
});
