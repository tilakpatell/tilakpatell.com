import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { HEROES, HILTS, SABER_COLORS, SKINS, defaultHeroId, heroById, heroSpec, leanText, loadoutLine, partyFor, readHero, refitOf, skinsOf, writeHero } from './heroes';
import { CREW, fileOf } from './surface/crewList';
import PUBLISHED from '../../data/galaxyAssets.json';

// (a file of the site's: in public/, or published to the bucket, src/data/galaxyAssets.json)
const onSite = (url) => existsSync(new URL(`../../../public${url}`, import.meta.url)) || Boolean(PUBLISHED[url.slice(1)]);
import { GUNS } from '../universe/gunplay';
import { RIGGED } from '../rickmorty/portal/meshyCast';
import { ABILITIES } from './surface/abilityRules';

describe('the heroes’ sides in the war', () => {
  it('every hero leans light, dark or neither, and has a line for an assault on their side and against it', () => {
    for (const h of HEROES) {
      expect(['light', 'dark', null], h.id).toContain(h.lean);
      for (const k of ['ours', 'theirs']) {
        expect(typeof h.lines?.[k], `${h.id} ${k}`).toBe('string');
        expect(h.lines[k].length, `${h.id} ${k}`).toBeLessThanOrEqual(120);
        expect(h.lines[k], h.id).not.toMatch(/['"]/);
      }
    }
    expect(heroById('luke').lean).toBe('light');
    expect(heroById('bobafett').lean).toBe('dark');
  });
  it('says what side a hero leans to, for their card', () => {
    expect(leanText('light')).toMatch(/\S/);
    expect(leanText('dark')).toMatch(/\S/);
    expect(leanText(null)).toBeNull();
  });
});

describe('the heroes', () => {
  it('each have a rigged figure in the site, a weapon the hands know, and a word about them', () => {
    expect(HEROES.length).toBeGreaterThanOrEqual(6);
    for (const h of HEROES) {
      // (a file of the site's, or a Meshy figure the cast rigs)
      if (h.src.meshy) expect(RIGGED.has(h.src.meshy), h.id).toBe(true);
      else expect(onSite(h.src.url), h.id).toBe(true);
      expect(ABILITIES[h.abilities.power], `${h.id} on G`).toBeTruthy();
      expect(ABILITIES[h.abilities.second], `${h.id} on V`).toBeTruthy();
      expect(['galaxy', 'elsewhere']).toContain(h.side);
      expect(h.tall).toBeGreaterThan(1);
      expect(GUNS[h.weapon], `${h.id} carries ${h.weapon}`).toBeTruthy();
      if (h.weapon === 'saber') {
        expect(SABER_COLORS.some((c) => c.id === h.saber.color), h.id).toBe(true);
        expect(HILTS.some((x) => x.id === h.saber.hilt), h.id).toBe(true);
      }
      expect(h.blurb.length).toBeGreaterThan(10);
    }
    expect(new Set(HEROES.map((h) => h.id)).size).toBe(HEROES.length);
  });
  it('gives each of the 2017 game’s heroes two of its own kit, with the game’s numbers', () => {
    const game = HEROES.filter((h) => h.rig === 'walrus' && h.id !== 'bobafett');
    expect(game.map((h) => h.id)).toEqual(expect.arrayContaining(['luke', 'vader', 'palpatine', 'maul', 'dooku', 'obiwan', 'anakin', 'han', 'leia', 'chewie']));
    for (const h of game) {
      for (const slot of ['power', 'second']) {
        const a = ABILITIES[h.abilities[slot]];
        // (Leia's medpack is the site's: her kit's other two are a shield and a rifle it doesn't play)
        if (h.id === 'leia' && slot === 'second') continue;
        // (nor Lando's G, his kit's smoke and disruptor, nor Bossk's V, his mines and his instincts)
        if ((h.id === 'lando' && slot === 'power') || (h.id === 'bossk' && slot === 'second')) continue;
        expect(a.game?.startsWith(`${h.id}: `), `${h.id} on ${slot}`).toBe(true);
      }
    }
    // (Boba Fett's jetpack is the site's own; his rocket the game's)
    expect(ABILITIES[heroById('bobafett').abilities.second].game).toMatch(/^bobafett: /);
    expect(heroById('vader').abilities).toEqual({ power: 'vaderChoke', second: 'vaderRage' });
  });

  it('reads the kept choice, and falls back to the ship’s lead on nothing or nonsense', () => {
    expect(readHero(null, 'xwing')).toMatchObject({ id: 'luke', color: 'green', hilt: 'luke' });
    expect(readHero(null, 'falcon').id).toBe('han');
    // the crews from elsewhere walk in as themselves
    expect(readHero(null, 'cruiser')).toMatchObject({ id: 'rick', gun: 'portal' });
    expect(readHero(null, 'rv')).toMatchObject({ id: 'walt', gun: 'revolver' });
    // and may carry the galaxy's guns, or their own that nobody else may
    expect(readHero({ id: 'rick', gun: 'blaster' }).gun).toBe('blaster');
    expect(readHero({ id: 'morty', gun: 'laser' }).gun).toBe('laser');
    expect(readHero({ id: 'han', gun: 'laser' }).gun).toBe('blaster');
    expect(heroSpec(readHero(null, 'cruiser'))).toMatchObject({ id: 'rick', src: { meshy: 'rick' }, abilities: { power: 'hop', second: 'overcharge' } });
    expect(heroSpec({ id: 'bobafett' })).toMatchObject({ gun: 'ee3', abilities: { power: 'jetpack', second: 'bobaRocket' } });
    expect(readHero('{bad json', 'xwing').id).toBe('luke');
    expect(readHero({ id: 'greedo' }).id).toBe(defaultHeroId('xwing'));
    expect(readHero(writeHero({ id: 'obiwan', color: 'purple', hilt: 'dooku' }))).toMatchObject({ id: 'obiwan', color: 'purple', hilt: 'dooku' });
    // a colour or hilt that isn't one goes back to the hero's own
    expect(readHero({ id: 'obiwan', color: 'plaid', hilt: 'x' })).toMatchObject({ id: 'obiwan', color: 'blue', hilt: 'temple' });
    // (a hero not on the game's rig yet, kept from before: the ship's lead instead)
    expect(readHero({ id: 'ahsoka', color: 'purple' }, 'xwing').id).toBe('luke');
    // a gun hero keeps a saber colour for when they pick one up
    expect(readHero({ id: 'han' })).toMatchObject({ id: 'han', color: 'blue', hilt: 'skywalker' });
  });

  it('makes a party spec: a saber hero holds the saber kind with the blade’s colour, a gun hero their gun', () => {
    const luke = heroSpec({ id: 'luke', color: 'blue', hilt: 'skywalker' });
    expect(luke.gun).toBe('saber');
    expect(luke.saber.color).toBe('#4aa8ff');
    expect(luke.saber.hilt.id).toBe('skywalker');
    expect(luke.bolt).toBe('#4aa8ff');
    expect(luke.src.url).toMatch(/luke\.glb$/);
    const han = heroSpec({ id: 'han', color: 'blue', hilt: 'skywalker' });
    expect(han.gun).toBe('blaster');
    expect(han.saber).toBeNull();
    expect(han.name).toBe('Han');
  });
});

describe('the stance, the gun and the mods', () => {
  it('reads a Jedi’s stance and a gunslinger’s gun and mods, and makes nonsense good', () => {
    // (the stance is the hero's own: one blade, or Maul's staff)
    expect(readHero({ id: 'luke', stance: 'double' }).stance).toBe('single');
    expect(readHero({ id: 'luke', stance: 'nope' }).stance).toBe('single');
    expect(readHero({ id: 'maul' }).stance).toBe('double');
    expect(readHero({ id: 'han', gun: 'sniper', mods: ['scope', 'scope', 'nope', 'cooling', 'choke'] })).toMatchObject({ gun: 'sniper', mods: ['scope', 'cooling'] });
    expect(readHero({ id: 'han', gun: 'saber' }).gun).toBe('blaster');
    expect(readHero({ id: 'luke', gun: 'sniper' }).gun).toBe('saber');
    expect(readHero({ id: 'chewie' }).gun).toBe('bowcaster');
  });
  it('the spec carries them: the saber’s stance, the picked gun and its mods, a yellow bolt from elsewhere', () => {
    expect(heroSpec(readHero({ id: 'maul', stance: 'single' })).saber.stance).toBe('double');
    const han = heroSpec(readHero({ id: 'han', gun: 'shotgun', mods: ['choke'] }));
    expect(han.gun).toBe('shotgun');
    expect(han.mods).toEqual(['choke']);
    expect(han.bolt).toBe('#ffd36b');
    expect(heroSpec(readHero({ id: 'han', gun: 'a280' })).bolt).toBe('#ff4a3d');
    expect(JSON.parse(writeHero(readHero({ id: 'leia', gun: 'smg', mods: ['trigger'] })))).toMatchObject({ gun: 'smg', mods: ['trigger'] });
  });
});

describe('the perks', () => {
  it('ride with the choice, three at most, nonsense dropped', () => {
    expect(readHero({ id: 'luke', perks: ['focus', 'nope', 'nimble', 'nimble', 'survivor', 'riposte'] }).perks).toEqual(['focus', 'nimble', 'survivor']);
    expect(readHero({ id: 'luke' }).perks).toEqual([]);
    expect(heroSpec(readHero({ id: 'han', perks: ['heatsink'] })).perks).toEqual(['heatsink']);
    expect(JSON.parse(writeHero(readHero({ id: 'leia', perks: ['deflector'] }))).perks).toEqual(['deflector']);
  });
});

describe('a change of hero down on a world (applied there and then, not on the next visit)', () => {
  const xwing = [{ id: 'luke', name: 'Luke' }, { id: 'artoo', name: 'Artoo' }];
  const falcon = [{ id: 'chewie', name: 'Chewie' }, { id: 'han', name: 'Han' }];
  const spec = (choice) => heroSpec(readHero(choice));
  it('the hero leads; the mate is the ship’s second, or its first when the hero is the second', () => {
    expect(partyFor(spec({ id: 'han' }), xwing).map((p) => p.id)).toEqual(['han', 'artoo']);
    expect(partyFor(spec({ id: 'han' }), falcon).map((p) => p.id)).toEqual(['han', 'chewie']);
    expect(partyFor(spec({ id: 'chewie' }), falcon).map((p) => p.id)).toEqual(['chewie', 'han']);
    expect(partyFor(spec({ id: 'leia' }), falcon).map((p) => p.id)).toEqual(['leia', 'han']);
    expect(partyFor(null, falcon)).toEqual(falcon);
  });
  it('says what a figure needs: a new body for another person, new arms for another gun, blade or mods, nothing for perks', () => {
    const luke = spec({ id: 'luke', color: 'green', hilt: 'luke', stance: 'single' });
    expect(refitOf(luke, spec({ id: 'luke', color: 'green', hilt: 'luke', stance: 'single' }))).toBe('same');
    expect(refitOf(luke, spec({ id: 'luke', color: 'green', hilt: 'luke', stance: 'single', perks: ['survivor'] }))).toBe('same');
    expect(refitOf(luke, spec({ id: 'luke', color: 'red', hilt: 'luke', stance: 'single' }))).toBe('arms');
    expect(refitOf(luke, spec({ id: 'luke', color: 'green', hilt: 'temple', stance: 'single' }))).toBe('arms');
    expect(refitOf(luke, spec({ id: 'luke', color: 'green', hilt: 'luke', stance: 'double' }))).toBe('same');
    expect(refitOf(luke, spec({ id: 'han' }))).toBe('body');
    const han = spec({ id: 'han' });
    expect(refitOf(han, spec({ id: 'han', gun: 'ee3' }))).toBe('arms');
    expect(refitOf(han, spec({ id: 'han', mods: ['scope'] }))).toBe('arms');
    expect(refitOf(null, han)).toBe('body');
    // (the ship's crew, not on the roster: the same when it's them again)
    expect(refitOf(xwing[1], { ...xwing[1] })).toBe('same');
  });
});

describe('the loadout in a line (the panel’s summary, the note when it goes on)', () => {
  it('a Jedi: the blade’s colour, the hilt and the stance', () => {
    expect(loadoutLine(readHero({ id: 'luke', color: 'green', hilt: 'luke', stance: 'single' }))).toBe('Green blade · Luke’s own hilt · One blade');
  });
  it('a gunslinger: the gun and its mods', () => {
    expect(loadoutLine(readHero({ id: 'han', gun: 'ee3', mods: ['scope', 'barrel'] }))).toBe('EE-3 · Scope, Long barrel');
    expect(loadoutLine(readHero({ id: 'han' }))).toBe('DL-44');
  });
  it('and the perks, counted', () => {
    expect(loadoutLine(readHero({ id: 'han', perks: ['survivor'] }))).toBe('DL-44 · 1 perk');
    expect(loadoutLine(readHero({ id: 'han', perks: ['survivor', 'focus'] }))).toBe('DL-44 · 2 perks');
  });
});

describe('the outfits', () => {
  it('are a 2017 hero’s own, the one they wear first and the game’s others, each on the game’s skeleton with the hero’s clips', () => {
    for (const [id, looks] of Object.entries(SKINS)) {
      const h = heroById(id);
      expect(h?.rig, id).toBe('walrus');
      expect(looks[0], id).toMatchObject({ kind: id });
      expect(new Set(looks.map((l) => l.id)).size, id).toBe(looks.length);
      for (const l of looks) {
        expect(l.name, `${id} ${l.id}`).toBeTruthy();
        expect(CREW[l.kind], `${id} ${l.id}: a CREW row`).toMatchObject({ rig: 'walrus', pack: id });
        expect(onSite(fileOf(CREW[l.kind])), `${l.kind}.glb`).toBe(true);
      }
    }
    expect(skinsOf('rick')).toEqual([]);
  });

  it('keeps the outfit picked, and puts it on: its file, the hero’s clips', () => {
    const [, other] = skinsOf('luke');
    expect(readHero({ id: 'luke', skin: other.id }).skin).toBe(other.id);
    expect(readHero({ id: 'luke', skin: 'nope' }).skin).toBe(skinsOf('luke')[0].id);
    expect(readHero({ id: 'han', skin: other.id }).skin).toBe(skinsOf('han')[0].id);
    expect(readHero({ id: 'rick', skin: other.id }).skin).toBeNull();
    expect(readHero(writeHero(readHero({ id: 'luke', skin: other.id }))).skin).toBe(other.id);
    const spec = heroSpec(readHero({ id: 'luke', skin: other.id }));
    expect(spec.src.url).toBe(fileOf(CREW[other.kind]));
    expect(spec).toMatchObject({ rig: 'walrus', pack: 'luke' });
    expect(heroSpec(readHero({ id: 'luke' })).src).toEqual(heroById('luke').src);
    // (another outfit is another body)
    expect(refitOf(heroSpec(readHero({ id: 'luke' })), spec)).toBe('body');
    expect(loadoutLine(readHero({ id: 'luke', skin: other.id }))).toContain(other.name);
  });
});

describe('one saber path', () => {
  it('fields no saber hero who isn’t on the game’s rig: one not yet is `soon`, with why, and isn’t picked', () => {
    const off = HEROES.filter((h) => h.weapon === 'saber' && h.rig !== 'walrus');
    expect(off.map((h) => h.id)).toEqual(['ahsoka']);
    for (const h of off) {
      expect(h.soon).toMatch(/game’s rig/);
      expect(readHero({ id: h.id }).id).not.toBe(h.id);
    }
  });
});
