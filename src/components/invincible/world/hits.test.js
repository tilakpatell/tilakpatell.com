import { describe, expect, it } from 'vitest';
import { FLOOR, createHits } from './hits';

const at = (t) => ({ now: () => t, random: () => 0.5 });

describe('his hits, by force (lib/impact.js’s law)', () => {
  it('a harder landing is louder, and none is lost', () => {
    let t = 0;
    const hits = createHits({ now: () => (t += 1), random: () => 0.5 });
    const soft = hits.voice('land', 2);
    const slam = hits.voice('slam', 40);
    const crash = hits.voice('slam', 220);
    expect(soft.gain).toBeGreaterThanOrEqual(FLOOR);
    expect(slam.gain).toBeGreaterThan(soft.gain);
    expect(crash.gain).toBeGreaterThan(slam.gain);
    expect(crash.gain).toBeLessThanOrEqual(1);
    expect(slam.pitch).toBeGreaterThan(0.8);
  });
  it('one key once within its gap, so a skim isn’t a drum roll', () => {
    const hits = createHits(at(10));
    expect(hits.voice('slam', 100)).not.toBeNull();
    expect(hits.voice('slam', 100)).toBeNull();
    expect(hits.voice('impact', 100)).not.toBeNull();
  });
  it('a villain’s hit goes by their size', () => {
    let t = 0;
    const hits = createHits({ now: () => (t += 1), random: () => 0.5 });
    expect(hits.voice('foe', hits.foeForce('mauler')).gain).toBeGreaterThan(hits.voice('foe', hits.foeForce('flaxan')).gain);
  });
  it('a force that is no number is no sound', () => {
    expect(createHits(at(0)).voice('slam', NaN)).toBeNull();
  });
});

describe('the brawl’s moves', () => {
  it('have forces: a counter harder than a punch, a slam and a dive by how fast they land', () => {
    const h = createHits({ now: () => 0, random: () => 0.5 });
    expect(h.moveForce({ kind: 'counter' })).toBeGreaterThan(h.moveForce({ kind: 'punch' }));
    expect(h.moveForce({ kind: 'slam', force: 75 })).toBe(75);
    expect(h.moveForce({ kind: 'diveHit', force: 90 })).toBe(90);
    expect(h.moveForce({ kind: 'pound' })).toBeGreaterThan(0);
    expect(h.moveForce({ kind: 'nothing' })).toBe(0);
  });
});
