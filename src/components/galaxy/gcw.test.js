import { describe, expect, it } from 'vitest';
import { TALLY, createTally, readTally } from '../universe/tally';
import { GCW, NEIGHBOURS, WAR_SYSTEMS, areaBonusOf, pressureOn, areaOf, battleAt, campaignAt, campaignResult, campaignRun, history, opening, pointsKey, readKey, runAt, scoresAt, seeded, supplyOf, warTable, warTables, winKey, worthOf } from './gcw';
import { frontPace, lean, orderOver, supplied } from './gcwAI';
import { AREAS, DOCTRINE, WARS, WAR_IDS } from './sides';
import { LANES, systemById } from './systems';
import { CAP, KEYS } from './warState';

const none = () => 0;
const H = 3600e3;
const at = (n, ms) => GCW.start + n * GCW.campaign + ms;
const stepAt = (ms) => campaignAt(ms).step;
const atStep = (n, k, past = 0) => at(n, k * GCW.step + past);
const countOf = (owner) => {
  const c = {};
  for (const id of WAR_SYSTEMS) c[owner[id]] = (c[owner[id]] ?? 0) + 1;
  return c;
};
const quietAt = (s, id) => !s.fronts.includes(id) && !s.attacks.some((a) => a.sys === id);
const TOTAL_WORTH = WAR_SYSTEMS.reduce((t, id) => t + worthOf(id), 0);
// a busy campaign's tally: both sides' pilots somewhere every step, now and then winning
const busyTally = (war, seed = 'busy') => {
  const t = createTally('c0', { keys: KEYS, cap: CAP });
  const rand = seeded(seed);
  const sides = [WARS[war].liberator, WARS[war].raider];
  for (let i = 0; i < 1500; i++) {
    const k = Math.floor(rand() * (GCW.campaign / GCW.step));
    const side = sides[i % 2];
    const sys = WAR_SYSTEMS[Math.floor(rand() * WAR_SYSTEMS.length)];
    if (i % 7 === 0) t.add(winKey(side, sys, k), 1);
    else t.add(pointsKey(side, sys, k), 1 + Math.floor(rand() * 40));
  }
  return t;
};

describe('the war’s map', () => {
  it('is every system with a planet but Dagobah', () => {
    expect(WAR_SYSTEMS).toContain('endor');
    expect(WAR_SYSTEMS).toContain('hoth');
    expect(WAR_SYSTEMS).toContain('scarif');
    expect(WAR_SYSTEMS).not.toContain('dagobah');
    expect(WAR_SYSTEMS).not.toContain('alderaan');
  });
  it('has neighbours both ways, two at least each, and all of it joined up', () => {
    for (const id of WAR_SYSTEMS) {
      expect(NEIGHBOURS[id].length, id).toBeGreaterThanOrEqual(2);
      for (const o of NEIGHBOURS[id]) expect(NEIGHBOURS[o], `${o} → ${id}`).toContain(id);
    }
    const seen = new Set(['yavin']);
    const todo = ['yavin'];
    while (todo.length) for (const o of NEIGHBOURS[todo.pop()]) if (!seen.has(o)) (seen.add(o), todo.push(o));
    expect(seen.size).toBe(WAR_SYSTEMS.length);
  });
  it('every route’s systems are a chain in NEIGHBOURS', () => {
    let chained = 0;
    for (const lane of LANES) {
      const seq = [];
      for (const p of lane.pts) {
        let best = null;
        let bd = Infinity;
        for (const id of WAR_SYSTEMS) {
          const s = systemById(id);
          const d = Math.hypot(s.pos[0] - p[0], s.pos[1] - p[1]);
          if (d < bd) (bd = d), (best = id);
        }
        if (bd <= GCW.routeReach && seq[seq.length - 1] !== best) seq.push(best);
      }
      for (let i = 1; i < seq.length; i++) {
        expect(NEIGHBOURS[seq[i - 1]], `${lane.id}: ${seq[i - 1]} → ${seq[i]}`).toContain(seq[i]);
        chained++;
      }
    }
    expect(chained).toBeGreaterThan(5);
  });
  it('puts every war system in an area, and has worth for it', () => {
    for (const id of WAR_SYSTEMS) {
      expect(AREAS.map((a) => a.id), id).toContain(areaOf(id));
      expect([1, 2, 3], id).toContain(worthOf(id));
    }
    expect(worthOf('coruscant')).toBe(3);
  });
  it('opens each war on its own map, every system whole', () => {
    for (const war of WAR_IDS) {
      const o = opening(war);
      const w = WARS[war];
      for (const id of WAR_SYSTEMS) {
        const named = Object.entries(w.opening).find(([, ids]) => ids.includes(id))?.[0];
        expect(o.owner[id], `${war}: ${id}`).toBe(named ?? w.raider);
        expect(o.control[id]).toBe(1);
      }
    }
    expect(opening('gcw').owner.yavin).toBe('rebel');
    expect(opening('clone').owner.geonosis).toBe('separatists');
    expect(opening('remnant').owner.tatooine).toBe('hutt');
  });
});

describe('the tally’s keys', () => {
  it('carry the side', () => {
    expect(pointsKey('rebel', 'hoth', 3)).toBe('reb:hoth:3');
    expect(winKey('separatists', 'naboo', 12)).toBe('win:sep:naboo:12');
    expect(readKey('imp:endor:7')).toEqual({ side: 'empire', war: 'gcw', win: false, sys: 'endor', step: 7 });
    expect(readKey('win:nr:lothal:2')).toEqual({ side: 'newrepublic', war: 'remnant', win: true, sys: 'lothal', step: 2 });
  });
  it('a key of the old shape is the Rebellion’s', () => {
    expect(readKey('hoth:12')).toEqual({ side: 'rebel', war: 'gcw', win: false, sys: 'hoth', step: 12 });
    expect(readKey('win:hoth:12')).toEqual({ side: 'rebel', war: 'gcw', win: true, sys: 'hoth', step: 12 });
  });
  it('anything else is nobody’s', () => {
    for (const k of ['', 'zzz:hoth:1', 'reb:nowhere:1', 'reb:hoth:x', 'win:hoth', 'reb:hoth:1:2']) expect(readKey(k), k).toBeNull();
  });
});

describe('campaignAt', () => {
  it('gives every pilot the same campaign and step for the same moment', () => {
    const c = campaignAt(at(2, 5 * H + 13 * 60e3));
    expect(c.n).toBe(2);
    expect(c.step).toBe(Math.floor((5 * H + 13 * 60e3) / GCW.step));
    expect(c.stepStart).toBe(at(2, c.step * GCW.step));
    expect(c.end).toBe(at(3, 0));
    expect(c.epoch).toBe('c2');
  });
});

describe('history', () => {
  it('is the same every time for the same moment and tally', () => {
    for (const war of WAR_IDS) expect(history(war, 1, at(1, 20 * H), none)).toEqual(history(war, 1, at(1, 20 * H), none));
  });
  it('has fronts where the liberator borders anyone else’s, no more than GCW.fronts: its order first, then the worthiest', () => {
    // (the major order was simply the worthiest front, so it sat on Coruscant
    // or Scarif for days; now the liberator gives an order of its own each
    // window, by its doctrine, and works it first, the rest still worthiest
    // first, and the major is still the first front)
    for (const war of WAR_IDS) {
      const s = history(war, 0, at(0, 30 * 60e3), none);
      const lib = WARS[war].liberator;
      expect(s.fronts.length, war).toBeGreaterThan(0);
      expect(s.fronts.length).toBeLessThanOrEqual(GCW.fronts);
      for (const f of s.fronts) {
        expect(s.owner[f]).not.toBe(lib);
        expect(NEIGHBOURS[f].some((o) => s.owner[o] === lib), f).toBe(true);
      }
      expect(s.fronts[0]).toBe(s.orders[lib].sys);
      const worths = s.fronts.slice(1).map(worthOf);
      expect(worths).toEqual([...worths].sort((a, b) => b - a));
      expect(s.major).toBe(s.fronts[0]);
    }
  });
  it('a Hutt world bordering the liberator is a front, sooner or later', () => {
    let found = false;
    for (let n = 0; n < 12 && !found; n++)
      for (const war of WAR_IDS)
        for (let h = 0; h < 72 && !found; h += 6) {
          const s = history(war, n, at(n, h * H), none);
          if (s.fronts.some((f) => s.owner[f] === 'hutt')) found = true;
        }
    expect(found).toBe(true);
  });
  it('moves both ways on its own: over campaigns the liberator takes systems and loses some', () => {
    for (const war of WAR_IDS) {
      const lib = WARS[war].liberator;
      let taken = 0;
      let lost = 0;
      for (let n = 0; n < 6; n++) {
        const s = history(war, n, at(n, GCW.campaign - 1), none);
        const o = opening(war);
        for (const id of WAR_SYSTEMS) {
          if (o.owner[id] !== lib && s.owner[id] === lib) taken++;
          if (o.owner[id] === lib && s.owner[id] !== lib) lost++;
        }
      }
      expect(taken, war).toBeGreaterThan(0);
      expect(lost, war).toBeGreaterThan(0);
    }
  });
  it('opens with the raider’s strike at GCW.strike, so the first day moves', () => {
    for (const war of WAR_IDS) {
      const { raider } = WARS[war];
      expect(history(war, 0, atStep(0, GCW.strike, -60e3), none).attacks.some((x) => x.by === raider), war).toBe(false);
      const a = history(war, 0, atStep(0, GCW.strike, 60e3), none).attacks.find((x) => x.by === raider);
      expect(a, war).toBeTruthy();
      expect(a.from).toBe(atStep(0, GCW.strike));
    }
  });
  it('ends every attack and raid by the campaign’s end', () => {
    // (one launched in the campaign's last hour and a half once ran on past it,
    // so the card gave longer to hold out than the campaign had left)
    let late = 0;
    for (const war of WAR_IDS)
      for (let n = 0; n < 6; n++) {
        const end = at(n + 1, 0);
        const run = campaignRun(war, n, none);
        for (let k = 330; k < GCW.campaign / GCW.step; k++)
          for (const a of runAt(run, atStep(n, k, 60e3)).attacks) {
            expect(a.until, `${war} c${n} ${k} ${a.sys}`).toBeLessThanOrEqual(end);
            if (a.from > end - (a.by === 'hutt' ? GCW.raidFor : GCW.attackFor)) late += 1;
          }
      }
    expect(late).toBeGreaterThan(0);
  });
  it('sends the raider against a border system every so often, for GCW.attackFor', () => {
    for (const war of WAR_IDS) {
      const { raider } = WARS[war];
      const s = history(war, 0, at(0, GCW.attackEvery + 60e3), none);
      const a = s.attacks.find((x) => x.by === raider);
      expect(a, war).toBeTruthy();
      expect(s.owner[a.sys]).not.toBe(raider);
      expect(NEIGHBOURS[a.sys].some((o) => s.owner[o] === raider)).toBe(true);
      expect(a.until - a.from).toBe(GCW.attackFor);
    }
  });
  it('the Hutts raid a main side’s system on Hutt space’s border', () => {
    let raids = 0;
    for (let n = 0; n < 6; n++)
      for (const war of WAR_IDS) {
        const s = history(war, n, at(n, GCW.raidEvery + 60e3), none);
        const a = s.attacks.find((x) => x.by === 'hutt');
        if (!a) continue;
        raids++;
        expect(s.owner[a.sys]).not.toBe('hutt');
        expect(NEIGHBOURS[a.sys].some((o) => s.owner[o] === 'hutt')).toBe(true);
        expect(a.until - a.from).toBe(GCW.raidFor);
      }
    expect(raids).toBeGreaterThan(0);
  });
  it('sends the raider at a Hutt world only where the attack would take it: left alone, every one does', () => {
    // (the Hutts halve any attack, and a counter-attack went at once at what
    // they'd taken, held at 0.7: 14 to 18% of the raider's attacks went at
    // Hutt worlds and failed, nearly all of them counters or with nothing it
    // could take anywhere on its border)
    let taken = 0;
    for (let n = 0; n < 6; n++)
      for (const war of WAR_IDS) {
        const { raider } = WARS[war];
        const run = campaignRun(war, n, none);
        for (let k = 1; k < GCW.campaign / GCW.step; k++) {
          const s = runAt(run, atStep(n, k));
          if (s.over) break;
          // (what happened in the step before, whole now)
          for (const e of s.events.filter((x) => x.k === k - 1 && x.by === raider)) {
            if (e.type === 'repelled') expect(e.holder, `${war} c${n} ${k - 1} ${e.sys}`).not.toBe('hutt');
            if (e.type === 'captured' && e.from === 'hutt') taken += 1;
          }
        }
      }
    expect(taken).toBeGreaterThan(0);
  });
  it('the Hutts can take a system, and the raider can take a Hutt world', () => {
    let hutts = 0;
    let fromHutts = 0;
    for (let n = 0; n < 20; n++)
      for (const war of WAR_IDS) {
        const o = opening(war);
        const s = history(war, n, at(n, GCW.campaign - 1), none);
        for (const id of WAR_SYSTEMS) {
          if (o.owner[id] !== 'hutt' && s.owner[id] === 'hutt') hutts++;
          if (o.owner[id] === 'hutt' && s.owner[id] === WARS[war].raider) fromHutts++;
        }
      }
    expect(hutts).toBeGreaterThan(0);
    expect(fromHutts).toBeGreaterThan(0);
  });
  it('takes a front’s hold down by what the liberator’s pilots did there', () => {
    const ms = at(0, 30 * 60e3);
    const s0 = history('gcw', 0, ms, none);
    const f = s0.fronts.find((id) => s0.control[id] > 0.5);
    const s1 = history('gcw', 0, ms, (k) => (k === pointsKey('rebel', f, stepAt(ms)) ? 20 : 0));
    expect(s1.control[f]).toBeCloseTo(s0.control[f] - 0.2, 5);
  });
  it('the holder’s pilots push back: Imperial points at a front keep it the Empire’s', () => {
    const ms = at(0, 30 * 60e3);
    const s0 = history('gcw', 0, ms, none);
    const f = s0.fronts.find((id) => s0.control[id] > 0.5);
    const k = stepAt(ms);
    const rebelsOnly = history('gcw', 0, ms, (key) => (key === pointsKey('rebel', f, k) ? 30 : 0));
    const both = history('gcw', 0, ms, (key) => (key === pointsKey('rebel', f, k) ? 30 : key === pointsKey('empire', f, k) ? 10 : 0));
    expect(both.control[f]).toBeCloseTo(rebelsOnly.control[f] + 0.1, 5);
  });
  it('a key of the old shape counts as the Rebellion’s in the Civil War, and nowhere else', () => {
    const ms = at(0, 30 * 60e3);
    const k = stepAt(ms);
    const s0 = history('gcw', 0, ms, none);
    const f = s0.fronts.find((id) => s0.control[id] > 0.5);
    const old = history('gcw', 0, ms, (key) => (key === `${f}:${k}` ? 20 : 0));
    const now = history('gcw', 0, ms, (key) => (key === pointsKey('rebel', f, k) ? 20 : 0));
    expect(old.control[f]).toBe(now.control[f]);
    expect(history('clone', 0, ms, (key) => (key === `${f}:${k}` ? 20 : 0))).toEqual(history('clone', 0, ms, none));
  });
  it('counts a battle won once, for the side that won it', () => {
    const ms = at(0, 30 * 60e3);
    const k = stepAt(ms);
    const s0 = history('gcw', 0, ms, none);
    const f = s0.fronts.find((id) => s0.control[id] > 0.5);
    const one = history('gcw', 0, ms, (key) => (key === winKey('rebel', f, k) ? 1 : 0));
    const three = history('gcw', 0, ms, (key) => (key === winKey('rebel', f, k) ? 3 : 0));
    expect(one.control[f]).toBeCloseTo(s0.control[f] - GCW.points.win / 100, 5);
    expect(three.control[f]).toBe(one.control[f]);
    const held = history('gcw', 0, ms, (key) => (key === winKey('rebel', f, k) ? 1 : key === winKey('empire', f, k) ? 1 : 0));
    expect(held.control[f]).toBeCloseTo(s0.control[f], 5);
  });
  it('gives a front to the liberator when its hold is gone, held at GCW.captured', () => {
    // (it came in whole; a system just taken is held at GCW.captured now, so
    // it can be fought back for, and a step's points count for no more than
    // GCW.playerCap, so the pilots take three steps over it, not one)
    const ms = at(0, 30 * 60e3);
    const s0 = history('clone', 0, ms, none);
    const f = s0.fronts[0];
    const s1 = history('clone', 0, ms, (key) => ([0, 1, 2].some((k) => key === pointsKey('republic', f, k)) ? 100 : 0));
    expect(s1.owner[f]).toBe('republic');
    expect(s1.control[f]).toBe(GCW.captured);
    expect(GCW.captured).toBe(0.7);
  });
  it('loses an attacked system at 0, gives one held to the end GCW.repelled back, and players can save one', () => {
    // (one held to the end was whole again; now it gets GCW.repelled back,
    // so a dented system can be finished off later, or fought for)
    // (the Empire's attacks every four hours of the first campaigns: the ones
    // at four hours alone were all at whole systems, most of them Hoth, a
    // stronghold that holds out longer, and none fell)
    const cases = [];
    for (let n = 0; n < 10 && !cases.some((c) => c.fell && c.holder === 'rebel'); n++)
      for (let t = GCW.attackEvery; t < GCW.campaign - GCW.attackFor; t += GCW.attackEvery) {
        const s = history('gcw', n, at(n, t + 60e3), none);
        const a = s.attacks.find((x) => x.by === 'empire' && !cases.some((c) => c.n === n && c.attack.from === x.from));
        if (!a) continue;
        const after = history('gcw', n, a.until + 1, none);
        cases.push({ n, sys: a.sys, holder: s.owner[a.sys], fell: after.owner[a.sys] === 'empire', after, attack: a });
      }
    // (one of the Rebellion's that fell: the Hutts have no pilots to save theirs)
    const fell = cases.find((c) => c.fell && c.holder === 'rebel');
    const held = cases.find((c) => !c.fell);
    expect(fell).toBeTruthy();
    expect(held).toBeTruthy();
    const before = history('gcw', held.n, held.attack.until - 1, none);
    expect(held.after.control[held.sys]).toBeCloseTo(Math.min(1, before.control[held.sys] + GCW.repelled), 3);
    expect(GCW.repelled).toBe(0.25);
    const steps = [];
    for (let ms = fell.attack.from; ms < fell.attack.until; ms += GCW.step) steps.push(stepAt(ms));
    const saved = history('gcw', fell.n, fell.attack.until + 1, (k) => (steps.some((st) => k === pointsKey(fell.holder, fell.sys, st)) ? 30 : 0));
    expect(saved.owner[fell.sys]).toBe(fell.holder);
  });
  it('is the same for two pilots who’ve told each other a busy campaign, a message at a time, and counts its newest points', () => {
    const ms = at(0, 36 * H);
    const last = stepAt(ms);
    const a = createTally('c0', { keys: KEYS, cap: CAP });
    const b = createTally('c0', { keys: KEYS, cap: CAP });
    // each fights somewhere every step: the Rebels' pilot and the Empire's
    const rand = seeded('two pilots');
    const somewhere = () => WAR_SYSTEMS[Math.floor(rand() * WAR_SYSTEMS.length)];
    for (let k = 0; k < last; k++) {
      a.add(pointsKey('rebel', somewhere(), k), 1 + Math.floor(rand() * 20));
      b.add(pointsKey('empire', somewhere(), k), 1 + Math.floor(rand() * 20));
      if (k % 5 === 0) a.add(winKey('rebel', somewhere(), k), 1);
    }
    expect(a.keys().length + b.keys().length).toBeGreaterThan(3 * TALLY.keys);
    // and the newest: the Rebels' pilot hits the major order hard
    const s0 = history('gcw', 0, ms, (k) => a.value(k) + b.value(k));
    const f = s0.major;
    a.add(pointsKey('rebel', f, last), CAP);
    const talk = (rounds) => {
      for (let r = 0; r < rounds; r++) {
        const fromA = readTally(JSON.parse(JSON.stringify(a.message())));
        const fromB = readTally(JSON.parse(JSON.stringify(b.message())));
        b.receive('a', fromA);
        a.receive('b', fromB);
      }
    };
    talk(12);
    const forA = history('gcw', 0, ms, (k) => a.value(k));
    expect(history('gcw', 0, ms, (k) => b.value(k))).toEqual(forA);
    expect(b.value(pointsKey('rebel', f, last))).toBe(CAP);
    expect(forA.owner[f] !== s0.owner[f] || forA.control[f] < s0.control[f]).toBe(true);
  });
  it('throws no attack or raid at a side’s last stand before the Climax: it can’t fall', () => {
    // (one side's pilots everywhere, so the others are soon down to their last
    // stands; each side's count is followed from the news, a step at a time)
    let stands = 0;
    for (const [war, code] of [
      ['clone', 'rep:'],
      ['gcw', 'imp:'],
      ['remnant', 'nr:'],
    ]) {
      const run = campaignRun(war, 0, (key) => (key.startsWith(code) ? 100 : 0));
      const count = countOf(opening(war).owner);
      for (let k = 0; k < GCW.phases.at(-1).from; k++) {
        const s = runAt(run, atStep(0, k, 60e3));
        // (an operation's launched as its step begins, on the count the steps before left)
        for (const e of s.events.filter((x) => x.k === k && (x.type === 'attack' || x.type === 'raid'))) {
          expect(count[e.holder], `${war} ${k} ${e.by} at ${e.sys}`).toBeGreaterThan(GCW.lastStand);
          stands += Object.values(count).filter((c) => c === GCW.lastStand).length;
        }
        // (and what fell in this step is known for sure once it's whole: at the next)
        for (const e of runAt(run, atStep(0, k + 1, 60e3)).events.filter((x) => x.k === k && x.type === 'captured')) {
          count[e.from] -= 1;
          count[e.by] = (count[e.by] ?? 0) + 1;
        }
      }
    }
    expect(stands).toBeGreaterThan(0);
  });
  it('ends a war when one side holds every system, but not before the Climax: each side’s last stand holds till then', () => {
    // (it ended at 30 h with the Republic's pilots everywhere; now a side's
    // last system holds out till the Climax, so it ends then, at 70 h)
    const all = (k) => (k.startsWith('rep:') ? 100 : 0);
    for (const h of [30, 65]) {
      const early = history('clone', 0, at(0, h * H), all);
      expect(early.over, `${h} h`).toBeNull();
      for (const side of ['separatists', 'hutt']) expect(WAR_SYSTEMS.some((id) => early.owner[id] === side), `${h} h: ${side}`).toBe(true);
    }
    const s = history('clone', 0, at(0, 70 * H), all);
    expect(s.over).toBe('republic');
    // (a war won outright is over: its result's final at once)
    expect(s.result).toEqual({ winner: 'republic', vp: s.vp, decisive: s.result.decisive, over: 'republic', final: true });
    expect(s.step).toBeGreaterThanOrEqual(GCW.phases.at(-1).from);
    for (const id of WAR_SYSTEMS) expect(s.owner[id]).toBe('republic');
    expect(history('clone', 0, at(0, 70 * H), none).over).toBeNull();
  });
  it('tells of every system taken as it happens, once, with when', () => {
    for (const war of WAR_IDS) {
      let prev = opening(war).owner;
      let changes = 0;
      for (let k = 1; k <= 120; k++) {
        const s = history(war, 2, atStep(2, k), none);
        for (const id of WAR_SYSTEMS) if (s.owner[id] !== prev[id]) changes += 1;
        prev = s.owner;
      }
      const s = history(war, 2, atStep(2, 120), none);
      const taken = s.events.filter((e) => e.type === 'captured');
      expect(s.events.length, war).toBeLessThan(64);
      expect(taken.length, war).toBe(changes);
      for (const e of s.events) expect(e.at).toBe(atStep(2, e.k));
      for (const e of taken) expect(e.by).not.toBe(e.from);
      expect(history(war, 2, atStep(2, 120), none).events).toEqual(s.events);
    }
  });
  it('sends each attack from a system of the attacker’s next to its target', () => {
    let seen = 0;
    for (const war of WAR_IDS)
      for (let n = 0; n < 3; n++)
        for (let h = 1; h < 72; h += 5) {
          const s = history(war, n, at(n, h * H), none);
          for (const a of s.attacks) {
            seen += 1;
            expect(NEIGHBOURS[a.sys]).toContain(a.origin);
            expect(history(war, n, a.from, none).owner[a.origin], `${war} ${n} ${a.sys}`).toBe(a.by);
          }
          for (const e of s.events) if (e.type === 'attack' || e.type === 'raid') expect(NEIGHBOURS[e.sys]).toContain(e.origin);
        }
    expect(seen).toBeGreaterThan(10);
  });
  it('counts each side’s systems and worth every six hours and now, from the opening', () => {
    for (const war of WAR_IDS) {
      const s = history(war, 1, at(1, 40 * H + 60e3), none);
      const o = countOf(opening(war).owner);
      expect(s.counts.map((c) => c.k)).toEqual([0, 30, 60, 90, 120, 150, 180, 200]);
      for (const side of Object.keys(o)) expect(s.counts[0][side]).toBe(o[side]);
      for (const c of s.counts) {
        const sides = [WARS[war].liberator, WARS[war].raider, 'hutt'];
        expect(sides.reduce((t, x) => t + (c[x] ?? 0), 0)).toBe(WAR_SYSTEMS.length);
        expect(sides.reduce((t, x) => t + (c.worth[x] ?? 0), 0)).toBe(TOTAL_WORTH);
      }
      const now = countOf(s.owner);
      for (const side of Object.keys(now)) expect(s.counts.at(-1)[side]).toBe(now[side]);
    }
  });
  it('in a campaign’s first six hours, gives each side’s trend against the opening', () => {
    // (the opening's count was once the running count itself, moved by every
    // capture, so the trend read nothing all through the first six hours)
    let moved = 0;
    for (const war of WAR_IDS) {
      const o = countOf(opening(war).owner);
      for (let n = 0; n < 6; n++) {
        const run = campaignRun(war, n, none);
        for (let k = 1; k <= GCW.window; k++) {
          const ms = atStep(n, k, GCW.step / 2);
          for (const [how, s] of [
            ['a step at a time', runAt(run, ms)],
            ['whole', history(war, n, ms, none)],
          ])
            for (const [side, r] of Object.entries(s.strength)) {
              expect(r.trend6h, `${war} c${n} ${k} ${side}, ${how}`).toBe(r.systems - (o[side] ?? 0));
              if (r.trend6h) moved += 1;
            }
        }
      }
    }
    expect(moved).toBeGreaterThan(0);
  });
  it('names the campaign’s phase, when it ends and the next, and tells of each as it comes', () => {
    expect(history('gcw', 0, at(0, 20 * H), none).phase).toEqual({ index: 1, name: 'Escalation', from: atStep(0, 60), until: atStep(0, 240), next: 'Decisive' });
    expect(history('gcw', 0, at(0, 71 * H), none).phase).toMatchObject({ name: 'Climax', until: at(1, 0), next: null });
    expect(history('gcw', 0, at(0, H), none).phase.name).toBe('Opening');
    expect(history('gcw', 0, at(0, 13 * H), none).events.filter((e) => e.type === 'phase').map((e) => [e.k, e.phase])).toEqual([[60, 'Escalation']]);
  });
  it('draws the fronts’ rates again every GCW.window, inside their ranges', () => {
    const a = history('gcw', 0, at(0, H), none).rates;
    const b = history('gcw', 0, at(0, 7 * H), none).rates;
    expect(WAR_SYSTEMS.some((id) => a[id] !== b[id])).toBe(true);
    for (const r of [a, b])
      for (const id of WAR_SYSTEMS) {
        const [lo, hi] = worthOf(id) >= 2 ? GCW.majorRate : GCW.rate;
        expect(r[id]).toBeGreaterThanOrEqual(lo);
        expect(r[id]).toBeLessThanOrEqual(hi);
      }
  });
  it('a quiet system gets its hold back at GCW.regen in supply, and nothing cut off from its capital', () => {
    const per = (GCW.regen / 100) * (GCW.step / 3600e3);
    let back = 0;
    let cut = 0;
    // (a step at a time from one run: it comes to history's, below)
    for (const war of WAR_IDS)
      for (let n = 0; n < 4; n++) {
        const run = campaignRun(war, n, none);
        for (let k = 3; k < 357; k += 3) {
          const s = runAt(run, atStep(n, k));
          const next = runAt(run, atStep(n, k + 1));
          for (const id of WAR_SYSTEMS) {
            if (s.control[id] >= 1 || !quietAt(s, id) || next.owner[id] !== s.owner[id]) continue;
            if (s.cut.includes(id)) {
              cut += 1;
              expect(next.control[id], `${war} ${n} ${k} ${id}`).toBeCloseTo(s.control[id], 5);
            } else {
              back += 1;
              expect(next.control[id], `${war} ${n} ${k} ${id}`).toBeCloseTo(Math.min(1, s.control[id] + per), 5);
            }
          }
        }
      }
    expect(back).toBeGreaterThan(0);
    expect(cut).toBeGreaterThan(0);
  });
  it('counts players’ points only where there’s a battle, or at the side’s own systems, and no more than GCW.playerCap a step', () => {
    const ms = at(0, 30 * 60e3);
    const k = stepAt(ms);
    const s0 = history('gcw', 0, ms, none);
    const quiet = WAR_SYSTEMS.find((id) => s0.owner[id] !== 'rebel' && quietAt(s0, id));
    expect(history('gcw', 0, ms, (key) => (key === pointsKey('rebel', quiet, k) ? 50 : 0)).control[quiet]).toBe(s0.control[quiet]);
    const f = s0.fronts[0];
    const lots = history('gcw', 0, ms, (key) => (key === pointsKey('rebel', f, k) ? 1000 : 0));
    expect(s0.control[f] - lots.control[f]).toBeCloseTo(GCW.playerCap, 5);
  });
  it('goes back for what it’s just lost: the raider attacks it at once', () => {
    // the Rebellion's pilots take the Empire's system at the major order in the first three steps
    let checked = 0;
    for (let n = 0; n < 12 && checked < 3; n++) {
      const f = history('gcw', n, atStep(n, 2), none).fronts[0];
      if (!NEIGHBOURS[f].some((o) => opening('gcw').owner[o] === 'empire')) continue;
      const pts = (key) => ([0, 1, 2].some((k) => key === pointsKey('rebel', f, k)) ? 100 : 0);
      expect(history('gcw', n, atStep(n, 3), pts).owner[f]).toBe('rebel');
      const back = history('gcw', n, atStep(n, 3, 60e3), pts).attacks.find((a) => a.by === 'empire');
      expect(back, `c${n}`).toMatchObject({ sys: f, counter: true });
      checked += 1;
    }
    expect(checked).toBeGreaterThan(0);
  });
  it('goes back for what it’s just lost: the liberator makes it its front after its order', () => {
    // the Empire's pilots take the Rebellion's system its opening strike's on.
    // (It was the first front, ahead of the order; but the first front is the
    // major order, and the ★ jumped to every system to retake while the order
    // said elsewhere. Now the order stays first and the retaking comes next.)
    let checked = 0;
    for (let n = 0; n < 20 && checked < 2; n++) {
      const a = history('gcw', n, atStep(n, GCW.strike, 60e3), none).attacks.find((x) => x.by === 'empire');
      if (!a || opening('gcw').owner[a.sys] !== 'rebel' || !NEIGHBOURS[a.sys].some((o) => o !== a.sys && opening('gcw').owner[o] === 'rebel')) continue;
      const steps = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => GCW.strike + i);
      const pts = (key) => (steps.some((k) => key === pointsKey('empire', a.sys, k)) ? 100 : 0);
      let fell = null;
      for (let k = GCW.strike + 1; k < GCW.strike + 9 && fell === null; k++) if (history('gcw', n, atStep(n, k), pts).owner[a.sys] === 'empire') fell = k;
      expect(fell, `c${n}`).not.toBeNull();
      let worked = 0;
      for (let k = fell; k < fell + GCW.counterFor; k++) {
        const s = history('gcw', n, atStep(n, k, 60e3), pts);
        if (!s.fronts.includes(a.sys)) continue;
        expect(s.fronts.indexOf(a.sys), `c${n} ${k}`).toBeLessThanOrEqual(1);
        expect(s.fronts[0]).toBe(s.orders.rebel.sys);
        worked += 1;
      }
      expect(worked, `c${n}`).toBeGreaterThan(0);
      checked += 1;
    }
    expect(checked).toBeGreaterThan(0);
  });
  it('an outnumbered raider attacks more often, at its phase’s pace over its underdog boost', () => {
    // the Republic's pilots everywhere: the Separatists are soon down to a few systems
    const all = (k) => (k.startsWith('rep:') ? 100 : 0);
    const s = history('clone', 0, at(0, 40 * H), all);
    const { raider } = WARS.clone;
    const pace = Math.round((GCW.phases[1].every * DOCTRINE[raider].every) / GCW.underdog.boost);
    expect(pace).toBeLessThan(Math.round(GCW.phases[1].every * DOCTRINE[raider].every));
    const attacks = s.events.filter((e) => e.type === 'attack' && e.by === raider && e.k >= GCW.phases[1].from);
    let gaps = 0;
    for (let i = 1; i < attacks.length; i++)
      if (!attacks[i - 1].counter) {
        expect(attacks[i].k - attacks[i - 1].k, `${attacks[i - 1].k}`).toBeLessThanOrEqual(pace);
        gaps += 1;
      }
    expect(gaps).toBeGreaterThan(2);
  });
  it('tells a side once that it’s lost its capital, and shakes it for GCW.shockFor', () => {
    const all = (k) => (k.startsWith('reb:') ? 100 : 0);
    let s = null;
    for (let h = 1; h < 72 && !s; h += 1) {
      const t = history('gcw', 0, at(0, h * H), all);
      if (t.owner.coruscant === 'rebel') s = t;
    }
    expect(s).toBeTruthy();
    // (the Hutts lose Tatooine, theirs, about then too)
    const told = s.events.filter((e) => e.type === 'capital' && e.from === 'empire');
    expect(told).toHaveLength(1);
    expect(told[0]).toMatchObject({ sys: 'coruscant', by: 'rebel', from: 'empire' });
    expect(s.shaken.empire).toBe(atStep(0, told[0].k + GCW.shockFor));
  });
  it('gives each side orders with a deadline: the liberator’s a front, the raider’s its attack or a system of its under threat, kept till done or the window’s out', () => {
    for (const war of WAR_IDS) {
      const { liberator, raider } = WARS[war];
      let prev = null;
      for (let k = 0; k < 90; k++) {
        // (at a step's start, before anything in it can fall)
        const s = history(war, 1, atStep(1, k), none);
        const lo = s.orders[liberator];
        expect(lo, `${war} ${k}`).toBeTruthy();
        expect(lo.verb).toBe('liberate');
        expect(lo.until).toBe(atStep(1, (Math.floor(k / GCW.window) + 1) * GCW.window));
        expect(s.owner[lo.sys]).not.toBe(liberator);
        // (and it's the first front, the major order: never one someone else is attacking)
        expect(s.attacks.some((a) => a.sys === lo.sys), `${war} ${k}`).toBe(false);
        expect(s.fronts[0], `${war} ${k}`).toBe(lo.sys);
        const ro = s.orders[raider];
        if (ro?.verb === 'take') expect(s.attacks.some((a) => a.sys === ro.sys && a.by === raider), `${war} ${k}`).toBe(true);
        else if (ro) {
          expect(ro.verb).toBe('hold');
          expect(s.owner[ro.sys]).toBe(raider);
          expect(!quietAt(s, ro.sys), `${war} ${k}`).toBe(true);
        }
        if (prev && Math.floor(k / GCW.window) === Math.floor((k - 1) / GCW.window)) {
          // (an order's given up when its push stalled: the liberator's by the last step's battles, the raider's by this one's)
          const state = { owner: s.owner, attacks: s.attacks, fronts: s.fronts, liberator, raider };
          for (const [side, eff] of [
            [liberator, prev.eff],
            [raider, s.eff],
          ]) {
            const was = prev.orders[side];
            if (was && s.orders[side]?.sys !== was.sys) expect(orderOver(was, { ...state, eff }), `${war} ${k} ${side}`).toBe(true);
          }
        }
        prev = s;
      }
    }
  });
  it('flags the decisive battle in the Climax, and gives the campaign’s result at its end, by victory points', () => {
    for (const war of WAR_IDS) {
      const before = history(war, 0, at(0, 60 * H), none);
      expect(before.decisive).toBeNull();
      expect(before.result).toBeNull();
      const climax = history(war, 0, at(0, 67 * H), none);
      expect(climax.decisive).toBe(climax.fronts[0]);
      const end = history(war, 0, at(0, GCW.campaign - 1), none);
      const vp = {};
      for (const id of WAR_SYSTEMS) vp[end.owner[id]] = (vp[end.owner[id]] ?? 0) + worthOf(id);
      for (const side of Object.keys(vp)) expect(end.result.vp[side]).toBe(vp[side]);
      expect(Object.values(end.result.vp).reduce((t, x) => t + x, 0)).toBe(TOTAL_WORTH);
      expect(end.result.vp[end.result.winner]).toBe(Math.max(...Object.values(end.result.vp)));
      expect(end.result.decisive).toBe(end.decisive);
      // (but in its last step it's only who's leading: that step's battles and points still count)
      expect(end.result.final).toBe(false);
      expect(history(war, 0, at(0, GCW.campaign - GCW.step - 1), none).result).toBeNull();
      // and once it's over, the campaign's result is the war at its last moment, final
      expect(campaignResult(war, 0, none)).toEqual({ ...end.result, n: 0, final: true });
    }
  });
  it('the major order is the liberator’s order, at every step', () => {
    // (the major was the first front, and a system to retake went first for a
    // while after every loss, so the ★ jumped there while the order said
    // elsewhere: on 22 to 28% of steps, and it moved about twice as often)
    for (const war of WAR_IDS) {
      const lib = WARS[war].liberator;
      for (let n = 0; n < 3; n++) {
        const run = campaignRun(war, n, none);
        for (let k = 0; k < GCW.campaign / GCW.step; k++) {
          const s = runAt(run, atStep(n, k, GCW.step / 2));
          if (s.over) break;
          expect(s.major, `${war} c${n} ${k}`).toBe(s.orders[lib]?.sys ?? null);
          expect(s.majors[k]).toBe(s.major);
        }
      }
    }
  });
  it('says when the next operation’s due', () => {
    const { raider } = WARS.gcw;
    expect(history('gcw', 0, at(0, 30 * 60e3), none).nextOp).toEqual({ by: raider, at: atStep(0, GCW.strike) });
    expect(history('gcw', 0, atStep(0, GCW.strike + 1), none).nextOp).toEqual({ by: raider, at: atStep(0, GCW.attackEvery / GCW.step) });
  });
  it('keeps the major order of every step', () => {
    const s = history('clone', 3, at(3, 10 * H + 60e3), none);
    expect(s.majors).toHaveLength(s.step + 1);
    for (const k of [0, 7, 30, 50]) expect(s.majors[k], `${k}`).toBe(history('clone', 3, atStep(3, k, 60e3), none).major);
  });
  it('worked through from a checkpoint a step at a time comes to the same as worked through whole', () => {
    const t = busyTally('gcw');
    const v = (k) => t.value(k);
    const run = campaignRun('gcw', 0, v);
    const rand = seeded('moments');
    const moments = Array.from({ length: 20 }, () => Math.floor(rand() * GCW.campaign)).sort((a, b) => a - b);
    moments.push(moments[4]); // (and back again)
    for (const m of moments) expect(runAt(run, at(0, m)), `${m}`).toEqual(history('gcw', 0, at(0, m), v));
  });
  it('comes to the same from a checkpoint all through the first six hours, a capture partway through a step and all', () => {
    // (the trend in the first six hours is measured against the opening: the
    // twenty moments above missed that window, and the two ways differed in it)
    let partway = 0;
    for (const war of WAR_IDS) {
      const t = busyTally(war, `first-hours-${war}`);
      const v = (k) => t.value(k);
      const run = campaignRun(war, 0, v);
      for (let k = 0; k <= GCW.window; k++) {
        const began = history(war, 0, atStep(0, k), v).owner;
        for (const f of [0.1, 0.5, 0.9]) {
          const ms = atStep(0, k, f * GCW.step);
          const whole = history(war, 0, ms, v);
          expect(runAt(run, ms), `${war} ${k} ${f}`).toEqual(whole);
          if (WAR_SYSTEMS.some((id) => whole.owner[id] !== began[id])) partway += 1;
        }
      }
    }
    expect(partway).toBeGreaterThan(0);
  });
  it('counts each area’s systems by side, and names one held whole', () => {
    const s = history('gcw', 0, at(0, 60e3), none);
    for (const a of AREAS) {
      const r = s.areas[a.id];
      const ids = WAR_SYSTEMS.filter((id) => areaOf(id) === a.id);
      expect(r.total).toBe(ids.length);
      const sides = new Set(ids.map((id) => s.owner[id]));
      expect(r.holder).toBe(sides.size === 1 ? [...sides][0] : null);
      expect(Object.entries(r).filter(([k]) => k !== 'total' && k !== 'holder').reduce((t, [, v]) => t + v, 0)).toBe(ids.length);
    }
  });
});

describe('supply and areas', () => {
  it('Hutt space gives way at GCW.hutts of the rate anywhere else does', () => {
    expect(pressureOn('empire', 10)).toBe(10);
    expect(pressureOn('hutt', 10)).toBe(10 * GCW.hutts);
    expect(GCW.hutts).toBeLessThan(1);
  });
  const pick = WAR_SYSTEMS.find((id) => NEIGHBOURS[id].length >= 3);
  it('a front with more of the attacker’s neighbours moves faster than one with fewer', () => {
    const theirs = Object.fromEntries(WAR_SYSTEMS.map((id) => [id, 'empire']));
    const ours = { ...Object.fromEntries(WAR_SYSTEMS.map((id) => [id, 'rebel'])), [pick]: 'empire' };
    expect(supplyOf(pick, ours, 'rebel')).toBeGreaterThan(supplyOf(pick, { ...theirs, [NEIGHBOURS[pick][0]]: 'rebel' }, 'rebel'));
    expect(supplyOf(pick, ours, 'rebel')).toBe(GCW.supply * (NEIGHBOURS[pick].length - 1));
  });
  it('an area held whole gives its holder’s fronts next to it the bonus', () => {
    // a system with a neighbour in another area
    const id = WAR_SYSTEMS.find((x) => NEIGHBOURS[x].some((o) => areaOf(o) !== areaOf(x)));
    const area = areaOf(NEIGHBOURS[id].find((o) => areaOf(o) !== areaOf(id)));
    const owner = Object.fromEntries(WAR_SYSTEMS.map((x) => [x, areaOf(x) === area ? 'rebel' : 'empire']));
    expect(areaBonusOf(id, owner, 'rebel')).toBe(GCW.areaBonus);
    const broken = { ...owner, [WAR_SYSTEMS.find((x) => areaOf(x) === area)]: 'hutt' };
    expect(areaBonusOf(id, broken, 'rebel')).toBe(0);
  });
});

describe('battleAt', () => {
  it('has a battle at a front, the liberator attacking, on the clock everyone shares', () => {
    const ms = at(0, 24 * 60e3 + 4 * 60e3);
    const s = history('gcw', 0, ms, none);
    const f = s.fronts[0];
    const b = battleAt(s, f, ms);
    const c = campaignAt(ms);
    expect(b.id).toBe(`c0.gcw.${f}.${c.step}`);
    expect(b.war).toBe('gcw');
    expect(b.attacker).toBe('rebel');
    expect(b.defender).toBe(s.owner[f]);
    expect(b.sides).toEqual(['rebel', s.owner[f]]);
    expect(b.attackerTeam).toBe(0);
    expect(b.start).toBe(c.stepStart);
    expect(b.fightEnd).toBe(c.stepStart + GCW.fight);
    expect(b.fighting).toBe(true);
    expect(b.seed).toBe(battleAt(s, f, ms + 1000).seed);
  });
  it('has the attacker attacking at a system under attack', () => {
    const ms = at(0, GCW.attackEvery + 60e3);
    const s = history('gcw', 0, ms, none);
    const a = s.attacks[0];
    const b = battleAt(s, a.sys, ms);
    expect(b.attacker).toBe(a.by);
    expect(b.defender).toBe(s.owner[a.sys]);
    expect(b.sides[b.attackerTeam]).toBe(a.by);
  });
  it('lists a battle’s sides by team: the light side 0, the dark 1, the Hutts in the other’s place', () => {
    const ms = at(0, 24 * 60e3);
    const s = { war: 'gcw', owner: { hoth: 'rebel', tatooine: 'hutt', endor: 'empire' }, fronts: ['tatooine'], attacks: [{ sys: 'hoth', by: 'empire' }, { sys: 'endor', by: 'hutt' }] };
    expect(battleAt(s, 'hoth', ms)).toMatchObject({ sides: ['rebel', 'empire'], attackerTeam: 1 });
    expect(battleAt(s, 'tatooine', ms)).toMatchObject({ sides: ['rebel', 'hutt'], attackerTeam: 0 });
    expect(battleAt(s, 'endor', ms)).toMatchObject({ sides: ['hutt', 'empire'], attackerTeam: 0 });
  });
  it('the same system and step in two wars are two battles', () => {
    const ms = at(0, 24 * 60e3 + 4 * 60e3);
    const a = history('gcw', 0, ms, none);
    const b = history('clone', 0, ms, none);
    const both = a.fronts.find((id) => b.fronts.includes(id));
    if (both) expect(battleAt(a, both, ms).id).not.toBe(battleAt(b, both, ms).id);
  });
  it('has none where there’s no fighting', () => {
    const ms = at(0, 60e3);
    const s = history('gcw', 0, ms, none);
    const quiet = WAR_SYSTEMS.find((id) => !s.fronts.includes(id) && !s.attacks.some((a) => a.sys === id));
    expect(battleAt(s, quiet, ms)).toBeNull();
  });
  it('is in its lull for the end of the step', () => {
    const ms = at(0, 24 * 60e3 + GCW.fight + 30e3);
    const s = history('gcw', 0, ms, none);
    expect(battleAt(s, s.fronts[0], ms).fighting).toBe(false);
  });
});

describe('warTable', () => {
  it('gives the holotable every system’s owner, hold, worth, kind, area and battle, the areas and the campaign’s end', () => {
    const ms = at(0, 5 * H + 60e3);
    for (const war of WAR_IDS) {
      const w = warTable(war, ms, none);
      const { liberator, raider } = WARS[war];
      expect(w.war).toBe(war);
      expect(w.systems.map((s) => s.id).sort()).toEqual([...WAR_SYSTEMS].sort());
      expect(w.ends).toBe(at(1, 0));
      expect(w.over).toBeNull();
      expect(Object.keys(w.areas).sort()).toEqual(AREAS.map((a) => a.id).sort());
      expect(w.systems.find((s) => s.id === w.major)?.front).toBe(true);
      for (const s of w.systems) {
        expect([liberator, raider, 'hutt']).toContain(s.owner);
        expect(s.control).toBeGreaterThanOrEqual(0);
        expect(s.control).toBeLessThanOrEqual(1);
        expect(typeof s.kind).toBe('string');
        expect(s.worth).toBe(worthOf(s.id));
        expect(s.area).toBe(areaOf(s.id));
        if (s.front || s.attack) expect(s.battle).not.toBeNull();
        if (s.front) expect(typeof s.rate).toBe('number');
      }
    }
  });
  it('opens each war with nothing cut off but what’s encircled: no more than two systems, and never the Hutts’', () => {
    // (supply ran from the capital alone, so 7 of the Separatists' 8 systems
    // opened cut off, and the Hutts' Nevarro in every war. Now what's left is
    // the Empire's Bespin and Mustafar, ringed by the Rebels' Hoth and the
    // Hutts' Nevarro, and two of the Remnant's holdouts in the New Republic's
    // space: none with a stronghold or a way through their own to one)
    const cut = Object.fromEntries(WAR_IDS.map((war) => [war, history(war, 0, at(0, 0), none).cut]));
    expect(cut).toEqual({ clone: [], gcw: ['bespin', 'mustafar'], remnant: ['mustafar', 'geonosis'] });
    for (const war of WAR_IDS) for (const id of cut[war]) expect(NEIGHBOURS[id].every((o) => opening(war).owner[o] !== opening(war).owner[id] || cut[war].includes(o)), `${war} ${id}`).toBe(true);
  });
  it('gives each battle its effective rate, the one that applies', () => {
    for (const war of WAR_IDS) {
      const { liberator } = WARS[war];
      for (const ms of [at(0, 30 * 60e3), atStep(0, GCW.strike + 1)]) {
        const s = history(war, 0, ms, none);
        const t = warTable(war, ms, none);
        const supply = Object.fromEntries(Object.entries(WARS[war].capitals).map(([side, cap]) => [side, supplied(s.owner, side, cap)]));
        const might = GCW.phases[0].mult * lean(countOf(s.owner), liberator);
        for (const r of t.systems) {
          // (a stronghold holds out longer: GCW.fortified of the pace)
          if (r.attack) expect(r.effRate, r.id).toBeCloseTo(pressureOn(r.owner, r.attack.rate + supplyOf(r.id, s.owner, r.attack.by) + areaBonusOf(r.id, s.owner, r.attack.by)) * (worthOf(r.id) >= GCW.stronghold ? GCW.fortified : 1), 6);
          else if (r.front) expect(r.effRate, r.id).toBeCloseTo(frontPace({ id: r.id, owner: s.owner, liberator, rate: r.rate * might, supply }), 6);
          else expect(r.effRate).toBeNull();
        }
      }
    }
  });
  it('gives the holotable the phase, the next operation, the orders, the news, each side’s strength, and the decisive battle and result when there are', () => {
    for (const war of WAR_IDS) {
      const { liberator, raider } = WARS[war];
      const ms = at(0, 30 * H);
      const w = warTable(war, ms, none);
      const s = history(war, 0, ms, none);
      expect(w.phase).toEqual(s.phase);
      expect(w.nextOp).toEqual(s.nextOp);
      expect(w.orders).toEqual(s.orders);
      expect(w.events).toEqual(s.events);
      expect(w.counts).toEqual(s.counts);
      expect(w.decisive).toBeNull();
      expect(w.result).toBeNull();
      const sides = [liberator, raider, 'hutt'];
      expect(sides.reduce((t, x) => t + w.strength[x].systems, 0)).toBe(WAR_SYSTEMS.length);
      expect(sides.reduce((t, x) => t + w.strength[x].share, 0)).toBeCloseTo(1, 2);
      const ago = countOf(history(war, 0, ms - 6 * H, none).owner);
      for (const x of sides) {
        expect(w.strength[x].systems).toBe(countOf(s.owner)[x] ?? 0);
        expect(w.strength[x].trend6h, `${war} ${x}`).toBe((countOf(s.owner)[x] ?? 0) - (ago[x] ?? 0));
      }
      for (const r of w.systems) {
        expect(typeof r.cut).toBe('boolean');
        expect(r.decisive).toBe(false);
      }
    }
  });
  it('says where a side’s points count, as history counts them: at a battle, or at its own systems', () => {
    const ms = at(0, 30 * 60e3);
    const k = stepAt(ms);
    const t = warTable('gcw', ms, none);
    const before = history('gcw', 0, ms, none);
    for (const row of t.systems)
      for (const side of ['rebel', 'empire']) {
        expect(scoresAt(row, side), `${row.id} ${side}`).toBe(Boolean(row.battle) || row.owner === side);
        // (and where they don't, history doesn't move for them)
        if (!scoresAt(row, side)) expect(history('gcw', 0, ms, (key) => (key === pointsKey(side, row.id, k) ? 30 : 0)).control[row.id]).toBe(before.control[row.id]);
      }
    expect(t.systems.some((row) => !scoresAt(row, 'rebel'))).toBe(true);
  });
  it('warTables gives all three wars', () => {
    const t = warTables(at(0, H), none);
    expect(Object.keys(t)).toEqual(WAR_IDS);
    expect(t.clone.war).toBe('clone');
  });
});

describe('the war table’s battles, by war', () => {
  it('names a Clone Wars interdiction world’s battle a siege, as it is laid', () => {
    const ms = GCW.start + 30 * 60e3;
    const ids = WAR_SYSTEMS.filter((id) => warTable('gcw', ms).systems.find((r) => r.id === id).kind === 'interdiction');
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) expect(warTable('clone', ms).systems.find((r) => r.id === id).kind, id).toBe('siege');
  });
});
