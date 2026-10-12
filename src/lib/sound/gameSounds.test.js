import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { GAME_SOUNDS, SITUATIONS, lineFor, soundFor } from './gameSounds';
import PUBLISHED from '../../data/galaxyAssets.json';
import { onSite } from '../../../scripts/lib/asset-manifest.mjs';

// the modules whose names the map uses, read as text (a test may read what
// a module in lib may not import)
const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const SURFACE = read('components/galaxy/surface/sounds.js');
const UNIVERSE = read('components/universe/sounds.js');
const SFX = read('lib/sfx.js');
const CLIPS = read('lib/clips.js');
const VOICES = read('components/galaxy/surface/voicelines.js');

const exported = (text, name) => new RegExp(`export (?:const|function|async function) ${name}\\b`).test(text);

// is `name` one the site plays a sound by?
function siteHas(name) {
  const [head, which] = name.split(':');
  const [where, what] = head.split(/\.(.+)/);
  if (where === 'surface') {
    // createSounds' own: saber, combat, step, blast, roar, crash, in what it returns
    if (!new RegExp(`return \\{[\\s\\S]*\\b${what},`).test(SURFACE)) return false;
    if (!which) return true;
    if (what === 'step') return new RegExp(`\\b${which}: \\[`).test(SURFACE.slice(SURFACE.indexOf('const STEP')));
    return SURFACE.includes(`what === '${which}'`);
  }
  if (where === 'universe') {
    if (!exported(UNIVERSE, what)) return false;
    if (!which) return true;
    if (what === 'gunSound') return UNIVERSE.includes(`gun === '${which}'`);
    if (what === 'shipEngine') return new RegExp(`^  ${which}: \\{ src:`, 'm').test(UNIVERSE);
    return false;
  }
  if (where === 'sfx') return exported(SFX, what);
  if (where === 'clip') return new RegExp(`^  ${what}: \\{ src:`, 'm').test(CLIPS);
  if (where === 'line') return VOICES.includes(`: '${what}',`);
  return false;
}

describe('the game’s sounds, by the site’s names', () => {
  it('every name is one sounds.js, sfx.js, clips.js or the voices already use', () => {
    const names = Object.keys(GAME_SOUNDS);
    expect(names.length).toBeGreaterThan(60);
    for (const name of names) expect(siteHas(name), name).toBe(true);
  });

  it('a name the site doesn’t use fails the check (the check is real)', () => {
    expect(siteHas('surface.saber:hum')).toBe(false);
    expect(siteHas('sfx.nothing')).toBe(false);
    expect(siteHas('clip.nothing')).toBe(false);
    expect(siteHas('line.kylo')).toBe(false);
    expect(siteHas('universe.gunSound:lightbow')).toBe(false);
  });

  it('covers the saber, the blasters, impacts, footfalls, engines, heroes and troopers', () => {
    for (const n of ['surface.saber:ignite', 'surface.saber:clash', 'surface.combat:force', 'universe.gunSound:blaster', 'universe.impactSound', 'surface.step:snow', 'universe.shipEngine:xwing', 'line.luke', 'line.stormtrooper']) expect(GAME_SOUNDS, n).toHaveProperty([n]);
  });

  // (a game file named here is one the Hoth set made: public/audio/galaxy/bf2017/, or published from it)
  const PUBLIC = { publicDir: fileURLToPath(new URL('../../../public', import.meta.url)), manifest: PUBLISHED };
  const onDisk = (f) => onSite(`audio/galaxy/bf2017/${f}`, PUBLIC);

  it('every game file is null until its audio is here, and names a file of the site’s when it is', () => {
    let named = 0;
    for (const [name, v] of Object.entries(GAME_SOUNDS)) {
      if (name.startsWith('line.')) {
        expect(Object.keys(v)).toEqual(SITUATIONS);
        for (const f of Object.values(v)) expect(f, name).toBeNull();
      } else if (v !== null) {
        expect(onDisk(v), `${name}: ${v}`).toBe(true);
        named += 1;
      }
    }
    expect(named).toBeGreaterThanOrEqual(4);
    expect(soundFor('universe.gunSound:blaster', onDisk)).toBe('/audio/galaxy/bf2017/blaster-e11-close-01.mp3');
  });
});

describe('soundFor', () => {
  const table = { 'surface.saber:ignite': 'saber/ignite_01.ogg', 'surface.blast': null, 'line.luke': { taunt: 'vo/luke_taunt_01.ogg', kill: null } };
  const has = (f) => f === 'saber/ignite_01.ogg' || f === 'vo/luke_taunt_01.ogg';

  it('the game’s file when the bucket has it', () => {
    expect(soundFor('surface.saber:ignite', has, table)).toBe('/audio/galaxy/bf2017/saber/ignite_01.ogg');
    expect(lineFor('luke', 'taunt', has, table)).toBe('/audio/galaxy/bf2017/vo/luke_taunt_01.ogg');
  });

  it('null otherwise, and the site’s own plays', () => {
    expect(soundFor('surface.saber:ignite', () => false, table)).toBeNull();
    expect(soundFor('surface.blast', has, table)).toBeNull();
    expect(soundFor('surface.nothing', has, table)).toBeNull();
    expect(lineFor('luke', 'kill', has, table)).toBeNull();
    expect(lineFor('vader', 'taunt', has, table)).toBeNull();
    // and with the real table, only the names the Hoth set gave a file
    for (const name of Object.keys(GAME_SOUNDS)) if (GAME_SOUNDS[name] === null) expect(soundFor(name, () => true), name).toBeNull();
    expect(soundFor('surface.combat:hit', () => true)).toBe('/audio/galaxy/bf2017/hit-hit-01.mp3');
  });
});
