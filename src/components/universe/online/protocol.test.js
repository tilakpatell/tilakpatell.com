import { describe, expect, it } from 'vitest';
import { DAMAGE_MAX, FLAG, FLOOD, GUARD, NAME_MAX, PACK_MAX, PUNCH_MAX, RATES, STALE_MS, aimedAt, allyStep, cleanName, createLimiter, hitCounts, hunterHitCounts, randomCallsign, readAlly, readCursor, readFoot, readHello, readHit, readHunterHit, readPack, readPose, readRam, readShot, ramCounts, RAM_MAX, sample, writeCursor, writeFactions, writeFoot, writeLooksWire, writePack, writePose, writeShot } from './protocol';
import { STOCK_LOADOUT, writeOutfit } from '../outfit';
import { CONTACT } from '../../../lib/combat/contact';
import { STOCK_BUILD, writeBuild } from '../shipyard/build';
import { defaultLook, readLook, readLooks, writeLook } from '../../rickmorty/wardrobe/looks';

describe('cleanName', () => {
  it('keeps an ordinary name', () => {
    expect(cleanName('Rogue Five')).toBe('Rogue Five');
  });
  it('trims, collapses spaces and caps the length', () => {
    expect(cleanName('  Red    Leader  ')).toBe('Red Leader');
    expect([...cleanName('x'.repeat(40))].length).toBe(NAME_MAX);
  });
  it('drops control and direction-override characters', () => {
    expect(cleanName('Han\u202eSolo')).toBe('HanSolo');
    expect(cleanName('a\u0000b\nc')).toBe('abc');
  });
  it('counts an emoji as one character, not its halves', () => {
    const name = cleanName('🚀'.repeat(20));
    expect([...name].length).toBe(NAME_MAX);
  });
  it('shows no slurs or obscenities, leetspeak and all, but leaves innocent words be', () => {
    for (const bad of ['sh1t lord', 'F.U.C.K', 'fuuuuck', 'Big Dick', 'KKK']) expect(cleanName(bad), bad).toBeNull();
    for (const ok of ['Cockpit Ace', 'Torpedo 7', 'Grape Ape', 'Class Act', 'Spicy Rick', 'Therapist', 'Hello Kitty', 'Kirk', 'Pass Go']) expect(cleanName(ok), ok).toBe(ok);
  });
  it('turns nothing into null', () => {
    expect(cleanName('   ')).toBeNull();
    expect(cleanName(42)).toBeNull();
    expect(cleanName(undefined)).toBeNull();
  });
});

describe('randomCallsign', () => {
  it('is a clean name', () => {
    for (let i = 0; i < 50; i++) {
      const n = randomCallsign();
      expect(cleanName(n)).toBe(n);
    }
  });
});

const NO_FACTIONS = { side: null, standing: null, war: null, oath: null, rank: null };

describe('readHello', () => {
  it('a hello without the new fields reads as before', () => {
    // (a pilot on a build from before the wallet: level 1, nobody's)
    const h = readHello({ n: 'Old Timer', k: 'falcon', c: 2, w: '/universe' });
    expect(h.level).toBe(1);
    expect(h.factions).toEqual(NO_FACTIONS);
    expect(h).toMatchObject({ name: 'Old Timer', kind: 'falcon', kills: 2, where: '/universe' });
  });
  it('lv is clamped and f is whitelisted', () => {
    expect(readHello({ n: 'A', lv: 99 }).level).toBe(11);
    expect(readHello({ n: 'A', lv: 7 }).level).toBe(7);
    expect(readHello({ n: 'A', lv: 4.7 }).level).toBe(4);
    for (const junk of [0, -3, '9', null, NaN, [5], { v: 5 }]) expect(readHello({ n: 'A', lv: junk }).level).toBe(1);
    expect(readHello({ n: 'A', f: { s: 'disney' } }).factions.side).toBeNull();
    expect(readHello({ n: 'A', f: { s: 'starwars' } }).factions.side).toBe('starwars');
    expect(readHello({ n: 'A', f: { o: 'empire', r: 'admiral' } }).factions).toMatchObject({ oath: 'empire', rank: 'admiral' });
    // (a rank that isn't the oath's side's is nobody's)
    expect(readHello({ n: 'A', f: { o: 'rebel', r: 'admiral' } }).factions).toMatchObject({ oath: 'rebel', rank: null });
    // nobody swears to the Hutts, and an oath must be to a side of the war named
    expect(readHello({ n: 'A', f: { o: 'hutt' } }).factions.oath).toBeNull();
    expect(readHello({ n: 'A', f: { w: 'clone', o: 'rebel' } }).factions).toMatchObject({ war: 'clone', oath: null });
    expect(readHello({ n: 'A', f: { w: 'order66', o: 'rebel' } }).factions).toMatchObject({ war: null, oath: 'rebel' });
    // standing names only from standing.js, and only with a side to have it with
    expect(readHello({ n: 'A', f: { s: 'rickmorty', st: { law: 'trusted', civil: 'emperor', outlaw: 7 } } }).factions.standing).toEqual({ law: 'trusted', civil: null, outlaw: null });
    expect(readHello({ n: 'A', f: { s: 'rickmorty', st: { law: 'friend' } } }).factions.standing).toEqual({ law: null, civil: null, outlaw: null });
    expect(readHello({ n: 'A', f: { st: { law: 'trusted' } } }).factions.standing).toBeNull();
    for (const junk of ['rebel', 7, [1, 2], null, { s: { toString: () => 'starwars' } }]) expect(readHello({ n: 'A', f: junk }).factions).toEqual(NO_FACTIONS);
  });
  it('writes the factions it reads back', () => {
    const f = { side: 'starwars', standing: { law: 'wanted', civil: null, outlaw: 'friend' }, war: 'gcw', oath: 'rebel', rank: 'flight-leader' };
    expect(readHello({ n: 'A', lv: 5, f: writeFactions(f) })).toMatchObject({ level: 5, factions: f });
    expect(readHello({ n: 'A', f: writeFactions(NO_FACTIONS) }).factions).toEqual(NO_FACTIONS);
  });

  it('reads a hello and cleans it', () => {
    expect(readHello({ n: ' Ace ', k: 'xwing', c: 3, w: '/middle-earth' })).toEqual({ name: 'Ace', kind: 'xwing', loadout: STOCK_LOADOUT, build: null, looks: null, kills: 3, where: '/middle-earth', level: 1, factions: NO_FACTIONS });
  });
  it('drops an unknown ship and bad kills', () => {
    expect(readHello({ n: 'A', k: '<img>', c: -5, w: 'javascript:alert(1)' })).toEqual({ name: 'A', kind: null, loadout: STOCK_LOADOUT, build: null, looks: null, kills: 0, where: null, level: 1, factions: NO_FACTIONS });
    expect(readHello({ n: '', k: null, c: 'lots' })).toEqual({ name: 'Pilot', kind: null, loadout: STOCK_LOADOUT, build: null, looks: null, kills: 0, where: null, level: 1, factions: NO_FACTIONS });
  });
  it('reads the paint job and parts fitted, and only ones it knows', () => {
    const l = { ...STOCK_LOADOUT, paint: 'sith', booster: 'portal', guns: 'fusion', fins: 'fins' };
    expect(readHello({ n: 'A', k: 'falcon', p: 'sith', o: writeOutfit(l) }).loadout).toEqual(l);
    // a colour, a shape, a part in the wrong slot or too many: none of it's believed
    expect(readHello({ n: 'A', k: 'falcon', p: '#ff0000', o: ['fusion', { r: 1 }, '<b>', 'portal', 'fins', 'srb', 'srb'] }).loadout).toEqual({ ...STOCK_LOADOUT, fins: 'fins' });
    expect(readHello({ n: 'A', k: 'falcon', p: 'aws', o: 'srb' }).loadout).toEqual({ ...STOCK_LOADOUT, paint: 'aws' });
  });
  it('reads the garage build flown, as ids it knows, and nothing else', () => {
    const b = { ...STOCK_BUILD, hull: 'hauler', wings: 'delta', engines: 'quad' };
    const { seed, ...ids } = b; // eslint-disable-line no-unused-vars
    expect(readHello({ n: 'A', k: 'rv', b: writeBuild(b) }).build).toEqual(ids);
    for (const junk of [[[1]], 'x'.repeat(500), 7, { hull: 'dart' }, ['dart', 'bubble', 'swept', 'twincans', 'fin', '<img>'], null]) {
      const h = readHello({ n: 'A', k: 'rv', b: junk });
      expect(h.build).toBeNull();
      expect(h.kind).toBe('rv');
    }
  });
  it('reads the looks of their Rick and Morty, by the wardrobe’s ids alone', () => {
    const rick = readLook('rick', { body: 'cowboyrick', colors: { outer: 'unitypurple' }, gear: { face: 'shades', hand: 'portalgun' } });
    const morty = readLook('morty', { body: 'evilmorty', gear: { head: 'crown' } });
    expect(readHello({ n: 'A', k: 'cruiser', l: [writeLook(rick), writeLook(morty)] }).looks).toEqual({ rick, morty });
    // one of them garbage: that one as the show has him
    expect(readHello({ n: 'A', k: 'cruiser', l: [writeLook(rick), [[1]]] }).looks).toEqual({ rick, morty: defaultLook('morty') });
    for (const junk of [7, 'x'.repeat(400), [[1, 2, 3], [{}]], [], null]) {
      const h = readHello({ n: 'A', k: 'cruiser', l: junk });
      expect(h.looks).toBeNull();
      expect(h.kind).toBe('cruiser');
    }
  });
  it('reads the looks of their Walt and Jesse beside them, each cast under its own key', () => {
    const walt = readLook('walt', { body: 'heisenberg', colors: { outer: 'bluesky' }, gear: { face: 'respirator' } });
    const jesse = readLook('jesse', { body: 'jesselab', gear: { head: 'porkpie', hand: 'bluebag' } });
    const rick = readLook('rick', { body: 'cop' });
    const morty = defaultLook('morty');
    const looks = { rick, morty, walt, jesse };
    const wire = writeLooksWire(looks);
    expect(wire.l).toEqual([writeLook(rick), writeLook(morty)]); // (Rick and Morty’s as they always went: a pilot whose site knows only them still reads theirs)
    expect(readHello({ n: 'A', k: 'rv', ...wire }).looks).toEqual(looks);
    expect(readHello({ n: 'A', k: 'rv', lb: wire.lb }).looks).toEqual({ walt, jesse });
    // one of them garbage: that one as the show has him; the other cast’s still read
    expect(readHello({ n: 'A', k: 'rv', l: wire.l, lb: [writeLook(walt), [[1]]] }).looks).toEqual({ rick, morty, walt, jesse: defaultLook('jesse') });
    expect(readHello({ n: 'A', k: 'rv', l: wire.l, lb: 'x'.repeat(400) }).looks).toEqual({ rick, morty });
    // never one cast’s look as another’s
    expect(readHello({ n: 'A', k: 'rv', lb: wire.l }).looks).toBeNull();
    expect(writeLooksWire(null)).toEqual({});
    // (a pair both as the show has them isn’t sent: that’s how they’re shown anyway)
    expect(writeLooksWire(readLooks(null))).toEqual({});
    expect(Object.keys(writeLooksWire({ ...readLooks(null), walt }))).toEqual(['lb']);
  });
  it('is null for anything that is not an object', () => {
    expect(readHello(null)).toBeNull();
    expect(readHello([1, 2])).toBeNull();
    expect(readHello('hi')).toBeNull();
  });
});

describe('poses', () => {
  const ship = { x: 12.3456, y: -1.2, z: 40.01, heading: 1.2, pitch: 0.1, bank: -0.3, speed: 5.5, vy: 0.4 };
  it('round-trips', () => {
    const p = readPose(writePose(ship, 2));
    expect(p.x).toBeCloseTo(12.35, 2);
    expect(p.heading).toBeCloseTo(1.2, 3);
    expect(p.vy).toBeCloseTo(0.4, 2);
    expect(p.boost).toBe(true);
    expect(p.hidden).toBe(false);
  });
  it('carries a ship upside down, and the lean into a turn on its bank', () => {
    expect(readPose(writePose({ ...ship, bank: Math.PI - 0.01 })).bank).toBeCloseTo(Math.PI - 0.01, 3);
    expect(readPose(writePose({ ...ship, bank: 0.2, lean: 0.3 })).bank).toBeCloseTo(0.5, 3);
    expect(readPose(writePose({ ...ship, bank: 3, lean: 0.3 })).bank).toBeCloseTo(3.3 - 2 * Math.PI, 3); // (round past upside down)
  });
  it('refuses junk and clamps the rest', () => {
    expect(readPose([1, 2])).toBeNull();
    expect(readPose(['a', 0, 0, 0, 0, 0, 0, 0, 0])).toBeNull();
    expect(readPose([NaN, 0, 0, 0, 0, 0, 0, 0, 0])).toBeNull();
    const p = readPose([1e9, 0, 0, 0, 9, 0, 1e6, 0, 1]);
    expect(p.x).toBe(90000);
    expect(p.pitch).toBe(1.6);
    expect(p.speed).toBe(5000);
    expect(p.hidden).toBe(true);
  });
  it('reaches as far as the spread universe does, and as fast as its lanes run', () => {
    // (the Rick and Morty sector sits at z −66,000 since the spread to six, its far edge −72,000; the fastest ever ran at 4,000 a second)
    const p = readPose(writePose({ ...ship, x: 54000, z: -70000, speed: 4000 }));
    expect(p.x).toBe(54000);
    expect(p.z).toBe(-70000);
    expect(p.speed).toBe(4000);
    expect(readPose([0, 1e9, 0, 0, 0, 0, 0, 0, 0]).y).toBe(1300); // (the height is as it was)
  });
  it('carries the sector out in the Expanse, with x and z from its middle, and reads one without as the authored map', () => {
    const out = writePose({ ...ship, x: 185184.78, y: 5, z: -121500 });
    expect(out[10]).toBe('E:2,-1');
    expect(out[0]).toBeCloseTo(185184.78 - 240000, 2);
    expect(out[2]).toBeCloseTo(-121500 + 120000, 2);
    const p = readPose(out);
    expect(p.sec).toBe('E:2,-1');
    expect(p.x).toBeCloseTo(185184.78, 2);
    expect(p.z).toBeCloseTo(-121500, 2);
    // (on the authored map: no sector, as before)
    expect(writePose(ship)).toHaveLength(10);
    expect(readPose(writePose(ship)).sec).toBeUndefined();
    // (a reader given no sector, or junk for one, takes the map's coordinates)
    expect(readPose([1, 2, 3, 0, 0, 0, 5, 0, 2, 100, 'E:x']).x).toBe(1);
    expect(readPose([1, 2, 3, 0, 0, 0, 5, 0, 2, 100, 'main']).sec).toBeUndefined();
    // (an Expanse pose is kept near its own sector)
    expect(readPose([1e9, 0, 0, 0, 0, 0, 0, 0, 0, 100, 'E:1,0']).x).toBe(120000 + 62000);
  });
  it('says when a pilot is riding a lane, and an old pose says they are not', () => {
    expect(FLAG.lane).toBe(8);
    expect(readPose(writePose(ship, FLAG.lane)).lane).toBe(true);
    expect(readPose(writePose(ship, FLAG.boost | FLAG.lane)).boost).toBe(true);
    expect(readPose(writePose(ship, FLAG.boost)).lane).toBe(false);
    // (nine fields, from a pilot whose site is older than the shields on the pose)
    expect(readPose([1, 2, 3, 0, 0, 0, 5, 0, 2]).lane).toBe(false);
  });
  it('carries the lane bit to where they are drawn', () => {
    const snaps = [
      { ...readPose(writePose(ship, FLAG.lane)), at: 0 },
      { ...readPose(writePose({ ...ship, x: 20 }, FLAG.lane)), at: 100 },
    ];
    expect(sample(snaps, 190).lane).toBe(true); // (between the two)
    expect(sample(snaps, 300).lane).toBe(true); // (and past the newest)
  });
});

describe('crews on foot', () => {
  const n = [0, 1, 0];
  const walker = (who, extra = {}) => ({ who, n: [0.6, 0.8, 0], f: [0, 0, 1], h: 0.01, speed: 0.05, side: 0, aim: 1, ...extra });
  const crew = { planet: 'breakingbad', kind: 'rv', ship: { n, f: [1, 0, 0] }, lead: walker('walt'), mate: walker('jesse') };

  it('round-trips, through the wire as JSON', () => {
    const f = readFoot(JSON.parse(JSON.stringify(writeFoot(crew))));
    expect(f.planet).toBe('breakingbad');
    expect(f.kind).toBe('rv');
    expect(f.ship.n).toEqual([0, 1, 0]);
    expect(f.lead.who).toBe('walt');
    expect(f.lead.n[0]).toBeCloseTo(0.6, 4);
    expect(f.lead.speed).toBeCloseTo(0.05, 4);
    expect(f.lead.aim).toBe(1);
    expect(f.mate.who).toBe('jesse');
  });
  it('carries what the body is doing beside where it is, and reads an older packet as doing nothing', () => {
    const f = readFoot(JSON.parse(JSON.stringify(writeFoot({ ...crew, lead: walker('walt', { e: ['wave', 1.234], hurt: 0.5, down: 1 }) }))));
    expect(f.lead.e).toEqual(['wave', 1.23]);
    expect(f.lead.hurt).toBe(0.5);
    expect(f.lead.down).toBe(1);
    expect(f.mate.e).toBeNull();
    expect(f.mate.hurt).toBe(0);
    expect(f.mate.down).toBe(0);
    const old = readFoot({ ...writeFoot(crew), a: ['walt', 0.6, 0.8, 0, 0, 0, 1, 0, 0, 0, 1] });
    expect(old.lead.e).toBeNull();
    expect(old.lead.down).toBe(0);
    expect(readFoot({ ...writeFoot(crew), a: ['walt', 0.6, 0.8, 0, 0, 0, 1, 0, 0, 0, 1, ['wave', 'x'], 9, -1] }).lead).toMatchObject({ e: null, hurt: 1, down: 0 });
  });
  it('says when the crew are back in, and takes a ship just landing with nobody out', () => {
    expect(readFoot(writeFoot(null))).toEqual({ off: true });
    const landing = readFoot(writeFoot({ ...crew, lead: null, mate: null }));
    expect(landing.lead).toBeNull();
    expect(landing.ship.n).toEqual([0, 1, 0]);
  });
  it('makes the directions unit ones, along the ground', () => {
    const f = readFoot(writeFoot({ ...crew, lead: walker('walt', { n: [0, 2, 0], f: [0, 0.5, 1] }) }));
    expect(Math.hypot(...f.lead.n)).toBeCloseTo(1, 6);
    expect(Math.hypot(...f.lead.f)).toBeCloseTo(1, 6);
    expect(f.lead.f[0] * f.lead.n[0] + f.lead.f[1] * f.lead.n[1] + f.lead.f[2] * f.lead.n[2]).toBeCloseTo(0, 6);
  });
  it('refuses a station, a stranger, junk numbers, and clamps the rest', () => {
    expect(readFoot(writeFoot({ ...crew, planet: 'home' }))).toBeNull(); // (no landing on a station)
    expect(readFoot(writeFoot({ ...crew, planet: 'starwars' }))).toBeNull(); // (nor on the gate into the galaxy)
    expect(readFoot(writeFoot({ ...crew, planet: 'nowhere' }))).toBeNull();
    expect(readFoot(writeFoot({ ...crew, lead: walker('vader') }))).toBeNull();
    expect(readFoot({ ...writeFoot(crew), s: [0, 0, 0, 1, 0, 0] })).toBeNull(); // (no way up)
    expect(readFoot({ ...writeFoot(crew), a: ['walt', NaN, 1, 0, 0, 0, 1, 0, 0, 0, 0] })).toBeNull();
    expect(readFoot([1, 2, 3])).toBeNull();
    expect(readFoot(null)).toBeNull();
    const fast = readFoot(writeFoot({ ...crew, lead: walker('walt', { speed: 99, h: 99 }), mate: walker('nobody') }));
    expect(fast.lead.speed).toBeLessThan(1);
    expect(fast.lead.h).toBeLessThan(0.1);
    expect(fast.mate).toBeNull();
  });
  it('is rate-limited like a pose', () => {
    expect(RATES.foot).toEqual(RATES.pose);
  });
});

describe('cursors', () => {
  it('round-trips', () => {
    expect(readCursor(writeCursor(-120.4, 900.6, false))).toEqual({ x: -120, y: 901, touch: false });
    expect(readCursor(writeCursor(0, 10, true)).touch).toBe(true);
  });
  it('refuses junk and clamps the rest', () => {
    expect(readCursor([1])).toBeNull();
    expect(readCursor(['a', 0, 0])).toBeNull();
    expect(readCursor([1e9, -5, 0])).toEqual({ x: 5000, y: 0, touch: false });
  });
});

describe('shots', () => {
  it('round-trips', () => {
    const s = readShot(writeShot({ x: 1, y: 2, z: 3 }, [0, 0, -20]));
    expect(s).toEqual({ p: [1, 2, 3], v: [0, 0, -20], w: 0 });
  });
  it('carries the weapon, and reads an unknown one as the blaster', () => {
    expect(readShot(writeShot({ x: 1, y: 2, z: 3 }, [0, 0, -20], 2)).w).toBe(2);
    expect(readShot([1, 2, 3, 0, 0, -20, 7]).w).toBe(0);
    expect(readShot([1, 2, 3, 0, 0, -20, 'x']).w).toBe(0);
  });

  it('a shot code past the table reads as the blaster', () => {
    expect(readShot([0, 0, 0, 1, 0, 0, 40]).w).toBe(0);
    expect(readShot([0, 0, 0, 1, 0, 0, 6]).w).toBe(6);
    expect(readShot([0, 0, 0, 1, 0, 0, 2]).w).toBe(2); // (an old peer's heavy round is still one)
    expect(readShot([0, 0, 0, 1, 0, 0, 2.5]).w).toBe(0);
    expect(readShot([0, 0, 0, 1, 0, 0, -1]).w).toBe(0);
  });
  it('refuses one from far off where the pilot was, or impossibly fast', () => {
    expect(readShot([50, 0, 0, 0, 0, -20], { x: 0, y: 0, z: 0 })).toBeNull();
    expect(readShot([0, 0, 0, 0, 0, -5000])).toBeNull();
    expect(readShot([0, 0, 0, 0, 0])).toBeNull();
  });
  it('reads a shot fired anywhere in the spread universe', () => {
    const s = readShot(writeShot({ x: 45000, y: 0, z: -70000 }, [0, 0, -20]));
    expect(s.p).toEqual([45000, 0, -70000]);
    expect(readShot([1e9, 0, 0, 0, 0, -20]).p[0]).toBe(90000);
  });
});

describe('rams', () => {
  it('reads the closing speed, capped, and nothing else', () => {
    expect(readRam({ v: 8 })).toBe(8);
    expect(readRam({ v: 1e9 })).toBe(RAM_MAX);
    expect(readRam({ v: -3 })).toBe(0);
    expect(readRam({ v: 'fast' })).toBeNull();
    expect(readRam(null)).toBeNull();
  });
  const me = { x: 0, y: 0, z: 0, speed: 6 };
  const peer = (o = {}) => ({ ally: 'none', blocked: false, ramAt: -Infinity, pose: { x: 0.5, y: 0, z: 0, speed: 6 }, ...o });
  it('counts a ram from a pilot last seen touching you, as hard as both your speeds allow', () => {
    expect(ramCounts(peer(), me, 9, 1000)).toBe(9);
    expect(ramCounts(peer(), me, 500, 1000)).toBe(12); // (6 and 6: no harder)
  });
  it('gives the touch more room the faster you both go', () => {
    const off = (speed) => peer({ pose: { x: 4, y: 0, z: 0, speed } });
    expect(ramCounts(off(0), { ...me, speed: 0 }, 2, 1000)).toBeNull();
    expect(ramCounts(off(6), me, 2, 1000)).toBe(2); // (1.5 + 12 × 0.35 = 5.7)
  });
  it('ignores allies, the blocked, one not seen, one far off, and one too soon after the last', () => {
    expect(ramCounts(peer({ ally: 'ally' }), me, 8, 1000)).toBeNull();
    expect(ramCounts(peer({ blocked: true }), me, 8, 1000)).toBeNull();
    expect(ramCounts(peer({ pose: null }), me, 8, 1000)).toBeNull();
    expect(ramCounts(peer({ pose: { x: 40, y: 0, z: 0, speed: 6 } }), me, 8, 1000)).toBeNull();
    expect(ramCounts(peer({ ramAt: 900 }), me, 8, 1000)).toBeNull();
    expect(ramCounts(peer({ ramAt: 900 }), me, 8, 900 + CONTACT.cool * 1000)).toBe(8);
    expect(ramCounts(peer(), null, 8, 1000)).toBeNull();
  });
});

describe('hits', () => {
  it('caps the damage', () => {
    expect(readHit({ d: 999 })).toBe(DAMAGE_MAX);
    expect(readHit({ d: -1 })).toBeNull();
    expect(readHit({})).toBeNull();
  });
  const me = { x: 0, y: 0, z: 0, speed: 0 };
  const atMe = { p: [5, 0, 0], v: [-18, 0, 0], at: 1000 }; // from 5 off, straight at you
  const peer = (o = {}) => ({ ally: 'none', blocked: false, shots: [atMe], hitAt: -Infinity, pose: { x: 5, y: 0, z: 0 }, ...o });
  it('counts a fair hit', () => {
    expect(hitCounts(peer(), me, 1200)).toBe(true);
  });
  it('ignores allies, the blocked, and anyone with no shot lately', () => {
    expect(hitCounts(peer({ ally: 'ally' }), me, 1200)).toBe(false);
    expect(hitCounts(peer({ blocked: true }), me, 1200)).toBe(false);
    expect(hitCounts(peer(), me, 1000 + GUARD.shotWindow + 1)).toBe(false);
  });
  it('ignores a hit from a shot that went nowhere near you', () => {
    const wide = { p: [5, 0, 0], v: [0, 0, -18], at: 1000 }; // fired off to the side
    expect(hitCounts(peer({ shots: [wide] }), me, 1200)).toBe(false);
    expect(hitCounts(peer({ shots: [] }), me, 1200)).toBe(false);
  });
  it('gives the aim more room the faster you were going', () => {
    const near = { p: [5, 0, 4], v: [-18, 0, 0], at: 1000 }; // passes 4 off
    expect(aimedAt([near], me, 1200)).toBe(false);
    expect(aimedAt([near], { ...me, speed: 5.5 }, 1200)).toBe(true);
  });
  it('ignores hits faster than the guns fire, or from too far', () => {
    expect(hitCounts(peer({ hitAt: 1150 }), me, 1200)).toBe(false);
    expect(hitCounts(peer({ pose: { x: GUARD.range + 1, y: 0, z: 0 } }), me, 1200)).toBe(false);
  });
  it('ignores hits while you are not flying', () => {
    expect(hitCounts(peer(), null, 1200)).toBe(false);
  });
});

describe('safe pilots', () => {
  it('says on the pose when a pilot is just back, and carries it to where they are drawn', () => {
    const s = { x: 1, y: 2, z: 3, heading: 0.5, pitch: 0, bank: 0, speed: 4, vy: 0 };
    expect(readPose(writePose(s, FLAG.safe | FLAG.boost)).safe).toBe(true);
    expect(readPose(writePose(s, FLAG.boost)).safe).toBe(false);
    const snaps = [
      { ...readPose(writePose(s, 0)), at: 0 },
      { ...readPose(writePose({ ...s, x: 2 }, FLAG.safe)), at: 100 },
    ];
    expect(sample(snaps, 190).safe).toBe(true); // (between the two: the newer's word)
    expect(sample(snaps, 300).safe).toBe(true); // (and past it)
  });
});

describe('the hunters after a pilot', () => {
  const wire = [
    [7, 'tie', 10.123456, -2, 30, 19.04, 0, -1.26, 1],
    [8, 'tieadvanced', 12, 0, 31, 0, 0, 26, 4],
  ];
  it('round-trips, rounded, through the wire as JSON', () => {
    const got = readPack(JSON.parse(JSON.stringify(writePack(wire))));
    expect(got).toEqual([
      { id: 7, kind: 'tie', x: 10.12, y: -2, z: 30, vx: 19, vy: 0, vz: -1.3, hp: 1 },
      { id: 8, kind: 'tieadvanced', x: 12, y: 0, z: 31, vx: 0, vy: 0, vz: 26, hp: 4 },
    ]);
    expect(readPack([])).toEqual([]); // (they're gone)
  });
  it('knows the galaxy’s hunters too', () => {
    expect(readPack([[1, 'vulture', 0, 0, 0, 0, 0, 0, 1]])).toHaveLength(1);
    expect(readPack([[1, 'suv', 0, 0, 0, 0, 0, 0, 1]])).toHaveLength(1); // (another side's)
    expect(readPack([[1, 'tractor', 0, 0, 0, 0, 0, 0, 1]])).toHaveLength(0); // (nobody's)
  });
  it('sends and takes no more than it should', () => {
    const many = Array.from({ length: 20 }, (_, i) => [i + 1, 'tie', i, 0, 0, 0, 0, 0, 1]);
    expect(writePack(many)).toHaveLength(PACK_MAX);
    expect(readPack(many)).toHaveLength(PACK_MAX);
  });
  it('refuses junk, leaves out what it does not know, and clamps the rest', () => {
    expect(readPack(null)).toBeNull();
    expect(readPack({ 0: wire[0] })).toBeNull();
    const got = readPack([
      [1, 'deathstar', 0, 0, 0, 0, 0, 0, 1], // no such hunter
      [2, '__proto__', 0, 0, 0, 0, 0, 0, 1],
      [3, 'tie', NaN, 0, 0, 0, 0, 0, 1],
      [4.5, 'tie', 0, 0, 0, 0, 0, 0, 1],
      'tie',
      [5, 'tie', 1e9, 0, 0, 1e9, 'fast', 0, 1e9],
      [5, 'tie', 0, 0, 0, 0, 0, 0, 1], // the same one twice
    ]);
    expect(got).toEqual([{ id: 5, kind: 'tie', x: 90000, y: 0, z: 0, vx: 80, vy: 0, vz: 0, hp: 99 }]);
  });
  it('reads hunters anywhere in the spread universe', () => {
    expect(readPack([[1, 'tie', 20000, 0, -70000, 0, 0, 0, 1]])[0]).toMatchObject({ x: 20000, z: -70000 });
  });
  it('reads a hit on one, capped at what a bolt can be worth', () => {
    expect(readHunterHit({ i: 7, d: 1 })).toEqual({ id: 7, damage: 1 });
    expect(readHunterHit({ i: 7, d: 50 })).toEqual({ id: 7, damage: PUNCH_MAX });
    expect(readHunterHit({ i: 7, d: 2.9 })).toEqual({ id: 7, damage: 2 });
    for (const bad of [null, {}, { i: 7 }, { i: 7, d: 0 }, { i: 7, d: 0.01 }, { i: 7, d: -1 }, { i: 'x', d: 1 }, { i: 1.5, d: 1 }]) expect(readHunterHit(bad)).toBeNull();
  });
  it('believes a hit on one of yours only from a pilot who just fired, close to it', () => {
    const at = { x: 0, y: 0, z: 0 };
    const peer = { blocked: false, shotAt: 900, pose: { x: 10, y: 0, z: 0 } };
    expect(hunterHitCounts(peer, at, 1000)).toBe(true);
    expect(hunterHitCounts({ ...peer, blocked: true }, at, 1000)).toBe(false);
    expect(hunterHitCounts({ ...peer, shotAt: 1000 - GUARD.shotWindow - 1 }, at, 1000)).toBe(false);
    expect(hunterHitCounts({ ...peer, pose: { x: GUARD.reach - 1, y: 0, z: 0 } }, at, 1000)).toBe(true);
    expect(hunterHitCounts({ ...peer, pose: { x: GUARD.reach + 1, y: 0, z: 0 } }, at, 1000)).toBe(false);
    expect(hunterHitCounts({ ...peer, pose: null }, at, 1000)).toBe(false);
    expect(hunterHitCounts(peer, null, 1000)).toBe(false);
  });
  it('has a share of messages for both', () => {
    expect(RATES.pack).toBeTruthy();
    expect(RATES.hhit).toBeTruthy();
  });
});

describe('createLimiter', () => {
  it('lets a pilot send their share, then turns the rest away', () => {
    const lim = createLimiter();
    const [, burst] = RATES.shot;
    let ok = 0;
    for (let i = 0; i < 20; i++) ok += lim.allow('shot', 1000) ? 1 : 0;
    expect(ok).toBe(burst);
    expect(lim.allow('shot', 1000 + 1000 / RATES.shot[0] + 1)).toBe(true); // one more, a moment on
  });
  it('turns away a kind it does not know', () => {
    expect(createLimiter().allow('bogus', 0)).toBe(false);
  });
  it('calls a flood a flood, and forgets it in time', () => {
    const lim = createLimiter();
    for (let i = 0; i < 200; i++) lim.allow('pose', 1000);
    expect(lim.flooding(1000)).toBe(true);
    expect(lim.flooding(1000 + FLOOD.window + 1)).toBe(false);
  });
  it('a steady pose stream is fine', () => {
    const lim = createLimiter();
    let ok = 0;
    for (let t = 0; t < 10000; t += 100) ok += lim.allow('pose', t) ? 1 : 0;
    expect(ok).toBe(100);
    expect(lim.flooding(10000)).toBe(false);
  });
});

describe('allyStep', () => {
  it('asks, and the other side accepts', () => {
    const a = allyStep('none', 'ask');
    expect(a).toEqual({ state: 'sent', send: 'ask' });
    const b = allyStep('none', { in: 'ask' });
    expect(b).toEqual({ state: 'got', send: null });
    const b2 = allyStep(b.state, 'accept');
    expect(b2).toEqual({ state: 'ally', send: 'yes' });
    expect(allyStep(a.state, { in: 'yes' })).toEqual({ state: 'ally', send: null });
  });
  it('a yes nobody asked for does nothing', () => {
    expect(allyStep('none', { in: 'yes' }).state).toBe('none');
    expect(allyStep('got', { in: 'yes' }).state).toBe('got');
  });
  it('both asking at once is an alliance', () => {
    expect(allyStep('sent', { in: 'ask' })).toEqual({ state: 'ally', send: 'yes' });
    expect(allyStep('got', 'ask')).toEqual({ state: 'ally', send: 'yes' });
  });
  it('declines and ends', () => {
    expect(allyStep('got', 'decline')).toEqual({ state: 'none', send: 'no' });
    expect(allyStep('sent', { in: 'no' }).state).toBe('none');
    expect(allyStep('ally', 'end')).toEqual({ state: 'none', send: 'end' });
    expect(allyStep('ally', { in: 'end' }).state).toBe('none');
  });
  it('ignores what makes no sense', () => {
    expect(allyStep('none', 'accept')).toEqual({ state: 'none', send: null });
    expect(allyStep('none', { in: 'bogus' })).toEqual({ state: 'none', send: null });
    expect(allyStep(undefined, 'end')).toEqual({ state: 'none', send: null });
  });
});

describe('readAlly', () => {
  it('reads each word of an alliance, and keeps the k of an ask from a pilot who has you saved', () => {
    for (const t of ['ask', 'yes', 'no', 'end']) expect(readAlly({ t })).toEqual({ t, k: 0 });
    expect(readAlly({ t: 'ask', k: 1 })).toEqual({ t: 'ask', k: 1 });
  });
  it('turns away what isn’t one, and a k that isn’t 1 is none', () => {
    for (const junk of [null, undefined, 'ask', ['ask'], {}, { t: 'bogus' }, { t: 'ASK' }, { t: ['ask'] }]) expect(readAlly(junk)).toBeNull();
    for (const k of [2, '1', true, -1, 0.5, null]) expect(readAlly({ t: 'ask', k })).toEqual({ t: 'ask', k: 0 });
  });
});

describe('sample', () => {
  const snap = (at, x, heading = 0) => ({ at, x, y: 0, z: 0, heading, pitch: 0, bank: 0, speed: 0, vy: 0, hidden: false, boost: false });
  it('draws between the poses either side, a little in the past', () => {
    const s = sample([snap(0, 0), snap(100, 10)], 190, 140);
    expect(s.x).toBeCloseTo(5);
  });
  it('turns the short way round', () => {
    const s = sample([snap(0, 0, 3.1), snap(100, 0, -3.1)], 190, 140);
    expect(Math.abs(s.heading)).toBeGreaterThan(3.1);
  });
  it('goes over the top of a loop the short way, not spinning round', () => {
    // nose just short of straight up, then just past it (on its back, going the other way)
    const a = { ...snap(0, 0), pitch: 1.5 };
    const b = { ...snap(100, 0), heading: Math.PI, pitch: 1.5, bank: Math.PI };
    const s = sample([a, b], 190, 140);
    expect(Math.sin(s.pitch)).toBeGreaterThan(0.999); // straight up between them
  });
  it('guesses a little way ahead of the newest, then gives up', () => {
    const moving = { ...snap(0, 0), speed: 10 };
    const s = sample([moving], 1000, 140);
    expect(s.z).toBeCloseTo(-2.5); // heading 0 is −z; 250 ms at most
    expect(sample([moving], STALE_MS + 1)).toBeNull();
    expect(sample([], 0)).toBeNull();
  });
});

describe('down on a world in the galaxy', () => {
  it('sends where the crew are, and reads it back', async () => {
    const { readWalk, writeWalk } = await import('./protocol');
    const sent = writeWalk({ world: 'tatooine', kind: 'xwing', lead: { who: 'luke', x: 12.345, y: 3.2, z: -40.1, yaw: 1.2, speed: 3.3 }, mate: { who: 'artoo', x: 11, y: 3.1, z: -41, yaw: 1.1, speed: 3 }, ride: 'landspeeder' });
    const got = readWalk(JSON.parse(JSON.stringify(sent)));
    expect(got.world).toBe('tatooine');
    expect(got.kind).toBe('xwing');
    expect(got.lead).toMatchObject({ who: 'luke', x: 12.35, y: 3.2, z: -40.1, yaw: 1.2 });
    expect(got.mate.who).toBe('artoo');
    expect(got.ride).toBe('landspeeder');
    expect(readWalk(writeWalk(null))).toEqual({ off: true });
  });

  it('says how far the lead’s gun is up, and an older pilot’s message (without it) reads as down', async () => {
    const { readWalk, writeWalk } = await import('./protocol');
    const got = readWalk(JSON.parse(JSON.stringify(writeWalk({ world: 'hoth', kind: 'falcon', lead: { who: 'han', x: 1, y: 2, z: 3, yaw: 0, speed: 0, aim: 0.734 }, mate: null }))));
    expect(got.lead.aim).toBeCloseTo(0.73, 2);
    expect(readWalk({ w: 'hoth', a: ['han', 1, 2, 3, 0, 0] }).lead.aim).toBe(0);
    expect(readWalk({ w: 'hoth', a: ['han', 1, 2, 3, 0, 0, 7] }).lead.aim).toBe(1); // (held to its range)
    expect(readWalk({ w: 'hoth', a: ['han', 1, 2, 3, 0, 0, 'up'] }).lead.aim).toBe(0);
  });

  it('says what is in the lead’s hand: a hero’s gun, or a lit saber with its colour and stance', async () => {
    const { readWalk, writeWalk } = await import('./protocol');
    const sent = writeWalk({ world: 'hoth', kind: 'xwing', lead: { who: 'luke', x: 1, y: 2, z: 3, yaw: 0, speed: 0, aim: 1, arms: { gun: 'saber', lit: true, color: '#f4f8ff', stance: 'double', swing: true } }, mate: { who: 'han', x: 1, y: 2, z: 3, yaw: 0, speed: 0, arms: { gun: 'shotgun' } } });
    const got = readWalk(JSON.parse(JSON.stringify(sent)));
    expect(got.lead.arms).toEqual({ gun: 'saber', lit: true, color: '#f4f8ff', stance: 'double', swing: true });
    // (an older pilot's stance the game's heroes don't hold, a pair or a crossguard: one blade)
    expect(readWalk({ w: 'hoth', a: ['luke', 1, 2, 3, 0, 0, 0, ['saber', 1, '#4aa8ff', 'dual', 1]] }).lead.arms.stance).toBe('single');
    expect(got.mate.arms).toEqual({ gun: 'shotgun', lit: false, color: '#4aa8ff', stance: 'single', swing: false });
    expect(readWalk({ w: 'hoth', a: ['han', 1, 2, 3, 0, 0, 0] }).lead.arms).toBeNull(); // (an older pilot)
    expect(readWalk({ w: 'hoth', a: ['han', 1, 2, 3, 0, 0, 0, ['rocket', 1]] }).lead.arms).toBeNull(); // (no such gun)
    expect(readWalk({ w: 'hoth', a: ['leia', 1, 2, 3, 0, 0, 0, ['saber', 1, 'javascript:', 'nope', 1]] }).lead.arms).toEqual({ gun: 'saber', lit: true, color: '#4aa8ff', stance: 'single', swing: true });
  });

  it('says which clip a stroke is, after the old five, so a peer plays the same one; an older packet still reads', async () => {
    const { readWalk, writeWalk } = await import('./protocol');
    const sent = writeWalk({ world: 'hoth', kind: 'xwing', lead: { who: 'luke', x: 1, y: 2, z: 3, yaw: 0, speed: 0, arms: { gun: 'saber', lit: true, color: '#4aa8ff', stance: 'single', swing: true, stroke: 'sword.light.b' } } });
    expect(sent.a[7]).toHaveLength(6);
    expect(sent.a[7].slice(0, 5)).toEqual(['saber', 1, '#4aa8ff', 'single', 1]);
    const got = readWalk(JSON.parse(JSON.stringify(sent)));
    expect(got.lead.arms.stroke).toBe('sword.light.b');
    // (five items, as an older pilot sends: no stroke, the rest as ever)
    expect(readWalk({ w: 'hoth', a: ['luke', 1, 2, 3, 0, 0, 0, ['saber', 1, '#4aa8ff', 'double', 1]] }).lead.arms).toEqual({ gun: 'saber', lit: true, color: '#4aa8ff', stance: 'double', swing: true });
    // (only a sword clip's name: anything else is no stroke)
    for (const bad of ['dance', 'sword.<b>', 'x'.repeat(80), 7]) expect(readWalk({ w: 'hoth', a: ['luke', 1, 2, 3, 0, 0, 0, ['saber', 1, '#4aa8ff', 'single', 1, bad]] }).lead.arms.stroke).toBeUndefined();
    // (no stroke, nothing sent for it)
    expect(writeWalk({ world: 'hoth', kind: 'xwing', lead: { who: 'han', x: 1, y: 2, z: 3, yaw: 0, speed: 0, arms: { gun: 'shotgun' } } }).a[7]).toHaveLength(5);
  });

  it('says the lead’s emote and how each moves, and an older pilot’s message (without them) reads as none', async () => {
    const { readWalk, writeWalk } = await import('./protocol');
    const sent = writeWalk({ world: 'hoth', kind: 'xwing', lead: { who: 'luke', x: 1, y: 2, z: 3, yaw: 0, speed: 3, emote: ['wave', 1.3], motion: { speed: 3.04, side: -0.26, turn: 1.23 } }, mate: { who: 'han', x: 1, y: 2, z: 3, yaw: 0, speed: 0, motion: { speed: 0, side: 0, turn: 0 } } });
    const got = readWalk(JSON.parse(JSON.stringify(sent)));
    expect(got.lead.emote).toEqual({ id: 'wave', age: 1.3 });
    expect(got.lead.motion).toEqual({ speed: 3, side: -0.3, turn: 1.2 });
    expect(got.lead.arms).toBeNull();
    expect(got.mate.motion).toEqual({ speed: 0, side: 0, turn: 0 });
    expect(got.mate).not.toHaveProperty('emote');
    // the arms still read beside them
    const armed = readWalk(JSON.parse(JSON.stringify(writeWalk({ world: 'hoth', kind: 'xwing', lead: { who: 'han', x: 1, y: 2, z: 3, yaw: 0, speed: 0, arms: { gun: 'shotgun' }, emote: ['cheer', 0] } }))));
    expect(armed.lead.arms.gun).toBe('shotgun');
    expect(armed.lead.emote).toEqual({ id: 'cheer', age: 0 });
    // without them, the message is as it was
    expect(writeWalk({ world: 'hoth', kind: 'xwing', lead: { who: 'han', x: 1, y: 2, z: 3, yaw: 0, speed: 0 } }).a).toHaveLength(7);
    const old = readWalk({ w: 'hoth', a: ['han', 1, 2, 3, 0, 0, 0] }).lead;
    expect(old).not.toHaveProperty('emote');
    expect(old).not.toHaveProperty('motion');
    // and what isn't one is dropped
    const bad = readWalk({ w: 'hoth', a: ['han', 1, 2, 3, 0, 0, 0, null, ['moonwalk', 1], ['fast', 0, 0]] }).lead;
    expect(bad).not.toHaveProperty('emote');
    expect(bad).not.toHaveProperty('motion');
    expect(writeWalk({ world: 'hoth', kind: 'xwing', lead: { who: 'han', x: 1, y: 2, z: 3, yaw: 0, speed: 0, emote: ['moonwalk', 1] } }).a).toHaveLength(7);
  });

  it('turns away what isn’t a crew on a world', async () => {
    const { readWalk } = await import('./protocol');
    expect(readWalk(null)).toBeNull();
    expect(readWalk({ w: 'tatooine', a: ['vader', 0, 0, 0, 0, 0] })).toBeNull();
    expect(readWalk({ w: '../etc', a: ['luke', 0, 0, 0, 0, 0] })).toBeNull();
    expect(readWalk({ w: 'tatooine', a: ['luke', 'x', 0, 0, 0, 0] })).toBeNull();
    expect(readWalk({ w: 'tatooine', a: ['luke', 1, 2, 3, 0, 0], r: 'deathstar' }).ride).toBeNull();
  });
});
