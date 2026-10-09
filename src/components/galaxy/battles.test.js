import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createBattle } from '../universe/battle';
import { createBattleScene } from '../universe/battleScene';
import { createDirector } from '../universe/battleDirector';
import { planFor } from '../universe/battlePlan';
import { FIGHTERS, SUBSYSTEMS } from '../universe/wars';
import { GALAXY_KINDS } from './fleet';
import { MODELS, STAND_IN } from './models';
import { BUILT_KINDS } from '../universe/trafficModels';
import { WAR_SYSTEMS, teamsOf } from './gcw';
import { SIDES, WARS, WAR_IDS } from './sides';
import { systemById } from './systems';
import { BATTLE_KINDS, HUTTS, SIZE, TEMPLATES, kindFor, layBattle, obstacles, templateFor } from './battles';

const KNOWN = new Set([...Object.keys(MODELS), ...GALAXY_KINDS, ...BUILT_KINDS, ...Object.keys(STAND_IN)]);
// a battle as gcw.js's battleAt has it
const fake = (sys, attacker = 'rebel', defender = null, seed = 7, war = null) => {
  const w = war ?? (attacker === 'hutt' ? WARS[Object.keys(WARS).find((k) => WARS[k].liberator === defender || WARS[k].raider === defender)].id : Object.values(WARS).find((x) => x.liberator === attacker || x.raider === attacker).id);
  const def = defender ?? (WARS[w].liberator === attacker ? WARS[w].raider : WARS[w].liberator);
  const sides = teamsOf(attacker, def);
  return { id: `c0.${w}.${sys}.3`, war: w, sys, step: 3, seed, attacker, defender: def, sides, attackerTeam: sides.indexOf(attacker), start: 0, fightEnd: 600e3, end: 720e3, fighting: true };
};
const lines = (t) => [t.light, t.dark];

describe('the kinds of battle', () => {
  it('are six, each with words for both sides, an objective, and its runners', () => {
    expect(Object.keys(BATTLE_KINDS).sort()).toEqual(['ambush', 'assault', 'blockade', 'evacuation', 'interdiction', 'siege']);
    for (const [id, k] of Object.entries(BATTLE_KINDS)) {
      expect(k.id).toBe(id);
      expect(k.name).toMatch(/\S/);
      expect(k.text.attack, id).toMatch(/\S/);
      expect(k.text.defend, id).toMatch(/\S/);
      expect(['flagship', 'interdictor']).toContain(k.objective);
      if (k.runners) expect(['attacker', 'defender']).toContain(k.runners.side);
    }
    expect(BATTLE_KINDS.evacuation.runners.side).toBe('defender');
    expect(BATTLE_KINDS.blockade.runners.side).toBe('attacker');
  });
  it('every war system has a known kind, and one without a war entry gets the defaults', () => {
    for (const id of WAR_SYSTEMS) expect(BATTLE_KINDS[kindFor(id)], id).toBeTruthy();
    expect(kindFor('hoth')).toBe('evacuation');
    expect(kindFor('nowhere')).toBe('assault');
    expect(templateFor('nowhere', 'gcw').name).toMatch(/\S/);
    expect(templateFor('nowhere', 'gcw').light.flagship.kind).toBe(templateFor('tatooine', 'gcw').light.flagship.kind);
  });
});

describe('the battles’ templates', () => {
  it('has the set pieces’ own in the Civil War, and one for every system in every war', () => {
    for (const id of ['endor', 'hoth', 'scarif', 'yavin', 'coruscant']) expect(TEMPLATES.gcw[id], id).toBeTruthy();
    for (const war of WAR_IDS) for (const id of WAR_SYSTEMS) expect(templateFor(id, war).name, `${war} ${id}`).toMatch(/\S/);
  });
  it('builds every ship from a model the galaxy has, at the galaxy’s sizes, every fighter one the battle knows', () => {
    for (const war of WAR_IDS)
      for (const id of WAR_SYSTEMS) {
        const t = templateFor(id, war);
        for (const l of [...lines(t), HUTTS])
          for (const c of [l.flagship, ...l.escorts]) {
            expect(KNOWN.has(c.kind), `${war} ${id} ${c.kind}`).toBe(true);
            expect(c.size, `${war} ${id} ${c.kind}`).toBeGreaterThan(0);
            expect(SIZE[c.kind], `${c.kind} has a size`).toBeGreaterThan(0);
          }
        for (const f of [...t.fighters.light, ...t.fighters.dark, ...HUTTS.fighters]) {
          expect(KNOWN.has(f.kind), `${war} ${id} ${f.kind}`).toBe(true);
          expect(FIGHTERS[f.kind], `${f.kind} flies`).toBeTruthy();
          if (f.role === 'bomber') expect(FIGHTERS[f.kind].reload, `${f.kind} bombs`).toBeGreaterThan(0);
        }
        for (const a of Object.values(t.ace ?? {})) {
          expect(FIGHTERS[a.kind], `${war} ${id} ace ${a.kind}`).toBeTruthy();
          expect(KNOWN.has(a.kind)).toBe(true);
          expect(a.name).toMatch(/\S/);
        }
      }
  });
  it('puts in a flagship with objectives, and four to seven escorts', () => {
    for (const war of WAR_IDS)
      for (const id of WAR_SYSTEMS)
        for (const l of [...lines(templateFor(id, war)), HUTTS]) {
          expect(SUBSYSTEMS[l.flagship.kind], `${war} ${id} ${l.flagship.kind}`).toBeTruthy();
          expect(l.escorts.length, `${war} ${id}`).toBeGreaterThanOrEqual(4);
          expect(l.escorts.length).toBeLessThanOrEqual(7);
        }
  });
  it('fights each war with its own: the Republic’s Venators, the Separatists’ droids, the Remnant’s TIEs', () => {
    const clone = templateFor('kashyyyk', 'clone');
    expect([clone.light.flagship, ...clone.light.escorts].some((c) => c.kind === 'venator')).toBe(true);
    expect(clone.fighters.dark.some((f) => f.kind === 'vulture')).toBe(true);
    expect(clone.fighters.light.some((f) => f.kind === 'arc170')).toBe(true);
    expect(templateFor('nevarro', 'remnant').fighters.dark.some((f) => f.kind === 'tie')).toBe(true);
  });
  it('has the Executor at Endor and Hoth, two Star Destroyers at Scarif, Vader over Hoth and Hera over Lothal', () => {
    expect(TEMPLATES.gcw.endor.dark.flagship.kind).toBe('executor');
    expect(TEMPLATES.gcw.hoth.dark.flagship.kind).toBe('executor');
    expect([TEMPLATES.gcw.scarif.dark.flagship, ...TEMPLATES.gcw.scarif.dark.escorts].filter((c) => c.kind === 'destroyer')).toHaveLength(2);
    expect(TEMPLATES.gcw.hoth.ace.dark).toMatchObject({ kind: 'tieadvanced', name: 'Darth Vader' });
    expect(TEMPLATES.gcw.lothal.ace.light).toMatchObject({ kind: 'ghost' });
  });
  it('gives the interdiction worlds’ raider an Interdictor only where the war has one', () => {
    for (const war of WAR_IDS)
      for (const id of WAR_SYSTEMS.filter((x) => kindFor(x) === 'interdiction')) {
        const has = templateFor(id, war).dark.escorts.some((c) => c.kind === 'interdictor');
        expect(has, `${war} ${id}`).toBe(war !== 'clone');
      }
  });
  it('fights a Clone Wars interdiction as a siege', () => {
    const id = WAR_SYSTEMS.find((x) => kindFor(x) === 'interdiction');
    const laid = layBattle(systemById(id), fake(id, 'republic', 'separatists', 7, 'clone'));
    expect(laid.kind).toBe('siege');
    expect(laid.objectivesOn).toBe('flagship');
  });
  it('runs each side’s own runners', () => {
    // the runners' side: an evacuation's the defender, a blockade's the attacker
    const runnersOf = (war, kindId, side) => {
      const id = WAR_SYSTEMS.find((x) => kindFor(x) === kindId);
      const other = WARS[war].liberator === side ? WARS[war].raider : WARS[war].liberator;
      const [att, def] = kindId === 'evacuation' ? [other, side] : [side, other];
      return layBattle(systemById(id), fake(id, att, def, 7, war)).runners.kind;
    };
    expect(runnersOf('clone', 'evacuation', 'republic')).toBe('corvette');
    expect(runnersOf('clone', 'blockade', 'separatists')).toBe('coreship');
    expect(runnersOf('gcw', 'evacuation', 'rebel')).toBe('transport');
    expect(runnersOf('remnant', 'blockade', 'remnant')).toBe('gozanti');
  });
});

describe('the flagships’ objectives, from outside', () => {
  // (as universe/battle.test.js checks the universe's: a fair share of bolts
  // from round an objective's outer side that meet its ship meet it)
  const reachable = (laid) => {
    const b = createBattle({ ...laid, perSide: 0 });
    b.setYou(b.attacker);
    const ship = b.capitals.find((c) => c.objective);
    for (const phase of [1, 2, 3]) {
      for (const s of ship.subs.filter((o) => o.phase === phase)) {
        const out = { x: s.pos.x - ship.pos.x, y: s.pos.y - ship.pos.y, z: s.pos.z - ship.pos.z };
        let reached = 0;
        let stopped = 0;
        let seed = 11;
        const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
        for (let n = 0; n < 60; n++) {
          let d;
          do d = { x: rand() * 2 - 1, y: rand() * 2 - 1, z: rand() * 2 - 1 };
          while (Math.hypot(d.x, d.y, d.z) > 1 || d.x * out.x + d.y * out.y + d.z * out.z <= 0);
          const l = Math.hypot(d.x, d.y, d.z);
          let p = { x: s.pos.x + (d.x / l) * 40, y: s.pos.y + (d.y / l) * 40, z: s.pos.z + (d.z / l) * 40 };
          let hit = null;
          for (let f = 0; f < 30 && !hit; f++) {
            const q = { x: p.x - (d.x / l) * 2, y: p.y - (d.y / l) * 2, z: p.z - (d.z / l) * 2 };
            hit = b.hit(p, q, 0);
            p = q;
          }
          if (hit?.sub === s.id) reached++;
          else if ((hit?.shield || hit?.capital) && hit.id === ship.id) stopped++;
        }
        expect(reached / Math.max(1, reached + stopped), `${ship.kind} ${s.id}`).toBeGreaterThan(0.25);
      }
      for (const s of ship.subs.filter((o) => o.phase === phase)) for (let i = 0; i < 400 && s.alive; i++) b.hit(s.pos, { x: s.pos.x, y: s.pos.y - 0.01, z: s.pos.z }, 5);
      b.update(0.1, null);
      expect(b.phase, `${ship.kind} past phase ${phase}`).toBe(phase + 1);
    }
  };
  it('can be shot on every flagship the wars and the Hutts fly, and on an Interdictor', () => {
    const seen = new Set();
    for (const war of WAR_IDS)
      for (const id of WAR_SYSTEMS) {
        const { liberator, raider } = WARS[war];
        for (const [att, def] of [
          [liberator, raider],
          [raider, liberator],
          [liberator, 'hutt'],
        ]) {
          const laid = layBattle(systemById(id), fake(id, att, def, 7, war));
          const ship = laid.war.sides[1 - laid.attacker].capitals.find((c, i) => (laid.objectivesOn === 'interdictor' ? c.kind === 'interdictor' : i === 0));
          const key = `${ship.kind}:${laid.objectivesOn}`;
          if (seen.has(key)) continue;
          seen.add(key);
          reachable(laid);
        }
      }
    expect([...seen].some((k) => k.startsWith('interdictor'))).toBe(true);
    expect([...seen].some((k) => k.startsWith('venator'))).toBe(true);
  });
});

describe('obstacles', () => {
  it('has the planet, a little over its size', () => {
    const sys = systemById('hoth');
    const o = obstacles(sys);
    expect(o[0].c).toEqual({ x: 0, y: 0, z: 0 });
    expect(o[0].r).toBeGreaterThan(sys.body.r);
  });
  it('has the second Death Star’s shield at Endor', () => {
    const o = obstacles(systemById('endor'));
    expect(o.some((s) => s.r > 80 && Math.hypot(s.c.x, s.c.y, s.c.z) > systemById('endor').body.r)).toBe(true);
  });
});

describe('layBattle', () => {
  it('is laid out alike for everyone, from the battle’s seed', () => {
    expect(layBattle(systemById('endor'), fake('endor'))).toEqual(layBattle(systemById('endor'), fake('endor')));
  });
  it('puts each side on its team: the light side 0, the dark 1, the Hutts in the other’s place', () => {
    const lib = layBattle(systemById('scarif'), fake('scarif', 'rebel'));
    expect(lib.attacker).toBe(0);
    expect(lib.war.sides.map((s) => s.id)).toEqual(['rebel', 'empire']);
    expect(layBattle(systemById('hoth'), fake('hoth', 'empire')).attacker).toBe(1);
    const raid = layBattle(systemById('naboo'), fake('naboo', 'hutt', 'separatists'));
    expect(raid.war.sides.map((s) => s.id)).toEqual(['hutt', 'separatists']);
    expect(raid.attacker).toBe(0);
    expect(raid.war.sides[0].capitals[0].kind).toBe(HUTTS.flagship.kind);
  });
  it('colours each side its own', () => {
    const o = layBattle(systemById('kashyyyk'), fake('kashyyyk', 'republic'));
    expect(o.war.sides[0].colour).toBe(SIDES.republic.colour);
    for (const s of o.war.sides) {
      expect(s.laser).toHaveLength(3);
      expect(s.turbo).toHaveLength(3);
    }
  });
  it('an interdiction puts the objectives on the Interdictor when the dark side defends, on the flagship when the light does', () => {
    expect(layBattle(systemById('mandalore'), fake('mandalore', 'rebel')).objectivesOn).toBe('interdictor');
    expect(layBattle(systemById('mandalore'), fake('mandalore', 'empire')).objectivesOn).toBe('flagship');
    expect(layBattle(systemById('scarif'), fake('scarif', 'rebel')).objectivesOn).toBe('flagship');
  });
  it('an evacuation’s runners are the defender’s, a blockade’s the attacker’s', () => {
    const evac = layBattle(systemById('hoth'), fake('hoth', 'empire'));
    expect(evac.runners).toMatchObject({ team: 0, kind: 'transport' });
    expect(evac.runners.need).toBeLessThanOrEqual(evac.runners.count);
    const block = layBattle(systemById('naboo'), fake('naboo', 'republic'));
    expect(block.runners).toMatchObject({ team: 0 });
    expect(layBattle(systemById('scarif'), fake('scarif', 'rebel')).runners).toBeNull();
  });
  it('routes an evacuation’s and a blockade’s runners through the fight: most of the way inside it, and past the line they have to get by', () => {
    // (they ran beside it before: a blockade's from its own flagship to the
    // planet without crossing the other line, an evacuation's mostly out of
    // the fighters' reach, so they all got away untouched)
    const inside = (route, C, r) => {
      let all = 0;
      let within = 0;
      for (let i = 1; i < route.length; i++)
        for (let k = 0; k < 50; k++) {
          const p = route[i - 1].map((x, j) => x + (route[i][j] - x) * ((k + 0.5) / 50));
          const d = Math.hypot(...route[i].map((x, j) => x - route[i - 1][j])) / 50;
          all += d;
          if (Math.hypot(p[0] - C[0], p[1] - C[1], p[2] - C[2]) < r) within += d;
        }
      return within / all;
    };
    // how near the route comes to the segment of the enemy's line of capital ships
    const nearLine = (route, caps) => {
      let best = Infinity;
      for (const cap of caps)
        for (let i = 1; i < route.length; i++)
          for (let k = 0; k <= 100; k++) {
            const p = route[i - 1].map((x, j) => x + (route[i][j] - x) * (k / 100));
            best = Math.min(best, Math.hypot(p[0] - cap.pos.x, p[1] - cap.pos.y, p[2] - cap.pos.z) - cap.size * 0.3);
          }
      return best;
    };
    let n = 0;
    for (const war of WAR_IDS)
      for (const id of WAR_SYSTEMS.filter((x) => ['evacuation', 'blockade'].includes(kindFor(x)))) {
        const { liberator, raider } = WARS[war];
        for (const [att, def] of [
          [liberator, raider],
          [raider, liberator],
        ]) {
          const o = layBattle(systemById(id), fake(id, att, def, 5, war));
          const route = o.runners.route;
          expect(route.length, `${war} ${id}`).toBeGreaterThanOrEqual(3);
          expect(route[0]).toEqual(o.runners.from);
          expect(route.at(-1)).toEqual(o.runners.to);
          expect(inside(route, o.at, o.radius), `${war} ${id} ${att}`).toBeGreaterThanOrEqual(0.6);
          const b = createBattle({ ...o, perSide: 0, runners: null });
          const enemy = b.capitals.filter((c) => c.team !== o.runners.team);
          expect(nearLine(route, enemy), `${war} ${id} ${att}`).toBeLessThan(25);
          n += 1;
        }
      }
    expect(n).toBeGreaterThan(10);
  });
  it('marks the runners of a battle at Bespin and at Lothal, once the first of them is off', () => {
    const stub = () => ({ slot: (kind, size) => ({ kind, size, holder: new THREE.Group(), ready: true }), want() {}, drop() {}, update() {} });
    for (const [id, att] of [
      ['bespin', 'rebel'],
      ['lothal', 'empire'],
    ]) {
      const laid = layBattle(systemById(id), fake(id, att));
      const plan = planFor({ id: `c0.gcw.${id}.3`, kind: laid.kind, attacker: laid.attacker, runners: laid.runners });
      const d = createDirector({ plan, seed: plan.id });
      const t = plan.runners.startAt + 5;
      const b = createBattle({ ...laid, perSide: 0, plan, director: { state: () => d.state(t, () => 0) } });
      b.setYou(0);
      const parent = new THREE.Group();
      const draw = createBattleScene(parent, { models: stub(), small: true });
      draw.show(b, laid.war);
      const events = b.update(1 / 30, null);
      draw.update(1 / 30, 1, new THREE.PerspectiveCamera(), new THREE.Vector3(), events, 0);
      const r = b.runners.find((x) => x.alive);
      expect(r, id).toBeTruthy();
      const marks = parent.children.filter((o) => o.isSprite && o.renderOrder === 10);
      expect(marks.some((m) => m.position.distanceTo(new THREE.Vector3(r.seen.x, r.seen.y, r.seen.z)) < 1e-6), id).toBe(true);
      draw.dispose();
    }
  });
  it('an ambush is a smaller fight: one escort a side, more fighters', () => {
    const o = layBattle(systemById('tatooine'), fake('tatooine', 'rebel', 'hutt'), { tier: 'mid' });
    for (const s of o.war.sides) expect(s.capitals.length).toBe(2);
    expect(o.perSide).toBeGreaterThan(layBattle(systemById('scarif'), fake('scarif', 'rebel'), { tier: 'mid' }).perSide);
    expect(o.kind).toBe('ambush');
  });
  it('lays out the kind a battle asks for, if it’s one', () => {
    expect(layBattle(systemById('scarif'), { ...fake('scarif', 'rebel'), kind: 'blockade' }).kind).toBe('blockade');
    expect(layBattle(systemById('scarif'), { ...fake('scarif', 'rebel'), kind: 'nope' }).kind).toBe('siege');
  });
  it('flies the system’s aces on their sides', () => {
    const o = layBattle(systemById('hoth'), fake('hoth', 'empire'));
    expect(o.ace[1]).toMatchObject({ name: 'Darth Vader' });
    expect(o.ace[0]).toMatchObject({ kind: 'xwing' });
    const hutts = layBattle(systemById('hoth'), fake('hoth', 'hutt', 'rebel'));
    expect(hutts.ace[1] ?? null).toBeNull();
  });
  it('fights it off the planet in every war: every capital ship clear of the planet and its stations', () => {
    for (const war of WAR_IDS)
      for (const id of WAR_SYSTEMS) {
        const sys = systemById(id);
        for (const seed of [1, 2]) {
          const o = layBattle(sys, fake(id, WARS[war].liberator, null, seed, war));
          const b = createBattle({ ...o, perSide: 0, runners: null });
          for (const cap of b.capitals)
            for (const ob of obstacles(sys)) {
              const d = Math.hypot(cap.pos.x - ob.c.x, cap.pos.y - ob.c.y, cap.pos.z - ob.c.z);
              expect(d - cap.size * 0.55, `${war} ${id} ${seed} ${cap.kind}`).toBeGreaterThan(ob.r);
            }
        }
      }
  });
  it('fights a galaxy battle to its clock: no ticket end (tickets: false)', () => {
    for (const id of ['yavin', 'hoth', 'naboo', 'mandalore']) expect(layBattle(systemById(id), fake(id)).tickets, id).toBe(false);
  });
  it('sizes the battle to its ships, and gives it the shared clock', () => {
    const o = layBattle(systemById('endor'), { ...fake('endor'), start: 1000, fightEnd: 601000 }, { now: 61000 });
    expect(o.lines).toBeGreaterThanOrEqual(110 * 0.5 + 30);
    expect(o.radius).toBeGreaterThan(o.lines);
    expect(o.clock).toBe(600);
    expect(o.elapsed).toBe(60);
    expect(o.war.sides[0].capitals[0].role).toBe('flagship');
    expect(o.war.name).toBe('The Battle of Endor');
  });
  it('still lays out a battle of the old shape, with no sides (the Rebellion and the Empire)', () => {
    const o = layBattle(systemById('endor'), { id: 'c0.endor.3', sys: 'endor', step: 3, seed: 7, attacker: 'empire', start: 0, fightEnd: 600e3, end: 720e3, fighting: true });
    expect(o.attacker).toBe(1);
    expect(o.war.sides.map((s) => s.id)).toEqual(['rebel', 'empire']);
  });
});
