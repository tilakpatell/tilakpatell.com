import { describe, expect, it } from 'vitest';
import CLASS_BOOK from '../../../data/bf2017/classes.json';
import { CLASSES, TROOPERS, sidesOf, trooperId, trooperKind, troopersFor } from './troopers';
import { WEAPONS } from './weaponRules';
import { CREW } from './crewList';
import { heroById, heroSpec, readHero, writeHero, refitOf } from '../heroes';
import { bodiesFor } from './standIn';

describe('the trooper classes', () => {
  it('carry the game’s health and weapons for the Original Trilogy’s sides (classes.json)', () => {
    for (const c of CLASSES)
      for (const [f, key] of [['l', 'light'], ['d', 'dark']]) {
        const row = CLASS_BOOK.rows[`${f}-orig-${c.cls}`];
        expect(row, c.cls).toBeTruthy();
        expect(c.health).toBe(row.health);
        expect(c.game[key]).toBe(row.weapon);
      }
  });
  it('every class’s gun is one the surface fires, every body one the crew list has', () => {
    for (const t of TROOPERS) {
      expect(WEAPONS[t.weapon], t.id).toBeTruthy();
      expect(CREW[t.trooper.kind], t.id).toBeTruthy();
    }
  });
  it('the sides by era, and the world’s own kit', () => {
    expect(sidesOf('empire').map((s) => s.id)).toEqual(['rebel', 'empire']);
    expect(sidesOf('republic').map((s) => s.id)).toEqual(['republic', 'separatists']);
    expect(trooperKind('empire', 'hoth')).toBe('snowtrooper');
    expect(trooperKind('empire', 'tatooine')).toBe('stormtrooper');
    expect(troopersFor('rebel', 'hoth')[0].trooper.kind).toBe('hothtrooper');
  });
  it('a class pick is a spec the scene accepts, in the world’s kit, kept and read back', () => {
    const id = trooperId('empire', 'heavy');
    const pick = readHero({ id, kind: 'snowtrooper', gun: 'dlt19' });
    expect(pick).toMatchObject({ id, kind: 'snowtrooper', gun: 'dlt19' });
    expect(readHero(writeHero(pick))).toEqual(pick);
    const spec = heroSpec(pick);
    expect(spec).toMatchObject({ id, rig: 'walrus', pack: null, gun: 'dlt19', hero: true });
    expect(spec.src.url).toBe(CREW.snowtrooper.url);
    expect(spec.abilities).toEqual(CLASSES.find((c) => c.cls === 'heavy').abilities);
    // (another kit is another body; the stand-in chain covers a trooper too)
    expect(refitOf(spec, heroSpec({ ...pick, kind: 'stormtrooper' }))).toBe('body');
    expect(bodiesFor(spec, heroById(id)).map((t) => t.stoodIn)).toEqual([null, 'standin']);
  });
});
