// What the Red Book sounds like: the study’s fire and the rain on its round
// window under everything, and over them the score, one mood for each group
// of pages (./score.js), played on the book’s instruments
// (./instruments.js) and cross-faded at a phrase’s end as the pages turn.
// The Ring sinks it all under a closing filter, with a whisper rising and,
// as the Eye comes nearer, a heartbeat; the Palantír lowers the score under
// a glassy shimmer, gone sour and dark when the Eye looks back. And the
// book’s own sounds: a page turning, the pop-up standing, the cover, the
// Ring, the stone, a find, someone met.
//
// Everything is on rt.audio’s bus (the module’s gain into the master),
// asked for only once the visitor has pressed or touched (`wake()`): before
// that the browser will not start a context, so nothing is made and every
// call just remembers where the book is. Notes are scheduled a little ahead
// on the context’s own clock from the world’s step, never by timers that
// drift; a note that would have been missed while the tab slept is let go.
//
//   createMusic(rt, { on, reduced }) → { wake(), page(id), update(dt, { vision, dread, stone, eye }),
//     cue(name), setOn(on), on, stats(), dispose() }
//   stats() → { state (the context’s, or null), mood, playing (voices now), on }

import { eventsOf, moodOf, nextPhrase, notesIn } from './score';
import { createKit, crackle, cue as cueOf, hz, impulse, note, patter } from './instruments';

const AHEAD = 0.3; // s of notes scheduled ahead of the clock
const SCORE = 0.38; // the score’s level: its peaks near −16 dBFS, well under the site’s sounds
const AMBIENCE = 0.06; // the fire and the rain, softer still
const MAX_VOICES = 56;
const MAX_CUES = 16;
const OPEN = 18000; // the Ring’s filter, open (Hz)
const SHUT = 320; // and as shut as it goes

export function createMusic(rt, { on = true, reduced = false } = {}) {
  let isOn = Boolean(on);
  let mood = 'study'; // the mood wanted, kept before the context is there too
  let awake = false;
  let ctx = null;
  let kit = null;
  let g = null; // the graph’s fixed nodes
  const layers = []; // a mood playing: { mood, gain, start, until, fading, stopAt }
  const voices = [];
  const cues = [];
  const live = {}; // the held layers: ambience, whisper, shimmer, sour, drone
  let beatAt = 0;

  const gain = (value, to) => {
    const n = ctx.createGain();
    n.gain.value = value;
    if (to) n.connect(to);
    return n;
  };
  const filter = (type, f, q, to) => {
    const n = ctx.createBiquadFilter();
    n.type = type;
    n.frequency.value = f;
    n.Q.value = q;
    if (to) n.connect(to);
    return n;
  };
  const loopOf = (data, to, rate = 1) => {
    const b = ctx.createBuffer(1, data.length, ctx.sampleRate);
    b.copyToChannel(data, 0);
    const s = ctx.createBufferSource();
    s.buffer = b;
    s.loop = true;
    s.playbackRate.value = rate;
    s.connect(to);
    s.start();
    return s;
  };
  const halt = (sources) => {
    for (const s of sources)
      try {
        s.stop();
      } catch {
        /* never started, or already stopped */
      }
  };
  const letGo = (nodes) => {
    for (const n of nodes)
      try {
        n.disconnect();
      } catch {
        /* already gone */
      }
  };
  // (a level eased toward, and only when it has moved: one call a frame
  // would leave the context a timeline of thousands)
  const eased = new WeakMap();
  const ease = (param, value, tau = 0.08) => {
    const was = eased.get(param);
    if (was != null && Math.abs(was - value) <= Math.abs(value) * 0.004 + 1e-5) return;
    eased.set(param, value);
    param.setTargetAtTime(value, ctx.currentTime, tau);
  };

  function build(bus) {
    // score → the Ring’s filter → the stone’s duck → the bus; a send to the hall
    const scoreBus = gain(isOn ? SCORE : 0);
    const duck = gain(1, bus);
    const ringLp = filter('lowpass', OPEN, 0.5, duck);
    scoreBus.connect(ringLp);
    const reverbIn = gain(1);
    const hall = ctx.createConvolver();
    const [l, r] = impulse(ctx.sampleRate);
    const ir = ctx.createBuffer(2, l.length, ctx.sampleRate);
    ir.copyToChannel(l, 0);
    ir.copyToChannel(r, 1);
    hall.buffer = ir;
    const wet = gain(0.55, ringLp);
    reverbIn.connect(hall).connect(wet);
    const send = gain(0.45, reverbIn);
    scoreBus.connect(send);
    // the book’s sounds and the held layers, beside the score
    const cueOut = gain(1.6, bus);
    const cueSend = gain(0.3, reverbIn);
    cueOut.connect(cueSend);
    const fxOut = gain(1, bus);
    // the study: the fire and the rain, muffled a little under the Ring
    const ambGain = gain(AMBIENCE, bus);
    const ambLp = filter('lowpass', 12000, 0.5, ambGain);
    return { scoreBus, duck, ringLp, reverbIn, hall, wet, send, cueOut, cueSend, fxOut, ambGain, ambLp };
  }

  function ambience() {
    const nodes = [];
    const fireLp = filter('lowpass', 3200, 0.5, g.ambLp);
    const fireG = gain(0.9, fireLp);
    const rainHp = filter('highpass', 3000, 0.4, g.ambLp);
    const rainG = gain(0.22, rainHp);
    const dropsG = gain(0.45, g.ambLp);
    nodes.push(fireLp, fireG, rainHp, rainG, dropsG);
    const sources = [loopOf(crackle(ctx.sampleRate), fireG), loopOf(patter(ctx.sampleRate), dropsG)];
    const hiss = ctx.createBufferSource();
    hiss.buffer = kit.noise;
    hiss.loop = true;
    hiss.connect(rainG);
    hiss.start();
    sources.push(hiss);
    return { sources, nodes: [...nodes, ...sources] };
  }

  // the Ring’s whisper: breath through a moving vowel, trembling
  function whisper() {
    const out = gain(0, g.fxOut);
    const band = filter('bandpass', 1400, 2.5, out);
    const s = ctx.createBufferSource();
    s.buffer = kit.noise;
    s.loop = true;
    s.playbackRate.value = 0.7;
    const trem = gain(0.5, band);
    s.connect(trem);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.7;
    const depth = gain(0.45, trem.gain);
    lfo.connect(depth);
    const sweep = ctx.createOscillator();
    sweep.frequency.value = 0.13;
    const reach = gain(900, band.frequency);
    sweep.connect(reach);
    const sources = [s, lfo, sweep];
    sources.forEach((x) => x.start());
    return { out, sources, nodes: [out, band, trem, depth, reach, ...sources] };
  }
  // the stone’s shimmer: high glass tones, each trembling at its own pace;
  // `notes` sour ones a semitone off for when the Eye looks back
  function glass(notes, level) {
    const out = gain(0, g.fxOut);
    out.connect(g.cueSend);
    const sources = [];
    const nodes = [out];
    notes.forEach((m, i) => {
      const o = ctx.createOscillator();
      o.frequency.value = hz(m);
      const v = gain(level, out);
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.21 + i * 0.13;
      const d = gain(level * 0.8, v.gain);
      o.connect(v);
      lfo.connect(d);
      sources.push(o, lfo);
      nodes.push(o, v, lfo, d);
    });
    sources.forEach((x) => x.start());
    return { out, sources, nodes };
  }
  // the Eye’s drone: a low saw, throbbing
  function drone() {
    const out = gain(0, g.fxOut);
    const lp = filter('lowpass', 140, 1, out);
    const throb = gain(0.6, lp);
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = 41.2;
    o.connect(throb);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 1.1;
    const d = gain(0.4, throb.gain);
    lfo.connect(d);
    const sources = [o, lfo];
    sources.forEach((x) => x.start());
    return { out, sources, nodes: [out, lp, throb, d, ...sources] };
  }
  // one beat of the heart: lub at t, and its quieter dub after
  function heartbeat(t, level) {
    const v = { end: t + 0.9, sources: [], nodes: [] };
    for (const [k, peak] of [[0, level], [0.26, level * 0.7]]) {
      const o = ctx.createOscillator();
      o.frequency.setValueAtTime(58, t + k);
      o.frequency.exponentialRampToValueAtTime(36, t + k + 0.08);
      const a = ctx.createGain();
      a.gain.setValueAtTime(0, t + k);
      a.gain.linearRampToValueAtTime(peak, t + k + 0.01);
      a.gain.setTargetAtTime(0, t + k + 0.02, 0.08);
      o.connect(a).connect(g.fxOut);
      o.start(t + k);
      o.stop(t + 0.9);
      v.sources.push(o);
      v.nodes.push(o, a);
    }
    cues.push(v);
  }

  // a mood begun at `at` on the context’s clock, faded in, its plucks made first
  function begin(m, at) {
    const l = { mood: m, gain: gain(0, g.scoreBus), start: at, until: at, fading: false, stopAt: Infinity };
    l.gain.gain.setValueAtTime(0, at);
    l.gain.gain.setTargetAtTime(1, at, 0.5);
    for (const e of eventsOf(m)) if (e.inst === 'harp') kit.pluck(e.midi);
    layers.push(l);
    // (no more than three at once: the oldest goes at once)
    while (layers.length > 3) {
      const old = layers.shift();
      letGo([old.gain]);
    }
  }
  function change(m) {
    const now = ctx.currentTime;
    const cur = layers.find((l) => !l.fading);
    if (cur?.mood === m) return;
    let at = now + 0.12;
    if (cur) {
      cur.fading = true;
      if (cur.start > now) {
        // (it never began: it goes now)
        cur.gain.gain.cancelScheduledValues(now);
        cur.gain.gain.setValueAtTime(0, now);
        cur.stopAt = now;
      } else {
        const b = cur.start + nextPhrase(cur.mood, now + 0.1 - cur.start);
        if (b - now < 2.5) at = b;
        cur.gain.gain.setTargetAtTime(0, Math.max(now, at - 1), 0.8);
        cur.stopAt = at + 2;
      }
    }
    begin(m, at);
  }

  function schedule(now) {
    for (const l of layers) {
      if (!isOn) {
        l.until = Math.max(l.until, now);
        continue;
      }
      if (l.until < now - 0.05) l.until = Math.max(l.start, now);
      const to = Math.min(now + AHEAD, l.stopAt);
      if (to <= l.until) continue;
      for (const e of notesIn(l.mood, l.until - l.start, to - l.start)) {
        if (voices.length >= MAX_VOICES) break;
        voices.push(note(ctx, kit, { ...e, t: l.start + e.t }, l.gain));
      }
      l.until = to;
    }
  }
  function prune(now) {
    for (const list of [voices, cues])
      for (let i = list.length - 1; i >= 0; i--)
        if (list[i].end < now) {
          letGo(list[i].nodes);
          list.splice(i, 1);
        }
    for (let i = layers.length - 1; i >= 0; i--)
      if (layers[i].fading && now > layers[i].stopAt + 3) {
        letGo([layers[i].gain]);
        layers.splice(i, 1);
      }
  }

  return {
    wake() {
      if (awake) return;
      const bus = rt?.audio?.bus?.() ?? null;
      const c = bus?.context ?? null;
      if (!bus || !c) return;
      ctx = c;
      kit = createKit(ctx);
      g = build(bus);
      live.ambience = ambience();
      awake = true;
      begin(mood, ctx.currentTime + 0.1);
    },
    page(id) {
      mood = moodOf(id);
      if (awake) change(mood);
    },
    update(dt, { vision = 0, dread = 0, stone = 0, eye = 0 } = {}) {
      if (!awake) return;
      const now = ctx.currentTime;
      schedule(now);
      prune(now);
      // the Ring: the world sinks and goes cold, and something whispers
      ease(g.ringLp.frequency, OPEN * (SHUT / OPEN) ** vision);
      ease(g.ambLp.frequency, 12000 * (900 / 12000) ** (vision * 0.8));
      ease(g.duck.gain, (1 - 0.6 * stone) * (1 - 0.25 * vision), 0.15);
      if (vision > 0.005) live.whisper ??= whisper();
      if (live.whisper) ease(live.whisper.out.gain, vision * 0.12, 0.2);
      // the Palantír’s glass, gone sour when the Eye is in it
      if (stone > 0.005) {
        live.shimmer ??= glass([81, 88, 95, 102], 0.25);
        live.sour ??= glass([82, 87, 94], 0.25);
      }
      if (live.shimmer) ease(live.shimmer.out.gain, stone * 0.06 * (1 - eye * 0.6), 0.25);
      if (live.sour) ease(live.sour.out.gain, stone * eye * 0.06, 0.25);
      if (eye > 0.005) live.drone ??= drone();
      if (live.drone) ease(live.drone.out.gain, eye * 0.16, 0.2);
      // the heart, quickening as the Eye comes nearer
      if (dread > 0.04) {
        if (beatAt < now) beatAt = now + 0.05;
        while (beatAt < now + AHEAD) {
          if (cues.length < MAX_CUES) heartbeat(beatAt, 0.22 * dread);
          beatAt += 60 / (46 + 34 * dread);
        }
      } else beatAt = 0;
    },
    cue(name) {
      if (!awake || cues.length >= MAX_CUES) return;
      const v = cueOf(ctx, kit, name, ctx.currentTime + 0.005, g.cueOut);
      if (v) cues.push(v);
    },
    setOn(value) {
      isOn = Boolean(value);
      if (!awake) return;
      ease(g.scoreBus.gain, isOn ? SCORE : 0, 0.35);
      if (isOn) for (const l of layers) l.until = Math.max(l.until, ctx.currentTime);
    },
    get on() {
      return isOn;
    },
    stats: () => ({ state: ctx?.state ?? null, mood, playing: voices.length, on: isOn, reduced: Boolean(reduced) }),
    dispose() {
      for (const v of [...voices, ...cues]) {
        halt(v.sources);
        letGo(v.nodes);
      }
      voices.length = 0;
      cues.length = 0;
      for (const x of Object.values(live)) {
        halt(x.sources);
        letGo(x.nodes);
      }
      for (const k of Object.keys(live)) delete live[k];
      letGo(layers.map((l) => l.gain));
      layers.length = 0;
      if (g) letGo(Object.values(g));
      g = null;
      kit = null;
      ctx = null;
      awake = false;
    },
  };
}
