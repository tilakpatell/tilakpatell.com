import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSoundPlayer, kindsOf, playStem, reachable } from './player.js';

// a Web Audio context that remembers what was started
const param = () => ({
  value: 0,
  targets: [],
  setTargetAtTime(v, t, k) {
    this.targets.push([v, k]);
  },
});
function fakeContext(state = 'running') {
  const started = [];
  const node = (more = {}) => ({ connect: (to) => to, disconnect() {}, gain: param(), frequency: param(), pan: param(), playbackRate: param(), ...more });
  return {
    state,
    currentTime: 0,
    started,
    createGain: () => node(),
    createBiquadFilter: () => node(),
    createStereoPanner: () => node(),
    createMediaElementSource: () => node(),
    createBufferSource() {
      const n = node({ start: () => started.push(n), stop() {} });
      return n;
    },
  };
}
const ROWS = {
  'step.jog': { files: ['step-jog-01.mp3', 'step-jog-02.mp3', 'step-jog-03.mp3', 'step-jog-04.mp3', 'step-jog-05.mp3'], gain: 1 },
  'blaster.e11.close': { files: ['blaster-e11-close-01.mp3'], gain: 0.9 },
  'ambience.bed': { files: ['ambience-bed-01.mp3'], gain: 0.5, loop: true },
  'music.medium': { files: ['music-medium-01.mp3'], gain: 1 },
  'music.loading.intro': { files: ['music-loading-intro-01.mp3'], gain: 1 },
  'music.loading.loop': { files: ['music-loading-loop-01.mp3'], gain: 1, loop: true },
};
const same = (p) => p;
function fakeElement(play = () => Promise.resolve()) {
  const on = {};
  return {
    on,
    plays: 0,
    addEventListener: (t, fn) => (on[t] = fn),
    play() {
      this.plays += 1;
      return play(this);
    },
    pause() {},
    removeAttribute() {},
    load() {},
  };
}
function make({ state = 'running', load = null, here = true, resolve = same } = {}) {
  const ctx = fakeContext(state);
  const asked = [];
  const loader = (url) => {
    asked.push(url);
    return load ? load(url) : Promise.resolve({ url });
  };
  const out = { context: ctx, connect: (to) => to };
  const player = createSoundPlayer({ context: () => ctx, output: () => out, musicOut: () => out, load: loader, resolve, rows: ROWS, rng: () => 0, here, element: () => fakeElement() });
  return { ctx, asked, player };
}
// a window's worth of gestures
function fakeGestures() {
  const on = new Map();
  return {
    on,
    addEventListener: (t, fn) => on.set(t, fn),
    removeEventListener: (t, fn) => on.get(t) === fn && on.delete(t),
    fire: (t) => on.get(t)?.(),
  };
}
const quiet = () => [vi.spyOn(console, 'error').mockImplementation(() => {}), vi.spyOn(console, 'warn').mockImplementation(() => {})];
const settle = () => new Promise((r) => setTimeout(r, 0));
afterEach(() => vi.restoreAllMocks());

describe('the Battlefront world’s sound player', () => {
  it('starts a loaded take on the world bus and counts it by name and by kind', async () => {
    const { ctx, player } = make();
    await player.preload(['step.jog', 'blaster.e11.close']);
    expect(player.ready('step.jog')).toBe(true);
    expect(player.play('step.jog', { gain: 0.5, pitch: 0.9 })).toMatchObject({ stop: expect.any(Function) });
    player.play('step.jog');
    player.play('blaster.e11.close', { pan: -1 });
    expect(ctx.started).toHaveLength(3);
    expect(ctx.started[0].playbackRate.value).toBe(0.9);
    const s = player.stats();
    expect(s.played).toEqual({ 'step.jog': 2, 'blaster.e11.close': 1 });
    expect(s.kinds).toEqual({ step: 2, blaster: 1 });
    expect(s).toMatchObject({ starts: 3, late: 0, failed: 0, missing: 0, absent: 0, asleep: 0, buffers: 6 });
    expect(player.play('nothing')).toBeNull();
    expect(player.play('step.jog', { gain: 0 })).toBeNull();
  });

  it('a take not here yet goes unheard, is fetched, and plays the next time', async () => {
    const { ctx, asked, player } = make();
    expect(player.play('blaster.e11.close')).toBeNull();
    expect(player.stats()).toMatchObject({ late: 1, lateNames: { 'blaster.e11.close': 1 }, starts: 0 });
    await settle();
    expect(asked).toEqual(['/audio/galaxy/bf2017/blaster-e11-close-01.mp3']);
    expect(player.play('blaster.e11.close')).not.toBeNull();
    expect(ctx.started).toHaveLength(1);
    expect(asked).toHaveLength(1);
  });

  it('a file that fails to load is asked once, never again, and says nothing', async () => {
    const [error, warn] = quiet();
    const { ctx, asked, player } = make({ load: () => Promise.reject(new Error('404')) });
    await player.preload(['blaster.e11.close']);
    expect(player.stats()).toMatchObject({ failed: 1, missing: 1 });
    for (let i = 0; i < 5; i++) expect(player.play('blaster.e11.close')).toBeNull();
    await player.preload(['blaster.e11.close']);
    expect(asked).toHaveLength(1);
    expect(ctx.started).toHaveLength(0);
    expect(player.stats()).toMatchObject({ failed: 1, missing: 1, late: 0, starts: 0 });
    expect(error).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
  });

  it('a loader that gives nothing (a page where audio should be) is a miss, not a buffer', async () => {
    const { player } = make({ load: () => Promise.resolve(null) });
    await player.preload(['blaster.e11.close']);
    expect(player.ready('blaster.e11.close')).toBe(false);
    expect(player.stats()).toMatchObject({ failed: 1, missing: 1, buffers: 0 });
  });

  it('asks for nothing where the site has no copy and no bucket names one', async () => {
    const [error] = quiet();
    const { ctx, asked, player } = make({ here: false });
    await player.preload(['step.jog', 'ambience.bed']);
    expect(player.play('step.jog')).toBeNull();
    expect(player.play('ambience.bed', { loop: true })).toBeNull();
    expect(player.music('music.medium')).toBeNull();
    expect(asked).toEqual([]);
    expect(ctx.started).toHaveLength(0);
    expect(player.stats()).toMatchObject({ absent: 2, failed: 0, late: 0, starts: 0 });
    expect(error).not.toHaveBeenCalled();
  });

  it('and asks the bucket where it names the file', async () => {
    const bucket = (p) => `https://bucket.test/abc123${p}`;
    const { asked, player } = make({ here: false, resolve: bucket });
    await player.preload(['blaster.e11.close']);
    expect(asked).toEqual(['https://bucket.test/abc123/audio/galaxy/bf2017/blaster-e11-close-01.mp3']);
    expect(player.play('blaster.e11.close')).not.toBeNull();
    expect(reachable('/audio/x.mp3', { resolve: bucket, here: false })).toBe(true);
    expect(reachable('/audio/x.mp3', { resolve: same, here: false })).toBe(false);
    expect(reachable('/audio/x.mp3', { resolve: same, here: true })).toBe(true);
  });

  it('drops a one-shot while the context sleeps, and still starts a bed', async () => {
    const { ctx, player } = make({ state: 'suspended' });
    await player.preload(['step.jog', 'ambience.bed']);
    expect(player.play('step.jog')).toBeNull();
    expect(player.play('step.jog')).toBeNull();
    expect(player.play('ambience.bed', { loop: true })).not.toBeNull();
    expect(ctx.started).toHaveLength(1);
    expect(ctx.started[0].loop).toBe(true);
    expect(player.stats()).toMatchObject({ asleep: 2, starts: 1, kinds: { ambience: 1 } });
  });

  it('ducks the world bus by the mixer’s numbers and plays one stem at a time', async () => {
    const { player } = make();
    player.duck('death');
    expect(player.duckKind).toBe('death');
    expect(player.music('music.medium', { loop: true })).not.toBeNull();
    expect(player.musicName).toBe('music.medium');
    expect(player.music('music.medium')).not.toBeNull();
    // (counted once it plays, not when it is asked for)
    expect(player.stats().played['music.medium']).toBeUndefined();
    await settle();
    expect(player.stats().played['music.medium']).toBe(1);
    player.stopMusic(0);
    expect(player.musicName).toBeNull();
    await settle();
  });

  it('counts the starts by kind', () => {
    expect(kindsOf({ 'blaster.e11.close': 3, 'blaster.hifi': 3, 'step.jog': 5, 'music.medium': 1 })).toEqual({ blaster: 6, step: 5, music: 1 });
  });
});

describe('a stem', () => {
  const out = () => {
    const ctx = fakeContext();
    return { context: ctx, connect: (to) => to };
  };

  it('streams through an element, the intro’s end starting its loop', async () => {
    const made = [];
    const element = () => {
      const el = fakeElement();
      made.push(el);
      return el;
    };
    const stem = playStem(ROWS['music.loading.intro'], { musicOut: out, resolve: same, loop: false, then: 'music.loading.loop', rows: ROWS, here: true, element, gestures: null });
    await settle();
    expect(made).toHaveLength(1);
    expect(made[0].src).toBe('/audio/galaxy/bf2017/music-loading-intro-01.mp3');
    expect(made[0].loop).toBe(false);
    expect(made[0].plays).toBe(1);
    made[0].on.ended();
    await settle();
    expect(made).toHaveLength(2);
    expect(made[1].src).toBe('/audio/galaxy/bf2017/music-loading-loop-01.mp3');
    expect(made[1].loop).toBe(true);
    stem.stop(0);
    await settle();
  });

  it('held by the browser until a gesture starts on the next one, once', async () => {
    const blocked = Object.assign(new Error('play() failed'), { name: 'NotAllowedError' });
    let allow = false;
    const el = fakeElement(() => (allow ? Promise.resolve() : Promise.reject(blocked)));
    const gestures = fakeGestures();
    playStem(ROWS['music.medium'], { musicOut: out, resolve: same, rows: ROWS, here: true, element: () => el, gestures });
    await settle();
    expect(el.plays).toBe(1);
    expect([...gestures.on.keys()].sort()).toEqual(['click', 'keydown', 'touchend']);
    allow = true;
    gestures.fire('click');
    await settle();
    expect(el.plays).toBe(2);
    expect(gestures.on.size).toBe(0);
  });

  it('stopped while held, does not start on the gesture', async () => {
    const blocked = Object.assign(new Error('play() failed'), { name: 'NotAllowedError' });
    const el = fakeElement(() => Promise.reject(blocked));
    const gestures = fakeGestures();
    const stem = playStem(ROWS['music.medium'], { musicOut: out, resolve: same, rows: ROWS, here: true, element: () => el, gestures });
    await settle();
    stem.stop(0);
    expect(gestures.on.size).toBe(0);
    expect(el.plays).toBe(1);
    await settle();
  });

  it('is nothing where the file cannot be had, and a file that is not audio stays silent', async () => {
    const [error] = quiet();
    const made = [];
    expect(playStem(ROWS['music.medium'], { musicOut: out, resolve: same, rows: ROWS, here: false, element: () => made.push(1) })).toBeNull();
    expect(made).toHaveLength(0);
    expect(playStem(null, { musicOut: out })).toBeNull();
    const el = fakeElement(() => Promise.reject(Object.assign(new Error('no source'), { name: 'NotSupportedError' })));
    const gestures = fakeGestures();
    let started = 0;
    expect(playStem(ROWS['music.medium'], { musicOut: out, resolve: same, rows: ROWS, here: true, element: () => el, gestures, onStart: () => (started += 1) })).not.toBeNull();
    await settle();
    expect(started).toBe(0);
    expect(gestures.on.size).toBe(0);
    expect(error).not.toHaveBeenCalled();
  });
});
