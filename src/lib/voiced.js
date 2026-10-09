// The speakers' own voices for the lines nobody recorded: made by
// scripts/voices (its README says how) into public/audio/voiced, with a
// manifest of which lines have one (or served from VITE_VOICED_BASE). A line
// with none keeps its blips (universe/sounds.js), or its silence.

import { voicesOn } from './audio';
import { speech } from './speech';

const BASE = (import.meta.env?.VITE_VOICED_BASE || '/audio/voiced').replace(/\/$/, '');

// A line's id: FNV-1a of who says it and what they say, so the same words
// from the same mouth find the same file wherever they appear (and an edited
// line gets a new one). scripts/voices/export-lines.mjs uses this too.
export function lineId(who, text) {
  let h = 0x811c9dc5;
  const s = `${who}|${text}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

// The manifest, fetched once. One that's not there, or not a manifest (not
// generated here, or not signed in), means the blips; one that didn't come
// (offline a moment, a dropped connection) is asked for again a little later,
// rather than leave the whole visit without voices.
const RETRY = 10_000;
let manifest = null;
let failedAt = -Infinity;
function load() {
  if (!manifest || (manifest.failed && Date.now() - failedAt > RETRY)) {
    const next = fetch(`${BASE}/manifest.json`)
      .then((r) => (r.ok ? r.json() : null))
      .then((m) => (m && typeof m.lines === 'object' ? m.lines : {}))
      .catch((e) => {
        if (e instanceof SyntaxError) return {};
        next.failed = true;
        failedAt = Date.now();
        return {};
      });
    manifest = next;
  }
  return manifest;
}

// Start fetching the manifest, so the first line isn't kept waiting for it.
export const preloadVoiced = () => {
  load();
};

// Where a line's generated recording is, or null if it has none.
export async function voicedSrc(who, text) {
  const lines = await load();
  const file = lines[lineId(who, text)];
  return typeof file === 'string' ? `${BASE}/${file}` : null;
}

// ── the worlds' conversations ──
// Speakers whose lines are someone else's voice (Strider is Aragorn; the
// Council are Ricks; Evil Morty is a Morty), and the ones with no voice at
// all: whoever narrates, a caller, a voice on the wind, the beeps and roars.
const SAME_VOICE = { strider: 'aragorn', councila: 'rick', councilb: 'rick', councilc: 'rick', evilmorty: 'morty', president: 'morty', pa: 'rick', cop: 'rick', daycare: 'rick', foreman: 'rick' };
const NO_VOICE = new Set(['narrator', 'voice', 'caller', 'r2', 'artoo', 'chewie', 'nazgul', 'orc', 'comms', 'bot', 'bee', 'bumblebee']);

// The voice a speaker's lines are made in, or null.
export function voiceOf(who) {
  if (!who || NO_VOICE.has(who)) return null;
  return SAME_VOICE[who] ?? who;
}

// What of a line is said aloud: the parts in quotes, where a line mixes
// them with narration (“Frodo?” You back away.); otherwise all of it; never
// what's in brackets.
// scripts/voices/export-lines.mjs makes the line from this.
export function spoken(text) {
  const quoted = [...text.matchAll(/“([^”]+)”/g)].map((m) => m[1].trim());
  const said = quoted.length ? quoted.join(' ') : text;
  return said.replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim(); // not the asides in brackets: (Beeps.)
}

let turn = 0;

// Say a line in its speaker's voice, if it's been made, when it's its turn
// (lib/speech.js: one voice at a time; `mode` as there, else a line set off
// by a press cuts in and one that came by itself waits). Resolves to the
// playing handle, or null (no voice, not made, not here, voices off, or
// overtaken). The promise's stop() takes the line back, said or waiting.
export function sayVoiced(who, text, { mode } = {}) {
  const how = mode ?? speech.mode(); // decided now, in the press, not after the lookup
  const mine = turn;
  let stopped = false;
  let said = null;
  const gone = () => stopped || mine !== turn;
  const line = (async () => {
    const voice = voiceOf(who);
    if (!voice || !text || !voicesOn()) return null;
    const src = await voicedSrc(voice, text);
    if (gone()) return null;
    if (!src) {
      if (how === 'cut') speech.stop('voiced'); // the visitor's moved on: the last line is out of date
      return null;
    }
    const { playFile } = await import('./clips');
    if (gone()) return null;
    said = playFile(src, { voice: true, mode: how, tag: 'voiced' });
    return said;
  })();
  line.stop = () => {
    stopped = true;
    said?.stop?.();
  };
  return line;
}

// Stops every line sayVoiced has said, or has waiting (not the comms').
export function stopVoiced() {
  turn += 1;
  speech.stop('voiced');
}
