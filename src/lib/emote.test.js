import { describe, expect, it, vi } from 'vitest';
import { EMOTE, EMOTES, GAME_EMOTE, applyEmote, emoteFor, createEmoteWheel, emotePacket, heardEmote, keepEmote, motionPacket, readEmote, readEmoteWire, readMotion, wheelAngle } from './emote';

describe('the emotes', () => {
  it('are the five the spec names, each a clip on a layer, with a length', () => {
    expect(EMOTES).toEqual(['wave', 'cheer', 'dance', 'taunt', 'sit']);
    for (const id of EMOTES) {
      const e = EMOTE[id];
      expect(e.clip).toBeTruthy();
      expect(['full', 'upper']).toContain(e.layer);
      expect(e.length).toBeGreaterThan(0);
    }
    expect(EMOTE.wave.layer).toBe('upper');
    // a sit is on the floor, cross-legged, till you get up: never the chair's way in
    expect(EMOTE.sit).toMatchObject({ clip: 'sit.floor', layer: 'full', loop: true });
    expect(EMOTE.sit.base).toBeUndefined();
    expect(EMOTE.sit.length).toBe(Infinity);
  });
});

describe('the wheel', () => {
  it('a tap repeats the last (a wave before any)', () => {
    const w = createEmoteWheel();
    w.down(0);
    expect(w.up(0.1)).toBe('wave');
    expect(w.open).toBe(false);
  });

  it('a hold opens it, the stick or pointer picks a slice, and the release plays it', () => {
    const w = createEmoteWheel({ hold: 0.25 });
    w.down(1);
    expect(w.tick(1.1).open).toBe(false);
    expect(w.tick(1.3).open).toBe(true);
    // up (a pointer's or a stick's y runs down the screen): the first slice
    w.aim(0, -1);
    expect(w.hover).toBe('wave');
    // to the right: the next one round, clockwise
    w.aim(1, 0);
    expect(w.hover).toBe('cheer');
    w.aim(-0.9, -0.3);
    expect(w.hover).toBe('sit');
    expect(w.up(1.6)).toBe('sit');
    expect(w.open).toBe(false);
    // and a tap now repeats it
    w.down(3);
    expect(w.up(3.05)).toBe('sit');
  });

  it('let go in the middle: nothing, and the last stays', () => {
    const w = createEmoteWheel();
    w.down(0);
    w.tick(1);
    w.aim(0.1, 0.1);
    expect(w.hover).toBeNull();
    expect(w.up(1.1)).toBeNull();
    w.down(2);
    expect(w.up(2.05)).toBe('wave');
  });

  it('a held key repeating doesn’t restart the hold; an up with no down is nothing; a pick by number', () => {
    const w = createEmoteWheel({ hold: 0.25 });
    expect(w.up(0)).toBeNull();
    w.down(0);
    w.down(0.2);
    expect(w.tick(0.3).open).toBe(true);
    expect(w.choose(3)).toBe('taunt');
    expect(w.open).toBe(false);
    expect(w.up(0.4)).toBeNull();
    w.down(1);
    expect(w.up(1.05)).toBe('taunt');
    w.down(2);
    w.cancel();
    expect(w.up(2.1)).toBeNull();
  });

  it('lays its slices clockwise from the top', () => {
    expect(wheelAngle(0)).toBe(0);
    expect(wheelAngle(1)).toBeCloseTo((2 * Math.PI) / 5, 9);
  });
});

describe('a player’s emote', () => {
  it('lasts its clip, a wave walks on, the rest stop when you move, anything stops when you act', () => {
    const wave = { id: 'wave', at: 10 };
    const cheer = { id: 'cheer', at: 10 };
    expect(keepEmote(wave, 11, { moving: true })).toBe(wave);
    expect(keepEmote(cheer, 11, { moving: true })).toBeNull();
    expect(keepEmote(cheer, 11)).toBe(cheer);
    expect(keepEmote(cheer, 10 + EMOTE.cheer.length + 0.01)).toBeNull();
    expect(keepEmote(wave, 11, { acted: true })).toBeNull();
    expect(keepEmote({ id: 'sit', at: 0 }, 1e6)).toEqual({ id: 'sit', at: 0 });
    expect(keepEmote(null, 1)).toBeNull();
  });
});

describe('on the wire', () => {
  it('goes out as its id and how long it has been on', () => {
    expect(emotePacket({ id: 'wave', at: 10 }, 11.26)).toEqual(['wave', 1.3]);
    expect(emotePacket({ id: 'cheer', at: 0 }, 2)).toBeNull(); // (over)
    expect(emotePacket({ id: 'moonwalk', at: 0 }, 1)).toBeNull();
    expect(emotePacket(null, 1)).toBeNull();
    // a sit lasts till you get up
    expect(emotePacket({ id: 'sit', at: 0 }, 5000)).toEqual(['sit', 600]);
  });

  it('comes in cleaned (it is a stranger’s)', () => {
    expect(readEmoteWire(['wave', 1.3])).toEqual({ id: 'wave', age: 1.3 });
    expect(readEmoteWire(['wave', -5])).toEqual({ id: 'wave', age: 0 });
    expect(readEmoteWire(['wave', 1e9])).toEqual({ id: 'wave', age: 600 });
    for (const bad of [null, undefined, {}, [], ['x', 1], ['wave', 'a'], ['wave'], ['__proto__', 1], 'wave']) expect(readEmoteWire(bad)).toBeNull();
  });

  it('is timed from when it was heard, the same one kept as it comes again', () => {
    const first = heardEmote({ id: 'wave', age: 1 }, 100);
    expect(first).toEqual({ id: 'wave', at: 99 });
    // the next message, a little later and a little jittered: the same wave
    expect(heardEmote({ id: 'wave', age: 1.25 }, 100.2, first)).toBe(first);
    // a new one (a wave again, from the start)
    expect(heardEmote({ id: 'wave', age: 0 }, 104, first)).toEqual({ id: 'wave', at: 104 });
    expect(heardEmote({ id: 'cheer', age: 1.25 }, 100.2, first)).toEqual({ id: 'cheer', at: 98.95 });
    expect(heardEmote(null, 100, first)).toBeNull();
  });

  it('reads as none from an old packet, or once it is over', () => {
    expect(readEmote({}, 5)).toBeNull();
    expect(readEmote(null, 5)).toBeNull();
    expect(readEmote({ emote: null }, 5)).toBeNull();
    expect(readEmote({ emote: { id: 'wave', at: 99 } }, 100)).toEqual({ id: 'wave', at: 99, t: 1 });
    expect(readEmote({ emote: { id: 'wave', at: 99 } }, 99 + EMOTE.wave.length + 0.1)).toBeNull();
    expect(readEmote({ emote: { id: 'nope', at: 99 } }, 100)).toBeNull();
    // heard a moment before it started (clocks): from its start
    expect(readEmote({ emote: { id: 'wave', at: 100 } }, 99.9).t).toBe(0);
  });

  it('carries how you move, rounded, and reads it back held to sense', () => {
    expect(motionPacket({ speed: 3.04, side: -0.26, turn: 1.23 })).toEqual([3, -0.3, 1.2]);
    expect(motionPacket(null)).toBeNull();
    expect(readMotion([3, -0.3, 1.2])).toEqual({ speed: 3, side: -0.3, turn: 1.2 });
    expect(readMotion([999, -999, 99])).toEqual({ speed: 45, side: -20, turn: 20 });
    expect(readMotion([1, 'x', 0])).toEqual({ speed: 1, side: 0, turn: 0 });
    for (const bad of [null, {}, [], ['a', 0, 0], 3]) expect(readMotion(bad)).toBeNull();
  });
});

describe('on a figure', () => {
  const figure = () => {
    const playing = { full: null, upper: null };
    return {
      play: vi.fn((name, { layer = 'full' } = {}) => {
        playing[layer] = name;
        return Promise.resolve('done');
      }),
      base: vi.fn(() => Promise.resolve('done')),
      anim: { stop: vi.fn((layer) => (playing[layer] = null)), playing: (layer = 'full') => playing[layer] },
    };
  };

  it('plays each emote once, from where it is, and stops it when it’s gone', () => {
    const fig = figure();
    const e = { id: 'wave', at: 10, t: 0.5 };
    let shown = applyEmote(fig, e, null);
    expect(fig.play).toHaveBeenCalledWith('wave', expect.objectContaining({ layer: 'upper', at: 0.5 }));
    // the same one, frame after frame: not again
    shown = applyEmote(fig, { ...e, t: 0.6 }, shown);
    expect(fig.play).toHaveBeenCalledTimes(1);
    shown = applyEmote(fig, null, shown);
    expect(fig.anim.stop).toHaveBeenCalledWith('upper');
    expect(shown).toBeNull();
  });

  it('a dance loops till it’s gone; a new emote ends the last', () => {
    const fig = figure();
    const shown = applyEmote(fig, { id: 'dance', at: 0, t: 0 }, null);
    expect(fig.play).toHaveBeenCalledWith('dance', expect.objectContaining({ layer: 'full', loop: true }));
    expect(applyEmote(fig, { id: 'wave', at: 3, t: 0 }, shown)).toMatchObject({ id: 'wave' });
    expect(fig.anim.stop).toHaveBeenCalledWith('full');
    expect(fig.play).toHaveBeenLastCalledWith('wave', expect.objectContaining({ layer: 'upper' }));
  });

  it('a sit is on the floor: a loop on the whole body, sat down into gently, and up again', () => {
    const fig = figure();
    let shown = applyEmote(fig, { id: 'sit', at: 0, t: 0 }, null);
    expect(fig.play).toHaveBeenCalledWith('sit.floor', expect.objectContaining({ layer: 'full', loop: true, at: 0, fade: EMOTE.sit.fade }));
    expect(EMOTE.sit.fade).toBeGreaterThan(0.2);
    expect(fig.base).not.toHaveBeenCalled(); // (no chair, no sit.enter)
    shown = applyEmote(fig, { id: 'sit', at: 0, t: 4 }, shown);
    expect(fig.play).toHaveBeenCalledTimes(1);
    // you move: up again, eased off the floor
    applyEmote(fig, null, shown);
    expect(fig.anim.stop).toHaveBeenCalledWith('full', EMOTE.sit.rise);
    expect(fig.base).not.toHaveBeenCalled();
    // heard late, from a stranger: sat from the first, whenever it started
    const late = figure();
    applyEmote(late, { id: 'sit', at: 0, t: 300 }, null);
    expect(late.play).toHaveBeenCalledWith('sit.floor', expect.objectContaining({ layer: 'full', loop: true, at: 300 }));
  });

  it('a one-shot that played out isn’t cut from under what came after', () => {
    const fig = figure();
    const shown = applyEmote(fig, { id: 'cheer', at: 0, t: 0 }, null);
    fig.play('hit.chest', { layer: 'full' });
    applyEmote(fig, null, shown);
    expect(fig.anim.stop).not.toHaveBeenCalled();
  });

  it('no figure yet, or one without clips: no throw, and tried again once it has them', () => {
    const e = { id: 'wave', at: 0, t: 0 };
    expect(applyEmote(null, e, null)).toBeNull();
    expect(applyEmote({}, e, null)).toBeNull();
    expect(applyEmote({ play: () => undefined }, e, null)).toBe(e);
    expect(applyEmote({ play: () => Promise.reject(new Error('no clip')) }, e, null)).toBe(e);
    expect(applyEmote(null, null, null)).toBeNull();
  });
});

describe('a 2017 hero’s own emotes on the wheel', () => {
  const played = [];
  const hero = { clips: { 'emote.2': { duration: 6.25 } }, play: (clip, o) => (played.push([clip, o.layer]), Promise.resolve(true)) };
  it('plays the hero’s game emote in a slot’s place, on the whole body, as long as it is', () => {
    expect(GAME_EMOTE.cheer).toBe('emote.2');
    expect(emoteFor(hero, 'cheer')).toEqual({ clip: 'emote.2', layer: 'full', length: 6.25, walk: false });
    // (a slot the hero has no game emote for, and anyone else: the site's)
    expect(emoteFor(hero, 'dance').clip).toBe('dance');
    expect(emoteFor({ play() {} }, 'wave')).toMatchObject({ clip: 'wave', layer: 'upper', walk: true });
    applyEmote(hero, { id: 'cheer', at: 0, t: 0 });
    expect(played.at(-1)).toEqual(['emote.2', 'full']);
  });
  it('keeps it its own length, and cuts it when the hero moves off', () => {
    const e = { id: 'cheer', at: 10, length: 6.25, walk: false };
    expect(keepEmote(e, 15)).toBe(e);
    expect(keepEmote(e, 16.3)).toBeNull();
    expect(keepEmote({ ...e, id: 'wave' }, 11, { moving: true })).toBeNull();
  });
});

