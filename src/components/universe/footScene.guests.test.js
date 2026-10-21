import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { keepGuestTags } from './footScene';

// Another pilot’s crew down on your planet, as setGuests keeps them: the
// tags are stand-ins (a canvas sprite needs a page) that keep the words and
// colour they were made with, and the ones dropped are counted.
const ALLY = '#8dff9a';
const tags = () => {
  const made = [];
  const dropped = [];
  return {
    made,
    dropped,
    make: (text, colour) => {
      const t = Object.assign(new THREE.Object3D(), { text, colour });
      made.push(t);
      return t;
    },
    drop: (t) => dropped.push(t),
  };
};
const walker = (name, alt = false) => ({ spec: { name }, alt, label: null });
const guest = (extra = {}) => ({ name: 'Ace', ally: false, dim: { code: 'C-500', hue: 0.5 }, walkers: [walker('Rick'), walker('Morty')], ...extra });
const keep = (g, t) => keepGuestTags(g, t.make, t.drop);

describe('a guest crew’s tags', () => {
  it('are made with who they are, the lead’s with their pilot', () => {
    const g = guest();
    const t = tags();
    keep(g, t);
    expect(g.walkers.map((wk) => [wk.label.text, wk.label.colour])).toEqual([
      ['Rick · Ace', '#ffffff'],
      ['Morty', '#ffffff'],
    ]);
  });

  it('are made once, while nothing on them changes', () => {
    const g = guest();
    const t = tags();
    for (let i = 0; i < 60; i++) keep(g, t);
    expect(t.made).toHaveLength(2);
    expect(t.dropped).toHaveLength(0);
  });

  it('turn the ally green when their pilot joins your party, stood where they were', () => {
    const g = guest();
    const t = tags();
    keep(g, t);
    const [rick, morty] = g.walkers.map((wk) => wk.label);
    rick.position.set(1, 2, 3);
    rick.visible = false;
    g.ally = true;
    keep(g, t);
    expect(t.dropped).toEqual([rick, morty]);
    expect(g.walkers.map((wk) => wk.label.colour)).toEqual([ALLY, ALLY]);
    // (where the old one was, and shown or not as it was, till the next frame places it)
    expect(g.walkers[0].label.position.toArray()).toEqual([1, 2, 3]);
    expect(g.walkers[0].label.visible).toBe(false);
    // and back when they leave it
    g.ally = false;
    keep(g, t);
    expect(g.walkers.map((wk) => wk.label.colour)).toEqual(['#ffffff', '#ffffff']);
    expect(t.made).toHaveLength(6);
  });

  it('keep a double’s own tint, and its dimension, until their pilot is a mate', () => {
    const g = guest({ walkers: [walker('Rick', true), null] });
    const t = tags();
    keep(g, t);
    expect([g.walkers[0].label.text, g.walkers[0].label.colour]).toEqual(['Rick of C-500 · Ace', 'hsl(180, 90%, 72%)']);
    g.ally = true;
    keep(g, t);
    expect(g.walkers[0].label.colour).toBe(ALLY);
  });

  it('follow their pilot’s new name, on the lead’s tag alone', () => {
    const g = guest();
    const t = tags();
    keep(g, t);
    const morty = g.walkers[1].label;
    g.name = 'Ace Two';
    keep(g, t);
    expect(g.walkers[0].label.text).toBe('Rick · Ace Two');
    expect(g.walkers[1].label).toBe(morty);
    expect(t.dropped).toHaveLength(1);
  });

  it('call an unnamed pilot a pilot', () => {
    const g = guest({ name: null });
    const t = tags();
    keep(g, t);
    expect(g.walkers[0].label.text).toBe('Rick · a pilot');
  });
});
