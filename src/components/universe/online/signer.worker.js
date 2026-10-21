// Signing and checking the room's events away from the page (nostr.js asks):
// each takes a few milliseconds of sums on big numbers, ten or more times a
// second while you're online, which the universe map's frames can't spare.
// { id, op: 'sign', key, pubkey, ev } → { id, out: the signed event };
// { id, op: 'check', ev } → { id, out: true or false }; { id, error } if it threw.
//
// The party's chat is sealed and opened here too (partyCrypt.js), for the
// same reason, and so the pair keys it agrees with each mate live here,
// apart from the page: { id, op: 'seal', key, pubkey, party, to, text } →
// { id, out: the blobs, or null }; { id, op: 'open', key, pubkey, party,
// from, blobs } → { id, out: the line, or null }; { id, op: 'forget' } →
// { id, out: true }, the pair keys dropped (a room left keeps none).

import { checkEvent, signEvent } from './events';
import { openFrom, sealFor } from './partyCrypt';

const pairs = new Map(); // the chat's pair keys, by both pilots' keys (partyCrypt.js's cache)

const OPS = {
  sign: (d) => signEvent(d.key, d.pubkey, d.ev),
  check: (d) => checkEvent(d.ev),
  seal: (d) => sealFor({ secretKey: d.key, selfPub: d.pubkey, to: d.to, party: d.party, text: d.text, cache: pairs }),
  open: (d) => openFrom({ secretKey: d.key, selfPub: d.pubkey, from: d.from, party: d.party, blobs: d.blobs, cache: pairs }),
  forget: () => {
    pairs.clear();
    return true;
  },
};

self.onmessage = async ({ data }) => {
  const { id, op } = data;
  try {
    // (an op it doesn't know is an error, so the page does it itself)
    if (!Object.hasOwn(OPS, op)) throw new Error(`no op ${op}`);
    self.postMessage({ id, out: await OPS[op](data) });
  } catch (err) {
    self.postMessage({ id, error: String(err) });
  }
};
