// The site's settings, in one place: what the settings panel (Settings.jsx)
// shows and changes. Kept as localStorage 'tp-settings' ({ v: 1, … }), and
// the keys the site already reads are written too, so nothing that reads
// them changes; those keys win when read back, so a setting changed
// somewhere else (the sound from ⌘K, 3D from a world's own switch) is what
// the panel shows.
//
//   quality        'auto' or a level (lib/device: 'tp-quality')
//   three          'auto' | 'on' | 'off', whether to draw in 3D (lib/gpu: 'tp-3d')
//   sharpness      0.5 – 2, the pixel ratio against the level's own (lib/device: 'tp-sharpness')
//   motion         'auto' (the system's) | 'full' | 'reduced' ('tp-motion', html[data-motion])
//   sound          on or off (lib/audio: 'tp-sound')
//   volume, music, voices   0 – 1 (lib/audio: 'tp-volume' { master, music, voices })
//   voicesOn       whether anyone speaks (lib/audio: 'tp-voices' 'off'; a world's Menu and ⌘K switch it too)
//   askBigDownload whether a big world asks first (lib/device's worldCheck: 'tp-ask-download')
//   capped         read only: the level this chip was held at after it struggled ('tp-detail-cap')
//
// read(store?) → settings; write(patch, store?) → settings; subscribe(fn) → stop.
// Pure but for the storage it's handed (the page's localStorage by default).

export const KEY = 'tp-settings';
const LEVELS = ['low', 'mid', 'high', 'ultra'];
const MODES = ['auto', ...LEVELS];

export const DEFAULTS = Object.freeze({ v: 1, quality: 'auto', three: 'auto', sharpness: 1, motion: 'auto', sound: true, volume: 1, music: 1, voices: 1, voicesOn: true, askBigDownload: true, capped: null });

const pageStore = () => {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
};

const get = (store, k) => {
  try {
    return store?.getItem(k) ?? null;
  } catch {
    return null;
  }
};
const set = (store, k, v) => {
  try {
    if (v == null) store?.removeItem(k);
    else store?.setItem(k, v);
  } catch {
    /* storage unavailable: it lasts for this page */
  }
};
const json = (s) => {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
};

const unit = (x, fallback) => (Number.isFinite(x) ? Math.min(1, Math.max(0, x)) : fallback);

// Every value held to what it may be; anything else is its default.
function clean(s) {
  const sharp = typeof s.sharpness === 'number' ? s.sharpness : Number.parseFloat(s.sharpness);
  return {
    v: 1,
    quality: MODES.includes(s.quality) ? s.quality : DEFAULTS.quality,
    three: ['auto', 'on', 'off'].includes(s.three) ? s.three : DEFAULTS.three,
    sharpness: Number.isFinite(sharp) ? Math.min(2, Math.max(0.5, sharp)) : DEFAULTS.sharpness,
    motion: ['auto', 'full', 'reduced'].includes(s.motion) ? s.motion : DEFAULTS.motion,
    sound: typeof s.sound === 'boolean' ? s.sound : DEFAULTS.sound,
    volume: unit(s.volume, DEFAULTS.volume),
    music: unit(s.music, DEFAULTS.music),
    voices: unit(s.voices, DEFAULTS.voices),
    voicesOn: typeof s.voicesOn === 'boolean' ? s.voicesOn : DEFAULTS.voicesOn,
    askBigDownload: typeof s.askBigDownload === 'boolean' ? s.askBigDownload : DEFAULTS.askBigDownload,
    capped: LEVELS.includes(s.capped) ? s.capped : null,
  };
}

// What the older keys say, for the fields they hold.
function legacy(store) {
  const out = {};
  const q = get(store, 'tp-quality');
  out.quality = LEVELS.includes(q) ? q : 'auto';
  const three = get(store, 'tp-3d');
  out.three = three === 'on' || three === 'off' ? three : 'auto';
  const sound = get(store, 'tp-sound');
  if (sound != null) out.sound = sound !== 'off';
  out.voicesOn = get(store, 'tp-voices') !== 'off';
  const sharp = get(store, 'tp-sharpness');
  if (sharp != null) out.sharpness = sharp;
  const motion = get(store, 'tp-motion');
  out.motion = motion === 'full' || motion === 'reduced' ? motion : 'auto';
  out.askBigDownload = get(store, 'tp-ask-download') !== 'off';
  const vol = json(get(store, 'tp-volume'));
  if (vol && typeof vol === 'object') {
    if (vol.master != null) out.volume = vol.master;
    if (vol.music != null) out.music = vol.music;
    if (vol.voices != null) out.voices = vol.voices;
  }
  const cap = json(get(store, 'tp-detail-cap'));
  out.capped = cap?.level ?? null;
  return out;
}

export function read(store = pageStore()) {
  const kept = json(get(store, KEY));
  const own = kept && kept.v === 1 ? kept : {};
  return clean({ ...DEFAULTS, ...own, ...legacy(store) });
}

const listeners = new Set();
export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function write(patch, store = pageStore()) {
  const next = clean({ ...read(store), ...patch });
  set(store, KEY, JSON.stringify({ ...next, capped: undefined })); // (the cap is lib/device's to keep)
  set(store, 'tp-quality', next.quality === 'auto' ? null : next.quality);
  set(store, 'tp-3d', next.three === 'auto' ? null : next.three);
  set(store, 'tp-sound', next.sound ? 'on' : 'off');
  set(store, 'tp-sharpness', String(next.sharpness));
  set(store, 'tp-motion', next.motion === 'auto' ? null : next.motion);
  set(store, 'tp-ask-download', next.askBigDownload ? null : 'off');
  set(store, 'tp-voices', next.voicesOn ? null : 'off');
  set(store, 'tp-volume', JSON.stringify({ master: next.volume, music: next.music, voices: next.voices }));
  for (const fn of listeners) fn(next, patch);
  return next;
}

// The motion setting on the page: html[data-motion='reduced'] calms the
// site's CSS animations (index.css); Auto leaves the system's own setting.
export function applyMotion(motion, doc = typeof document !== 'undefined' ? document : null) {
  if (!doc) return;
  if (motion === 'reduced') doc.documentElement.dataset.motion = 'reduced';
  else delete doc.documentElement.dataset.motion;
}
