// The wand’s sounds, all made here on the runtime’s bus (rt.audio: the
// site’s one context, the master volume, faded out with the world): the
// whip of a flick, the crack of a spell let go, Protego’s hum, Lumos’s
// little bell, a bolt’s hit, and the Patronus’s three rising notes in D,
// the world’s own motif (the design’s §4.12). Nothing from the films.
//
//   createSpellSounds(rt) → { cast(spell), hit(how), fizzle(), hum(), notes(), whoosh(k), dispose() }

let noiseBuf = null;
function noise(ac) {
  if (noiseBuf && noiseBuf.sampleRate === ac.sampleRate) return noiseBuf;
  const n = ac.sampleRate;
  noiseBuf = ac.createBuffer(1, n, ac.sampleRate);
  const d = noiseBuf.getChannelData(0);
  let s = 12345;
  for (let i = 0; i < n; i++) {
    // (a fixed noise: the same whip every time, and no Math.random on the path)
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    d[i] = (s / 0x7fffffff) * 2 - 1;
  }
  return noiseBuf;
}

export function createSpellSounds(rt) {
  const ctx = () => rt?.audio?.context?.() ?? null;
  const out = () => rt?.audio?.bus?.() ?? null;
  const ready = () => {
    const ac = ctx();
    const o = ac ? out() : null;
    return ac && o && ac.state !== 'closed' ? [ac, o] : null;
  };

  // a band of noise swept from one pitch to another: the whip, a whoosh
  const sweep = (dur, from, to, gain, q = 1.4, delay = 0) => {
    const r = ready();
    if (!r) return;
    const [ac, o] = r;
    const t = ac.currentTime + delay;
    const src = ac.createBufferSource();
    src.buffer = noise(ac);
    const f = ac.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = q;
    f.frequency.setValueAtTime(from, t);
    f.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + dur * 0.25);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(o);
    src.start(t);
    src.stop(t + dur + 0.05);
  };
  // a struck tone, or a few one after another
  const tone = (freqs, { type = 'sine', dur = 0.4, gain = 0.06, gap = 0, attack = 0.008, glide = 1 } = {}) => {
    const r = ready();
    if (!r) return;
    const [ac, o] = r;
    const t0 = ac.currentTime;
    freqs.forEach((hz, i) => {
      const t = t0 + i * gap;
      const osc = ac.createOscillator();
      osc.type = type;
      osc.frequency.setValueAtTime(hz, t);
      if (glide !== 1) osc.frequency.exponentialRampToValueAtTime(hz * glide, t + dur);
      const g = ac.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(gain, t + attack);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(g).connect(o);
      osc.start(t);
      osc.stop(t + dur + 0.05);
    });
  };
  // the crack: a short bright snap of noise over a low knock
  const crack = (gain = 0.22, delay = 0.09) => {
    sweep(0.06, 5200, 2400, gain, 0.8, delay);
    tone([140], { type: 'triangle', dur: 0.12, gain: gain * 0.35, glide: 0.5 });
  };

  return {
    cast(spell) {
      const kind = spell?.kind;
      // every cast has the whip; what it lets go is its own
      sweep(0.16, 700, 3600, 0.1);
      if (kind === 'light') tone([1760, 2637], { type: 'triangle', dur: 0.5, gain: 0.03, gap: 0.05 });
      else if (kind === 'bolt') crack(spell.id === 'stupefy' ? 0.26 : 0.2);
      else if (kind === 'shield') tone([220, 221.6, 330], { dur: 1.1, gain: 0.04, attack: 0.08 });
      else if (kind === 'fire') sweep(0.5, 300, 900, 0.14, 0.7, 0.06);
      else if (kind === 'summon') sweep(0.45, 2400, 500, 0.08, 1.8, 0.05);
      else if (kind === 'lift') tone([520], { type: 'sine', dur: 0.6, gain: 0.03, glide: 1.6, attack: 0.1 });
      else if (kind === 'unlock') tone([880, 660], { type: 'square', dur: 0.08, gain: 0.025, gap: 0.09 });
      else if (kind === 'patronus') this.notes();
    },
    // a bolt landing: on a figure, on a shield, thrown back
    hit(how = 'hit') {
      if (how === 'back') tone([440, 880], { type: 'triangle', dur: 0.3, gain: 0.05, gap: 0.04 });
      else if (how === 'blocked') tone([330], { dur: 0.35, gain: 0.05, glide: 0.8 });
      else crack(0.28, 0);
    },
    fizzle: () => sweep(0.25, 900, 300, 0.05, 0.9),
    hum: () => tone([220, 221.6], { dur: 0.9, gain: 0.035, attack: 0.1 }),
    // the world’s motif: D, F sharp, A, rising, soft
    notes: () => tone([293.66, 369.99, 440], { type: 'triangle', dur: 1.4, gain: 0.05, gap: 0.32, attack: 0.04 }),
    whoosh: (k = 1) => sweep(0.35, 400, 1600 * k, 0.06 * k),
    dispose() {},
  };
}
