import { describe, expect, it } from 'vitest';
import { BRIDGE_SECONDS, stance } from './balrog.rules';

describe('the Balrog on the Bridge', () => {
  it('a 22 s timeline, the beat’s hold', () => {
    expect(BRIDGE_SECONDS).toBe(22);
  });

  it('rises with its wings out, cracks the whip when the bridge breaks, then falls, and stays fallen', () => {
    const s = (t) => stance(t);
    expect(s(0)).toMatchObject({ wings: 0, whip: 0, fall: 0, broken: false });
    expect(s(6).wings).toBeGreaterThan(0.9);
    expect(s(12).broken).toBe(true);
    expect(s(10).broken).toBe(false);
    expect(s(14).fall).toBeGreaterThan(0);
    expect(s(15).whip).toBeGreaterThan(0.5);
    expect(s(BRIDGE_SECONDS).fall).toBe(1);
    expect(s(100)).toEqual(s(BRIDGE_SECONDS));
    let last = 0;
    for (let t = 0; t <= BRIDGE_SECONDS; t += 0.5) {
      const f = s(t).fall;
      expect(f).toBeGreaterThanOrEqual(last);
      last = f;
    }
  });

  it('Gandalf is dragged over only after the whip, and is gone by the end', () => {
    expect(stance(13).gandalf).toBe(0);
    expect(stance(18).gandalf).toBeGreaterThan(0);
    expect(stance(BRIDGE_SECONDS).gandalf).toBe(1);
  });
});
