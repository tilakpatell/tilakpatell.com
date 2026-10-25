import { describe, expect, it } from 'vitest';
import { padActs, padFiring } from './padActs';

const up = { a: false, b: false, x: false, y: false, lt: false, rt: false, lx: 0, ly: 0, rx: 0, ry: 0 };
const press = (k) => ({ ...up, [k]: true });

describe('C-137 on a controller', () => {
  it('uses with A, jumps with X, and opens or shuts Things to do with Y (B shuts it)', () => {
    expect(padActs(press('a'), up)).toEqual(['act']);
    expect(padActs(press('x'), up)).toEqual(['jump']);
    expect(padActs(press('y'), up)).toEqual(['openList']);
    expect(padActs(press('y'), up, { list: true })).toEqual(['closeList']);
    expect(padActs(press('b'), up, { list: true })).toEqual(['closeList']);
    expect(padActs(press('b'), up)).toEqual([]);
  });

  it('in a fight fires with RT and locks on with LT; in Total Rickall X or RT shoots and LT locks on', () => {
    expect(padActs(press('rt'), up, { duel: true })).toEqual(['fire']);
    expect(padActs(press('lt'), up, { duel: true })).toEqual(['lock']);
    expect(padActs(press('x'), up, { duel: true })).toEqual(['jump']);
    expect(padActs(press('x'), up, { rickall: true })).toEqual(['shoot']);
    expect(padActs(press('rt'), up, { rickall: true })).toEqual(['shoot']);
    expect(padActs(press('lt'), up, { rickall: true })).toEqual(['lock']);
    // (no fight: the triggers do nothing on foot)
    expect(padActs(press('rt'), up)).toEqual([]);
    expect(padActs(press('lt'), up)).toEqual([]);
  });

  it('with Things to do open over the world, neither jumps, fires nor locks on', () => {
    expect(padActs(press('x'), up, { list: true })).toEqual([]);
    expect(padActs(press('rt'), up, { duel: true, list: true })).toEqual([]);
    expect(padActs(press('lt'), up, { duel: true, list: true })).toEqual([]);
  });

  it('acts on a press, not a hold, and does nothing with no pad', () => {
    expect(padActs(press('a'), press('a'))).toEqual([]);
    expect(padActs(null, up)).toEqual([]);
  });

  it('with an episode’s card up, closes it at any press or the stick’s first move, and does nothing else', () => {
    expect(padActs(press('a'), up, { card: true })).toEqual(['closeCard']);
    expect(padActs({ ...up, lx: 0.6 }, up, { card: true })).toEqual(['closeCard']);
    expect(padActs(up, up, { card: true })).toEqual([]);
  });

  it('in the cruiser, keeps firing while X is held (RT is its throttle), and doesn’t jump', () => {
    expect(padFiring(press('x'), { flying: true })).toBe(true);
    expect(padFiring(press('rt'), { flying: true })).toBe(false);
    expect(padFiring(press('x'), { flying: false })).toBe(false);
    expect(padFiring(null, { flying: true })).toBe(false);
    expect(padActs(press('x'), up, { flying: true })).toEqual([]);
  });
});
