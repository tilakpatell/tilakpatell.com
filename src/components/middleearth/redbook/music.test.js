import { describe, expect, it } from 'vitest';
import { createMusic } from './music';
import { CUE_NAMES } from './instruments';
import { PAGES } from './pages';
import { fakeAudio } from './fixtures/audio';

// the clock moved on in frames, as the world steps
function run(music, ctx, seconds, held = {}) {
  for (let t = 0; t < seconds; t += 1 / 30) {
    ctx.currentTime += 1 / 30;
    music.update(1 / 30, held);
  }
}

describe('the music', () => {
  it('makes nothing before the visitor wakes it, and remembers the page', () => {
    const { ctx, rt } = fakeAudio();
    const before = ctx.made.length;
    const music = createMusic(rt);
    music.page('bree');
    music.update(0.1, { vision: 1, stone: 1, eye: 1, dread: 1 });
    music.cue('turn');
    music.setOn(false);
    music.setOn(true);
    expect(ctx.made.length).toBe(before);
    expect(music.stats()).toMatchObject({ state: null, mood: 'bree', playing: 0, on: true });
    music.wake();
    expect(ctx.made.length).toBeGreaterThan(before);
    run(music, ctx, 2);
    expect(music.stats()).toMatchObject({ state: 'running', mood: 'bree', on: true });
    expect(music.stats().playing).toBeGreaterThan(0);
  });

  it('stays quiet without a bus, and wakes once there is one', () => {
    const { ctx, bus } = fakeAudio();
    let given = null;
    const music = createMusic({ audio: { bus: () => given } });
    music.wake();
    expect(music.stats().state).toBeNull();
    given = bus;
    music.wake();
    run(music, ctx, 1);
    expect(music.stats().state).toBe('running');
    expect(createMusic(null).stats().state).toBeNull();
  });

  it('turns through every page, wears the Ring, holds the stone, and plays every sound', () => {
    const { ctx, rt } = fakeAudio();
    const music = createMusic(rt);
    music.wake();
    for (const p of [null, ...PAGES.map((x) => x.id), 'met', 'kept']) {
      music.page(p);
      run(music, ctx, 0.5);
    }
    run(music, ctx, 2, { vision: 1, dread: 0.8 });
    run(music, ctx, 2, { stone: 1, eye: 0.7 });
    for (const name of CUE_NAMES) music.cue(name);
    run(music, ctx, 1);
    expect(music.stats().playing).toBeLessThanOrEqual(56);
  });

  it('lets the score be switched off and on, the clock going on meanwhile', () => {
    const { ctx, rt } = fakeAudio();
    const music = createMusic(rt, { on: false });
    expect(music.on).toBe(false);
    music.wake();
    music.page('shire-edge');
    run(music, ctx, 3);
    expect(music.stats().playing).toBe(0);
    music.setOn(true);
    expect(music.on).toBe(true);
    run(music, ctx, 2);
    expect(music.stats().playing).toBeGreaterThan(0);
  });

  it('lets go of notes long past rather than playing them all at once', () => {
    const { ctx, rt } = fakeAudio();
    const music = createMusic(rt);
    music.wake();
    music.page('shire-edge');
    run(music, ctx, 1);
    const sources = ctx.sources.length;
    // (the tab slept for a minute)
    ctx.currentTime += 60;
    music.update(60);
    expect(ctx.sources.length - sources).toBeLessThan(80);
  });

  it('leaves nothing running when it goes', () => {
    const { ctx, rt } = fakeAudio();
    const music = createMusic(rt);
    music.wake();
    music.page('moria');
    run(music, ctx, 3, { vision: 0.6, dread: 0.5, stone: 0.5, eye: 0.5 });
    music.cue('ring-on');
    music.dispose();
    const running = ctx.sources.filter((s) => s.started && !s.stopped);
    expect(running).toEqual([]);
    expect(music.stats()).toMatchObject({ state: null, playing: 0 });
    // and a call after it is harmless
    music.update(0.1);
    music.cue('turn');
  });
});
