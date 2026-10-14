import { describe, expect, it } from 'vitest';
import { adoptable, madeFor, recoverNow, sameProps } from './useWorld';

// A page mounting a module finds a world of that module already on the
// runtime: one handed over to it (adopt it), or one made for something else
// (a world built for the hero or the mission the page has since changed
// from: make it again, not adopt it and show the old one)
describe('which world on the runtime a page may adopt', () => {
  const mod = { id: 'galaxy-surface' };
  const world = () => ({ draw() {} });
  it('one handed over (made by no page): adopted, whatever the page asks for', () => {
    expect(adoptable({ module: mod, world: world() }, mod, 'chase')).toBe(true);
    expect(adoptable({ module: mod, world: world() }, mod, null)).toBe(true);
  });
  it('one a page made for the same thing: adopted (React’s second run, the page again)', () => {
    const w = world();
    madeFor.set(w, 'explore');
    expect(adoptable({ module: mod, world: w }, mod, 'explore')).toBe(true);
  });
  it('one a page made for something else: not adopted', () => {
    const w = world();
    madeFor.set(w, 'explore');
    expect(adoptable({ module: mod, world: w }, mod, 'chase')).toBe(false);
  });
  it('another module’s, or none: not adopted', () => {
    expect(adoptable({ module: { id: 'earth' }, world: world() }, mod, null)).toBe(false);
    expect(adoptable(null, mod, null)).toBe(false);
  });
});

// A lost device on WebGPU: the page mounts its world again, once, on the
// node renderer over WebGL 2; a second loss leaves the page's own fallback
describe('when a page mounts its world again after a loss', () => {
  it('once, after a loss the runtime can come back from', () => {
    expect(recoverNow({ status: 'lost', recoverable: true, tried: false, mine: true })).toBe(true);
    // (a page opened while another page's world is lost: that page's to mount again, not this one's)
    expect(recoverNow({ status: 'lost', recoverable: true, tried: false, mine: false })).toBe(false);
    expect(recoverNow({ status: 'lost', recoverable: true, tried: true, mine: true })).toBe(false);
    expect(recoverNow({ status: 'lost', recoverable: false, tried: false, mine: true })).toBe(false);
    expect(recoverNow({ status: 'failed', recoverable: true, tried: false, mine: true })).toBe(false);
    expect(recoverNow({ status: 'on', recoverable: true, tried: false, mine: true })).toBe(false);
  });
});

// (the page's props reach its world's update() only when one changed: a
// page that re-renders eight times a second with the same props, as
// Battlefront's does for its HUD, asked its world for a fresh frame each time)
describe('whether a page’s props are the ones its world has', () => {
  it('are the same when every value is, in a new object or the same one', () => {
    const p = { level: 'hoth', mode: 'ga', weather: 'day' };
    expect(sameProps(p, p)).toBe(true);
    expect(sameProps(p, { level: 'hoth', mode: 'ga', weather: 'day' })).toBe(true);
    expect(sameProps(undefined, undefined)).toBe(true);
    expect(sameProps(null, undefined)).toBe(true);
  });

  it('differ when a value, a callback or the set of names does', () => {
    const f = () => {};
    expect(sameProps({ a: 1 }, { a: 2 })).toBe(false);
    expect(sameProps({ on: f }, { on: () => {} })).toBe(false);
    expect(sameProps({ on: f }, { on: f })).toBe(true);
    expect(sameProps({ a: 1 }, { a: 1, b: undefined })).toBe(false);
    expect(sameProps({ a: 1 }, null)).toBe(false);
    expect(sameProps({ a: NaN }, { a: NaN })).toBe(true);
  });
});
