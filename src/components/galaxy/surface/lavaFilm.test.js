import { describe, expect, it } from 'vitest';
import { lavaFilm } from './lavaFilm';

const FILMS = [{ slug: 'mt-volcano2', kind: 'fx', fx: 'volcano', path: 'films/bf2017/mt-volcano2.webm', poster: 'films/bf2017/mt-volcano2.webp', loop: true, flipped: true }];
const mustafar = { water: { kind: 'lava', video: 'volcano' } };
const fakeDoc = () => {
  const made = [];
  return {
    made,
    createElement: (tag) => {
      const el = { tag, attrs: {}, played: 0, play() { this.played++; return Promise.resolve(); }, pause() {}, removeAttribute(k) { delete this[k]; }, load() {} };
      made.push(el);
      return el;
    },
  };
};

describe('the game’s lava film on a site’s lava', () => {
  it('plays it muted and looping on high and ultra, flipped as the game keeps it', () => {
    for (const level of ['high', 'ultra']) {
      const doc = fakeDoc();
      const lava = lavaFilm(mustafar, { level, saveData: false, doc, films: FILMS });
      expect(lava.flipped).toBe(true);
      expect(doc.made[0]).toMatchObject({ tag: 'video', muted: true, loop: true, playsInline: true, played: 1 });
      expect(doc.made[0].src).toMatch(/films\/bf2017\/mt-volcano2\.webm$/);
      expect(lava.texture.image).toBe(doc.made[0]);
      lava.dispose();
    }
  });

  it('draws the shader’s own lava on low and mid, with reduced motion, on a saver connection, or where the site asks for none', () => {
    const doc = fakeDoc();
    expect(lavaFilm(mustafar, { level: 'mid', saveData: false, doc, films: FILMS })).toBeNull();
    expect(lavaFilm(mustafar, { level: 'low', saveData: false, doc, films: FILMS })).toBeNull();
    expect(lavaFilm(mustafar, { level: 'high', reduced: true, saveData: false, doc, films: FILMS })).toBeNull();
    expect(lavaFilm(mustafar, { level: 'high', saveData: true, doc, films: FILMS })).toBeNull();
    expect(lavaFilm({ water: { kind: 'lava' } }, { level: 'high', saveData: false, doc, films: FILMS })).toBeNull();
    expect(lavaFilm({ water: { kind: 'sea', video: 'volcano' } }, { level: 'high', saveData: false, doc, films: FILMS })).toBeNull();
    expect(lavaFilm(mustafar, { level: 'high', saveData: false, doc, films: [] })).toBeNull();
    expect(doc.made).toEqual([]);
  });
});
