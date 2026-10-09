import { describe, expect, it } from 'vitest';
import { SEALED_MAX, seal, sealKey, unseal } from './seal';

const SID = 'BCDFGHJKLMNP';

describe('a squad’s text, sealed', () => {
  it('round-trips under the squad’s key, sealed afresh each time', async () => {
    const key = await sealKey(SID);
    const a = await seal(key, 'Regroup at Hoth');
    const b = await seal(key, 'Regroup at Hoth');
    expect(a).toMatch(/^[A-Za-z0-9+/]+=*$/);
    expect(a).not.toContain('Regroup');
    expect(a).not.toBe(b); // (a fresh nonce each time)
    expect(await unseal(key, a)).toBe('Regroup at Hoth');
    // another page's key from the same sid opens it
    expect(await unseal(await sealKey(SID), b)).toBe('Regroup at Hoth');
    // and the key never leaves the page
    expect(key.extractable).toBe(false);
  });

  it('a wrong sid’s key gives null', async () => {
    const sealed = await seal(await sealKey(SID), 'hello');
    expect(await unseal(await sealKey('ZXWVTSRQPNML'), sealed)).toBeNull();
  });

  it('one changed character gives null', async () => {
    const key = await sealKey(SID);
    const sealed = await seal(key, 'hello');
    const i = sealed.length >> 1;
    expect(await unseal(key, sealed.slice(0, i) + (sealed[i] === 'A' ? 'B' : 'A') + sealed.slice(i + 1))).toBeNull();
  });

  it('refuses junk, and anything over 1,024 characters', async () => {
    const key = await sealKey(SID);
    expect(SEALED_MAX).toBe(1024);
    for (const junk of [null, undefined, 42, {}, '', '!!!!', 'AAAA', 'A'.repeat(1028), `${await seal(key, 'hi')}A`]) expect(await unseal(key, junk)).toBeNull();
  });

  it('cuts a text that would seal past what can be opened', async () => {
    const key = await sealKey(SID);
    const sealed = await seal(key, '🚀'.repeat(200)); // (800 bytes: more than a sealed word holds)
    expect(sealed.length).toBeLessThanOrEqual(SEALED_MAX);
    expect(await unseal(key, sealed)).toBe('🚀'.repeat(185));
  });

  it('draws another key for another use of the sid: the room’s', async () => {
    const room = await sealKey(SID, 'tp-squad-room');
    const sealed = await seal(room, '["hi",{}]');
    expect(await unseal(room, sealed)).toBe('["hi",{}]');
    expect(await unseal(await sealKey(SID), sealed)).toBeNull();
    expect(await unseal(await sealKey(SID, 'tp-squad-chat'), await seal(await sealKey(SID), 'hello'))).toBe('hello');
  });

  it('takes a cap of its own, for seal and unseal alike', async () => {
    const key = await sealKey(SID, 'tp-squad-room');
    const long = 'x'.repeat(5000);
    const sealed = await seal(key, long, 12000);
    expect(sealed.length).toBeGreaterThan(SEALED_MAX);
    expect(await unseal(key, sealed)).toBeNull(); // (past the default's 1,024)
    expect(await unseal(key, sealed, 12000)).toBe(long);
    expect((await seal(key, 'y'.repeat(20000), 12000)).length).toBeLessThanOrEqual(12000);
  });
});
