import { describe, expect, it } from 'vitest';
import { foreground, inFront, whenClear } from './foreground';

const settled = async (p) => {
  let done = false;
  p.then(() => (done = true));
  await Promise.resolve();
  await Promise.resolve();
  return done;
};

describe('a scene in front of the page', () => {
  it('says nothing is in front until something is, and the strongest hold wins', () => {
    expect(foreground()).toBe(null);
    const drawing = inFront('drawing');
    expect(foreground()).toBe('drawing');
    const launch = inFront('launch');
    expect(foreground()).toBe('launch');
    launch();
    expect(foreground()).toBe('drawing');
    drawing();
    expect(foreground()).toBe(null);
  });

  it('keeps a wait for the launch until the launch lets go, not while the scene merely draws', async () => {
    const drawing = inFront('drawing');
    expect(await settled(whenClear('launch'))).toBe(true);
    const launch = inFront('launch');
    const wait = whenClear('launch');
    expect(await settled(wait)).toBe(false);
    launch();
    expect(await settled(wait)).toBe(true);
    // (a wait for the scene to be gone altogether holds while it draws)
    const gone = whenClear('drawing');
    expect(await settled(gone)).toBe(false);
    drawing();
    expect(await settled(gone)).toBe(true);
  });

  it('releases each hold once, so a second call can’t let another one go', () => {
    const a = inFront('launch');
    const b = inFront('launch');
    a();
    a();
    expect(foreground()).toBe('launch');
    b();
    expect(foreground()).toBe(null);
  });

  it('takes an unknown strength as drawing', () => {
    const odd = inFront('warp');
    expect(foreground()).toBe('drawing');
    odd();
    expect(foreground()).toBe(null);
  });
});
