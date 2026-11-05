import { describe, expect, it } from 'vitest';
import { JUMP, aimFrom, aimTargets, jumpPhase, nameShows } from './aim';
import { HYPER, hyperState } from './nav';
import { POSITIONS, SUN } from './layout';
import { isGoal } from './ship';

const unit = (v) => {
  const l = Math.hypot(...v);
  return v.map((x) => x / l);
};
const toward = (from, to) => unit([to[0] - from[0], to[1] - from[1], to[2] - from[2]]);
// turned `a` radians about y
const turned = ([x, y, z], a) => [x * Math.cos(a) + z * Math.sin(a), y, -x * Math.sin(a) + z * Math.cos(a)];

describe('the aim', () => {
  const from = [0, 20, 600]; // (just out of the home system)
  const main = aimTargets('main', null);

  it('aims at the place nearest the nose within the cone', () => {
    const nose = toward(from, POSITIONS.middleearth);
    expect(aimFrom(from, nose, main)?.id).toBe('middleearth');
    expect(aimFrom(from, turned(nose, 0.02), main)?.id).toBe('middleearth');
  });

  it('aims at nothing with nothing in the cone', () => {
    // (straight up out of the disc: nothing there)
    expect(aimFrom(from, [0, 1, 0], main)).toBe(null);
  });

  it('never aims at a place near enough to be itself: only at stars (past where it\'s real)', () => {
    // (beside Middle-earth, 1.75 of its reaches out, looking at it: it's a planet, not a star)
    const me = POSITIONS.middleearth;
    const beside = [me[0] + 190, me[1], me[2]];
    expect(aimFrom(beside, toward(beside, me), main)?.id ?? null).not.toBe('middleearth');
    // and from far off it's a star again
    expect(aimFrom(from, toward(from, me), main)?.id).toBe('middleearth');
  });

  it('sticks to the one it had', () => {
    const targets = [
      { id: 'a', at: [0, 0, -10000] },
      { id: 'b', at: [Math.tan(0.005) * 10000, 0, -10000] },
    ];
    const nose = [0, 0, -1];
    expect(aimFrom([0, 0, 0], nose, targets)?.id).toBe('a');
    expect(aimFrom([0, 0, 0], nose, targets, 'b')?.id).toBe('b');
  });

  it('never aims at where you are, nor the other sector', () => {
    expect(aimTargets('main', 'middleearth').some((t) => t.id === 'middleearth')).toBe(false);
    expect(aimTargets('main', null).some((t) => t.id === 'gazorpazorp')).toBe(false);
    expect(aimTargets('rickmorty', null).some((t) => t.id === 'gazorpazorp')).toBe(true);
    expect(aimTargets('rickmorty', null).some((t) => t.id === 'middleearth')).toBe(false);
  });

  it('aims only at somewhere the ship can go: the home sun is home, the Twins once, no station', () => {
    for (const t of main) expect(isGoal(t.id), t.id).toBe(true);
    expect(main.find((t) => t.id === 'home')?.at).toEqual(SUN.at);
    expect(main.filter((t) => t.id === 'twins')).toHaveLength(1);
    expect(main.some((t) => t.id === 'projects')).toBe(false);
    expect(main.some((t) => t.id === 'sun')).toBe(false);
  });
});

describe('the jump', () => {
  it('aligns, then spools, and the stick cancels it', () => {
    expect(JUMP).toEqual({ align: 4.5, aligned: 0.996 });
    expect(jumpPhase({ phase: 'align' }, { aligned: 0.9, age: 1, input: false })).toBe('align');
    expect(jumpPhase({ phase: 'align' }, { aligned: 0.997, age: 1, input: false })).toBe('spool');
    expect(jumpPhase({ phase: 'align' }, { aligned: 0.5, age: 4.6, input: false })).toBe('spool');
    expect(jumpPhase({ phase: 'align' }, { aligned: 0.9, age: 1, input: true })).toBe('cancel');
    // (past the align, it's the jump's own)
    expect(jumpPhase({ phase: 'spool' }, { aligned: 0.2, age: 9, input: true })).toBe('spool');
  });

  it('recharges in five seconds', () => {
    expect(HYPER.recharge).toBe(5);
    expect(hyperState({ last: 0, now: 4 }).ready).toBe(false);
    expect(hyperState({ last: 0, now: 5 }).ready).toBe(true);
  });
});

describe('whose name shows', () => {
  const base = { k: 1, station: false, picked: false, viewAll: false, onFoot: false, noseDot: 0 };
  it('shows every name with the whole map in view, or no ship', () => {
    expect(nameShows({ ...base, viewAll: true })).toBe(true);
  });
  it('shows a place that is itself (near), picked, aimed at or gone to', () => {
    expect(nameShows({ ...base, k: 0.5 })).toBe(true);
    expect(nameShows({ ...base, picked: true })).toBe(true);
  });
  it('shows a far star only within 8° of the nose', () => {
    expect(nameShows({ ...base, noseDot: Math.cos(0.1) })).toBe(true);
    expect(nameShows({ ...base, noseDot: Math.cos(0.2) })).toBe(false);
  });
  it('never names a far station by the nose: out there it is not drawn at all (home is the sun)', () => {
    expect(nameShows({ ...base, station: true, noseDot: 1 })).toBe(false);
    expect(nameShows({ ...base, station: true, k: 0 })).toBe(true);
    expect(nameShows({ ...base, station: true, picked: true })).toBe(true);
  });
  it('on foot, names only what is near or picked', () => {
    expect(nameShows({ ...base, onFoot: true, noseDot: 1 })).toBe(false);
    expect(nameShows({ ...base, onFoot: true, k: 0 })).toBe(true);
  });
});

describe('aiming, frame after frame', () => {
  it('hands back the same list of places for the same sector and the same place you are at (it is asked every frame)', () => {
    const a = aimTargets('main', null);
    expect(aimTargets('main', null)).toBe(a);
    expect(aimTargets('main', a[0].id)).not.toBe(a);
    expect(aimTargets('main', a[0].id)).toBe(aimTargets('main', a[0].id));
    expect(aimTargets('main', a[0].id).some((t) => t.id === a[0].id)).toBe(false);
  });

  it('finds the same star ahead whether asked once or many times over (its records kept between calls)', () => {
    const targets = aimTargets('main', null);
    const t = targets.find((x) => x.reach != null) ?? targets[0];
    const from = [t.at[0] + 50000, t.at[1], t.at[2]];
    const nose = [-1, 0, 0];
    const once = aimFrom(from, nose, targets)?.id ?? null;
    for (let i = 0; i < 5; i++) aimFrom([0, 0, 0], [0, 0, -1], targets);
    expect(aimFrom(from, nose, targets)?.id ?? null).toBe(once);
  });
});
