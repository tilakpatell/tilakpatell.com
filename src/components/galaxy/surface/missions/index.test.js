import { describe, expect, it } from 'vitest';
import { MISSIONS, endRun, missionOf, missionSite, newRun, outcomeOf, tickRun, worldOf } from './index';
import { ASSAULTS } from './assaults';
import { chooseSide, newBattle, stepBattle } from './assault';
import { STEP_TYPES } from '../quests';
import { RIDES } from '../rides';
import { buildFigure } from '../figures';
import { SURFACE_MODELS } from '../catalog';
import { PROPS } from '../props';
import { siteOf } from '../sites';
import { REACH, makeHeight } from '../terrain';
import { createSolids } from '../walker';
import { MODE_WORLDS, SYSTEMS } from '../../systems';
import { GROUNDS } from './arenas';
import { ACHIEVEMENTS } from '../../../Achievements';

describe('missions played as quests', () => {
  it('reads how a quest went from what the quest engine said', () => {
    expect(outcomeOf([{ type: 'step', step: 1 }, { type: 'done' }])).toBe('won');
    expect(outcomeOf([{ type: 'fail', why: 'time' }])).toBe('lost');
    expect(outcomeOf([{ type: 'count', count: 1, of: 3 }])).toBeNull();
    expect(outcomeOf([])).toBeNull();
  });

  it('gives every mission a ride there is (or none: on foot), and a quest mission steps the engine knows', () => {
    for (const list of Object.values(MISSIONS))
      for (const m of Object.values(list)) {
        if (m.ride) expect(RIDES[m.ride], `${m.id} ride`).toBeTruthy();
        else expect(['quest', 'assault', 'hvv', 'blast'], `${m.id} on foot`).toContain(m.kind);
        if (m.kind !== 'quest') continue;
        expect(m.quest.steps.length).toBeGreaterThan(0);
        for (const s of m.quest.steps) {
          expect(STEP_TYPES, `${m.id} ${s.type}`).toContain(s.type);
          expect(typeof s.text).toBe('string');
          for (const sp of [s.spawn].flat().filter(Boolean)) expect(Boolean(buildFigure(sp.kind) || SURFACE_MODELS[sp.kind] || PROPS[sp.kind]), `${m.id} spawn ${sp.kind}`).toBe(true);
        }
        expect(m.stars[0]).toBeLessThan(m.stars[1]);
      }
  });

  it('runs Lothal’s star map from the landing, between the spires, to the tower', () => {
    const m = missionOf('lothal', 'starmap');
    expect(m?.kind).toBe('quest');
    const site = siteOf('lothal');
    const tower = site.places.find((p) => p.id === 'tower');
    expect(tower?.things.some((t) => t.kind === 'lothtower')).toBe(true);
    const race = m.quest.steps.find((s) => s.type === 'race');
    expect(race.ride).toBe('speederbike');
    expect(race.gates.length).toBeGreaterThanOrEqual(5);
    expect(race.time).toBeGreaterThan(0);
    const last = race.gates[race.gates.length - 1];
    expect(Math.hypot(last[0] - tower.at[0], last[1] - tower.at[1])).toBeLessThan(45);
    const use = m.quest.steps.find((s) => s.type === 'use');
    expect(Math.hypot(use.at[0] - tower.at[0], use.at[1] - tower.at[1])).toBeLessThan(tower.r);
    // a bike waits at the landing for anyone, not only the mission
    expect(site.rides.some((r) => r.kind === 'speederbike')).toBe(true);
  });

  it('keeps a quest mission’s clock till it ends, then holds it', () => {
    const m = missionOf('lothal', 'starmap');
    let run = tickRun(tickRun(newRun(), 10), 5);
    expect(run).toEqual({ phase: 'run', t: 15, result: null });
    const won = endRun(run, m, 'won');
    expect(won.result).toEqual({ won: true, t: 15, stars: 3 });
    expect(tickRun(won, 5).t).toBe(15);
    expect(endRun(won, m, 'lost', 'down')).toBe(won);
    expect(endRun(run, m, 'lost', 'time').result).toEqual({ won: false, t: 15, why: 'time' });
    run = tickRun(run, m.stars[1]);
    expect(endRun(run, m, 'won').result.stars).toBe(1);
  });

  it('says how each mission ended, every way it can end', () => {
    for (const list of Object.values(MISSIONS))
      for (const m of Object.values(list)) {
        expect(typeof m.ends.won, `${m.id} won`).toBe('string');
        expect(typeof m.ends.lost, `${m.id} lost`).toBe('string');
        for (const why of m.kind === 'quest' ? ['time', 'down'] : m.kind === 'assault' ? ['posts', 'tickets'] : m.kind === 'hvv' ? ['points'] : m.kind === 'blast' ? ['kills'] : ['lost']) expect(typeof m.ends.why[why], `${m.id} ${why}`).toBe('string');
      }
  });

  it('starts every mission on foot on dry ground', () => {
    for (const list of Object.values(MISSIONS))
      for (const m of Object.values(list)) {
        if (m.ride) continue;
        const site = siteOf(m.system);
        const h = makeHeight(site.ground);
        expect(h(...m.start), `${m.id} start`).toBeGreaterThan((site.water?.level ?? -Infinity) + 0.2);
      }
  });

  it('runs Beggar’s Canyon both ways in a landspeeder, from the canyon’s mouth', () => {
    const m = missionOf('tatooine', 'canyonrun');
    expect(m?.kind).toBe('quest');
    expect(m.ride).toBe('landspeeder');
    const site = siteOf('tatooine');
    const canyon = site.places.find((p) => p.id === 'canyon');
    const [down, up] = m.quest.steps;
    expect(down.type).toBe('race');
    expect(up.type).toBe('race');
    expect(down.gates.length).toBeGreaterThanOrEqual(6);
    expect(up.gates).toEqual([...down.gates].reverse());
    // the gates run down the canyon's own pits
    for (const g of down.gates) expect(site.ground.pits.some((q) => Math.hypot(q.at[0] - g[0], q.at[1] - g[1]) < 12), `gate ${g}`).toBe(true);
    expect(Math.hypot(m.start[0] - down.gates[0][0], m.start[1] - down.gates[0][1])).toBeLessThan(60);
    expect(Math.hypot(canyon.at[0] - down.gates[0][0], canyon.at[1] - down.gates[0][1])).toBeLessThan(200);
  });

  it('runs Hoth’s first transport from its ramp to the ion cannon, on foot', () => {
    const m = missionOf('hoth', 'transport');
    expect(m?.kind).toBe('quest');
    expect(m.ride).toBeFalsy();
    const site = siteOf('hoth');
    const transport = site.things_all.find((t) => t.kind === 'gr75');
    const cannon = site.places.find((p) => p.id === 'ioncannon');
    const near = (a, b, r) => Math.hypot(a[0] - b[0], a[1] - b[1]) < r;
    expect(near(m.start, transport.at, 60)).toBe(true);
    expect(m.quest.steps[0].type).toBe('use');
    expect(near(m.quest.steps[0].at, transport.at, 40)).toBe(true);
    expect(m.quest.steps.some((s) => s.type === 'shoot' && s.spawn.kind === 'snowtrooper')).toBe(true);
    const last = m.quest.steps.at(-1);
    expect(last.type).toBe('use');
    expect(near(last.at, cannon.at, cannon.r)).toBe(true);
    expect(last.end.some((e) => e.signal === 'fire')).toBe(true);
    // (and the run there is against the clock)
    expect(m.quest.steps.find((s) => s.type === 'reach').time).toBeGreaterThan(0);
  });

  it('holds Sorgan’s village against the raiders and their walker, then tells Omera', () => {
    const m = missionOf('sorgan', 'sanctuary');
    expect(m?.kind).toBe('quest');
    expect(m.ride).toBeFalsy();
    const site = siteOf('sorgan');
    const village = site.places.find((p) => p.id === 'village');
    const near = (a, b, r) => Math.hypot(a[0] - b[0], a[1] - b[1]) < r;
    expect(near(m.start, village.at, village.r)).toBe(true);
    const [raiders, walker, talk] = m.quest.steps;
    expect(raiders.type).toBe('shoot');
    expect(raiders.spawn.n).toBe(6);
    expect(near(raiders.spawn.at, village.at, 120)).toBe(true);
    expect(walker.spawn.kind).toBe('atst');
    expect(walker.time).toBeGreaterThan(0);
    expect(talk.type).toBe('talk');
    expect(site.life.some((a) => a.id === talk.actor)).toBe(true);
  });

  it('gives every mission a live link from its system’s briefing', () => {
    for (const [system, list] of Object.entries(MISSIONS))
      for (const m of Object.values(list)) {
        const sys = SYSTEMS.find((s) => s.id === system);
        // (the briefing's own game, or another mission it carries beside it: game.also,
        // which the briefing shows whether or not its own game is live yet)
        const also = (sys.game.also ?? []).map((a) => a.to);
        const links = [sys.game.to, ...also];
        expect(links, `${system} ${m.id}`).toContain(`/galaxy/${system}/surface?mission=${m.id}`);
        if (!also.includes(`/galaxy/${system}/surface?mission=${m.id}`)) expect(sys.game.status, `${system} ${m.id}`).toBe('live');
        if (m.achievement) expect(ACHIEVEMENTS[m.achievement], `${m.id} achievement`).toBeTruthy();
      }
  });

  it('runs Dagobah’s swamp from the camp to the cave, then raises the X-wing', () => {
    const m = missionOf('dagobah', 'raise');
    expect(m?.kind).toBe('quest');
    expect(m.ride).toBeFalsy();
    const site = siteOf('dagobah');
    const at = (id) => site.places.find((p) => p.id === id).at;
    const near = (a, b, r) => Math.hypot(a[0] - b[0], a[1] - b[1]) < r;
    expect(near(m.start, at('camp'), 20)).toBe(true);
    const race = m.quest.steps[0];
    expect(race.type).toBe('race');
    expect(race.ride).toBeFalsy();
    expect(race.gates.length).toBe(6);
    expect(near(race.gates.at(-1), at('cave'), 25)).toBe(true);
    expect(m.quest.steps.some((s) => s.type === 'shoot' && near(s.spawn.at, at('cave'), 20))).toBe(true);
    const last = m.quest.steps.at(-1);
    expect(last.type).toBe('use');
    expect(near(last.at, at('xwing'), 12)).toBe(true);
    expect(last.end.some((e) => e.signal === 'raise')).toBe(true);
    // (and Again puts it back in the bog)
    expect(m.reset.some((e) => e.signal === 'raise' && e.on === false)).toBe(true);
  });
});

describe('the galactic assaults', () => {
  const kindThere = (kind) => Boolean(buildFigure(kind) || SURFACE_MODELS[kind] || PROPS[kind]);
  for (const [system, m] of Object.entries(ASSAULTS)) {
    describe(system, () => {
      const site = siteOf(system);
      const h = makeHeight(site.ground);
      it('is the system’s, reached as a mission there', () => {
        expect(missionOf(system, 'assault')).toBe(m);
        expect(m.kind).toBe('assault');
        expect(m.system).toBe(system);
        expect(m.ride).toBeNull();
        expect(m.achievement).toBe('galacticassault');
      });
      it('stands its posts on dry, level ground within reach', () => {
        for (const p of m.posts) {
          expect(Math.hypot(...p.at) + p.r, p.id).toBeLessThan(REACH);
          // (a post that says `wade` is in the shallows: knee-deep at most)
          if (p.wade) expect(h(...p.at), p.id).toBeGreaterThan((site.water?.level ?? -Infinity) - 0.8);
          else expect(h(...p.at), p.id).toBeGreaterThan((site.water?.level ?? -Infinity) + 0.2);
          // (level enough to walk: the slope across its middle and at its edge)
          for (const [x, z] of [p.at, [p.at[0] + p.r * 0.7, p.at[1]], [p.at[0], p.at[1] + p.r * 0.7]]) {
            const slope = Math.hypot(h(x + 2, z) - h(x - 2, z), h(x, z + 2) - h(x, z - 2)) / 4;
            expect(slope, p.id).toBeLessThan(0.3);
          }
        }
        const ids = m.posts.map((p) => p.id);
        expect(new Set(ids).size).toBe(ids.length);
      });
      it('gives each side a fixed post, and its phases every other post once', () => {
        for (const side of ['attack', 'defend']) expect(m.posts.filter((p) => p.fixed === side), side).toHaveLength(1);
        const taken = m.phases.flatMap((ph) => ph.posts);
        const free = m.posts.filter((p) => !p.fixed).map((p) => p.id);
        expect([...taken].sort()).toEqual([...free].sort());
        for (const ph of m.phases) {
          expect(ph.name).toBeTruthy();
          expect(ph.tickets).toBeGreaterThan(0);
        }
        expect(m.tickets.attack).toBeGreaterThan(0);
        expect(m.tickets.defend).toBeGreaterThanOrEqual(m.tickets.attack);
      });
      it('fields soldiers there are figures for, and hides the world’s own of them', () => {
        for (const side of ['attack', 'defend']) {
          const s = m.sides[side];
          for (const k of ['id', 'name', 'short']) expect(typeof s[k], `${side}.${k}`).toBe('string');
          expect(s.colour).toMatch(/^#[0-9a-f]{6}$/i);
          for (const [kind, w] of s.kinds) {
            expect(kindThere(kind), kind).toBe(true);
            expect(w).toBeGreaterThan(0);
          }
        }
        for (const kind of m.hideLife) expect(site.life.some((a) => a.kind === kind), `${kind} in the life`).toBe(true);
        expect(m.sides.attack.colour).not.toBe(m.sides.defend.colour);
      });
      it('has words for the crews and the sides', () => {
        for (const when of ['start', 'won', 'lost']) for (const crew of ['xwing', 'falcon', 'cruiser', 'rv']) expect(m.lines[when][crew]?.length, `${when} ${crew}`).toBeGreaterThan(0);
        for (const side of ['attack', 'defend']) expect(m.barks[side].length).toBeGreaterThan(1);
        expect(typeof m.line).toBe('string');
      });
      it('plays out on its own ground within fifteen minutes, either way', () => {
        // (the posts alone as solids: the site's things are placed in the
        // browser; here the field is open, so the walk and the fight decide)
        const env = { solids: createSolids(), reach: site.reach };
        // (the phases' top-ups off, so the pockets alone decide)
        for (const [tickets, won] of [
          [{ attack: 300, defend: 10 }, true],
          [{ attack: 10, defend: 300 }, false],
        ]) {
          const b = newBattle({ ...m, tickets, phases: m.phases.map((ph) => ({ ...ph, tickets: 0 })) }, { n: 6, seed: 3 });
          chooseSide(b, 'attack');
          for (let t = 0; t < 900 && !b.result; t += 0.1) stepBattle(b, 0.1, null, env);
          expect(b.result?.won, `${JSON.stringify(tickets)}`).toBe(won);
        }
      });
    });
  }
});

describe('Heroes vs Villains and Blast', () => {
  it('runs on every world whose level has their grounds, each briefing listing them', () => {
    expect([...GROUNDS].sort()).toEqual([...MODE_WORLDS].sort());
    for (const w of GROUNDS) for (const id of ['hvv', 'blast']) expect(missionOf(w, id)?.kind, `${w} ${id}`).toBe(id);
  });
  for (const w of GROUNDS) {
    const site = siteOf(w);
    const h = makeHeight(site.ground);
    it(`plays ${w}’s two grounds on dry land within reach, fielding soldiers there are figures for`, () => {
      for (const id of ['hvv', 'blast']) {
        const m = missionOf(w, id);
        expect(Math.hypot(...m.start), id).toBeLessThan(REACH);
        expect(h(...m.start), id).toBeGreaterThan((site.water?.level ?? -Infinity) + 0.2);
        for (const when of ['start', 'won', 'lost']) for (const crew of ['xwing', 'falcon', 'cruiser', 'rv']) expect(m.lines[when][crew]?.length, `${id} ${when} ${crew}`).toBeGreaterThan(0);
      }
      const blast = missionOf(w, 'blast');
      for (const side of ['attack', 'defend']) for (const [kind] of blast.sides[side].kinds) expect(Boolean(buildFigure(kind) || SURFACE_MODELS[kind] || PROPS[kind]), kind).toBe(true);
      for (const p of blast.posts) expect(Math.hypot(...p.at) + p.r, p.id).toBeLessThan(REACH);
    });
  }
});

// A mission may lay its own sky over the site's (the Purge Planet's night):
// only while it runs, so the next landing has the site's own again.
describe('a mission’s own sky, light, fog and weather', () => {
  const NIGHT = { top: '#02030a', horizon: '#0a0d1c', suns: [] };
  const base = siteOf('tatooine');

  it('lays the mission’s over the site’s, and leaves the rest as the site has it', () => {
    const site = missionSite(base, { id: 'night', site: { sky: NIGHT, weather: [{ kind: 'ash' }], ground: 'not this' } });
    expect(site.sky).toBe(NIGHT);
    expect(site.weather).toEqual([{ kind: 'ash' }]);
    expect(site.light).toBe(base.light);
    expect(site.fog).toBe(base.fog);
    expect(site.ground).toBe(base.ground);
  });

  it('gives the site itself back for a mission with nothing to lay over it, or none', () => {
    expect(missionSite(base, MISSIONS.endor.chase)).toBe(base);
    expect(missionSite(base, null)).toBe(base);
  });

  it('builds the world again with the site’s own sky once the mission is left', () => {
    const spec = { id: 'night', kind: 'quest', site: { sky: NIGHT } };
    const first = worldOf({ site: base, missionSpec: spec });
    expect(first.mission).toBe(spec);
    expect(first.site.sky).toBe(NIGHT);
    const second = worldOf({ site: base });
    expect(second.mission).toBeNull();
    expect(second.site.sky).toBe(base.sky);
    expect(base.sky).not.toBe(NIGHT);
  });

  it('looks the site and the mission up by system when neither is handed in', () => {
    const w = worldOf({ system: 'endor', mission: 'chase' });
    expect(w.site).toEqual(siteOf('endor'));
    expect(w.mission).toBe(MISSIONS.endor.chase);
    expect(worldOf({ system: 'endor' }).mission).toBeNull();
    expect(worldOf({ system: 'nowhere' }).site).toBeNull();
  });
});
