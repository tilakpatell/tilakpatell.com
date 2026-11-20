import { describe, expect, it } from 'vitest';
import { BEAM, PULLS, RIFT, freshPull, pullStep, squashOf } from './pull';
import { POSITIONS, REACH } from './layout';
import { portalById } from './portals';

const dist = (s, at) => Math.hypot(s.x - at[0], s.y - at[1], s.z - at[2]);
// a ship `d` out from `at` along +x, level, coming on toward it (heading −π/2 is +x's way back: forward(h) = [−sin h, −cos h])
const toward = (at, d, speed = 300) => ({ x: at[0] + d, y: at[1], z: at[2], heading: -Math.PI / 2 + Math.PI, pitch: 0, speed, bank: 0 });
const away = (at, d) => ({ ...toward(at, d), heading: -Math.PI / 2 });

function run(ship, { seconds = 30, boost = () => false, dt = 1 / 60 } = {}) {
  let st = freshPull();
  let s = ship;
  const seen = [];
  for (let t = 0; t < seconds; t += dt) {
    const r = pullStep(st, s, { boost: boost(t, st), dt, now: t });
    st = r.st;
    s = r.ship;
    for (const e of r.events) seen.push({ ...e, t });
    if (st.phase === 'through') break;
  }
  return { st, s, seen };
}

describe('the portals’ pulls', () => {
  it('sits at the Star Wars gate and the portal into the Curve', () => {
    expect(PULLS.map((p) => p.id)).toEqual(['starwars', 'rmportal']);
    expect(PULLS[0].at).toEqual(POSITIONS.starwars);
    expect(PULLS[1].at).toEqual(portalById('rmportal').at);
    expect(BEAM.lock).toBeLessThan(BEAM.reach);
  });

  it('never catches a ship that isn’t closing in: parked beside, or going away', () => {
    for (const p of PULLS) {
      expect(run({ ...toward(p.at, p.reach * 0.6), speed: 0 }, { seconds: 3 }).seen).toEqual([]);
      expect(run(away(p.at, p.reach * 0.6), { seconds: 3 }).seen).toEqual([]);
      expect(run(toward(p.at, p.reach * 1.5, 0), { seconds: 3 }).seen).toEqual([]); // (out of its reach)
    }
  });

  it('hauls a ship caught by the Maelstrom’s beam in, locks on, and takes it through the gate', () => {
    const gate = POSITIONS.starwars;
    const { st, s, seen } = run(toward(gate, BEAM.reach - 200), { seconds: 60 });
    expect(seen.map((e) => e.type)).toEqual(['caught', 'locked', 'through']);
    expect(st.phase).toBe('through');
    expect(dist(s, gate)).toBeLessThanOrEqual(REACH.starwars * 1.05);
    // (and not in a blink: a few seconds of being dragged)
    expect(seen.at(-1).t).toBeGreaterThan(3);
    expect(seen.at(-1).t).toBeLessThan(40);
  });

  it('lets a ship boost free before the lock, and then leaves it be a while', () => {
    const gate = POSITIONS.starwars;
    const { st, seen } = run(toward(gate, BEAM.reach - 100), { seconds: 4, boost: () => true });
    expect(seen.map((e) => e.type)).toEqual(['caught', 'broke']);
    expect(st.phase).toBe('free');
    expect(st.restUntil).toBeGreaterThan(seen[1].t + BEAM.rest - 0.1);
    // (still closing in, the beam doesn't catch it again while it rests)
    const again = pullStep(st, toward(gate, BEAM.reach - 400), { dt: 1 / 60, now: seen[1].t + 1 });
    expect(again.events).toEqual([]);
  });

  it('won’t let go once it’s locked', () => {
    const gate = POSITIONS.starwars;
    const { seen } = run(toward(gate, BEAM.lock - 50), { seconds: 60, boost: () => true });
    expect(seen.map((e) => e.type)).toEqual(['caught', 'locked', 'through']);
  });

  it('spins a ship the Rift grabs round and in, squashed and stretched, and through', () => {
    const p = portalById('rmportal');
    let maxSquash = 1;
    let st = freshPull();
    let s = toward(p.at, RIFT.reach - 100);
    const types = [];
    let turned = 0;
    let last = Math.atan2(s.z - p.at[2], s.x - p.at[0]);
    for (let t = 0; t < 30 && st.phase !== 'through'; t += 1 / 60) {
      const r = pullStep(st, s, { dt: 1 / 60, now: t });
      st = r.st;
      s = r.ship;
      types.push(...r.events.map((e) => e.type));
      maxSquash = Math.max(maxSquash, squashOf(st)[1]);
      const a = Math.atan2(s.z - p.at[2], s.x - p.at[0]);
      turned += Math.abs(Math.atan2(Math.sin(a - last), Math.cos(a - last)));
      last = a;
    }
    expect(types).toEqual(['caught', 'through']);
    expect(turned).toBeGreaterThan(Math.PI * 2); // (round it at least once)
    expect(maxSquash).toBeGreaterThan(1.5);
    expect(Math.hypot(s.x - p.at[0], s.z - p.at[2])).toBeLessThanOrEqual(p.r * RIFT.through + 1e-6);
  });

  it('keeps the ship’s scale as it is outside the Rift’s grab', () => {
    expect(squashOf(freshPull())).toEqual([1, 1]);
    expect(squashOf({ ...freshPull(), phase: 'caught', id: 'starwars', k: 1, t: 2 })).toEqual([1, 1]);
    const [across, along] = squashOf({ phase: 'grabbed', id: 'rmportal', k: 1, t: 0 });
    expect(across * across * along).toBeCloseTo(1, 6); // (its volume kept)
  });
});
