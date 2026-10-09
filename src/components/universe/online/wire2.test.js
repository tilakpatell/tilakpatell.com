import { describe, expect, it } from 'vitest';
import { CLIENT_RATES, PING_KINDS, RATES2, readInvite, readPing, readPoint, readQuick, readSay, writePing, writePoint } from './wire2';
import { RATES } from './protocol';

describe('what pilots say', () => {
  it('a line to everyone: cleaned again on the way in, to all or to here', () => {
    expect(readSay({ t: 'hello', s: 1 })).toEqual({ text: 'hello', all: true });
    expect(readSay({ t: '  hi ‮ there https://x.io ', s: 0 })).toEqual({ text: 'hi there [link]', all: false });
    expect(readSay({ t: 'x'.repeat(5000), s: 1 }).text).toHaveLength(160);
    for (const junk of [null, 'hello', [], {}, { t: 'hi' }, { t: 'hi', s: 2 }, { t: 'hi', s: true }, { t: '   ', s: 1 }, { t: 42, s: 1 }]) expect(readSay(junk)).toBeNull();
  });

  it('a quick-chat phrase is its id', () => {
    for (let i = 0; i < 16; i++) expect(readQuick(i)).toBe(i);
    for (const junk of [16, -1, 2.5, '3', null, {}, [3]]) expect(readQuick(junk)).toBeNull();
  });

  it('a ping round-trips: its kind, where, the point and what it marks', () => {
    expect(PING_KINDS).toEqual(['go', 'help', 'foe', 'look']);
    const ping = { kind: 'foe', where: '/galaxy/hoth', p: [12.345, 3, -40], target: 'tie-7' };
    expect(readPing(writePing(ping))).toEqual({ kind: 'foe', where: '/galaxy/hoth', p: [12.35, 3, -40], sec: null, target: 'tie-7' });
    // out in the Expanse, with its sector; with no point, only where (a page with no ping source)
    const far = readPing(writePing({ kind: 'go', where: '/universe', p: [123456.78, 5, -81000] }));
    expect(far.sec).toBe('E:2,-1');
    expect(far.p[0]).toBeCloseTo(123456.78, 2);
    expect(readPing(writePing({ kind: 'help', where: '/projects' }))).toEqual({ kind: 'help', where: '/projects', p: null, sec: null, target: null });
    // a point given as the map's { x, y, z } goes too
    expect(readPing(writePing({ kind: 'look', where: '/universe', p: { x: 1, y: 2, z: 3 } })).p).toEqual([1, 2, 3]);
  });

  it('a ping is clamped as a pose is, and junk is none', () => {
    expect(readPing({ k: 'go', w: '/universe', p: [1e9, 1e9, 0] }).p).toEqual([60000, 1300, 0]);
    const junk = [null, 'go', [], {}, { k: 'nuke', w: '/universe' }, { k: 'go' }, { k: 'go', w: 'https://x.io' }, { k: 'go', w: '/universe', p: 'here' }, { k: 'go', w: '/universe', p: [1, 'a', 3] }, { k: 'go', w: '/universe', t: '<b>' }, { k: 'go', w: '/universe', t: 'x'.repeat(65) }, { k: 'go', w: '/universe', t: {} }];
    for (const j of junk) expect(readPing(j), JSON.stringify(j)).toBeNull();
    expect(writePing({ kind: 'nuke', where: '/universe' })).toBeNull();
  });
});

describe('the site’s new words', () => {
  it('have rates of their own, beside the old ones', () => {
    expect(RATES2).toEqual({ inv: [0.2, 2], say: [0.5, 3], qc: [1, 3] });
    expect(CLIENT_RATES).toEqual({ ...RATES, ...RATES2 });
  });

  it('an invite carries a squad’s sid, and junk is none', () => {
    expect(readInvite({ s: 'BCDFGHJKLMNP' })).toEqual({ sid: 'BCDFGHJKLMNP' });
    for (const junk of [null, undefined, 'BCDFGHJKLMNP', [], {}, { s: 'AEIOUAEIOUAE' }, { s: 42 }, { s: 'BCDFGHJKLMNPQ' }]) expect(readInvite(junk)).toBeNull();
  });
});

describe('a point on the map, as it goes over the wire', () => {
  it('round-trips, rounded as a pose is', () => {
    expect(writePoint({ x: 12.345, y: -6.789, z: 1000 })).toEqual([12.35, -6.79, 1000]);
    expect(readPoint(writePoint({ x: 12.345, y: -6.789, z: 1000 }))).toEqual({ x: 12.35, y: -6.79, z: 1000 });
  });

  it('carries the sector out in the Expanse, with x and z from its middle', () => {
    const out = writePoint({ x: 123456.78, y: 5, z: -81000 });
    expect(out[3]).toBe('E:2,-1');
    expect(out[0]).toBeCloseTo(123456.78 - 160000, 2);
    const p = readPoint(out);
    expect(p.sec).toBe('E:2,-1');
    expect(p.x).toBeCloseTo(123456.78, 2);
    expect(p.z).toBeCloseTo(-81000, 2);
  });

  it('is clamped as a pose is, and junk is no point', () => {
    expect(readPoint([1e9, -1e9, 0])).toEqual({ x: 60000, y: -1300, z: 0 });
    expect(readPoint([1e9, 0, 0, 'E:1,0']).x).toBe(80000 + 42000);
    for (const junk of [null, undefined, 'x', {}, [], [1, 2], [1, 'a', 3], [NaN, 0, 0], [1, 2, 3, 'E:1,0', 5]]) expect(readPoint(junk)).toBeNull();
  });
});
