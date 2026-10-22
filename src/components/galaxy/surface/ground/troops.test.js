import { describe, expect, test } from 'vitest';
import { PICKABLE, WEAPONS } from '../weaponRules';
import { FIGURES } from '../figures';
import { OWNERS } from '../../warEffects';
import { SIDE_OF_KIND } from './standing';
import ai from '../../../../data/bf2017/ai.json';
import classes from '../../../../data/bf2017/classes.json';
import reinforcements from '../../../../data/bf2017/reinforcements.json';
import weapons from '../../../../data/bf2017/weapons.json';
import { ARMS, FAMILIES, GAME_GUNS, KINDS_OF_SIDE, SOLDIERS, TROOPS, YOUR_SHARE, damageOf, dressOf, falloff, hpOf, hurt, kindFor, newSoldier, onYou } from './troops';

describe('troops', () => {
  test('every kind a side fields has a row, with a gun the galaxy knows (or none)', () => {
    for (const kind of Object.keys(SIDE_OF_KIND)) {
      const t = TROOPS[kind];
      expect(t, kind).toBeTruthy();
      expect(t.hp).toBeGreaterThan(0);
      if (t.weapon) expect(WEAPONS[t.weapon], `${kind} ${t.weapon}`).toBeTruthy();
    }
    // (the trooper's health is the game's assault class's since the ground war's soldiers took the game's minds: 100 by hand before)
    expect(TROOPS.stormtrooper).toMatchObject({ hp: 150, weapon: 'rifle', range: 48, speed: 3.2, cone: 0.3, nerve: 1 });
    expect(TROOPS.clone.weapon).toBe('dc15');
    expect(TROOPS.battledroid).toMatchObject({ hp: 60, weapon: 'e5', nerve: 0 });
    expect(TROOPS.superdroid).toMatchObject({ hp: 160, nerve: 0 });
    expect(TROOPS.droideka.shield).toBe(3);
    expect(TROOPS.probe.weapon).toBeNull();
  });
  test('the clone’s DC-15 and the droid’s E-5 are soldiers’ guns, not the hero panel’s', () => {
    expect(WEAPONS.dc15).toMatchObject({ damage: 1, every: 0.4, burst: 3, spread: 0.012, range: 120, side: 'galaxy' });
    expect(PICKABLE).not.toContain('dc15');
    expect(PICKABLE).not.toContain('e5');
    expect(WEAPONS.e5).toMatchObject({ damage: 1, every: 0.5, spread: 0.03, range: 70, side: 'galaxy' });
    expect(PICKABLE).not.toContain('dc15');
    expect(PICKABLE).not.toContain('e5');
  });
  test('each side fields figures the surface can draw, the warEffects owner’s troops first', () => {
    for (const [side, o] of Object.entries(OWNERS)) {
      expect(KINDS_OF_SIDE[side][0], side).toBe(o.troops);
      for (const k of KINDS_OF_SIDE[side]) expect(FIGURES, k).toContain(k);
    }
    expect(KINDS_OF_SIDE.empire).toContain(kindFor('empire', () => 0));
  });
  test('damage falls past two thirds of the range', () => {
    expect(damageOf('rifle', 10)).toBe(10);
    expect(damageOf('rifle', 100)).toBe(6);
    expect(damageOf('nope', 10)).toBe(20); // (weaponRules' blaster's numbers when unknown)
  });
  test('a soldier of a kind the game has fires its gun’s damage, falling off as the projectile’s does', () => {
    const trooper = { kind: 'stormtrooper' };
    expect(damageOf('rifle', 10, trooper)).toBe(36);
    expect(damageOf('rifle', 30, trooper)).toBe(27.5);
    expect(damageOf('rifle', 100, trooper)).toBe(19);
    // (a kind the game lacks keeps the galaxy's numbers)
    expect(damageOf('e5', 10, { kind: 'battledroid' })).toBe(10);
    expect(falloff({ start: 40, end: 25, startDistance: 20, endDistance: 40 }, 25)).toBe(36.25);
    // (on you, scaled by your 100 against the game's assault class's 150)
    expect(onYou(trooper, 36)).toBe(24);
    expect(onYou({ kind: 'clone' }, 10)).toBe(10);
    expect(YOUR_SHARE * classes.rows['d-orig-assault'].health).toBe(100);
  });
});

describe('the troops on the game’s records', () => {
  const rows = { ...classes.rows };
  test('a kind the game has: its hp is the class’s (or the special’s), its gun the class’s, every number the record’s', () => {
    for (const [kind, t] of Object.entries(TROOPS)) {
      if (t.source === 'hand') {
        expect(t.game, kind).toBeUndefined();
        continue;
      }
      expect(t.source, kind).toBe('game');
      const rec = t.game.cls ? rows[t.game.cls] : reinforcements.rows[t.game.special];
      expect(rec, kind).toBeTruthy();
      expect(t.hp, kind).toBe(rec.health);
      expect(t.game.hp, kind).toBe(rec.health);
      if (t.game.cls) expect(rec.weapon, kind).toBe(t.game.gun);
    }
    for (const [id, g] of Object.entries(GAME_GUNS)) {
      const w = weapons.rows[id];
      expect(w, id).toBeTruthy();
      expect(g.family, id).toBe(w.family);
      expect(g.rof, id).toBe(w.firing.rof);
      for (const k of ['start', 'end', 'startDistance', 'endDistance']) expect(g.damage[k], `${id} ${k}`).toBe(w.damage[k]);
    }
  });
  test('the Original Trilogy’s troopers are the game’s; the Clone Wars’, the droids and the Hutts’ men are the galaxy’s own', () => {
    for (const kind of ['stormtrooper', 'sandtrooper', 'snowtrooper', 'shoretrooper', 'rebel', 'hothtrooper', 'deathtrooper']) expect(TROOPS[kind].source, kind).toBe('game');
    for (const kind of ['clone', 'clonephase1', 'battledroid', 'superdroid', 'droideka', 'mercenary', 'weequay', 'probe', 'scouttrooper']) expect(TROOPS[kind].source, kind).toBe('hand');
    expect(TROOPS.rebel).toMatchObject({ hp: 150, game: { cls: 'l-orig-assault', gun: 'a280' } });
    expect(TROOPS.deathtrooper).toMatchObject({ hp: 320, game: { special: 'DeathTrooper', gun: 'e11d' } });
  });
  test('every kind plays one of the game’s templates, with that template’s own tactics', () => {
    for (const [kind, t] of Object.entries(TROOPS)) {
      expect(['rifleman', 'heavy', 'officer', 'sniper', 'closerange', 'melee'], kind).toContain(t.template);
      expect(ai.rows.templates[t.template].tactics, kind).toBe(t.tactics);
      expect(ai.rows.tactics[t.tactics], kind).toBeTruthy();
    }
    expect(TROOPS.superdroid.template).toBe('heavy');
    expect(TROOPS.mercenary.template).toBe('closerange');
    expect(TROOPS.battledroid.template).toBe('rifleman');
  });
  test('hurt says down at nothing left, and a quest spec’s hp maps to the scale', () => {
    const s = newSoldier({ id: 'a', kind: 'battledroid', side: 'separatists', role: 'post', at: [1, 2], yaw: 0, home: [1, 2], squad: 'q' }, () => 0.5);
    expect(s).toMatchObject({ id: 'a', hp: 60, hpMax: 60, weapon: 'e5', alive: true, suppressed: 0, heat: 0, grudge: 0, b: { x: 1, z: 2 } });
    expect(hurt(s, 30)).toBe('hurt');
    expect(hurt(s, 30)).toBe('down');
    expect(s.alive).toBe(false);
    expect(hpOf({ hp: 4 })).toBe(40);
  });
  test('the old tables are the one table’s', () => {
    expect(ARMS).toEqual({ tusken: 'sniper', jango: 'westar', greedo: 'blaster', aqualish: 'blaster', scouttrooper: 'blaster', stormtrooper: 'e11', sandtrooper: 'e11', snowtrooper: 'e11', shoretrooper: 'e11', deathtrooper: 'e11', clone: 'dc15', battledroid: 'e5', mercenary: 'rifle', hothtrooper: 'a280', rebel: 'a280' });
    expect(FAMILIES).toEqual({ stormtrooper: ['stormtrooper', 'sandtrooper', 'snowtrooper', 'scouttrooper'], rebel: ['rebel', 'hothtrooper'], clone: ['clone'], battledroid: ['battledroid', 'superdroid'], mercenary: ['mercenary'] });
    expect([...SOLDIERS]).toEqual(['stormtrooper', 'sandtrooper', 'snowtrooper', 'scouttrooper', 'shoretrooper', 'deathtrooper', 'tiepilot', 'officer', 'clone', 'rex', 'battledroid', 'superdroid', 'rebel', 'hothtrooper', 'wingguard', 'senateguard', 'bobafett', 'greedo', 'jango', 'mando', 'bokatan', 'fennec', 'caradune', 'ig11', 'greef']);
  });
});

describe('a world’s own kit', () => {
  test('dresses a side’s trooper in the world’s uniform, and leaves the rest', () => {
    const hoth = { stormtrooper: 'snowtrooper', rebel: 'hothtrooper' };
    expect(dressOf('stormtrooper', hoth)).toBe('snowtrooper');
    expect(dressOf('rebel', hoth)).toBe('hothtrooper');
    expect(dressOf('mercenary', hoth)).toBe('mercenary');
    expect(dressOf('stormtrooper', undefined)).toBe('stormtrooper');
  });
});
