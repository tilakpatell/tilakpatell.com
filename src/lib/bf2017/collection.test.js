import { describe, expect, it } from 'vitest';
import { CARD_SLOTS, STORE_KEY, abilitiesFor, appearanceOf, cardLine, cardsFor, character, factionsOf, pick, picksFor, picksOf, readStore, roster, skinsFor, stageSpec, writeStore } from './collection';

describe('the Collection', () => {
  it('lists the heroes by side, the four classes and the reinforcements, the sequel’s left out', () => {
    const r = roster();
    expect(r.heroes.light.slice(0, 3)).toEqual(['luke', 'leia', 'hansolo']);
    expect(r.heroes.dark).toContain('darthvader');
    expect([...r.heroes.light, ...r.heroes.dark]).not.toContain('kyloren');
    expect(r.troopers).toEqual(['assault', 'heavy', 'officer', 'specialist']);
    expect(r.specials.length).toBeGreaterThan(0);
    expect(character('luke')).toMatchObject({ kind: 'hero', side: 'light' });
  });

  it('gives a hero its skins in the game’s words, each with the body it wears', () => {
    const skins = skinsFor('luke');
    expect(skins.map((s) => s.name)).toEqual(['JEDI', 'HOTH', 'FARMBOY', 'YAVIN CEREMONY']);
    expect(skins.find((s) => s.name === 'HOTH')).toMatchObject({ rarity: 'rare', body: 'lukehoth' });
    expect(skinsFor('nobody')).toEqual([]);
  });

  it('files a class’s skins by faction', () => {
    expect(factionsOf('assault')).toEqual(['rebel', 'empire', 'republic', 'cis']);
    expect(skinsFor('assault', { faction: 'empire' }).map((s) => s.name)).toContain('SNOWTROOPER');
    expect(skinsFor('assault', { faction: 'empire' }).find((s) => s.name === 'SNOWTROOPER').body).toBe('snowtrooper');
  });

  it('names a hero’s abilities and star cards, a card’s line with its level’s number', () => {
    expect(abilitiesFor('luke').map((a) => a.slot)).toEqual(['left', 'middle', 'right']);
    const cards = cardsFor('luke');
    expect(cards).toHaveLength(9);
    expect(cards[0]).toMatchObject({ n: 1, name: 'RUSH IMMUNITY', levels: [8, 10, 12, 15] });
    expect(cards[0].art).toMatch(/\.webp$/);
    expect(cardLine(cards[0], 2)).toBe('Every RUSH makes Luke 12% more resistant to damage for three seconds.');
  });

  it('lists the emotes, poses and voice lines', () => {
    expect(picksFor('luke', 'poses').map((p) => p.name)).toEqual(['JEDI HERO', 'MASTER SKYWALKER', 'HERE TO RESCUE YOU', 'NOT AFRAID']);
    expect(picksFor('assault', 'emotes').length).toBeGreaterThan(20);
  });

  it('keeps the picks: a skin, the cards three at most, the game’s defaults where none is kept', () => {
    expect(picksOf({}, 'luke')).toMatchObject({ skin: 'VUR_Luke_ROTJ_01', cards: [] });
    let s = pick({}, 'luke', 'skin', 'VUR_Luke_Hoth_01');
    expect(appearanceOf(s, 'luke')).toBe('lukehoth');
    for (const c of ['luke.1', 'luke.2', 'luke.3', 'luke.4']) s = pick(s, 'luke', 'cards', c);
    expect(picksOf(s, 'luke').cards).toHaveLength(CARD_SLOTS);
    s = pick(s, 'luke', 'cards', 'luke.1');
    expect(picksOf(s, 'luke').cards).toEqual(['luke.2', 'luke.3']);
    expect(picksOf({ luke: { skin: 'not-a-skin' } }, 'luke').skin).toBe('VUR_Luke_ROTJ_01');
  });

  it('puts a skin on the hero-select stage with its hero’s clips', () => {
    expect(stageSpec('luke', 'VUR_Luke_Hoth_01')).toMatchObject({ rig: 'walrus', src: { url: '/models/galaxy/bf2017/crew/lukehoth.glb' }, pack: 'luke' });
    expect(stageSpec('nobody', 'x')).toBeNull();
  });

  it('reads and writes the store without throwing', () => {
    const mem = new Map();
    const storage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) };
    expect(writeStore(storage, { luke: { skin: 'VUR_Luke_Hoth_01' } })).toBe(true);
    expect(JSON.parse(mem.get(STORE_KEY)).luke.skin).toBe('VUR_Luke_Hoth_01');
    expect(readStore(storage)).toEqual({ luke: { skin: 'VUR_Luke_Hoth_01' } });
    const broken = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(readStore(broken)).toEqual({});
    expect(writeStore(broken, {})).toBe(false);
    expect(readStore({ getItem: () => '[1]' })).toEqual({});
  });
});
