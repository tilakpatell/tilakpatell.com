import { describe, expect, it } from 'vitest';
import { FP_SET, fpClip } from './firstPerson';

describe('the first-person set', () => {
  it('holds each class’s arms at ease, sprinting and down the sights', () => {
    for (const k of ['p', 't', 'l']) for (const n of ['idle', 'sprint', 'aim', 'melee']) expect(FP_SET[`fp.${k}.${n}`], `${k} ${n}`).toBeTruthy();
    expect([].concat(FP_SET['fp.t.idle'])).toContain('1p_Rifle_Standard_IdlePose');
  });
  it('picks the stance’s own pose, else the rifle’s, else none', () => {
    const clips = { 'fp.p.idle': 1, 'fp.t.idle': 1, 'fp.t.aim': 1, 'fp.die': 1 };
    expect(fpClip(clips, 'p', 'idle')).toBe('fp.p.idle');
    expect(fpClip(clips, 'p', 'aim')).toBe('fp.t.aim');
    expect(fpClip(clips, 'l', 'die')).toBe('fp.die');
    expect(fpClip(clips, 'p', 'reload')).toBe(null);
    expect(fpClip(null, 'p', 'idle')).toBe(null);
  });
});
