// What the Road sounds like: one ambient layer a stage (the design’s §4.3
// sound column, §4.7), cross-faded over FADE seconds as a stage opens; the
// beats’ one-off sounds through lib/sfx.js where it has them; the clips
// through lib/clips.js; the cast’s lines through lib/voiced.js, each told to
// the page as a 'line' event for the Bubble whether or not it has a voice.
// Everything goes on rt.audio’s bus, which is there only once the site’s
// context has started (the first key or tap): until then the Road is quiet
// and nothing is made.
//
//   LAYERS = { stageId: [[source, level], …] }   (sounds.js’s SOURCES)
//   fade(t) → { from, to }, an equal-gain cross-fade (they sum to 1)
//   levelsBetween(a, b, t) → { source: level } part way from layers a to b
//   createAmbience(rt) → { stage(id), update(dt), beat(kind), clip(id), say(who, text, at), stop(), stats(), dispose() }
//     stats() → { state (the context’s, or null before it is there), layers: { source: level } }

import { makeSource } from './sounds';
import { playClip } from '../../../lib/clips';
import { sayVoiced } from '../../../lib/voiced';
import { drum, stone, thunder, wraith } from '../../../lib/sfx';

export const FADE = 4; // s

export const LAYERS = {
  hobbiton: [['birds', 0.55], ['water', 0.25], ['jig', 0.3]],
  'shire-edge': [['wind', 0.4], ['rain', 0.35], ['water', 0.2]],
  bree: [['rain', 0.55], ['fire', 0.25]],
  weathertop: [['wind', 0.6], ['fire', 0.2]],
  ford: [['water', 0.7], ['wind', 0.3]],
  rivendell: [['water', 0.5], ['harp', 0.35], ['birds', 0.2]],
  caradhras: [['wind', 0.9]],
  moria: [['drum', 0.45], ['held', 0.08]],
  lorien: [['wind', 0.25], ['held', 0.3], ['birds', 0.15]],
  anduin: [['water', 0.6], ['wind', 0.25]],
  marshes: [['wind', 0.35], ['held', 0.06], ['brass', 0.25]],
  ithilien: [['water', 0.4], ['birds', 0.4], ['sub', 0.15]],
  'cirith-ungol': [['wind', 0.2], ['drum', 0.25]],
  gorgoroth: [['wind', 0.55], ['sub', 0.5], ['drum', 0.2]],
  'minas-tirith': [['birds', 0.4], ['bell', 0.45]],
  havens: [['water', 0.5], ['birds', 0.3], ['wind', 0.2]],
};

export function fade(t) {
  const k = Math.min(1, Math.max(0, t));
  return { from: 1 - k, to: k };
}

export function levelsBetween(a = [], b = [], t) {
  const { from, to } = fade(t);
  const out = {};
  for (const [name] of [...a, ...b]) out[name] = 0;
  for (const [name, level] of a) out[name] += level * from;
  for (const [name, level] of b) out[name] += level * to;
  return out;
}

// the beats’ one-offs lib/sfx.js already makes (the Ring’s wraith returns its stop)
const BEATS = { drum, stone, thunder, wraith };

export function createAmbience(rt) {
  const sources = new Map(); // name → source
  let ctx = null;
  let bus = null;
  let was = []; // the layers faded from
  let now = []; // the layers faded to
  let t = 1;
  let held = null; // the Ring’s whisper while it lasts
  const clips = new Set();
  const lines = new Set();
  let epoch = 0; // (bumped by stop: a clip that lands after it is stopped at once)

  // the bus once the context runs; the sources made as they are first wanted
  const ready = () => {
    if (bus) return true;
    bus = rt.audio?.bus?.() ?? null;
    ctx = bus?.context ?? null;
    return Boolean(bus && ctx);
  };
  const apply = () => {
    if (!ready()) return;
    for (const [name, level] of Object.entries(levelsBetween(was, now, t))) {
      let s = sources.get(name);
      if (!s && level > 0) sources.set(name, (s = makeSource(ctx, name, bus)));
      s?.set(level);
    }
  };

  return {
    stage(id) {
      // (from where the fade had got to, so a quick step back is not a jump)
      const at = levelsBetween(was, now, t);
      was = Object.entries(at).filter(([, l]) => l > 0);
      now = LAYERS[id] ?? [];
      t = 0;
      apply();
    },
    update(dt) {
      if (t < 1) t = Math.min(1, t + dt / FADE);
      apply();
    },
    beat(kind) {
      if (kind === 'wraith') {
        held ??= wraith();
        return;
      }
      if (kind === 'wraith:off') {
        held?.();
        held = null;
        return;
      }
      BEATS[kind]?.();
    },
    async clip(id, opts) {
      const mine = epoch;
      const c = await playClip(id, opts);
      if (c && mine !== epoch) {
        c.stop?.();
        return null;
      }
      if (c) {
        clips.add(c);
        c.ended?.then?.(() => clips.delete(c));
      }
      return c;
    },
    say(who, text, at) {
      rt.events?.emit?.('line', { who, text, at });
      const line = sayVoiced(who, text);
      lines.add(line);
      line.then?.(() => lines.delete(line), () => lines.delete(line));
      return line;
    },
    stats: () => ({ state: ctx?.state ?? null, layers: Object.fromEntries([...sources.keys()].map((n) => [n, Math.round(sources.get(n).node.gain.value * 100) / 100])) }),
    stop() {
      epoch += 1;
      for (const c of clips) c.stop?.();
      for (const l of lines) l.stop?.();
      clips.clear();
      lines.clear();
      held?.();
      held = null;
    },
    dispose() {
      this.stop();
      for (const s of sources.values()) s.stop();
      sources.clear();
      bus = null;
    },
  };
}
