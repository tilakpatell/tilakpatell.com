import { describe, expect, it } from 'vitest';
import { Buffer } from 'node:buffer';
import { Point, getPublicKey, getSharedSecret, schnorr } from '@noble/secp256k1';
import { openFrom, padText, sealFor, unpadText } from './partyCrypt';
import { BLOB_MAX, CHAT_MAX, PARTY_MAX, readSay } from './partyWire';

const hex = (bytes) => Buffer.from(bytes).toString('hex');
const unhex = (s) => new Uint8Array(Buffer.from(s, 'hex'));
const enc = new TextEncoder();

// a pilot as the site makes one: a Schnorr key, known online by its x alone
const pilot = (secretKey = schnorr.keygen().secretKey) => ({ secretKey, pub: hex(schnorr.getPublicKey(secretKey)), cache: new Map() });
// a key whose full point has an odd y (or an even one): x-only hides which,
// and the pair key mustn't care
const pilotWithY = (odd) => {
  for (;;) {
    const { secretKey } = schnorr.keygen();
    if ((getPublicKey(secretKey, true)[0] === 3) === odd) return pilot(secretKey);
  }
};

const PARTY = '0123456789abcdef';
const OTHER = 'fedcba9876543210';
const seal = (from, to, text, party = PARTY) => sealFor({ secretKey: from.secretKey, selfPub: from.pub, to: to.map((p) => (typeof p === 'string' ? p : p.pub)), party, text, cache: from.cache });
const open = (me, from, blobs, party = PARTY) => openFrom({ secretKey: me.secretKey, selfPub: me.pub, from: typeof from === 'string' ? from : from.pub, party, blobs, cache: me.cache });

// The construction as the design writes it, done here by hand, so the wire
// is pinned and not only the module's agreement with itself.
async function pairKeyBySpec(me, peerPub) {
  const x = getSharedSecret(me.secretKey, unhex(`02${peerPub}`)).slice(1, 33);
  const base = await crypto.subtle.importKey('raw', x, 'HKDF', false, ['deriveKey']);
  const [lo, hi] = [me.pub, peerPub].sort();
  return crypto.subtle.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt: enc.encode('tp-psay-v1'), info: enc.encode(lo + hi) }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
const aad = (party, from, to) => enc.encode(`tp-psay-v1|${party}|${from}|${to}`);
async function sealBySpec(from, toPub, bytes, party = PARTY) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const sealed = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: aad(party, from.pub, toPub) }, await pairKeyBySpec(from, toPub), bytes));
  return Buffer.concat([iv, sealed]).toString('base64url');
}
// 64 hex digits that are no pilot's key: an x with no point on the curve
// (about half of them are)
const offCurve = () => {
  for (let x = 7n; ; x += 1n) {
    const h = x.toString(16).padStart(64, '0');
    try {
      Point.fromBytes(unhex(`02${h}`));
    } catch {
      return h;
    }
  }
};
// a blob with one byte changed at i
const flip = (blob, i) => {
  const b = Buffer.from(blob, 'base64url');
  b[i] ^= 1;
  return b.toString('base64url');
};

describe('padText and unpadText', () => {
  it('writes the length (two bytes, big end first), the words, then zeros to a multiple of 32', () => {
    const out = padText('Hi');
    expect(out).toBeInstanceOf(Uint8Array);
    expect(out.length).toBe(32);
    expect([...out.slice(0, 4)]).toEqual([0, 2, 72, 105]);
    expect(out.slice(4).every((b) => b === 0)).toBe(true);
    expect(unpadText(out)).toBe('Hi');
  });

  it('pads to 32 at least, and to the next 32 past that, so a line’s length shows only roughly', () => {
    expect(padText('').length).toBe(32);
    expect(padText('a'.repeat(30)).length).toBe(32);
    expect(padText('a'.repeat(31)).length).toBe(64);
    expect(padText('a'.repeat(CHAT_MAX)).length).toBe(224);
    // (four bytes a character: the longest a line can be)
    expect(padText('🚀'.repeat(CHAT_MAX)).length).toBe(832);
    const long = 'a'.repeat(300);
    expect(padText(long).length).toBe(320);
    expect(padText(long)[0] * 256 + padText(long)[1]).toBe(300);
  });

  it('round-trips any script', () => {
    for (const s of ['', 'Hello', 'Let’s go', 'નમસ્તે', '你好', '🚀🌍 over here', 'a'.repeat(CHAT_MAX)]) expect(unpadText(padText(s))).toBe(s);
  });

  it('reads nothing from junk, and never throws', () => {
    expect(padText(null)).toBe(null);
    expect(padText(42)).toBe(null);
    expect(unpadText(null)).toBe(null);
    expect(unpadText('Hi')).toBe(null);
    expect(unpadText([0, 2, 72, 105])).toBe(null);
    expect(unpadText(new Uint8Array(0))).toBe(null);
    expect(unpadText(new Uint8Array(31))).toBe(null);
    expect(unpadText(padText('Hi').slice(0, 31))).toBe(null);
    // a length past the end
    const over = padText('Hi');
    over[1] = 31;
    expect(unpadText(over)).toBe(null);
    // something after the words that isn't a zero
    const tail = padText('Hi');
    tail[20] = 1;
    expect(unpadText(tail)).toBe(null);
    // bytes that aren't UTF-8
    const bad = padText('Hi');
    bad[2] = 0xff;
    expect(unpadText(bad)).toBe(null);
  });
});

describe('sealFor and openFrom', () => {
  it('a line sealed for two mates opens for each, as the same words', async () => {
    const [alpha, bravo, charlie] = [pilot(), pilot(), pilot()];
    const blobs = await seal(alpha, [bravo, charlie], 'Meet at Bree');
    expect(blobs).toHaveLength(2);
    expect(readSay({ b: blobs })).toEqual({ b: blobs });
    for (const b of blobs) expect(b).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(await open(bravo, alpha, blobs)).toBe('Meet at Bree');
    expect(await open(charlie, alpha, blobs)).toBe('Meet at Bree');
  });

  it('is the design’s construction: IV ‖ AES-GCM under HKDF of the shared x, the party and both keys in the additional data', async () => {
    const [alpha, bravo] = [pilot(), pilot()];
    const [blob] = await seal(alpha, [bravo], 'On my way');
    const bytes = Buffer.from(blob, 'base64url');
    // (12 bytes of IV, 32 of padded words, 16 of tag)
    expect(bytes.length).toBe(60);
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes.subarray(0, 12), additionalData: aad(PARTY, alpha.pub, bravo.pub) }, await pairKeyBySpec(bravo, alpha.pub), bytes.subarray(12));
    expect(unpadText(new Uint8Array(plain))).toBe('On my way');
    // and the other way: a blob made by hand opens
    expect(await open(alpha, bravo, [await sealBySpec(bravo, alpha.pub, padText('Thanks'))])).toBe('Thanks');
  });

  it('doesn’t open for a pilot it wasn’t sealed for', async () => {
    const [alpha, bravo, dana] = [pilot(), pilot(), pilot()];
    const blobs = await seal(alpha, [bravo], 'Just us');
    expect(await open(dana, alpha, blobs)).toBe(null);
    // (nor for the one it was, told it came from someone else)
    expect(await open(bravo, dana, blobs)).toBe(null);
  });

  it('a blob sent back to its sealer, as if it were the mate’s own, doesn’t open (the same pair key, the other way round)', async () => {
    const [alpha, bravo] = [pilot(), pilot()];
    const blobs = await seal(alpha, [bravo], 'Wait for me');
    expect(await open(alpha, bravo, blobs)).toBe(null);
  });

  it('doesn’t open as another party’s line', async () => {
    const [alpha, bravo] = [pilot(), pilot()];
    const blobs = await seal(alpha, [bravo], 'Party one only');
    expect(await open(bravo, alpha, blobs, OTHER)).toBe(null);
    expect(await open(bravo, alpha, blobs)).toBe('Party one only');
  });

  it('a byte changed anywhere (the IV, the words, the tag) and it doesn’t open', async () => {
    const [alpha, bravo] = [pilot(), pilot()];
    const [blob] = await seal(alpha, [bravo], 'Untouched');
    for (const i of [0, 11, 12, 30, 43, 44, 59]) expect(await open(bravo, alpha, [flip(blob, i)])).toBe(null);
    expect(await open(bravo, alpha, [blob.slice(0, -1)])).toBe(null);
    expect(await open(bravo, alpha, [blob])).toBe('Untouched');
  });

  it('opens between keys whose points have an odd y as well as an even one', async () => {
    const odd = [pilotWithY(true), pilotWithY(true)];
    const even = [pilotWithY(false), pilotWithY(false)];
    for (const [a, b] of [
      [odd[0], odd[1]],
      [odd[0], even[0]],
      [even[0], odd[1]],
      [even[0], even[1]],
    ]) {
      expect(await open(b, a, await seal(a, [b], 'Odd or even'))).toBe('Odd or even');
      expect(await open(a, b, await seal(b, [a], 'Either way'))).toBe('Either way');
    }
  });

  it('tries every blob, so a mate finds theirs wherever it is', async () => {
    const [alpha, ...mates] = Array.from({ length: PARTY_MAX }, () => pilot());
    const blobs = await seal(alpha, mates, 'All aboard');
    expect(blobs).toHaveLength(PARTY_MAX - 1);
    for (const m of mates) expect(await open(m, alpha, blobs)).toBe('All aboard');
  });

  it('shuffles the blobs, and seals each afresh (a new IV), so neither order nor bytes say who is who', async () => {
    const [alpha, bravo, charlie, delta] = [pilot(), pilot(), pilot(), pilot()];
    const places = new Set();
    const seen = new Set();
    for (let n = 0; n < 20; n++) {
      const blobs = await seal(alpha, [bravo, charlie, delta], 'Same words');
      for (const b of blobs) seen.add(b);
      for (let i = 0; i < blobs.length; i++) if ((await open(bravo, alpha, [blobs[i]])) === 'Same words') places.add(i);
    }
    expect(seen.size).toBe(60);
    expect(places.size).toBeGreaterThan(1);
  });

  it('cuts a line to CHAT_MAX characters before it’s sealed, an emoji whole, and every blob fits the wire', async () => {
    const [alpha, bravo] = [pilot(), pilot()];
    const ascii = await seal(alpha, [bravo], 'a'.repeat(CHAT_MAX + 50));
    expect(await open(bravo, alpha, ascii)).toBe('a'.repeat(CHAT_MAX));
    const emoji = await seal(alpha, [bravo], '🚀'.repeat(CHAT_MAX + 50));
    expect(emoji[0].length).toBeLessThanOrEqual(BLOB_MAX);
    expect(readSay({ b: emoji })).not.toBe(null);
    expect(await open(bravo, alpha, emoji)).toBe('🚀'.repeat(CHAT_MAX));
  });

  it('cuts a longer line sealed by hand to CHAT_MAX when it’s opened (read as a stranger’s)', async () => {
    const [alpha, bravo] = [pilot(), pilot()];
    const blob = await sealBySpec(alpha, bravo.pub, padText('b'.repeat(CHAT_MAX + 100)));
    expect(await open(bravo, alpha, [blob])).toBe('b'.repeat(CHAT_MAX));
  });

  it('seals none for yourself, one for a mate named twice, and none for a key that isn’t one', async () => {
    const [alpha, bravo] = [pilot(), pilot()];
    const blobs = await seal(alpha, [alpha.pub, bravo, bravo.pub, 'nope', 42, offCurve(), 'A'.repeat(64)], 'Hello');
    expect(blobs).toHaveLength(1);
    expect(await open(bravo, alpha, blobs)).toBe('Hello');
    expect(await seal(alpha, [], 'Hello')).toEqual([]);
  });

  it('keeps each pair key once, non-extractable, under its two keys', async () => {
    const [alpha, bravo, charlie] = [pilot(), pilot(), pilot()];
    await seal(alpha, [bravo, charlie], 'One');
    expect([...alpha.cache.keys()].sort()).toEqual([`${alpha.pub}:${bravo.pub}`, `${alpha.pub}:${charlie.pub}`].sort());
    const key = await alpha.cache.get(`${alpha.pub}:${bravo.pub}`);
    expect(key.extractable).toBe(false);
    expect(key.algorithm).toMatchObject({ name: 'AES-GCM', length: 256 });
    await expect(crypto.subtle.exportKey('raw', key)).rejects.toThrow();
    await seal(alpha, [bravo, charlie], 'Two');
    expect(alpha.cache.size).toBe(2);
    // (works without a cache too)
    const blobs = await sealFor({ secretKey: alpha.secretKey, selfPub: alpha.pub, to: [bravo.pub], party: PARTY, text: 'Bare' });
    expect(await openFrom({ secretKey: bravo.secretKey, selfPub: bravo.pub, from: alpha.pub, party: PARTY, blobs })).toBe('Bare');
  });

  it('seals nothing (null) from junk, and never throws', async () => {
    const [alpha, bravo] = [pilot(), pilot()];
    const good = { secretKey: alpha.secretKey, selfPub: alpha.pub, to: [bravo.pub], party: PARTY, text: 'Hi', cache: new Map() };
    expect(await sealFor(good)).toHaveLength(1);
    for (const junk of [
      { secretKey: null },
      { secretKey: alpha.secretKey.slice(0, 31) },
      { secretKey: new Uint8Array(32) },
      { secretKey: 'not bytes' },
      { selfPub: 'abc' },
      { selfPub: alpha.pub.toUpperCase() },
      { party: 'xyz' },
      { party: null },
      { text: null },
      { text: 7 },
      { text: '' },
      { to: null },
      { to: 'everyone' },
      { to: Array.from({ length: PARTY_MAX }, () => pilot().pub) },
    ])
      expect(await sealFor({ ...good, ...junk }), JSON.stringify(Object.keys(junk))).toBe(null);
    expect(await sealFor()).toBe(null);
    expect(await sealFor(null)).toBe(null);
  });

  it('opens nothing (null) from junk, and never throws', async () => {
    const [alpha, bravo] = [pilot(), pilot()];
    const blobs = await seal(alpha, [bravo], 'Hi');
    const good = { secretKey: bravo.secretKey, selfPub: bravo.pub, from: alpha.pub, party: PARTY, blobs, cache: new Map() };
    expect(await openFrom(good)).toBe('Hi');
    for (const junk of [
      { secretKey: null },
      { secretKey: new Uint8Array(32) },
      { selfPub: 42 },
      { from: 'abc' },
      { from: bravo.pub },
      { from: 'f'.repeat(64) },
      { from: offCurve() },
      { party: 'nope' },
      { blobs: null },
      { blobs: 'abc' },
      { blobs: [] },
      { blobs: [42, null, {}] },
      { blobs: ['!!!!'] },
      { blobs: ['A'] },
      { blobs: ['A'.repeat(80)] },
      { blobs: ['A'.repeat(BLOB_MAX + 4)] },
      { blobs: Array.from({ length: 100 }, () => blobs[0]) },
    ])
      expect(await openFrom({ ...good, ...junk }), JSON.stringify(Object.keys(junk))).toBe(null);
    expect(await openFrom()).toBe(null);
    expect(await openFrom(null)).toBe(null);
  });

  it('an empty line sealed by hand opens as nothing', async () => {
    const [alpha, bravo] = [pilot(), pilot()];
    expect(await open(bravo, alpha, [await sealBySpec(alpha, bravo.pub, padText(''))])).toBe(null);
  });
});
