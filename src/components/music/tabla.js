// The tabla, played from real strokes: dio_333's recordings (CC0, from Sonic
// Pi's sample library), one sprite of 25 takes (./tablaSprite.js). The dayan
// is retuned to Sa and the bayan to Sa or Pa below it; each bol takes the
// next of its takes with a hand's small differences in time, level and pitch.
// A closed stroke stops what its drum was ringing, as the hand does. The
// rules (which take, how tuned, where a tihai falls) are in ./tablaRules.js.
//
// If the recordings can't load, the drums are synthesised from their modes
// instead, so a stroke never goes silent.

import { audioContext, prefetch } from '../../lib/audio';
import { decode, mix } from './room';
import { sa } from './tuning';
import { TABLA_SLOTS, TABLA_URL } from './tablaSprite';
import { BOLS, LAYA, STROKES, TAALS, accent, alignStart, beatBols, humanize, planTihai, rateFor, rng, takeFor } from './tablaRules';

export { BOLS, LAYA, TAALS };

// ── Loading ────────────────────────────────────────────────────────────────
let sprite = null; // Promise<{ buf, starts }>
let ready = null; // the same, once it has arrived
let failedAt = -Infinity; // when the recordings last failed to load with sound on

// `ac` is the live context, when there is one; without it the strokes are
// decoded offline, ahead of the first click.
function load(ac = null) {
  if (!sprite) {
    sprite = prefetch(TABLA_URL)
      .then((bytes) => decode(bytes, ac))
      .then((buf) => {
        const data = buf.getChannelData(0);
        const starts = {};
        for (const [name, [at, dur]] of Object.entries(TABLA_SLOTS)) starts[name] = alignStart(data, buf.sampleRate, at, dur);
        ready = { buf, starts };
        return ready;
      })
      .catch((e) => {
        sprite = null; // try again next time
        if (ac) failedAt = performance.now();
        throw e;
      });
  }
  return sprite;
}
const failing = () => performance.now() - failedAt < 8000;

// Fetch and decode the strokes ahead of the first one (on scroll, say). Needs
// no click: nothing starts playing.
export const warmTabla = () => load().catch(() => null);

// ── The mix ────────────────────────────────────────────────────────────────
let bus = null;
function out(ac) {
  if (bus) return bus;
  bus = ac.createGain();
  bus.gain.value = 0.62;
  // the body of the drums: a touch of warmth low down, the slap kept crisp
  const warm = ac.createBiquadFilter();
  warm.type = 'lowshelf';
  warm.frequency.value = 180;
  warm.gain.value = 2;
  bus.connect(warm).connect(mix(ac));
  return bus;
}

// What is ringing on each drum, so a closed stroke can stop it.
const ringing = { dayan: [], bayan: [] };
const counts = {};
const hand = rng((Date.now() & 0xffff) || 1);

function choke(drum, t) {
  const list = ringing[drum];
  for (const v of list) if (v.at < t) v.g.gain.setTargetAtTime(0, t, 0.022);
  ringing[drum] = list.filter((v) => v.at >= t);
}

// One take, at time t. Returns the voice, so a gumki can bend it.
function sound(ac, name, t, vel, rate, dest, ringOn) {
  const { buf, starts } = ready;
  const [, dur] = TABLA_SLOTS[name];
  const src = ac.createBufferSource();
  src.buffer = buf;
  src.playbackRate.setValueAtTime(rate, t);
  // softer strokes are darker, as a lighter finger excites fewer overtones
  const tone = ac.createBiquadFilter();
  tone.type = 'lowpass';
  tone.frequency.value = 2400 + 15000 * vel * vel;
  tone.Q.value = 0.3;
  const g = ac.createGain();
  g.gain.setValueAtTime(vel, t);
  src.connect(tone).connect(g).connect(dest);
  src.start(t, starts[name], dur);
  src.stop(t + dur / rate + 0.05);
  const v = { src, g, at: t, rate };
  if (ringOn) {
    const list = ringing[ringOn];
    list.push(v);
    // a drum carries three rings at most; older ones have faded into the new
    if (list.length > 3) list.shift().g.gain.setTargetAtTime(0, t, 0.08);
    src.onended = () => {
      const i = ringing[ringOn].indexOf(v);
      if (i >= 0) ringing[ringOn].splice(i, 1);
    };
  }
  return v;
}

function stroke(ac, part, t, vel, cents, dest) {
  const s = STROKES[part];
  counts[part] = (counts[part] || 0) + 1;
  const name = takeFor(part, counts[part] - 1);
  if (s.closed) choke(s.drum, t + 0.001);
  const rate = rateFor(s.drum, sa()) * 2 ** (cents / 1200);
  return sound(ac, name, t, Math.min(1.2, vel * s.gain), rate, dest, s.ring ? s.drum : null);
}

// Listeners for each bol as it sounds (the music planet's tabla shows them).
const bolListeners = new Set();
export const onTablaBol = (fn) => {
  bolListeners.add(fn);
  return () => bolListeners.delete(fn);
};
function heard(ac, bol, at) {
  if (!bolListeners.size) return;
  setTimeout(() => bolListeners.forEach((fn) => fn(bol)), Math.max(0, (at - ac.currentTime) * 1000));
}

// Play a bol at `when` seconds from now. `gumki` plays the bayan's lifting Ge.
// Returns a handle whose bend(semitones) pulls the bayan's pitch up as the
// heel of the hand presses (the gumki), or null if there is no sound.
export function playBol(bol, { when = 0, vel = 0.9, gumki = false, human = true } = {}) {
  const ac = audioContext();
  const parts = BOLS[bol];
  if (!ac || !parts) return null;
  const dest = out(ac);
  const h = human ? humanize(hand) : { dt: 0, vel: 1, cents: 0 };
  const t = Math.max(ac.currentTime + 0.003, ac.currentTime + when + h.dt);
  const go = () => {
    const at = Math.max(t, ac.currentTime + 0.003);
    if (at - t > 0.25) return null; // arrived too late to belong to its beat
    let bayan = null;
    for (const p of parts) {
      const part = gumki && p === 'ge' ? 'gumki' : p;
      const v = stroke(ac, part, at, vel * h.vel, h.cents, dest);
      if (STROKES[part].drum === 'bayan') bayan = v;
    }
    heard(ac, bol, at);
    return bayan;
  };
  if (ready) {
    const bayan = go();
    return bayan ? bend(ac, bayan) : { bend() {} };
  }
  // the recordings failed a moment ago: synthesise, and leave them be for a while
  if (failing()) {
    synthBol(ac, parts, t, vel, gumki);
    return { bend() {} };
  }
  // not loaded yet: load, then play (late by the decode at most); synthesise if it fails
  const handle = { voice: null, bend: (st) => handle.voice && bend(ac, handle.voice).bend(st) };
  load(ac)
    .then(() => {
      handle.voice = go();
    })
    .catch(() => synthBol(ac, parts, Math.max(t, ac.currentTime + 0.003), vel, gumki));
  return handle;
}

function bend(ac, v) {
  return {
    bend(semitones) {
      const target = v.rate * 2 ** (Math.max(0, Math.min(7, semitones)) / 12);
      v.src.playbackRate.cancelScheduledValues(ac.currentTime);
      v.src.playbackRate.setTargetAtTime(target, ac.currentTime, 0.06);
    },
  };
}

// ── The theka ──────────────────────────────────────────────────────────────
let theka = null;
export const thekaPlaying = () => Boolean(theka);

// Plays a taal's theka on a loop. `onBeat(i)` is called as each beat sounds;
// `onTihai(state)` with 'set' when a tihai has been placed and 'landed' when
// it falls on sam.
export function startTheka(taalId, bpm, onBeat, { laya = 'thah', onTihai } = {}) {
  const ac = audioContext();
  if (!ac || !TAALS[taalId]) return false;
  stopTheka();
  load(ac).catch(() => null);
  out(ac);
  const state = {
    taal: TAALS[taalId],
    bpm,
    laya: LAYA[laya] || 1,
    beat: 0,
    next: ac.currentTime + 0.12,
    timers: [],
    onBeat,
    onTihai,
    wantTihai: false,
    tihai: null, // { cycle, plan }
    last: null, // the last beat scheduled: { at, beat }
    interval: 0,
  };
  const n = () => state.taal.theka.length;
  const notify = (fn, at) => {
    state.timers.push(setTimeout(fn, Math.max(0, (at - ac.currentTime) * 1000)));
    if (state.timers.length > 48) state.timers.splice(0, 24);
  };
  const schedule = () => {
    while (state.next < ac.currentTime + 0.14) {
      const len = 60 / state.bpm;
      const cycle = Math.floor(state.beat / n());
      const i = state.beat % n();
      // place a tihai in this cycle if it still fits, else in the next
      if (state.wantTihai && !state.tihai) {
        const plan = planTihai(n());
        state.tihai = { cycle: i <= plan.start ? cycle : cycle + 1, plan };
        state.wantTihai = false;
        notify(() => state.onTihai?.('set'), state.next);
      }
      const T = state.tihai;
      let bols = beatBols(state.taal, i, state.laya);
      let extra = [];
      if (T && T.cycle === cycle) {
        // the theka gives way where the tihai begins; the tihai's strokes in this beat
        bols = bols.filter(([o]) => i + o < T.plan.start - 1e-9);
        extra = T.plan.events.filter(([p]) => p >= i && p < i + 1).map(([p, b]) => [p - i, b, 0.95]);
      } else if (T && T.cycle + 1 === cycle && i === 0) {
        // the tihai's last Dha is sam: one stroke, the strongest of the cycle
        bols = [[0, 'Dha', 1.12]];
        state.tihai = null;
        notify(() => state.onTihai?.('landed'), state.next);
      }
      for (const [o, b, v] of [...bols, ...extra]) {
        const vel = (v ?? accent(state.taal, i)) * (o === 0 ? 1 : 0.9);
        playBol(b, { when: state.next - ac.currentTime + o * len, vel });
      }
      const at = state.next;
      notify(() => state.onBeat?.(i), at);
      state.last = { at, beat: state.beat };
      state.next += len;
      state.beat++;
    }
  };
  schedule();
  state.interval = setInterval(schedule, 25);
  theka = state;
  return true;
}

// The theka's beat, for playing along with it (the sitar's chikari): the last
// beat scheduled (`beat`, counted from the first, sounding at `at` on the audio
// clock), how long a beat is now, the laya and the taal. Null when it's quiet.
export function thekaGrid() {
  if (!theka?.last) return null;
  const { last, next, laya, taal } = theka;
  return { at: last.at, beat: last.beat, len: next - last.at, laya, taal };
}

export function setThekaTempo(bpm) {
  if (theka) theka.bpm = bpm;
}

export function setThekaLaya(laya) {
  if (theka) theka.laya = LAYA[laya] || 1;
}

// End the cycle (or the next, if this one is too far gone) with a tihai.
export function tihai() {
  if (!theka || theka.tihai) return false;
  theka.wantTihai = true;
  return true;
}

export function stopTheka() {
  if (!theka) return;
  clearInterval(theka.interval);
  theka.timers.forEach(clearTimeout);
  theka = null;
}

// ── The fallback: drums from their modes ───────────────────────────────────
// Only if the recordings can't load. The dayan's black syahi makes its first
// modes whole-number multiples of its pitch; each stroke is a few of them.
let noiseBuf = null;
const MODES = {
  na: { modes: [[1, 0.22, 0.16], [2, 1, 0.5], [3, 0.62, 0.34], [4, 0.4, 0.24]], click: 0.5 },
  ta: { modes: [[1, 0.3, 0.2], [2, 1, 0.45], [3, 0.4, 0.3]], click: 0.45 },
  tin: { modes: [[1, 0.42, 0.26], [2, 0.9, 0.42], [3, 0.42, 0.28], [4, 0.2, 0.18]], click: 0.25 },
  tun: { modes: [[1, 1, 0.9], [2, 0.42, 0.45], [3, 0.22, 0.3]], click: 0.15 },
  ti: { modes: [[1, 0.3, 0.05], [2, 0.32, 0.04]], click: 0.9, closed: true },
  te: { modes: [[1, 0.3, 0.05], [2, 0.3, 0.04]], click: 0.9, closed: true },
  ra: { modes: [[1, 0.22, 0.04], [2, 0.24, 0.035]], click: 0.6, closed: true },
  tak: { modes: [[2, 0.5, 0.06], [3, 0.3, 0.05]], click: 0.7, closed: true },
};

function synthBol(ac, parts, t, vel, gumki) {
  const dest = out(ac);
  if (!noiseBuf) {
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const f = rateFor('dayan', sa()) * 315;
  for (const p of parts) {
    if (p === 'ge' || p === 'ga' || p === 'gumki') synthGe(ac, dest, t, rateFor('bayan', sa()) * 92, vel, gumki || p === 'gumki');
    else if (p === 'ke') noise(ac, dest, t, vel, 650, 0.06, 'lowpass');
    else synthDayan(ac, dest, t, f, MODES[p] || MODES.na, vel);
  }
}

function synthDayan(ac, dest, t, f, spec, vel) {
  for (const [mul, level, decay] of spec.modes) {
    const o = ac.createOscillator();
    o.frequency.value = f * mul;
    const g = ac.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(level * vel * 0.32, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay * 3);
    o.connect(g).connect(dest);
    o.start(t);
    o.stop(t + decay * 3 + 0.02);
  }
  noise(ac, dest, t, spec.click * vel * 0.6, spec.closed ? 1800 : 3200, spec.closed ? 0.045 : 0.012, 'bandpass');
}

function synthGe(ac, dest, t, f, vel, gumki) {
  const o = ac.createOscillator();
  o.frequency.setValueAtTime(f * 1.14, t);
  o.frequency.exponentialRampToValueAtTime(f, t + 0.07);
  if (gumki) o.frequency.exponentialRampToValueAtTime(f * 1.32, t + 0.42);
  const g = ac.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.5 * vel, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
  o.connect(g).connect(dest);
  o.start(t);
  o.stop(t + 1.15);
  noise(ac, dest, t, vel * 0.5, 420, 0.06, 'lowpass');
}

function noise(ac, dest, t, vel, freq, len, type) {
  const src = ac.createBufferSource();
  src.buffer = noiseBuf;
  const f = ac.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = 0.9;
  const g = ac.createGain();
  g.gain.setValueAtTime(0.5 * vel, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  src.connect(f).connect(g).connect(dest);
  src.start(t, Math.random() * 0.5);
  src.stop(t + len + 0.01);
}
