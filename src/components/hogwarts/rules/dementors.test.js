import { describe, expect, it } from 'vitest';
import { DEMENTORS, NOTES, canCome, drain, newDementors, nightOf, onShore, pull, step } from './dementors';

// a straight shore: the lake to −z, the bank rising to +z
const shoreAt = (x, z) => z;

function play({ seconds, player, week = 8, day = 10, hour = 22, patronusAt = null, state = newDementors(), dt = 1 / 20 }) {
  let s = state;
  const events = [];
  let worst = 0;
  for (let t = 0; t < seconds; t += dt) {
    const p = typeof player === 'function' ? player(t) : player;
    const r = step(s, { dt, week, day, hour, player: p, shoreAt, patronus: patronusAt != null && t >= patronusAt && t < patronusAt + dt });
    s = r.state;
    worst = Math.max(worst, s.cold);
    for (const e of r.events) events.push({ ...e, t });
  }
  return { state: s, events, worst };
}

describe('the dementors', () => {
  it('come only at night, and only past the sixth week', () => {
    expect(canCome(6, 23)).toBe(false);
    expect(canCome(7, 23)).toBe(true);
    expect(canCome(9, 2)).toBe(true);
    expect(canCome(9, 14)).toBe(false);
    expect(nightOf(4, 2)).toBe(3);
    expect(nightOf(4, 22)).toBe(4);
  });

  it('know the shore from the bank and the water', () => {
    expect(onShore(shoreAt, 0, 5)).toBe(true);
    expect(onShore(shoreAt, 0, DEMENTORS.shore + 5)).toBe(false);
    expect(onShore(shoreAt, 0, -10)).toBe(false);
  });

  it('rise over the water, come on, chill you and make you faint without a Patronus', () => {
    const r = play({ seconds: 80, player: { x: 0, z: 4 } });
    const come = r.events.find((e) => e.type === 'come');
    expect(come.t).toBeLessThan(0.1);
    const faint = r.events.find((e) => e.type === 'faint');
    expect(faint).toBeTruthy();
    expect(faint.toast).toMatch(/Madam Pomfrey/);
    expect(faint.to).toBe('common');
    // (long enough to see them coming and do something about it)
    expect(faint.t).toBeGreaterThan(18);
    expect(faint.t).toBeLessThan(60);
    expect(r.worst).toBeGreaterThan(0.9);
    // (and that was the night: they don’t come again before the next)
    expect(r.events.filter((e) => e.type === 'come')).toHaveLength(1);
    expect(r.state.phase).toBe('gone');
  });

  it('come out over the water, not up the bank', () => {
    const r = play({ seconds: 0.2, player: { x: 0, z: 4 } });
    expect(r.state.list).toHaveLength(DEMENTORS.count);
    for (const d of r.state.list) expect(d.z).toBeLessThan(-40);
  });

  it('come again the next night', () => {
    const first = play({ seconds: 80, player: { x: 0, z: 4 } });
    const next = play({ seconds: 1, player: { x: 0, z: 4 }, day: 11, state: first.state });
    expect(next.events.some((e) => e.type === 'come')).toBe(true);
  });

  it('are run off by a Patronus within its reach, and the night is yours', () => {
    const r = play({ seconds: 60, player: { x: 0, z: 4 }, patronusAt: 20 });
    expect(r.events.some((e) => e.type === 'faint')).toBe(false);
    const driven = r.events.find((e) => e.type === 'driven');
    expect(driven.t).toBeCloseTo(20, 0);
    expect(r.events.find((e) => e.type === 'gone').t).toBeLessThan(20 + DEMENTORS.fade + 1);
    expect(r.state.cold).toBe(0);
    expect(r.state.list).toEqual([]);
  });

  it('shrug off a Patronus cast too far off', () => {
    const r = play({ seconds: 3, player: { x: 0, z: 4 }, patronusAt: 1 });
    expect(r.events.some((e) => e.type === 'driven')).toBe(false);
  });

  it('hang back once you are well up the bank, and the cold eases', () => {
    const r = play({ seconds: 70, player: (t) => ({ x: 0, z: t < 12 ? 4 : 4 + Math.min(70, (t - 12) * 4) }) });
    expect(r.events.some((e) => e.type === 'faint')).toBe(false);
    expect(r.state.cold).toBeLessThan(0.3);
  });

  it('sink back at dawn', () => {
    let s = play({ seconds: 10, player: { x: 0, z: 4 } }).state;
    s = play({ seconds: 6, player: { x: 0, z: 4 }, hour: 7, day: 11, state: s }).state;
    expect(s.phase).toBe('none');
    expect(s.list).toEqual([]);
  });

  it('pull at your walk and drain the colour as the cold comes on', () => {
    expect(pull(0)).toBe(1);
    expect(pull(1)).toBeCloseTo(DEMENTORS.pull);
    expect(pull(0.5)).toBeGreaterThan(pull(0.8));
    expect(drain(0)).toBe(0);
    expect(drain(1)).toBe(1);
    expect(drain(0.3)).toBeLessThan(drain(0.6));
  });

  it('answer with three rising notes in D', () => {
    expect(NOTES).toHaveLength(3);
    expect(NOTES[0][0]).toBeCloseTo(293.66, 1);
    expect(NOTES[1][0]).toBeGreaterThan(NOTES[0][0]);
    expect(NOTES[2][0]).toBeGreaterThan(NOTES[1][0]);
  });
});
