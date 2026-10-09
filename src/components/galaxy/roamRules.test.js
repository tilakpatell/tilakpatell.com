import { describe, expect, it } from 'vitest';
import { GALAXY_SIDES, ROAM_EVENTS, bountyFor, galaxySide } from './roamRules';
import { GCW, warTable } from './gcw';
import { effectsFor } from './warEffects';
import { SYSTEMS, systemById } from './systems';
import { KINDS, NAMES } from './hunted';
import { canHave, EVENTS } from '../universe/director';
import { pick } from '../universe/sides';
import { GALAXY_KINDS } from './fleet';
import { BUILT_KINDS } from '../universe/trafficModels';
import { HUNTER_GLB } from './models';

const BUILT = new Set([...BUILT_KINDS, ...GALAXY_KINDS]); // (what galaxy/fleet.js's buildGalaxyShip can build)

const seeded = (seed = 3) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

describe('galaxySide', () => {
  it('gives every system a side by who holds it, and none without a system', () => {
    expect(galaxySide(null)).toBeNull();
    for (const s of SYSTEMS) {
      const side = galaxySide(s);
      expect(side, s.id).toBeTruthy();
      expect(side.id).toBe(`galaxy-${s.faction ?? 'none'}`);
    }
    expect(galaxySide(systemById('hoth'))).toBe(galaxySide(systemById('tatooine'))); // (the same object for the same faction)
  });

  it('has the Empire hunting with a Star Destroyer and four bounty hunters, the remnant with Fett, the Separatists with droids alone', () => {
    const empire = galaxySide(systemById('hoth'));
    expect(pick(empire, 'hunt', seeded())).toBe('empire');
    expect(pick(empire, 'capital')).toBe('navy');
    expect(empire.capitalShip).toBe('destroyer');
    expect(Object.entries(empire.factions).filter(([, f]) => f.role === 'bounty').map(([id]) => id).sort()).toEqual(['bossk', 'dengar', 'fett', 'ig88']);
    const remnant = galaxySide(systemById('nevarro'));
    expect(pick(remnant, 'hunt', seeded())).toBe('remnant');
    expect(pick(remnant, 'bounty', seeded())).toBe('fett');
    const seps = galaxySide(systemById('geonosis'));
    expect(pick(seps, 'hunt', seeded())).toBe('separatists');
    expect(pick(seps, 'capital')).toBeNull();
    expect(pick(seps, 'bounty', seeded())).toBeNull();
    expect(seps.has('destroyer')).toBe(false);
    const none = galaxySide(systemById('dagobah'));
    expect(pick(none, 'hunt', seeded())).toBeNull();
    expect(none.has('hunt')).toBe(false);
    expect(none.has('bounty')).toBe(true);
    for (const side of Object.values(GALAXY_SIDES)) expect(pick(side, 'pirates')).toBe('weequay');
  });

  it('lets the director bring only what each side can have, of the events the galaxy plays', () => {
    expect(Object.keys(ROAM_EVENTS)).toEqual(['hunt', 'destroyer', 'bounty', 'escort']);
    const can = (side) => Object.entries(EVENTS).filter(([, e]) => canHave(side, e)).map(([id]) => id);
    expect(can(GALAXY_SIDES.empire)).toEqual(expect.arrayContaining(['hunt', 'destroyer', 'bounty', 'distress', 'convoy', 'leviathan', 'meteors']));
    expect(can(GALAXY_SIDES.empire)).not.toContain('council');
    expect(can(GALAXY_SIDES.separatists)).not.toContain('destroyer');
    expect(can(GALAXY_SIDES.separatists)).not.toContain('bounty');
    expect(can(GALAXY_SIDES.none)).not.toContain('hunt');
    expect(can(GALAXY_SIDES.none)).toContain('bounty');
  });

  it('names only hunters the galaxy can fly: stats, a name and a model or a built one for every kind', () => {
    for (const side of Object.values(GALAXY_SIDES)) {
      for (const [id, f] of Object.entries(side.factions)) {
        expect(f.family, id).toBe('starwars');
        expect(f.laser, id).toHaveLength(3);
        for (const [kind] of f.kinds) {
          expect(KINDS[kind], `${id} ${kind}`).toBeTruthy();
          expect(NAMES[kind], `${id} ${kind}`).toBeTruthy();
          // (drawn: a model the fleet loads, or built in code till then; Slave I waits for its model)
          const model = KINDS[kind].model ?? kind;
          expect(Boolean(HUNTER_GLB[model]) || BUILT.has(model), `${id} ${kind}`).toBe(true);
        }
        if (f.ace) expect(KINDS[f.ace], `${id} ace`).toBeTruthy();
      }
    }
  });
});

describe('galaxySide, by who holds the system in the war', () => {
  const MS = GCW.start + 30 * 60e3;
  const fx = (war, id, owner, side, turncoat = false) => {
    const t = warTable(war, MS);
    const table = { ...t, systems: t.systems.map((r) => (r.id === id ? { ...r, owner, front: false, attack: null } : r)) };
    return effectsFor(id, table, { war, side, sworn: 1, turncoat });
  };
  const can = (side) => Object.entries({ ...EVENTS, ...ROAM_EVENTS }).filter(([, e]) => canHave(side, e)).map(([id]) => id);
  it('without effects, as it always was', () => {
    expect(galaxySide(systemById('hoth'), null)).toBe(galaxySide(systemById('hoth')));
  });
  it('a Rebel system with a Rebel pilot has no hunt and no Star Destroyer, an escort, and still the bounty hunters', () => {
    const side = galaxySide(systemById('hoth'), fx('gcw', 'hoth', 'rebel', 'rebel'));
    expect(pick(side, 'hunt', seeded())).toBeNull();
    expect(can(side)).toEqual(expect.arrayContaining(['bounty', 'escort']));
    expect(can(side)).not.toContain('hunt');
    expect(can(side)).not.toContain('destroyer');
    expect(side.escort).toEqual(['xwing', 'awing', 'ywing']);
  });
  it('with an Imperial pilot the Rebellion hunts, and drops in a Mon Calamari cruiser', () => {
    const side = galaxySide(systemById('hoth'), fx('gcw', 'hoth', 'rebel', 'empire'));
    expect(pick(side, 'hunt', seeded())).toBe('rebellion');
    expect(pick(side, 'capital')).toBe('rebelnavy');
    expect(side.capitalShip).toBe('moncal');
    expect(can(side)).toContain('destroyer');
    expect(can(side)).not.toContain('escort');
  });
  it('the Republic hunts with ARC-170s and a Venator, the Separatists with droids', () => {
    const rep = galaxySide(systemById('kamino'), fx('clone', 'kamino', 'republic', 'separatists'));
    expect(pick(rep, 'hunt', seeded())).toBe('republic');
    expect(rep.capitalShip).toBe('venator');
    expect(pick(galaxySide(systemById('kamino'), fx('clone', 'kamino', 'separatists', 'republic')), 'hunt', seeded())).toBe('separatists');
  });
  it('a separatist world’s droids come for you whoever holds it, your side or not, in the Clone Wars', () => {
    const side = galaxySide(systemById('geonosis'), fx('clone', 'geonosis', 'republic', 'republic'));
    expect(pick(side, 'hunt', seeded())).toBe('separatists');
    expect(can(side)).toContain('escort');
    // (and none after it: a Rebel-held Geonosis in the Civil War is your own space)
    expect(can(galaxySide(systemById('geonosis'), fx('gcw', 'geonosis', 'rebel', 'rebel')))).not.toContain('hunt');
  });
  it('Hutt space hunts nobody, but the bounty hunters come twice as keen', () => {
    const side = galaxySide(systemById('tatooine'), fx('gcw', 'tatooine', 'hutt', 'rebel'));
    expect(can(side)).not.toContain('hunt');
    expect(can(side)).toContain('bounty');
    expect(side.factions.fett.weight).toBe(2 * GALAXY_SIDES.empire.factions.fett.weight);
  });
  it('a deserter is hunted, and the bounty hunters are keener', () => {
    const side = galaxySide(systemById('hoth'), fx('gcw', 'hoth', 'rebel', 'empire', true));
    expect(pick(side, 'hunt', seeded())).toBe('rebellion');
    expect(side.factions.fett.weight).toBe(2);
  });
  it('every side’s capital ship and escorts can be drawn', () => {
    for (const owner of ['rebel', 'empire', 'republic', 'separatists', 'newrepublic', 'remnant', 'hutt'])
      for (const side of [owner === 'hutt' ? 'rebel' : owner, null]) {
        const s = galaxySide(systemById('hoth'), fx(owner === 'republic' || owner === 'separatists' ? 'clone' : owner === 'newrepublic' || owner === 'remnant' ? 'remnant' : 'gcw', 'hoth', owner, side));
        if (s.capitalShip) expect(Boolean(HUNTER_GLB[s.capitalShip]) || BUILT.has(s.capitalShip), `${owner} ${s.capitalShip}`).toBe(true);
        for (const [id, f] of Object.entries(s.factions)) for (const [kind] of f.kinds) expect(Boolean(HUNTER_GLB[KINDS[kind]?.model ?? kind]) || BUILT.has(KINDS[kind]?.model ?? kind), `${owner} ${id} ${kind}`).toBe(true);
      }
  });
});

describe('galaxySide, out of the war', () => {
  const can = (side) => Object.entries({ ...EVENTS, ...ROAM_EVENTS }).filter(([, e]) => canHave(side, e)).map(([id]) => id);
  it('sends nobody’s hunters from a faction that isn’t in the war', () => {
    const imperial = SYSTEMS.find((s) => s.faction === 'empire');
    expect(galaxySide(imperial, null, 'gcw').factions.empire).toBeDefined();
    const clone = galaxySide(imperial, null, 'clone');
    expect(clone.factions.empire).toBeUndefined();
    expect(clone.capitalShip).toBeNull();
    expect(can(clone)).not.toContain('destroyer');
    // (the Empire's world in the Remnant War is the Remnant's)
    expect(galaxySide(imperial, null, 'remnant').factions.remnant).toBeDefined();
  });
});

describe('the bounty hunter who comes', () => {
  it('sends another hunter, never Vader, while Slave I is still on its way', () => {
    expect(bountyFor('fett', () => true, ['fett', 'ig88'])).toBe('fett');
    expect(bountyFor('fett', () => false, ['fett', 'ig88', 'bossk'])).toBe('ig88');
    expect(bountyFor('fett', () => false, ['fett'])).toBeNull();
    expect(bountyFor('bossk', () => false, ['fett', 'bossk'])).toBe('bossk');
  });
});
