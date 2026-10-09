// Sealing, so the relays carry only ciphertext: AES-GCM under a key drawn
// from a squad's secret (HKDF with SHA-256, the sid's bytes, and an info
// naming the use: squad.js's room seals everything under 'tp-squad-room'), a
// fresh 12-byte nonce each time, the browser's own WebCrypto doing the work.
// The key is made unextractable, so it never leaves the page; anyone who has
// the sid can make it.
//
// sealKey(sid, info = 'tp-squad-chat') → Promise of the key; seal(key, text,
// max = SEALED_MAX) → Promise of base64 of the nonce and the ciphertext (a
// text that would seal past max characters is cut to what fits, a whole
// character at a time); unseal(key, sealed, max = SEALED_MAX) → Promise of
// the text, or null for anything that isn't one sealed under this key
// (refused unopened past max characters).

export const SEALED_MAX = 1024; // base64 characters of a sealed text, at most, unless said otherwise
const NONCE = 12;
const TAG = 16; // (AES-GCM's, at the end of the ciphertext)
const enc = new TextEncoder();
const dec = new TextDecoder('utf-8', { fatal: true });

export async function sealKey(sid, info = 'tp-squad-chat') {
  const secret = await crypto.subtle.importKey('raw', enc.encode(sid), 'HKDF', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(0), info: enc.encode(info) }, secret, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

const toBase64 = (bytes) => {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
};
// as much of the text as seals within max characters, whole characters only
const fit = (text, max) => {
  const room = Math.floor(max / 4) * 3 - NONCE - TAG;
  let n = 0;
  let out = '';
  for (const ch of text) {
    n += enc.encode(ch).length;
    if (n > room) break;
    out += ch;
  }
  return out;
};

export async function seal(key, text, max = SEALED_MAX) {
  const bytes = enc.encode(fit(text, max));
  const nonce = crypto.getRandomValues(new Uint8Array(NONCE));
  const sealed = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, bytes));
  const out = new Uint8Array(NONCE + sealed.length);
  out.set(nonce);
  out.set(sealed, NONCE);
  return toBase64(out);
}

export async function unseal(key, sealed, max = SEALED_MAX) {
  if (typeof sealed !== 'string' || sealed.length > max || sealed.length % 4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(sealed)) return null;
  try {
    const bytes = Uint8Array.from(atob(sealed), (c) => c.charCodeAt(0));
    if (bytes.length <= NONCE + TAG) return null;
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes.slice(0, NONCE) }, key, bytes.slice(NONCE));
    return dec.decode(plain);
  } catch {
    return null;
  }
}
