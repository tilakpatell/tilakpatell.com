import { describe, expect, it } from 'vitest';
import { SCORCH, lookOf } from './look.js';

describe('lookOf', () => {
  it('a packed _RGB decal map is masks: drawn as the scorch, its coverage the channel read from the map', () => {
    expect(lookOf('FX/Decals/EnvDecals/T_BlasterHole_RGB_01')).toEqual({ mask: 'r', color: SCORCH });
    expect(lookOf('FX/Decals/EnvDecals/T_BlasterStreak_RGB_01')).toEqual({ mask: 'r', color: SCORCH });
    // (the burnt map's red and green are a normal; its blue is the burn)
    expect(lookOf('FX/Decals/VolumeDecals/Textures/T_Burnt_01_RGB')).toEqual({ mask: 'b', color: SCORCH });
    expect(lookOf('FX/Decals/Somewhere/T_Unread_RGB_02').mask).toBe('r');
  });
  it('a colour map is its own colour, its alpha the coverage', () => {
    expect(lookOf('FX/Decals/T_Poster_01_C')).toEqual({ mask: 'a', color: null });
    expect(lookOf('FX/Decals/T_Sign_RGBA_01')).toEqual({ mask: 'a', color: null });
  });
});

