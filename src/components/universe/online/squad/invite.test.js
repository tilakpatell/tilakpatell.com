import { describe, expect, it } from 'vitest';
import { ALPHABET, cleanSid, instanceOf, linkFor, makeSid, roomOf, sidFromSearch } from './invite';

const SID = 'BCDFGHJKLMNP';

describe('a squad’s secret, its link and its room', () => {
  it('makes a sid of twelve letters from the alphabet, and reads it back however it’s typed', () => {
    expect(ALPHABET).toBe('BCDFGHJKLMNPQRSTVWXZ');
    let i = 0;
    expect(makeSid(() => (i++ % 20) / 20)).toBe(SID);
    const sid = makeSid();
    expect(sid).toMatch(/^[BCDFGHJKLMNPQRSTVWXZ]{12}$/);
    expect(makeSid()).not.toBe(sid); // (one in 20^12 to be the same)
    expect(cleanSid(sid)).toBe(sid);
    expect(cleanSid(' bcdf-ghjk lmnp ')).toBe(SID);
  });

  it('reads junk as no sid', () => {
    for (const junk of [null, undefined, 42, {}, [], '', 'BCDFGHJKLMN', 'BCDFGHJKLMNPQ', 'BCDFGHJKLMNA', 'BCDFGHJKLMN1', '<b>BCDFGHJKLMNP</b>', 'B'.repeat(5000)]) expect(cleanSid(junk)).toBeNull();
  });

  it('a link round-trips through the router’s search, and anything else in it is no squad', () => {
    const link = linkFor(SID, 'https://tilakpatell.com');
    expect(link).toBe('https://tilakpatell.com/#/?squad=BCDFGHJKLMNP');
    // (a hash router's search is what comes after #/)
    expect(sidFromSearch(link.slice(link.indexOf('#/') + 2))).toBe(SID);
    expect(sidFromSearch('?tour=1&squad=bcdfghjklmnp')).toBe(SID);
    for (const junk of ['', '?squad=', '?squad=AEIOUAEIOUAE', '?rush=BCDF', '?squad=BCDFGHJKLMNP%00', undefined, null, 42]) expect(sidFromSearch(junk)).toBeNull();
  });

  it('names the room by a hash the relays can’t read the sid from', async () => {
    const room = await roomOf(SID);
    expect(room).toBe('sq-72e1e99d1e3f84bd5e1ab5b2'); // ('sq-' and SHA-256 of 'tp-squad-room:' and the sid, 24 hex)
    expect(room).not.toContain(SID);
    expect(room).not.toContain(SID.toLowerCase());
    expect(await roomOf(SID)).toBe(room);
    expect(await roomOf('ZXWVTSRQPNML')).toBe('sq-ae27302787ca24c61642fecc');
  });

  it('gives each of the squad’s games an instance of its own', async () => {
    const first = await instanceOf(SID, 1);
    expect(first).toBe('b055988d35'); // (SHA-256 of the sid, ':' and n: 10 hex)
    expect(await instanceOf(SID, 2)).toBe('a849d7e0af');
    expect(await instanceOf(SID, 1)).toBe(first);
    expect(await instanceOf('ZXWVTSRQPNML', 1)).not.toBe(first);
  });
});
