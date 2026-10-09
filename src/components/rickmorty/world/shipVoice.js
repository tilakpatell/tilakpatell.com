// The cruiser's voice, saying what ./ship.js picks: its own (the show's ship,
// cloned by scripts/voices, made for each of its lines: ./voicelines.js) where
// a line's been made, and the browser's own speech for the rest, calm, low and
// a little slow. Quiet with the site's sound or voices off, or with the ship's voice
// switched off in the things-to-do list (kept in tp-c137-shipvoice); the
// captions show either way. With neither, it just doesn't speak.

import { soundOn, voicesOn } from '../../../lib/audio';
import { local } from '../../../lib/hooks';
import { speech } from '../../../lib/speech';
import { sayVoiced, voicedSrc } from '../../../lib/voiced';
import { SHIP_VOICE } from './ship';

const KEY = 'tp-c137-shipvoice';
export const shipVoiceOn = () => local.get(KEY, true) !== false;
export const setShipVoice = (on) => local.set(KEY, !!on);

const can = () => typeof window !== 'undefined' && 'speechSynthesis' in window && typeof window.SpeechSynthesisUtterance === 'function';

// a calm English voice if there is one: a British one first, a woman's if it says
const LIKED = [/Google UK English Female/i, /Serena|Kate|Martha|Stephanie|Fiona/i, /en-GB/i, /Samantha|Karen|Moira|Tessa|Victoria/i, /Female/i, /^en/i];
let chosen = null;
function voice() {
  if (chosen) return chosen;
  const all = window.speechSynthesis.getVoices?.() ?? [];
  if (!all.length) return null;
  for (const want of LIKED) {
    const v = all.find((o) => want.test(o.name) || want.test(o.lang));
    if (v) return (chosen = v);
  }
  return (chosen = all[0]);
}

function synth(line) {
  if (!can()) return;
  try {
    const s = window.speechSynthesis;
    s.cancel();
    const u = new window.SpeechSynthesisUtterance(line);
    const v = voice();
    if (v) u.voice = v;
    u.lang = v?.lang ?? 'en-GB';
    u.rate = 0.92;
    u.pitch = 0.72;
    u.volume = 0.9;
    s.speak(u);
  } catch {
    /* no voice, then */
  }
}

let turn = 0; // (a line asked for after this one, or a stop, overtakes it while it's looked up)
let made = null; // the made line, playing or waiting its turn (lib/speech.js)

// Says a line: the made one if there is one, else the browser's speech (not
// over anyone else). One at a time; nothing with the voices off.
export function speak(line) {
  if (!soundOn() || !shipVoiceOn() || !voicesOn()) return;
  stopSpeaking();
  const mine = turn;
  voicedSrc(SHIP_VOICE, line).then((src) => {
    if (mine !== turn) return;
    if (!src) {
      if (!speech.busy()) synth(line);
      return;
    }
    made = sayVoiced(SHIP_VOICE, line);
  });
}

export function stopSpeaking() {
  turn += 1;
  made?.stop();
  made = null;
  if (!can()) return;
  try {
    window.speechSynthesis.cancel();
  } catch {
    /* nothing to stop */
  }
}
