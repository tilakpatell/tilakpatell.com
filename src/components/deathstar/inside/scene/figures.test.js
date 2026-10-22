import { describe, expect, it } from 'vitest';
import { ALIAS, PEOPLE, PRELOAD, motionOf, playerKind } from './figures';
import { CAST } from '../rules/cast';
import { CLIPS } from '../../../../lib/three/clipLibrary';

// locomotion's weights for a `move` (lib/three/locomotion.js): idle below 0.04, run from 0.55
const smooth = (a, b, x) => {
  const k = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return k * k * (3 - 2 * k);
};
const weights = (move) => {
  const run = smooth(0.55, 0.9, move);
  const idle = 1 - smooth(0.04, 0.3, move);
  return { idle, walk: Math.max(0, 1 - run - idle), run };
};

describe('a figure’s motion, from how fast it goes', () => {
  it('stands idle when still, walks at walking pace and runs at running pace', () => {
    expect(weights(motionOf(0).move)).toMatchObject({ idle: 1, walk: 0, run: 0 });
    expect(weights(motionOf(1.6).move)).toMatchObject({ idle: 0, walk: 1, run: 0 });
    expect(weights(motionOf(4.2).move)).toMatchObject({ idle: 0, walk: 0, run: 1 });
  });

  it('blends walking into running between the two paces, and counts going sideways as going', () => {
    const w = weights(motionOf(2.9).move);
    expect(w.walk).toBeGreaterThan(0);
    expect(w.run).toBeGreaterThan(0);
    expect(motionOf(0, 1.6).move).toBeCloseTo(motionOf(1.6).move);
    expect(motionOf(1, -0.5, 0.3)).toMatchObject({ speed: 1, side: -0.5, turn: 0.3 });
  });
});

describe('the rules’ clip names', () => {
  it('each name a clip the library has', () => {
    for (const [name, clip] of Object.entries(ALIAS)) expect(CLIPS[clip], name).toBeDefined();
    for (const name of PRELOAD) expect(CLIPS[name], name).toBeDefined();
  });
});

describe('who the player is drawn as', () => {
  it('is the Rebel hero picked, in their own clothes', () => {
    expect(playerKind({ side: 'rebel', hero: 'leia' })).toBe('leia');
    expect(playerKind({ side: 'rebel', hero: 'obiwan' })).toBe('obiwan');
  });

  it('is a stormtrooper in borrowed armour, and always as an Imperial', () => {
    expect(playerKind({ side: 'rebel', hero: 'han', armour: true })).toBe('stormtrooper');
    expect(playerKind({ side: 'imperial' })).toBe('stormtrooper');
  });

  it('is Luke when the hero is someone the station has no figure for', () => {
    expect(playerKind({ side: 'rebel', hero: 'nobody' })).toBe('luke');
  });
});

describe('the player’s figures', () => {
  it('are on the game’s bodies the cast names for the same kinds, old Ben on the site’s', () => {
    for (const [kind, who] of Object.entries(PEOPLE)) expect(who.game ?? null, kind).toBe(CAST[kind].game ?? null);
    expect(PEOPLE.obiwan.game).toBeUndefined();
  });
});
