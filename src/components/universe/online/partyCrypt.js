// A party's chat, sealed so only its members read it. The room is public (a
// message “to one pilot” is a field anyone listening can read, nostr.js), so
// a line goes out as a blob for each mate there, each one opened only by
// them: the two pilots' keys agree a secret (secp256k1 ECDH, the keys they
// already sign with), HKDF-SHA256 makes it an AES-GCM-256 key for the pair,
// and the line is sealed under that with an IV of its own. The party and
// both keys (sender first) go in the additional data, so a blob can't be
// sent back to its sealer as the mate's, or replayed into another party.
// The words are padded to a multiple of 32 bytes, so a blob's size says
// only roughly how long the line was, and the blobs are shuffled, so their
// order doesn't say who each is for.
//
// Plain functions of their arguments on WebCrypto and @noble/secp256k1, so
// they run in signer.worker.js (nostr.js sends them there, as it does the
// signing), in the page when there's no worker, and in Node for the tests.
// Anything that isn't what it should be (a key, a blob, a party) gives
// null: a stranger can send anything, and nothing they send may throw.
//
// A pilot's key online is the x of their point (64 hex digits, as Nostr
// has it); 02 in front makes a whole point of it. That may be the other y
// from theirs, but x of the secret is the same either way, so both ends
// agree whatever their keys' y.
//
// sealFor({ secretKey, selfPub, to, party, text, cache }) → a blob for
//   each of `to` (base64url, shuffled), [] for no one, or null (junk);
// openFrom({ secretKey, selfPub, from, party, blobs, cache }) → the line,
//   or null (none of the blobs is yours, one was changed, another party's);
// padText(text) → the bytes sealed, unpadText(bytes) → the text or null.
// `cache` is a Map the pair keys are kept in (non-extractable, by
// `selfPub:peerPub`): each is a sum on big numbers, and a party chats with
// the same few.

import { getSharedSecret, utils } from '@noble/secp256k1';
import { BLOB_MAX, CHAT_MAX, PARTY_MAX } from './partyWire';

const VERSION = 'tp-psay-v1'; // the HKDF salt and the first of the additional data: a new scheme, a new name
const IV = 12;
const TAG = 16;
const PAD = 32;
const CACHE_MAX = 64; // pair keys kept, at most (past that, the oldest go)

const enc = new TextEncoder();
const KEY = /^[0-9a-f]{64}$/;
const PARTY = /^[0-9a-f]{16}$/;
const BLOB = /^[A-Za-z0-9_-]+$/;
const isKey = (v) => typeof v === 'string' && KEY.test(v);
const plain = (o) => Boolean(o) && typeof o === 'object' && !Array.isArray(o);
const unhex = (s) => Uint8Array.from(s.match(/../g), (h) => parseInt(h, 16));
// (a secret key as noble takes it, one that is a key, or null)
const secret = (k) => {
  const sk = ArrayBuffer.isView(k) && k.byteLength === 32 ? new Uint8Array(k.buffer, k.byteOffset, 32) : null;
  return sk && utils.isValidSecretKey(sk) ? sk : null;
};

const toB64 = (bytes) => btoa(Array.from(bytes, (b) => String.fromCharCode(b)).join('')).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64 = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

// The line's bytes: its length (two bytes, the big end first), its UTF-8,
// then zeros to a multiple of 32 (32 at least).
export function padText(text) {
  if (typeof text !== 'string') return null;
  const words = enc.encode(text);
  if (words.length > 0xffff) return null;
  const out = new Uint8Array(Math.max(PAD, Math.ceil((2 + words.length) / PAD) * PAD));
  out[0] = words.length >> 8;
  out[1] = words.length & 0xff;
  out.set(words, 2);
  return out;
}

// the line back, or null if these aren't bytes padText would have written
export function unpadText(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.length < PAD || bytes.length % PAD) return null;
  const n = (bytes[0] << 8) | bytes[1];
  if (2 + n > bytes.length || bytes.subarray(2 + n).some((b) => b !== 0)) return null;
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(2, 2 + n));
  } catch {
    return null;
  }
}

// at most CHAT_MAX characters, an emoji kept whole (a line cut in a pair of
// UTF-16 halves would end in a broken one)
const cut = (text) => Array.from(text).slice(0, CHAT_MAX).join('');

// The key the two of you share: x of the secret point, through HKDF (the
// two keys in the info, the lower first, so both ends make the same one).
// Kept as a promise, so two lines at once make it once; one that can't be
// made (their x is on no point) is null, and isn't kept.
function pairKey(cache, sk, selfPub, peerPub) {
  const id = `${selfPub}:${peerPub}`;
  let key = cache.get(id);
  if (key) return key;
  key = (async () => {
    let x;
    try {
      const shared = getSharedSecret(sk, unhex(`02${peerPub}`));
      x = shared.slice(1, 33);
      shared.fill(0);
    } catch {
      return null;
    }
    const base = await crypto.subtle.importKey('raw', x, 'HKDF', false, ['deriveKey']);
    x.fill(0);
    const info = selfPub < peerPub ? selfPub + peerPub : peerPub + selfPub;
    return crypto.subtle.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt: enc.encode(VERSION), info: enc.encode(info) }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  })().catch(() => null);
  cache.set(id, key);
  if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value);
  key.then((k) => {
    if (!k && cache.get(id) === key) cache.delete(id);
  });
  return key;
}

const aad = (party, fromPub, toPub) => enc.encode(`${VERSION}|${party}|${fromPub}|${toPub}`);

// Fisher and Yates, on the browser's own randomness
function shuffle(list) {
  const r = crypto.getRandomValues(new Uint32Array(list.length));
  for (let i = list.length - 1; i > 0; i--) {
    const j = r[i] % (i + 1);
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

// A line for each of `to`, cut to CHAT_MAX first: a blob each (IV ‖ the
// sealed words ‖ the tag), shuffled. Yourself, a key named twice and one
// that's no key are left out; more than a party could hold, an empty line
// or a bad key of your own, and it's null.
export async function sealFor(args) {
  try {
    const { secretKey, selfPub, to, party, text, cache = new Map() } = plain(args) ? args : {};
    const sk = secret(secretKey);
    if (!sk || !isKey(selfPub) || typeof party !== 'string' || !PARTY.test(party) || typeof text !== 'string' || !text || !Array.isArray(to)) return null;
    const peers = [...new Set(to.filter((id) => isKey(id) && id !== selfPub))];
    if (peers.length > PARTY_MAX - 1) return null;
    const words = padText(cut(text));
    const blobs = [];
    for (const peer of peers) {
      const key = await pairKey(cache, sk, selfPub, peer);
      if (!key) continue;
      const iv = crypto.getRandomValues(new Uint8Array(IV));
      const sealed = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: aad(party, selfPub, peer) }, key, words));
      const blob = new Uint8Array(IV + sealed.length);
      blob.set(iv);
      blob.set(sealed, IV);
      blobs.push(toB64(blob));
    }
    return shuffle(blobs);
  } catch {
    return null;
  }
}

// The line in a mate's `psay`: each blob tried under your pair key with
// them (the other mates' won't open, and that's no fault), cut to CHAT_MAX
// as a stranger's words are. Null if none opens.
export async function openFrom(args) {
  try {
    const { secretKey, selfPub, from, party, blobs, cache = new Map() } = plain(args) ? args : {};
    const sk = secret(secretKey);
    if (!sk || !isKey(selfPub) || !isKey(from) || from === selfPub || typeof party !== 'string' || !PARTY.test(party)) return null;
    if (!Array.isArray(blobs) || !blobs.length || blobs.length > PARTY_MAX - 1) return null;
    const key = await pairKey(cache, sk, selfPub, from);
    if (!key) return null;
    const additionalData = aad(party, from, selfPub);
    for (const b of blobs) {
      // (a blob's at least an IV, 32 bytes of words and a tag: 80 characters)
      if (typeof b !== 'string' || b.length < 80 || b.length > BLOB_MAX || b.length % 4 === 1 || !BLOB.test(b)) continue;
      const bytes = fromB64(b);
      if ((bytes.length - IV - TAG) % PAD) continue;
      let words;
      try {
        words = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes.subarray(0, IV), additionalData }, key, bytes.subarray(IV)));
      } catch {
        continue; // (not yours, or changed on the way)
      }
      const text = unpadText(words);
      return text ? cut(text) : null;
    }
    return null;
  } catch {
    return null;
  }
}
