import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CAST, PERCEPTION, perceptionOf } from './cast';
import { WEAPONS } from './combat';
import { bodyOf } from '../../../../lib/cast/bodies';

const root = (path) => new URL(`../../../../../${path}`, import.meta.url);
const json = (path) => JSON.parse(readFileSync(root(path), 'utf8'));

// Every speaker the voices pipeline can make a voice from: the site’s first
// sources and each world’s file beside them.
const SOURCED = new Set([
  ...Object.keys(json('scripts/voices/sources.json')),
  ...readdirSync(root('scripts/voices/sources/'))
    .filter((f) => f.endsWith('.json'))
    .flatMap((f) => Object.keys(json(`scripts/voices/sources/${f}`))),
]);
// the bones a model’s skin is weighted to, read from its GLB’s JSON chunk
const joints = (model) => {
  const b = readFileSync(root(`public${model}`));
  const gltf = JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString('utf8'));
  return gltf.skins?.[0]?.joints.map((i) => gltf.nodes[i].name).sort() ?? [];
};
const VOICELESS = new Set(json('scripts/ai-e2e/assets/allow-voiceless.json').speakers);
const voiced = (who) => existsSync(root(`public/audio/voiced/${who}`));

const KINDS = [
  'stormtrooper',
  'dstrooper',
  'gunner',
  'officer',
  'tiepilot',
  'technician',
  'librarian',
  'vader',
  'tarkin',
  'motti',
  'tagge',
  'jerjerrod',
  'emperor',
  'royalguard',
  'leia',
  'luke',
  'han',
  'obiwan',
  'chewie',
  'threepio',
  'artoo',
  'mouse',
  'gonk',
  'r5',
  'ito',
  'dianoga',
];
const BUILT = { ito: 'ito', dianoga: 'dianoga' };
const SIDES = ['imperial', 'rebel', 'neutral'];
const ROLES = ['soldier', 'officer', 'worker', 'droid', 'hero', 'boss', 'beast'];
const OFFICERS = ['officer', 'tarkin', 'motti', 'tagge', 'jerjerrod'];

describe('the cast', () => {
  it('has everyone the plan puts aboard, the archive’s keeper the talks already name, and nobody else', () => {
    expect(Object.keys(CAST).sort()).toEqual([...KINDS].sort());
  });

  it('gives the troops and the officer the numbers the plan sets', () => {
    expect(CAST.stormtrooper).toMatchObject({ model: '/models/galaxy/troops/stormtrooper.glb', tall: 1.83, gun: 'e11', hp: 60, voice: 'stormtrooper', side: 'imperial', role: 'soldier', armour: true });
    expect(CAST.dstrooper).toMatchObject({ model: '/models/galaxy/crew/officer.glb', tall: 1.8, gun: 'e11', hp: 60, helmet: 'dstrooper', side: 'imperial', role: 'soldier' });
    expect(CAST.officer).toMatchObject({ model: '/models/galaxy/crew/officer.glb', tall: 1.78, gun: 'dh17', hp: 40, voice: 'imperialofficer', side: 'imperial', role: 'officer' });
  });

  it('dresses the Death Star trooper in black, and the gunner as him without a gun', () => {
    const { color } = CAST.dstrooper.dye;
    expect(Math.max((color >> 16) & 255, (color >> 8) & 255, color & 255)).toBeLessThan(80);
    const dress = (c) => Object.fromEntries(Object.entries(c).filter(([k]) => !['name', 'role', 'gun'].includes(k)));
    expect(CAST.gunner.gun).toBeUndefined();
    expect(dress(CAST.gunner)).toEqual(dress(CAST.dstrooper));
  });

  it('puts Vader, the Emperor and the Royal Guard on their own models, with a saber and a pike', () => {
    expect(CAST.vader).toMatchObject({ model: '/models/galaxy/crew/vader.glb', tall: 2.03, blade: { type: 'saber' }, scripted: true, role: 'boss', side: 'imperial' });
    expect(CAST.vader.gun).toBeUndefined();
    expect(CAST.emperor).toMatchObject({ model: '/models/galaxy/crew/palpatine.glb', tall: 1.73, role: 'boss', side: 'imperial' });
    expect(CAST.royalguard).toMatchObject({ model: '/models/galaxy/crew/senateguard.glb', tall: 1.9, blade: { type: 'pike' }, side: 'imperial' });
    const { color } = CAST.royalguard.dye;
    expect((color >> 16) & 255).toBeGreaterThan(2 * Math.max((color >> 8) & 255, color & 255));
  });

  it('wears the officer’s uniform in a tint of his own for each of the conference room’s ranks', () => {
    const tints = ['tarkin', 'motti', 'tagge'].map((k) => {
      expect(CAST[k].model, k).toBe('/models/galaxy/crew/officer.glb');
      return CAST[k].tint;
    });
    expect(new Set(tints).size).toBe(3);
    expect(tints.every((t) => Number.isInteger(t))).toBe(true);
  });

  it('puts the droids on the surfaces’ models', () => {
    expect(CAST.threepio.model).toBe('/models/deathstar/c3po.glb');
    // (on the crew’s skeleton, not the surfaces’ Mixamo one, so the shared clips play on him)
    expect(joints(CAST.threepio.model)).toEqual(joints(CAST.officer.model));
    expect(CAST.artoo.model).toBe('/models/galaxy/surface/r2d2.glb');
    expect(CAST.mouse.model).toBe('/models/galaxy/surface/mousedroid.glb');
    expect(CAST.gonk.model).toBe('/models/galaxy/surface/gonk.glb');
    expect(CAST.r5.model).toBe('/models/galaxy/surface/r5.glb');
  });

  it('has a model in the site for every kind not built in code', () => {
    for (const [kind, c] of Object.entries(CAST)) if (c.model) expect(existsSync(root(`public${c.model}`)), `${kind}: ${c.model}`).toBe(true);
  });

  it('draws Chewbacca on his Meshy model, the cockpit’s, at his full height', () => {
    expect(CAST.chewie).toMatchObject({ model: '/models/cockpit/chewie.glb', tall: 2.28, side: 'rebel', role: 'hero' });
    expect(CAST.chewie.built).toBeUndefined();
    // the crew’s own skeleton, so the shared walk, run and fight clips (his chest-pound too) play on him
    expect(joints(CAST.chewie.model)).toHaveLength(24);
    expect(joints(CAST.chewie.model)).toEqual(joints(CAST.officer.model));
  });

  it('dyes the Death Star’s own black-clad crew charcoal and the Royal Guard crimson, rather than tinting them to black', () => {
    for (const k of ['dstrooper', 'gunner', 'technician', 'royalguard']) {
      expect(CAST[k].dye, k).toMatchObject({ color: expect.any(Number) });
      expect(CAST[k].tint, k).toBeUndefined();
    }
    // (crimson: red well over green and blue)
    const red = CAST.royalguard.dye.color;
    expect(red >> 16).toBeGreaterThan(((red >> 8) & 0xff) * 3);
  });

  it('draws Obi-Wan as the first film’s old Ben, rigged on the crew’s own skeleton', () => {
    expect(CAST.obiwan).toMatchObject({ model: '/models/deathstar/obiwan.glb', tall: 1.78, side: 'rebel', role: 'hero' });
    expect(joints(CAST.obiwan.model)).toEqual(joints(CAST.officer.model));
  });

  it('draws everyone the 2017 game has on the game’s own body, from the one cast table, the site’s model standing in', () => {
    // (the battlefront-by-default design, decision 4: the game’s rows, by the station’s kinds)
    const GAME = {
      stormtrooper: 'stormtrooper',
      dstrooper: 'deathtrooper',
      gunner: 'deathtrooper',
      officer: 'officer',
      technician: 'officer',
      librarian: 'officer',
      tarkin: 'officer',
      motti: 'officer',
      tagge: 'officer',
      jerjerrod: 'officer',
      vader: 'vader',
      emperor: 'palpatine',
      leia: 'leia',
      luke: 'luke',
      han: 'han',
      chewie: 'chewie',
      threepio: 'c3po',
      artoo: 'astromech',
      gonk: 'gonk',
      r5: 'r5',
    };
    for (const [kind, c] of Object.entries(CAST)) {
      expect(c.game ?? null, kind).toBe(GAME[kind] ?? null);
      if (!c.game) continue;
      const row = bodyOf(c.game);
      expect(row?.source, kind).toBe('game');
      // (the people on the game’s humanoid skeleton, the droids on their own)
      expect(row.rig, kind).toBe(c.role === 'droid' || kind === 'artoo' ? 'own' : 'walrus');
      expect(typeof c.model, `${kind}’s stand-in`).toBe('string');
    }
    // (the Royal Guard, the TIE pilot, old Ben, the mouse droid and the two built here: the game has none of them)
    for (const k of ['royalguard', 'tiepilot', 'obiwan', 'mouse', 'ito', 'dianoga']) expect(CAST[k].game, k).toBeUndefined();
  });

  it('builds the IT-O and the dianoga in code, and only them', () => {
    for (const [kind, c] of Object.entries(CAST)) {
      if (BUILT[kind]) expect(c, kind).toMatchObject({ model: null, built: BUILT[kind] });
      else {
        expect(typeof c.model, kind).toBe('string');
        expect(c.built, kind).toBeUndefined();
      }
    }
  });

  it('arms everyone who carries a gun with one the combat rules know', () => {
    const guns = Object.entries(CAST).filter(([, c]) => c.gun !== undefined);
    expect(guns.length).toBeGreaterThan(5);
    for (const [kind, c] of guns) expect(WEAPONS[c.gun], `${kind}: ${c.gun}`).toBeDefined();
  });

  it('voices each speaker with a voice the pipeline has a source for, shipped or allowed to wait', () => {
    const voices = Object.entries(CAST).filter(([, c]) => c.voice !== undefined);
    expect(voices.map(([k]) => k)).toEqual(expect.arrayContaining(['stormtrooper', 'officer', 'vader', 'threepio', 'obiwan', 'leia', 'han', 'luke']));
    for (const [kind, { voice }] of voices) {
      expect(SOURCED.has(voice), `${kind}: ${voice} has no source in scripts/voices`).toBe(true);
      expect(voiced(voice) || VOICELESS.has(voice), `${kind}: ${voice} is neither voiced nor allowed voiceless`).toBe(true);
    }
  });

  it('puts everyone on a side the station’s rules use, with a role the minds know', () => {
    for (const [kind, c] of Object.entries(CAST)) {
      expect(SIDES, kind).toContain(c.side);
      expect(ROLES, kind).toContain(c.role);
    }
    for (const k of ['leia', 'luke', 'han', 'obiwan', 'chewie', 'threepio', 'artoo']) expect(CAST[k], k).toMatchObject({ side: 'rebel', role: 'hero' });
    for (const k of ['mouse', 'gonk', 'r5']) expect(CAST[k], k).toMatchObject({ side: 'neutral', role: 'droid' });
    expect(CAST.ito).toMatchObject({ side: 'imperial', role: 'droid' });
    expect(CAST.dianoga).toMatchObject({ side: 'neutral', role: 'beast' });
    for (const k of OFFICERS) expect(CAST[k].role, k).toBe('officer');
  });

  it('gives every kind a name, a height and health, and any pace a positive one', () => {
    for (const [kind, c] of Object.entries(CAST)) {
      expect(typeof c.name === 'string' && c.name.length > 0, kind).toBe(true);
      expect(c.tall, kind).toBeGreaterThan(0);
      expect(c.hp, kind).toBeGreaterThan(0);
      if (c.speed !== undefined) expect(c.speed, kind).toBeGreaterThan(0);
    }
    expect(CAST.mouse.speed).toBeGreaterThan(1);
    expect(CAST.gonk.speed).toBeLessThan(1);
  });

  it('names people in plain words, with no straight quotes or exclamation marks', () => {
    for (const [kind, c] of Object.entries(CAST)) expect(c.name, kind).not.toMatch(/["'!]/);
  });

  it('keeps the station’s senses, which only officers, Royal Guards and mouse droids differ from', () => {
    expect(PERCEPTION).toEqual({ sight: 22, cone: 0.57, far: 1.2, shots: 18, steps: 6 });
    for (const k of [...OFFICERS, 'royalguard']) expect(perceptionOf(k), k).toEqual({ ...PERCEPTION, sight: 26 });
    expect(perceptionOf('mouse')).toEqual({ ...PERCEPTION, sight: 8 });
    const plain = Object.keys(CAST).filter((k) => ![...OFFICERS, 'royalguard', 'mouse'].includes(k));
    for (const k of plain) expect(perceptionOf(k), k).toEqual(PERCEPTION);
  });

  it('gives a kind it doesn’t know the station’s senses', () => {
    expect(perceptionOf('nobody')).toEqual(PERCEPTION);
    expect(perceptionOf('toString')).toEqual(PERCEPTION);
  });

  it('can’t be changed by whoever reads it', () => {
    expect(Object.isFrozen(CAST)).toBe(true);
    expect(Object.isFrozen(PERCEPTION)).toBe(true);
    for (const [kind, c] of Object.entries(CAST)) {
      expect(Object.isFrozen(c), kind).toBe(true);
      for (const v of Object.values(c)) if (v && typeof v === 'object') expect(Object.isFrozen(v), kind).toBe(true);
    }
    perceptionOf('officer').sight = 99;
    expect(perceptionOf('officer').sight).toBe(26);
  });
});
