import { describe, expect, it } from 'vitest';
import { latch, standing } from './stage';

const s = (o) => standing({ inMenu: false, phase: 'pre', ready: false, ...o });

describe('what stands over the Battlefront world', () => {
  it('the menu, while it is open, whatever the level has done', () => {
    expect(s({ inMenu: true, ready: true })).toMatchObject({ menu: true, loading: false, spawn: false, wipe: null, name: 'menu' });
    expect(s({ inMenu: true })).toMatchObject({ menu: true, loading: false, spawn: false, name: 'menu' });
  });
  it('rests the world under the menu once the level is ready: made, and not drawn, so the menu has the frame', () => {
    expect(s({ inMenu: true, ready: true })).toMatchObject({ rest: true });
    // (while it loads it draws: the shaders of what the camera sees build from what is drawn)
    expect(s({ inMenu: true })).toMatchObject({ rest: false });
    expect(s({ ready: true })).toMatchObject({ rest: false });
    expect(s({ ready: true, phase: 'in' })).toMatchObject({ rest: false });
  });
  it('out of the menu before the level is ready: the loading screen, never the spawn screen', () => {
    expect(s({})).toMatchObject({ menu: false, loading: true, spawn: false, wipe: null, name: 'loading' });
  });
  it('ready: the first spawn screen, kept under the wipe’s black on the way down', () => {
    expect(s({ ready: true })).toMatchObject({ loading: false, spawn: true, wipe: null, name: 'spawn' });
    expect(s({ ready: true, phase: 'down' })).toMatchObject({ spawn: true, wipe: 'down', name: 'spawn' });
  });
  it('the wipe lifting, then the field: nothing of the way in is left', () => {
    expect(s({ ready: true, phase: 'up' })).toMatchObject({ menu: false, loading: false, spawn: false, wipe: 'up', name: 'field' });
    expect(s({ ready: true, phase: 'in' })).toMatchObject({ loading: false, spawn: false, wipe: null, name: 'field' });
  });
  it('in the field with the level gone back to streaming: the loading screen as a veil', () => {
    expect(s({ ready: false, phase: 'in', loaded: false })).toMatchObject({ loading: true, spawn: false, name: 'loading' });
  });
  it('covers the parked camera until the game’s screens have come, and not after the first deploy', () => {
    expect(s({ screens: false })).toMatchObject({ cover: true });
    expect(s({ inMenu: true, screens: false })).toMatchObject({ cover: true });
    expect(s({ screens: true })).toMatchObject({ cover: false });
    expect(s({ ready: true, phase: 'in', screens: false })).toMatchObject({ cover: false });
  });
});

describe('the way in, once it has been ready', () => {
  it('stays ready: a late shader does not take the spawn screen away, nor refuse its Deploy', () => {
    let was = false;
    was = latch(was, { inMenu: false, phase: 'pre', ready: false });
    expect(was).toBe(false);
    was = latch(was, { inMenu: false, phase: 'pre', ready: true });
    expect(was).toBe(true);
    // (readiness goes false again for a beat whenever something new is built)
    was = latch(was, { inMenu: false, phase: 'pre', ready: false });
    expect(was).toBe(true);
    expect(standing({ inMenu: false, phase: 'pre', ready: was })).toMatchObject({ spawn: true, loading: false });
  });
  it('is not held under the menu, where nothing shows it and the level may still be building', () => {
    expect(latch(false, { inMenu: true, phase: 'pre', ready: true })).toBe(false);
  });
});
