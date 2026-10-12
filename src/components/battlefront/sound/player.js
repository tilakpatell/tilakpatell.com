// The Battlefront world's sounds on the site's one Web Audio context
// (lib/audio): the one-shots as decoded buffers on a world bus (a gain and
// a low-pass the mixers duck: mix.js's DUCKS) or a UX bus (the HUD's cues,
// never positional), the beds as looping buffers, and the music stems as
// <audio> elements streamed through the site's music volume, so a two-minute
// stem never sits decoded in memory. Every start is counted by name
// (`stats()`: the dev door's counter, scripts/bf2017-sound-check.mjs reads
// it). The names are sounds.js's; the asset base resolves each file
// (lib/assetBase: the bucket when the index is published, the site else).
//
//   createSoundPlayer({ context, output, musicOut, load, resolve, rows, rng }) → {
//     preload(names) → Promise, ready(name)
//     play(name, { gain, pitch, pan, ux, loop }) → { stop(fade) } | null   (a take at random, never the last three)
//     music(name, { then, loop, fade }) → { stop(fade) }   (`then`: the name to loop once this ends)
//     stopMusic(fade), duck(kind), stats(), dispose()
//   }
//   playStem(row, { musicOut, resolve, loop, then, onEnd }) → { element, stop(fade) }  (the loading screen's)

import { audioContext, loadBuffer, musicOutput, output as masterOut } from '../../../lib/audio';
import { assetUrl } from '../../../lib/assetBase';
import { DUCKS } from './mix.js';
import { ROWS, pickTake, urlOf } from './sounds.js';

const dbToGain = (db) => 10 ** (db / 20);

// A stem on an <audio> element into the music volume: streamed, looped by
// the element, faded by its own gain. `then` names the row to loop when a
// one-pass stem (an intro) ends.
export function playStem(row, { musicOut = musicOutput, resolve = assetUrl, loop = row?.loop ?? false, then = null, onEnd = null, rows = ROWS, file = 0 } = {}) {
  const out = musicOut();
  const ac = out?.context;
  if (!ac || !row?.files?.length) return null;
  const el = new Audio();
  el.crossOrigin = 'anonymous';
  el.preload = 'auto';
  el.loop = loop;
  el.src = resolve(urlOf(row.files[Math.min(file, row.files.length - 1)]));
  const gain = ac.createGain();
  gain.gain.value = row.gain ?? 1;
  let source = null;
  try {
    source = ac.createMediaElementSource(el);
    source.connect(gain).connect(out);
  } catch {
    /* the element can't join the graph (a test's stub): it plays on its own */
  }
  let next = null;
  let stopped = false;
  el.addEventListener('ended', () => {
    if (stopped) return;
    if (then && rows[then]) next = playStem(rows[then], { musicOut, resolve, loop: true, rows });
    onEnd?.();
  });
  el.play().catch(() => {});
  return {
    element: el,
    stop(fade = 600) {
      stopped = true;
      next?.stop(fade);
      gain.gain.setTargetAtTime(0, ac.currentTime, fade / 1000 / 4);
      setTimeout(() => {
        try {
          el.pause();
          el.removeAttribute('src');
          el.load();
          source?.disconnect();
          gain.disconnect();
        } catch {
          /* already gone */
        }
      }, fade + 50);
    },
  };
}

export function createSoundPlayer({ context = audioContext, output = masterOut, musicOut = musicOutput, load = loadBuffer, resolve = assetUrl, rows = ROWS, rng = Math.random } = {}) {
  const played = {};
  const history = new Map(); // name → the last takes played
  const buffers = new Map(); // url → AudioBuffer | null (loading)
  let late = 0;
  const lateNames = {};
  let failed = 0;
  let world = null; // the in-world sounds' gain, into the low-pass
  let lpf = null;
  let ux = null;
  let stem = null;
  let stemName = null;
  let duckKind = 'none';
  const live = new Set();

  const graph = () => {
    const ac = context();
    const master = output();
    if (!ac || !master) return null;
    if (!world) {
      lpf = ac.createBiquadFilter();
      lpf.type = 'lowpass';
      lpf.frequency.value = DUCKS.none.lpf;
      world = ac.createGain();
      world.connect(lpf).connect(master);
      ux = ac.createGain();
      ux.connect(master);
    }
    return ac;
  };

  const fetchBuffer = (url) => {
    if (buffers.has(url)) return Promise.resolve(buffers.get(url));
    buffers.set(url, null);
    return load(url)
      .then((b) => {
        buffers.set(url, b);
        return b;
      })
      .catch(() => {
        failed += 1;
        buffers.delete(url);
        return null;
      });
  };

  const preload = (names) => Promise.all(names.flatMap((n) => (rows[n]?.files ?? []).map((f) => fetchBuffer(resolve(urlOf(f))))));
  const ready = (name) => Boolean(rows[name]?.files?.every((f) => buffers.get(resolve(urlOf(f)))));

  function play(name, { gain = 1, pitch = 1, pan = 0, ux: onUx = false, loop = false } = {}) {
    const row = rows[name];
    if (!row || gain <= 0.005) return null;
    const ac = graph();
    if (!ac) return null;
    const hist = history.get(name) ?? [];
    const take = pickTake(row, hist, rng);
    hist.push(take);
    if (hist.length > 8) hist.shift();
    history.set(name, hist);
    const url = resolve(urlOf(row.files[take]));
    const buf = buffers.get(url);
    if (!buf) {
      // (not here yet: fetched for the next time, this one goes unheard)
      late += 1;
      lateNames[name] = (lateNames[name] ?? 0) + 1;
      fetchBuffer(url);
      return null;
    }
    const src = ac.createBufferSource();
    src.buffer = buf;
    src.loop = loop || Boolean(row.loop && loop);
    src.playbackRate.value = pitch;
    const g = ac.createGain();
    g.gain.value = gain * (row.gain ?? 1);
    let tail = g;
    if (!onUx && pan !== 0 && ac.createStereoPanner) {
      const p = ac.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, pan));
      g.connect(p);
      tail = p;
    }
    tail.connect(onUx ? ux : world);
    played[name] = (played[name] ?? 0) + 1;
    const handle = {
      stop(fade = 200) {
        g.gain.setTargetAtTime(0, ac.currentTime, fade / 1000 / 4);
        setTimeout(() => {
          try {
            src.stop();
          } catch {
            /* already ended */
          }
        }, fade + 50);
      },
    };
    live.add(handle);
    src.onended = () => {
      live.delete(handle);
      try {
        src.disconnect();
        g.disconnect();
        tail.disconnect();
      } catch {
        /* already gone */
      }
    };
    src.start();
    return handle;
  }

  function music(name, { then = null, loop = rows[name]?.loop ?? false, fade = 1000 } = {}) {
    if (name === stemName) return stem;
    stem?.stop(fade);
    stem = null;
    stemName = name;
    const row = rows[name];
    if (!row) return null;
    if (!graph()) return null;
    stem = playStem(row, { musicOut, resolve, loop, then, rows, file: Math.floor(rng() * row.files.length) });
    if (stem) played[name] = (played[name] ?? 0) + 1;
    return stem;
  }

  const stopMusic = (fade = 1000) => {
    stem?.stop(fade);
    stem = null;
    stemName = null;
  };

  // the mixers: the world bus to the kind's gain and low-pass, at its attack (release back to none)
  function duck(kind = 'none') {
    if (kind === duckKind) return;
    const d = DUCKS[kind] ?? DUCKS.none;
    const ac = graph();
    if (!ac) return;
    const t = kind === 'none' ? (DUCKS[duckKind]?.release ?? 1) : d.attack;
    duckKind = kind;
    world.gain.setTargetAtTime(dbToGain(d.db), ac.currentTime, t / 3);
    lpf.frequency.setTargetAtTime(d.lpf, ac.currentTime, t / 3);
  }

  return {
    preload,
    ready,
    play,
    music,
    stopMusic,
    duck,
    get duckKind() {
      return duckKind;
    },
    get musicName() {
      return stemName;
    },
    stats: () => ({ played: { ...played }, starts: Object.values(played).reduce((s, n) => s + n, 0), late, lateNames: { ...lateNames }, failed, buffers: [...buffers.values()].filter(Boolean).length, live: live.size }),
    dispose() {
      for (const h of [...live]) h.stop(100);
      stopMusic(300);
      setTimeout(() => {
        try {
          world?.disconnect();
          lpf?.disconnect();
          ux?.disconnect();
        } catch {
          /* already gone */
        }
        world = lpf = ux = null;
      }, 400);
      buffers.clear();
    },
  };
}
