import { describe, expect, it } from 'vitest';
import { FRAMES, createView, project } from './projection';
import { ORBIT, chartKey, createClicks, gestureStep, panFrom, ringStep, wheelFactor } from './input';

describe('the chart’s hands and keys', () => {
  it('reads + − 0, never while typing or with a modifier', () => {
    expect(['+', '=', '-', '_', '0', 'm'].map((key) => chartKey({ key }))).toEqual(['zoomIn', 'zoomIn', 'zoomOut', 'zoomOut', 'back', null]);
    expect(chartKey({ key: '-' }, { typing: true })).toBeNull();
    expect(chartKey({ key: '0' }, { typing: true })).toBeNull();
    expect(chartKey({ key: '+', ctrl: true })).toBeNull();
  });
  it('takes a keyboard event as it comes, its modifiers included', () => {
    expect(chartKey({ key: '+', shiftKey: true })).toBe('zoomIn');
    expect(['ctrlKey', 'metaKey', 'altKey'].map((m) => chartKey({ key: '0', [m]: true }))).toEqual([null, null, null]);
    expect(chartKey({ key: 'constructor' })).toBeNull();
    expect(chartKey(null)).toBeNull();
  });
  it('turns a wheel into a zoom, lines and floods and NaN included', () => {
    expect(wheelFactor(-100, 0)).toBeGreaterThan(1);
    expect(wheelFactor(100, 0)).toBeLessThan(1);
    expect(wheelFactor(-3, 1)).toBeCloseTo(wheelFactor(-48, 0));
    expect(wheelFactor(NaN, 0)).toBe(1);
    expect(wheelFactor(-1e6, 0)).toBeCloseTo(Math.exp(60 * 0.0068));
  });
  it('pans a whole drag from where it began: the middle goes where the hand went', () => {
    const v = createView({ range: 10000 });
    const p = project(panFrom(v, [0.047, 0], FRAMES.nav), v.focus); // (47 of the frame's 1000, over its radius 470: 0.1)
    expect(p.u).toBeCloseTo(0.1, 9);
    expect(p.v).toBeCloseTo(0, 9);
  });
  it('applies the other gestures to the view', () => {
    const v = createView({ range: 10000 });
    expect(gestureStep(v, { pan: [0.047, 0] }, FRAMES.nav)).toBe(v);
    expect(gestureStep(v, { orbit: [0.5, 0] }, FRAMES.nav).yaw).toBeCloseTo(0.5 * ORBIT.yaw);
    expect(gestureStep(v, { orbit: [0.5, 0] }, FRAMES.mini, { orbit: false })).toBe(v);
    const two = { zoom: 2, u: 0.5, w: 0.5, turn: 0.3, tilt: -0.1 };
    expect(gestureStep(v, two, FRAMES.nav)).toMatchObject({ range: 5000, yaw: 0.3, pitch: expect.closeTo(0.1 * ORBIT.pitch, 9) });
    expect(gestureStep(v, two, FRAMES.mini, { orbit: false })).toMatchObject({ range: 5000, yaw: 0, pitch: 0 });
    expect(gestureStep(v, { zoom: 0, u: 0, w: 0, turn: 0, tilt: 0 }, FRAMES.nav).range).toBe(10000);
  });
  it('steps through the places with the arrows, Home and End', () => {
    const ids = ['a', 'b', 'c'];
    expect([['ArrowRight', 'c'], ['ArrowLeft', 'a'], ['ArrowDown', 'a'], ['Home', 'b'], ['End', 'a'], ['ArrowRight', null], ['ArrowLeft', null], ['x', 'a']].map(([k, id]) => ringStep(ids, k, id))).toEqual(['a', 'c', 'b', 'a', 'c', 'a', 'c', undefined]);
  });
  it('swallows a drag’s click and the double click it is part of, never a keyboard’s', () => {
    const c = createClicks();
    // a drag's click, then a click: the double click the two make is the drag's
    expect([c.click(true, 1), c.click(false, 2), c.double()]).toEqual([true, false, true]);
    // two clicks: a double click
    expect([c.click(false, 1), c.click(false, 2), c.double()]).toEqual([false, false, false]);
    // a click, then a press that drags: the second click and the double click are the drag's
    expect([c.click(false, 1), c.click(true, 2), c.double()]).toEqual([false, true, true]);
    // a drag's click, then later a double click of its own: that one goes through
    expect([c.click(true, 1), c.click(false, 1), c.click(false, 2), c.double()]).toEqual([true, false, false, false]);
    // a keyboard's click (detail 0) is never a drag's
    expect([c.click(true, 0), c.double()]).toEqual([false, false]);
  });
});
