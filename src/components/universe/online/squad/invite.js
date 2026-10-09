// A squad's secret, the link that carries it and the rooms it names. The
// secret (`sid`) is twelve letters of ALPHABET (no vowels, so no words, and
// nothing that reads as another letter: the Rush kitchens' codes are four of
// the same), made from the browser's own randomness, and whoever has it can
// join: the link is the invitation. Small and with nothing to import: it's
// the one piece of the squads a page may load before its visitor has gone
// online, to read a link.
//
// The relays never see the sid. The squad's room is 'sq-' and the first 24
// hex digits of SHA-256 of 'tp-squad-room:' and the sid, and each of the
// squad's private games (PR 3) is ten hex digits of SHA-256 of the sid, ':'
// and the game's number: names that don't give the secret away.
//
// makeSid(rand) → twelve letters; cleanSid(raw) → the sid, or null (any case,
// spaces and dashes let go); linkFor(sid, origin) → '<origin>/#/?squad=<sid>';
// sidFromSearch(search) → the sid in a router's search, or null;
// roomOf(sid) → Promise of the room's name; instanceOf(sid, n) → Promise of a
// game's instance id.

export const ALPHABET = 'BCDFGHJKLMNPQRSTVWXZ';
const LENGTH = 12;

// (a secret: the browser's randomness, not Math.random's)
const secure = () => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;
export const makeSid = (rand = secure) => Array.from({ length: LENGTH }, () => ALPHABET[Math.floor(rand() * ALPHABET.length) % ALPHABET.length]).join('');

export function cleanSid(raw) {
  if (typeof raw !== 'string' || raw.length > 64) return null;
  const s = raw.toUpperCase().replace(/[\s-]/g, '');
  return s.length === LENGTH && [...s].every((c) => ALPHABET.includes(c)) ? s : null;
}

export const linkFor = (sid, origin) => `${origin}/#/?squad=${sid}`;

export function sidFromSearch(search) {
  if (typeof search !== 'string') return null;
  return cleanSid(new URLSearchParams(search).get('squad'));
}

const hash = async (text, digits) => {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('').slice(0, digits);
};
export const roomOf = async (sid) => `sq-${await hash(`tp-squad-room:${sid}`, 24)}`;
export const instanceOf = (sid, n) => hash(`${sid}:${n}`, 10);
