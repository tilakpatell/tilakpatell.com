import { describe, expect, it } from 'vitest';
import { canPower, mixPost } from './powerSeams';

const flight = (o = {}) => ({ flying: true, onFoot: false, crash: false, dive: false, jump: null, frozen: false, view: 'chase', phoneNear: false, ...o });

describe('the crews’ powers on the universe map', () => {
  it('shows Force Focus over the map’s own look', () => {
    const m = mixPost({ aberration: 0.002, exposure: 1.1 }, { aberration: 0.007, exposure: 0.88 });
    expect(m.aberration).toBeCloseTo(0.009);
    expect(m.exposure).toBeCloseTo(0.968);
  });
  it('leaves the map’s look as it is with no power on', () => {
    expect(mixPost({ aberration: 0.002, exposure: 1.1 }, { aberration: 0, exposure: 1 })).toEqual({ aberration: 0.002, exposure: 1.1 });
  });
  it('fills the record it’s handed', () => {
    const out = { aberration: 0, exposure: 1 };
    expect(mixPost({ aberration: 0.001, exposure: 1 }, { aberration: 0, exposure: 1 }, out)).toBe(out);
  });
  it('plays a power only in flight, nowhere else', () => {
    expect(canPower(flight())).toBe(true);
    for (const o of [{ flying: false }, { onFoot: true }, { crash: true }, { dive: true }, { jump: { phase: 'spool' } }, { frozen: true }, { view: 'map' }, { phoneNear: true }]) expect(canPower(flight(o))).toBe(false);
  });
});
