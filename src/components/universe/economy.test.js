import { describe, expect, it } from 'vitest';
import { createSaves } from '../../runtime/saves';
import {
  EARN,
  LEVELS,
  LOG_MAX,
  PILOT_KEY,
  SELL_BACK,
  SIDE_RATES,
  TITLES,
  createEconomy,
  deedToEarn,
  earnNote,
  goodStanding,
  levelOf,
  migrateOwned,
  refundOf,
} from './economy';
import { CATALOG } from './catalog';
import { LOADOUT_KEY } from './outfit';
import { GARAGE_KEY, HULL_KEY } from './shipyard/build';

// a localStorage in memory, the shape saves.js reads and writes
const memory = (init = {}) => {
  const m = new Map(Object.entries(init).map(([k, v]) => [k, typeof v === 'string' ? v : JSON.stringify(v)]));
  return {
    m,
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
  };
};
// a timer that only fires when told, so the debounce is deterministic
const manual = () => {
  const due = new Map();
  let n = 0;
  return {
    later: (fn) => (due.set(++n, fn), n),
    cancel: (h) => due.delete(h),
    run() {
      const fns = [...due.values()];
      due.clear();
      for (const fn of fns) fn();
    },
    get pending() {
      return due.size;
    },
  };
};
const fresh = (init = {}, opts = {}) => {
  const local = memory(init);
  const saves = createSaves({ local, session: memory() });
  const timer = manual();
  const econ = createEconomy({
    saves,
    later: timer.later,
    cancel: timer.cancel,
    ...opts,
  });
  return { local, saves, timer, econ };
};
const stored = (local) => JSON.parse(local.m.get(PILOT_KEY));

describe('levels', () => {
  it('has eleven levels and a title for each, Rookie to Legend', () => {
    expect(LEVELS).toEqual([0, 50, 150, 350, 700, 1200, 2000, 3200, 5000, 7500, 11000]);
    expect(TITLES).toHaveLength(11);
    expect(TITLES[0]).toBe('Rookie');
    expect(TITLES[10]).toBe('Legend');
  });

  it('reads a level off the xp, capped at eleven', () => {
    expect(levelOf(0)).toBe(1);
    expect(levelOf(49)).toBe(1);
    expect(levelOf(50)).toBe(2);
    expect(levelOf(10999)).toBe(10);
    expect(levelOf(11000)).toBe(11);
    expect(levelOf(1e9)).toBe(11);
    expect(levelOf(-5)).toBe(1);
    expect(levelOf(NaN)).toBe(1);
  });

  it('pays whole numbers, and every side at a rate', () => {
    for (const [what, e] of Object.entries(EARN)) {
      expect(Number.isInteger(e.credits) && e.credits >= 0, what).toBe(true);
      expect(Number.isInteger(e.xp) && e.xp >= 0, what).toBe(true);
    }
    expect(Object.keys(SIDE_RATES).sort()).toEqual(['breakingbad', 'galaxy', 'rickmorty', 'starwars']);
  });
});

describe('earning', () => {
  it('earning adds credits and xp and reports a level up at a threshold', () => {
    const { econ } = fresh();
    expect(econ.credits).toBe(0);
    expect(econ.level).toBe(1);
    const once = econ.earn('killHunter');
    expect(once).toEqual({
      credits: EARN.killHunter.credits,
      xp: EARN.killHunter.xp,
      levelUp: null,
    });
    econ.earn('killHunter');
    expect(econ.credits).toBe(2 * EARN.killHunter.credits);
    expect(econ.xp).toBe(2 * EARN.killHunter.xp);
    // questDone's 50 xp on top crosses 50
    const up = econ.earn('questDone');
    expect(econ.xp).toBeGreaterThanOrEqual(50);
    expect(up.levelUp).toBe(2);
    expect(econ.level).toBe(2);
  });

  it('pays per point, and by the side’s rate', () => {
    const { econ } = fresh();
    expect(econ.earn('warPoints', 5)).toMatchObject({
      credits: 5 * EARN.warPoints.credits,
      xp: 5 * EARN.warPoints.xp,
    });
    expect(econ.earn('killHunter', -3)).toEqual({
      credits: 0,
      xp: 0,
      levelUp: null,
    });
    expect(econ.earn('killHunter', NaN)).toEqual({
      credits: 0,
      xp: 0,
      levelUp: null,
    });
  });

  it('killing civilians earns nothing', () => {
    const { econ } = fresh();
    expect(econ.earn('killCivil')).toEqual({
      credits: 0,
      xp: 0,
      levelUp: null,
    });
    expect(econ.earn('killPatrol')).toEqual({
      credits: 0,
      xp: 0,
      levelUp: null,
    });
    expect(econ.earn('toString')).toEqual({ credits: 0, xp: 0, levelUp: null });
    expect(econ.credits).toBe(0);
    expect(econ.record().kills).toBe(0);
  });

  it('keeps a record: kills, rescues, wins, quests, and by side', () => {
    const { econ } = fresh();
    econ.earn('killHunter', 1, { side: 'starwars' });
    econ.earn('killPirate', 2, { side: 'rickmorty' });
    econ.earn('killCapital');
    econ.earn('rescued', 1, { side: 'breakingbad' });
    econ.earn('warWin', 1, { side: 'galaxy' });
    econ.earn('questDone', 3, { side: 'galaxy' });
    econ.earn('found', 1, { side: 'nowhere' });
    const r = econ.record();
    expect(r).toMatchObject({
      kills: 4,
      rescues: 1,
      wins: 1,
      quests: 3,
      credits: econ.credits,
      xp: econ.xp,
      level: econ.level,
    });
    expect(r.bySide.starwars).toEqual({ killHunter: 1 });
    expect(r.bySide.rickmorty).toEqual({ killPirate: 2 });
    expect(r.bySide.galaxy).toEqual({ warWin: 1, questDone: 3 });
    expect(r.bySide.nowhere).toBeUndefined();
    expect(r.earned).toBe(econ.credits);
    // the record is a copy
    r.bySide.starwars.killHunter = 99;
    expect(econ.record().bySide.starwars.killHunter).toBe(1);
  });

  it('tells its listeners, until they stop listening', () => {
    const { econ } = fresh();
    const heard = [];
    const off = econ.on((r) => heard.push(r.credits));
    econ.earn('found');
    econ.earn('killCivil'); // (nothing changed: nothing to tell)
    off();
    econ.earn('found');
    expect(heard).toEqual([EARN.found.credits]);
  });
});

describe('buying', () => {
  const item = (over = {}) => ({ id: 'srb', price: 100, needs: {}, ...over });

  it('canBuy says owned, credits or the lock', () => {
    let have = { achievements: [], standing: null, rank: null };
    const { econ } = fresh(
      {},
      {
        achievements: () => have.achievements,
        standingOf: (side) => (side === 'rickmorty' ? have.standing : null),
        rankOf: (side) => (side === 'rebel' ? have.rank : null),
      },
    );
    econ.earn('killCapital'); // 400 credits, 80 xp: level 2
    expect(econ.canBuy(item({ price: 1000 }))).toEqual({
      ok: false,
      why: 'credits',
    });
    expect(econ.canBuy(item())).toEqual({ ok: true, why: null });
    expect(econ.canBuy(item({ id: 'stock', price: 0 }))).toEqual({
      ok: false,
      why: 'owned',
    });

    expect(econ.canBuy(item({ needs: { achievement: 'rebels' } })).why).toBe('locked:achievement');
    have.achievements = ['rebels'];
    expect(econ.canBuy(item({ needs: { achievement: 'rebels' } })).ok).toBe(true);

    expect(econ.canBuy(item({ needs: { level: 3 } })).why).toBe('locked:level');
    expect(econ.canBuy(item({ needs: { level: 2 } })).ok).toBe(true);

    const trusted = {
      standing: { side: 'rickmorty', axis: 'law', level: 'trusted' },
    };
    expect(econ.canBuy(item({ needs: trusted })).why).toBe('locked:standing');
    have.standing = { law: 'suspect', civil: null, outlaw: null };
    expect(econ.canBuy(item({ needs: trusted })).why).toBe('locked:standing');
    have.standing = { law: 'trusted', civil: null, outlaw: null };
    expect(econ.canBuy(item({ needs: trusted })).ok).toBe(true);

    const leader = { rank: { side: 'rebel', id: 'flight-leader' } };
    expect(econ.canBuy(item({ needs: leader })).why).toBe('locked:rank');
    have.rank = 'pilot';
    expect(econ.canBuy(item({ needs: leader })).why).toBe('locked:rank');
    have.rank = 'flight-leader';
    expect(econ.canBuy(item({ needs: leader })).ok).toBe(true);
    have.rank = 'commander';
    expect(econ.canBuy(item({ needs: leader })).ok).toBe(true);
    // a rank on another side's ladder is no rank on this one
    have.rank = 'admiral';
    expect(econ.canBuy(item({ needs: leader })).why).toBe('locked:rank');
  });

  it('a skill need waits for its node in the skill tree', () => {
    let taken = [];
    const { econ } = fresh({}, { skillOf: (id) => taken.includes(id) });
    econ.earn('killCapital');
    const seismic = item({ needs: { skill: 'u-seismic' } });
    expect(econ.canBuy(seismic).why).toBe('locked:skill');
    taken = ['u-seismic'];
    expect(econ.canBuy(seismic).ok).toBe(true);
    // (and with no word from the tree at all, it stays shut)
    expect(fresh().econ.canBuy(seismic).why).toBe('locked:skill');
  });

  it('a lock says so before the price does', () => {
    const { econ } = fresh();
    expect(econ.canBuy(item({ price: 5000, needs: { level: 9 } })).why).toBe('locked:level');
  });

  it('turns away what is not an item', () => {
    const { econ } = fresh();
    for (const bad of [
      null,
      'srb',
      {},
      { id: 3, price: 0 },
      { id: 'srb', price: -1 },
      { id: 'srb', price: 1.5 },
      { id: 'srb', price: NaN },
    ]) {
      expect(econ.canBuy(bad).ok).toBe(false);
      expect(econ.buy(bad)).toBe(false);
    }
  });

  it('buy takes the price and keeps the id', () => {
    const { econ } = fresh();
    expect(econ.buy(item())).toBe(false);
    econ.earn('killCapital');
    expect(econ.buy(item())).toBe(true);
    expect(econ.credits).toBe(EARN.killCapital.credits - 100);
    expect(econ.owns('srb')).toBe(true);
    expect(econ.owned.has('srb')).toBe(true);
    expect(econ.spent).toBe(100);
    expect(econ.buy(item())).toBe(false);
    expect(econ.credits).toBe(EARN.killCapital.credits - 100);
    // the set handed out is a copy
    econ.owned.add('fusion');
    expect(econ.owns('fusion')).toBe(false);
  });

  it('spends credits on something that isn’t kept (a bounty paid off), only what you have', () => {
    const { econ } = fresh();
    expect(econ.spend(50)).toBe(false);
    econ.earn('killCapital');
    const { spend } = econ;
    expect(spend(-5)).toBe(false);
    expect(spend(1.5)).toBe(false);
    expect(spend(EARN.killCapital.credits + 1)).toBe(false);
    expect(spend(100)).toBe(true);
    expect(econ.credits).toBe(EARN.killCapital.credits - 100);
    expect(econ.spent).toBe(100);
    expect(econ.owned.size).toBe(0);
  });

  it('buy works taken off the wallet, as a callback', () => {
    const { econ } = fresh();
    const { buy } = econ;
    econ.earn('killCapital');
    expect(buy(item())).toBe(true);
    expect(econ.owns('srb')).toBe(true);
    expect(buy(item())).toBe(false);
  });

  it('owns a catalogue item by its key, so one id can be two things', () => {
    const { econ } = fresh();
    econ.earn('killCapital', 5);
    const paint = CATALOG['paint:paint:portal'];
    const booster = CATALOG['part:booster:portal'];
    expect(econ.buy({ ...paint, needs: {} })).toBe(true);
    expect(econ.owns(paint.key)).toBe(true);
    expect(econ.owns(booster.key)).toBe(false);
    expect(econ.canBuy({ ...booster, needs: {} }).ok).toBe(true);
    expect(econ.canBuy({ ...paint, needs: {} }).why).toBe('owned');
    // stock is everyone's: never for sale
    expect(econ.canBuy(CATALOG['part:booster:stock']).why).toBe('owned');
  });

  it('grants only strings', () => {
    const { econ } = fresh();
    econ.grant(['twin', 7, null, { id: 'x' }, '', 'fusion']);
    expect([...econ.owned].sort()).toEqual(['fusion', 'twin']);
    econ.grant('nonsense');
    expect(econ.owns('nonsense')).toBe(false);
  });
});

describe('the save', () => {
  it('the migration grants what was fitted', () => {
    const init = {
      [LOADOUT_KEY]: {
        xwing: { booster: 'srb', paint: 'jedi' },
        rv: { guns: 'fusion', shields: 'bogus' },
        nobody: { booster: 'repulsor' },
      },
      [HULL_KEY]: {
        falcon: {
          hull: 'hauler',
          cockpit: 'visor',
          wings: 'delta',
          engines: 'quad',
          tail: 'twinfin',
          extras: 'dish',
          seed: 4,
        },
        xwing: null,
      },
      [GARAGE_KEY]: { cruiser: { hull: 'needle', engines: 'ring' } },
    };
    const { econ } = fresh(init);
    for (const key of [
      'part:booster:srb',
      'paint:paint:jedi',
      'part:guns:fusion',
      'module:hull:hauler',
      'module:cockpit:visor',
      'module:wings:delta',
      'module:engines:quad',
      'module:tail:twinfin',
      'module:extras:dish',
      'module:hull:needle',
      'module:engines:ring',
    ]) {
      expect(econ.owns(key), key).toBe(true);
      expect(Object.hasOwn(CATALOG, key), key).toBe(true); // (the catalogue's keys)
    }
    expect(econ.owns('part:shields:bogus')).toBe(false);
    expect(econ.owns('part:booster:repulsor')).toBe(false); // (not a crew)
    expect(econ.credits).toBe(0);
    expect(econ.spent).toBe(0);
  });

  it('migrateOwned reads the raw saves, and nothing from junk', () => {
    expect(
      migrateOwned({
        loadouts: { xwing: { booster: 'srb' } },
        hulls: { falcon: { hull: 'hauler' } },
      }),
    ).toEqual(expect.arrayContaining(['part:booster:srb', 'module:hull:hauler']));
    expect(migrateOwned({ loadouts: 'junk', hulls: [1, 2], garage: 7 })).toEqual([]);
    expect(migrateOwned()).toEqual([]);
    expect(
      migrateOwned({
        loadouts: { xwing: { booster: 'srb' }, rv: { booster: 'srb' } },
      }).filter((id) => id === 'part:booster:srb'),
    ).toHaveLength(1);
  });

  it('a corrupt save reads as a fresh wallet', () => {
    for (const junk of ['{not json', '42', '"rich"', '[1,2]', JSON.stringify({ v: 1, data: 'x' }), JSON.stringify({ v: 1, data: null })]) {
      const { econ } = fresh({ [PILOT_KEY]: junk });
      expect(econ.credits, junk).toBe(0);
      expect(econ.xp, junk).toBe(0);
      expect(econ.level, junk).toBe(1);
      expect(econ.record().kills, junk).toBe(0);
    }
    // a good shape with bad fields keeps what's good
    const { econ } = fresh({
      [PILOT_KEY]: {
        v: 1,
        data: {
          credits: -50,
          xp: 75.6,
          owned: ['srb', 4, null],
          tally: { killHunter: 3, killCivil: 9, rescued: 'x' },
          bySide: {
            starwars: { killAce: 2 },
            mars: { killAce: 1 },
            rickmorty: 'x',
          },
        },
      },
    });
    expect(econ.credits).toBe(0);
    expect(econ.xp).toBe(75);
    expect([...econ.owned]).toEqual(['srb']);
    const r = econ.record();
    expect(r.kills).toBe(3);
    expect(r.rescues).toBe(0);
    expect(Object.keys(r.bySide)).toEqual(['starwars']);
  });

  it('the save round trips', () => {
    const { local, saves, timer, econ } = fresh();
    econ.earn('killAce', 1, { side: 'starwars' });
    econ.earn('rescued');
    econ.buy({ id: 'twin', price: 50, needs: {} });
    expect(local.m.has(PILOT_KEY)).toBe(false); // (not yet: debounced)
    timer.run();
    expect(stored(local).v).toBe(2);
    const again = createEconomy({
      saves,
      later: timer.later,
      cancel: timer.cancel,
    });
    expect(again.credits).toBe(econ.credits);
    expect(again.xp).toBe(econ.xp);
    expect(again.owns('twin')).toBe(true);
    expect(again.spent).toBe(50);
    expect(again.record()).toEqual(econ.record());
  });

  it('saves once for a burst of changes, and flush writes at once', () => {
    const { local, timer, econ } = fresh();
    econ.earn('found');
    econ.earn('found');
    econ.earn('found');
    expect(timer.pending).toBe(1);
    econ.flush();
    expect(timer.pending).toBe(0);
    expect(stored(local).data.credits).toBe(3 * EARN.found.credits);
    econ.flush(); // (nothing waiting: nothing to do)
  });

  it('works with no saves at all', () => {
    const econ = createEconomy();
    expect(econ.earn('found').credits).toBe(EARN.found.credits);
    econ.flush();
  });
});

describe('deedToEarn', () => {
  it('deedToEarn maps the paying deeds and nothing else', () => {
    expect(deedToEarn('killHunter')).toBe('killHunter');
    expect(deedToEarn('killPirate')).toBe('killPirate');
    expect(deedToEarn('rescued')).toBe('rescued');
    expect(deedToEarn('helped')).toBe('helped');
    expect(deedToEarn('capitalKill')).toBe('killCapital');
    for (const what of [
      'capitalHurt',
      'killCivil',
      'killPatrol',
      'ran',
      'shotLaw',
      'busted',
      'paidToll',
      'angeredPirates',
      'clean',
      'constructor',
      'toString',
      '',
      null,
      undefined,
    ])
      expect(deedToEarn(what)).toBe(null);
    // every key it gives is one the wallet pays
    for (const what of ['killHunter', 'killPirate', 'rescued', 'helped', 'capitalKill']) expect(EARN[deedToEarn(what)]).toBeTruthy();
  });
});

describe('what the HUD says of it', () => {
  it('earnNote says the credits, or the level reached, and nothing for nothing', () => {
    expect(earnNote({ credits: 40, xp: 8, levelUp: null })).toEqual({
      text: '+40 ¢',
      level: false,
    });
    expect(earnNote({ credits: 160, xp: 30, levelUp: 4 })).toEqual({
      text: '+160 ¢ · Level 4 · Wingmate',
      level: true,
    });
    expect(earnNote({ credits: 0, xp: 0, levelUp: null })).toBe(null);
    expect(earnNote(null)).toBe(null);
  });
  it('goodStanding is a level on the good side of nought', () => {
    for (const level of ['trusted', 'hero', 'friend']) expect(goodStanding(level)).toBe(true);
    for (const level of ['wanted', 'suspect', 'feared', null, undefined, 'constructor']) expect(goodStanding(level)).toBe(false);
  });
});

describe('selling, checking out and the log (save v2)', () => {
  const item = (id, price, extra = {}) => ({ key: `part:booster:${id}`, id, price, needs: {}, ...extra });

  it('a version 1 save migrates with an empty log and nothing else changed', () => {
    const data = { credits: 120, xp: 60, spent: 30, earned: 150, owned: ['part:booster:srb'], tally: { found: 2 }, bySide: {} };
    const { local, econ, timer } = fresh({ [PILOT_KEY]: { v: 1, data } });
    expect(econ.credits).toBe(120);
    expect(econ.xp).toBe(60);
    expect(econ.owns('part:booster:srb')).toBe(true);
    expect(econ.log).toEqual([]);
    expect(stored(local)).toEqual({ v: 2, data: { ...data, log: [] } });
    timer.run();
  });

  it('selling pays back three fifths, floored', () => {
    const { econ } = fresh({ [PILOT_KEY]: { v: 2, data: { credits: 0, owned: ['part:booster:srb'] } } });
    const srb = item('srb', 450);
    expect(SELL_BACK).toBe(0.6);
    expect(refundOf(srb)).toBe(270);
    expect(refundOf(item('x', 199))).toBe(119);
    expect(econ.canSell(srb)).toEqual({ ok: true, why: null });
    expect(econ.sell(srb)).toBe(270);
    expect(econ.credits).toBe(270);
    expect(econ.owns(srb.key)).toBe(false);
    expect(econ.earned).toBe(0);
    expect(econ.spent).toBe(0);
    expect(econ.log.at(-1)).toMatchObject({ kind: 'sell', what: srb.key, n: 270 });
    expect(econ.sell(srb)).toBe(false); // (sold already)
  });

  it('stock and unowned items can’t be sold', () => {
    const { econ } = fresh();
    expect(econ.canSell(item('stock', 0, { stock: true }))).toEqual({ ok: false, why: 'stock' });
    expect(econ.canSell(item('srb', 450))).toEqual({ ok: false, why: 'notOwned' });
    expect(econ.canSell(null)).toEqual({ ok: false, why: 'invalid' });
    expect(econ.sell(item('srb', 450))).toBe(false);
    expect(econ.credits).toBe(0);
  });

  it('checkout buys nothing when any item fails', () => {
    const { econ } = fresh({ [PILOT_KEY]: { v: 2, data: { credits: 500 } } });
    const calls = [];
    econ.on((r) => calls.push(r));
    const a = item('srb', 300);
    const b = item('rcs', 300);
    // (each alone is affordable; together they're not)
    expect(econ.checkout([a, b])).toEqual({ ok: false, why: 'credits', item: b, total: 600 });
    expect(econ.credits).toBe(500);
    expect(econ.owned.size).toBe(0);
    expect(calls).toHaveLength(0);
    const locked = item('afterburner', 10, { needs: { level: 9 } });
    expect(econ.checkout([a, locked])).toMatchObject({ ok: false, why: 'locked:level', item: locked });
    expect(econ.checkout([a, a])).toMatchObject({ ok: false, why: 'owned', item: a });
    expect(econ.owned.size).toBe(0);
  });

  it('checkout buys all in one change', () => {
    const { econ } = fresh({ [PILOT_KEY]: { v: 2, data: { credits: 1000 } } });
    const calls = [];
    econ.on((r) => calls.push(r));
    const list = [item('srb', 300), item('rcs', 200)];
    expect(econ.checkout(list)).toEqual({ ok: true, why: null, item: null, total: 500 });
    expect(calls).toHaveLength(1);
    expect(econ.credits).toBe(500);
    expect(econ.spent).toBe(500);
    for (const it of list) expect(econ.owns(it.key)).toBe(true);
    expect(econ.log.filter((e) => e.kind === 'buy')).toHaveLength(2);
    expect(econ.checkout([])).toEqual({ ok: true, why: null, item: null, total: 0 });
    expect(calls).toHaveLength(1);
    expect(econ.checkout('junk')).toMatchObject({ ok: false, why: 'invalid' });
  });

  it('buy is a checkout of one', () => {
    const { econ } = fresh({ [PILOT_KEY]: { v: 2, data: { credits: 100 } } });
    expect(econ.buy(item('srb', 150))).toBe(false);
    expect(econ.buy(item('rcs', 100))).toBe(true);
    expect(econ.credits).toBe(0);
  });

  it('the log keeps the last 30 newest last', () => {
    const { econ, local, timer } = fresh();
    for (let i = 0; i < 31; i++) econ.earn('found', i + 1);
    const log = econ.log;
    expect(LOG_MAX).toBe(30);
    expect(log).toHaveLength(30);
    expect(log[0]).toMatchObject({ kind: 'earn', what: 'found', n: 2 * EARN.found.credits });
    expect(log.at(-1)).toMatchObject({ n: 31 * EARN.found.credits });
    expect(typeof log[0].t).toBe('number');
    log.length = 0; // (a copy)
    expect(econ.log).toHaveLength(30);
    expect(econ.record().log).toHaveLength(30);
    econ.spend(10);
    expect(econ.log.at(-1)).toMatchObject({ kind: 'spend', n: 10 });
    timer.run();
    expect(stored(local).data.log).toHaveLength(30);
  });

  it('reads a log back, dropping junk entries', () => {
    const { econ } = fresh({ [PILOT_KEY]: { v: 2, data: { log: [{ t: 1, kind: 'buy', what: 'part:booster:srb', n: 400 }, { kind: 'steal', n: 9 }, 'x', null] } } });
    expect(econ.log).toEqual([{ t: 1, kind: 'buy', what: 'part:booster:srb', n: 400 }]);
  });
});
