// The Eye’s voice: a made recording of a line where one has been made
// (lib/voiced, the speaker ‘sauron’), else the browser’s own speech, as deep
// and as slow as it will go, a man’s voice if it has one. Quiet with the
// site’s sound or voices off; the words burn on the screen either way
// (pages/RedBook.jsx). One line at a time: a new one cuts the last.

import { soundOn, voicesOn } from '../../../lib/audio';
import { speech } from '../../../lib/speech';
import { sayVoiced, voicedSrc } from '../../../lib/voiced';

const can = () => typeof window !== 'undefined' && 'speechSynthesis' in window && typeof window.SpeechSynthesisUtterance === 'function';

// a deep English voice if there is one
const LIKED = [/Google UK English Male/i, /Daniel|Arthur|Oliver|George|Fred|Ralph|Bruce/i, /Male/i, /en-GB/i, /^en/i];
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

let turn = 0;
let made = null;

export function sauronSays(text, { loud = 0.6 } = {}) {
  hush();
  if (!soundOn() || !voicesOn() || !text) return;
  const mine = turn;
  voicedSrc('sauron', text).then((src) => {
    if (mine !== turn) return;
    if (src) {
      made = sayVoiced('sauron', text, { mode: 'cut' });
      return;
    }
    if (!can() || speech.busy()) return;
    try {
      const u = new window.SpeechSynthesisUtterance(text);
      const v = voice();
      if (v) u.voice = v;
      u.lang = v?.lang ?? 'en-GB';
      u.rate = 0.72;
      u.pitch = 0.05;
      u.volume = 0.55 + loud * 0.45;
      window.speechSynthesis.speak(u);
    } catch {
      /* no voice, then: the words still burn */
    }
  });
}

export function hush() {
  turn += 1;
  made?.stop?.();
  made = null;
  if (!can()) return;
  try {
    window.speechSynthesis.cancel();
  } catch {
    /* nothing to stop */
  }
}
