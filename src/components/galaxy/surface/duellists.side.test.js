// Which side a block meets a cut on, between you and the duellists: your
// stroke as their minds read it carries the way it cuts and where you face
// (swingingOf), a duellist blocks it on the side it comes in on (stepDuel's
// blockSide), and your block takes the side of the nearest duellist's
// stroke at you (incomingAt).
import { describe, expect, it } from 'vitest';
import luke from '../../../data/bf2017/strokes/luke.json';
import { incomingSide } from './blockSide';
import { asTarget, duelFor, incomingAt, stepDuel, swingingOf } from './duellists';
import { stanceFromTable } from './stanceFromTable';

// (Luke's stance, and a strike of his from each side)
const ST = stanceFromTable(luke);
const FROM = { right: luke.strikes.find((s) => s.side === 'right').name, left: luke.strikes.find((s) => s.side === 'left').name };

describe('your stroke as a duellist reads it', () => {
  it('says the way your stroke cuts and where you face', () => {
    const saber = { stance: ST, swinging: { name: FROM.right, contact: [0.2, 0.4], t0: 0, speed: 1 } };
    expect(swingingOf(saber, 0.1, 1.5)).toMatchObject({ contact: [0.2, 0.4], cut: 'right', yaw: 1.5 });
    expect(swingingOf({ stance: ST, swinging: null }, 0.1, 1.5)).toBe(null);
  });
});

describe('the duellist’s stroke at you', () => {
  // (a duellist at x, z facing yaw, its saber in `clip` or idle)
  const duellist = (x, z, yaw, clip, more = {}) => ({
    b: { x, z, yaw },
    duelMark: { you: true },
    blade: { saber: { stance: ST, swinging: clip ? { name: clip, t0: 0, speed: 1, contact: [0.2, 0.4] } : null } },
    ...more,
  });
  const you = { x: 0, z: 0, yaw: 0 };

  it('the nearest duellist swinging at you decides', () => {
    const a = duellist(0, 2, Math.PI, FROM.right);
    const b = duellist(0, 5, Math.PI, FROM.left);
    const c = duellist(0, 1, Math.PI, FROM.left, { duelMark: { you: false } }); // (nearer, but at another)
    const d = duellist(0, 0.5, Math.PI, FROM.left, { down: 1 });
    expect(incomingAt([b, c, d, a], you)).toBe('left');
    expect(incomingAt([b, c, d, a], you)).toBe(incomingSide('right', { from: Math.PI, to: 0 }));
    a.blade.saber.swinging = null;
    expect(incomingAt([b, c, d, a], you)).toBe('right');
    expect(incomingAt([c, d], you)).toBe(null);
    expect(incomingAt([], you)).toBe(null);
  });
});

describe('a duellist’s block', () => {
  const fencer = () => ({
    duel: duelFor({ kind: 'x', hostile: { parry: 1, blade: { stance: 'single' } } }, 1, null),
    b: { x: 0, z: 0, yaw: 0 },
    blade: { saber: { swinging: null, cancel() {}, sim: { state: { out: false } } }, swing: () => null },
    hostile: { chase: 2 },
  });
  // (you 2 m ahead of it, facing it, cutting `cut`; the world `{}` has no water to wade)
  const mark = (cut) => ({ x: 0, z: 2, target: asTarget(), swinging: cut === undefined ? null : { contact: [0.3, 0.5], t: 0, speed: 1, cut, yaw: Math.PI } });

  it('meets your stroke on the side it comes in on', () => {
    const t = fencer();
    stepDuel(t, mark('right'), 1 / 60, 0, {});
    expect(t.blocking).toBe(true);
    expect(t.blockSide).toBe('left');
    const u = fencer();
    stepDuel(u, mark('left'), 1 / 60, 0, {});
    expect(u.blockSide).toBe('right');
    const v = fencer();
    stepDuel(v, mark('up'), 1 / 60, 0, {});
    expect(v.blocking).toBe(true);
    expect(v.blockSide).toBe(null);
    const w = fencer();
    stepDuel(w, mark(undefined), 1 / 60, 0, {});
    expect(w.blocking).toBe(false);
    expect(w.blockSide).toBe(null);
  });
});
