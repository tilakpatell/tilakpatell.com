// The chat's log, kept in memory only (nothing of it is saved): the lines of
// each channel, 'squad' (the squad's sealed text), 'here' (everyone's, from
// those in the same place) and 'all' (everyone's, from anywhere), the last
// CHAT.log of each, with the pilots muted. Pure, so it's tested in Node
// (chat.test.js); the page keeps one and shows its lines as text.
//
// A line is cleaned again as it's kept (text.js's cleanText, to its
// channel's cap), whoever cleaned it before; a phrase is kept as its words.
// Mute hides a pilot's words, those kept and those to come, without
// blocking their ship (a block hides both: client.js). On 'here' and 'all'
// the same typed words three times from one pilot inside CHAT.repeatMs are
// dropped from the third on (allow(), which counts every try, so a pilot
// saying it over and over isn't heard again till they stop); a phrase has
// its own rate on the wire.
//
// createChat({ now }) → { add(channel, { from, name, text, phrase }) → kept
// (true or false), lines(channel) → [{ id, from, name, text, at }], muted(id),
// mute(id, yes), on(fn) → off (fn({ channel, line }) for each line kept),
// allow(from, text) → boolean }

import { CHAT, cleanText, phrase as phraseOf } from './text';

const CHANNELS = { squad: CHAT.squadMax, here: CHAT.everyoneMax, all: CHAT.everyoneMax }; // each one's cap
const TRIES = 16; // a pilot's recent words kept for the repeat rule, at most
const PILOTS = 64; // and the pilots kept track of

export function createChat({ now = () => Date.now() } = {}) {
  const logs = { squad: [], here: [], all: [] };
  const mutes = new Set();
  const recent = new Map(); // pilot → [{ words, at }]
  const listeners = new Set();
  let made = 0;

  const allow = (from, text) => {
    const t = now();
    const words = String(text).toLowerCase();
    const tries = (recent.get(from) ?? []).filter((x) => t - x.at < CHAT.repeatMs);
    const again = tries.filter((x) => x.words === words).length;
    tries.push({ words, at: t });
    recent.delete(from);
    recent.set(from, tries.slice(-TRIES));
    if (recent.size > PILOTS) recent.delete(recent.keys().next().value);
    return again < 2;
  };

  return {
    add(channel, line) {
      const cap = Object.hasOwn(CHANNELS, channel) ? CHANNELS[channel] : 0;
      if (!cap || !line || typeof line !== 'object' || typeof line.from !== 'string' || !line.from || mutes.has(line.from)) return false;
      const said = line.phrase === undefined;
      const text = said ? cleanText(line.text, cap) : phraseOf(line.phrase);
      if (!text || (said && channel !== 'squad' && !allow(line.from, text))) return false;
      const kept = { id: made++, from: line.from, name: typeof line.name === 'string' ? line.name : null, text, at: now() };
      const log = logs[channel];
      log.push(kept);
      if (log.length > CHAT.log) log.shift();
      for (const fn of [...listeners]) fn({ channel, line: kept });
      return true;
    },
    lines: (channel) => (Object.hasOwn(logs, channel) ? logs[channel].filter((l) => !mutes.has(l.from)) : []),
    muted: (id) => mutes.has(id),
    mute(id, yes) {
      if (yes) mutes.add(id);
      else mutes.delete(id);
    },
    on(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    allow,
  };
}
