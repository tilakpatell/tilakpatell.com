// One shared Web Audio context for every sound on the site, and the visitor's
// sound setting. Browsers only let audio start after a click or key press, so
// call `audioContext()` at the very start of an event handler, before any
// `await`: on iOS a context resumed later than that stays silent.

const KEY = 'tp-sound';
const VOLUME_KEY = 'tp-volume';
let ctx = null;
let master = null;
let music = null;
const listeners = new Set();

// The volumes, 0 to 1 (the settings panel's Sound): everything, the music
// room's instruments, and speech. Kept as 'tp-volume' { master, music, voices }.
const unit = (x) => (Number.isFinite(x) ? Math.min(1, Math.max(0, x)) : 1);
export function volumes() {
  try {
    const v = JSON.parse(window.localStorage.getItem(VOLUME_KEY) ?? 'null') ?? {};
    return { master: unit(v.master), music: unit(v.music), voices: unit(v.voices) };
  } catch {
    return { master: 1, music: 1, voices: 1 };
  }
}
const masterLevel = (on = soundOn()) => (on ? volumes().master : 0);

export function soundOn() {
  try {
    return window.localStorage.getItem(KEY) !== 'off';
  } catch {
    return true;
  }
}

export function setSound(on) {
  try {
    window.localStorage.setItem(KEY, on ? 'on' : 'off');
  } catch {
    /* storage unavailable */
  }
  if (master) master.gain.setTargetAtTime(masterLevel(on), ctx.currentTime, 0.05);
  listeners.forEach((fn) => fn(on));
}

// Set some of the volumes ({ master, music, voices }), kept and heard at once.
export function setVolumes(patch) {
  const next = { ...volumes(), ...patch };
  try {
    window.localStorage.setItem(VOLUME_KEY, JSON.stringify({ master: unit(next.master), music: unit(next.music), voices: unit(next.voices) }));
  } catch {
    /* storage unavailable */
  }
  if (!ctx) return;
  const v = volumes();
  master?.gain.setTargetAtTime(masterLevel(), ctx.currentTime, 0.05);
  music?.gain.setTargetAtTime(v.music, ctx.currentTime, 0.05);
  voiceBus?.gain.setTargetAtTime(voicesLevel(), ctx.currentTime, 0.05);
}

export function onSoundChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// The voices on their own (the worlds' Menu, the settings panel, ⌘K): off,
// nobody speaks (lib/speech.js says no line, the blips stay quiet) and the
// subtitles carry on. Kept as 'tp-voices' 'off'; the Voices volume is left
// as it was, for when they're back on.
const VOICES_KEY = 'tp-voices';
const voiceListeners = new Set();
export function voicesOn() {
  try {
    return window.localStorage.getItem(VOICES_KEY) !== 'off';
  } catch {
    return true;
  }
}
const voicesLevel = () => (voicesOn() ? volumes().voices : 0);

export function setVoicesOn(on) {
  try {
    if (on) window.localStorage.removeItem(VOICES_KEY);
    else window.localStorage.setItem(VOICES_KEY, 'off');
  } catch {
    /* storage unavailable */
  }
  if (voiceBus) voiceBus.gain.setTargetAtTime(voicesLevel(), ctx.currentTime, 0.05);
  voiceListeners.forEach((fn) => fn(!!on));
}

export function onVoicesChange(fn) {
  voiceListeners.add(fn);
  return () => voiceListeners.delete(fn);
}

// On an iPhone, Web Audio follows the ring/silent switch, so with the switch on
// silent (as most phones are) every sound here would be mute. Asking for the
// playback session (Safari 16.4+), or on older iOS playing a silent <audio>
// element, makes the site as audible as a video. Done once, in a gesture, and
// only after the visitor has used something with sound.
const IOS =
  typeof navigator !== 'undefined' && (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
let unmuted = false;
function silence() {
  // a tenth of a second of 8-bit silence, as a WAV
  const n = 800;
  const buf = new ArrayBuffer(44 + n);
  const v = new DataView(buf);
  const str = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF');
  v.setUint32(4, 36 + n, true);
  str(8, 'WAVEfmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, 8000, true);
  v.setUint32(28, 8000, true);
  v.setUint16(32, 1, true);
  v.setUint16(34, 8, true);
  str(36, 'data');
  v.setUint32(40, n, true);
  for (let i = 0; i < n; i++) v.setUint8(44 + i, 128);
  return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
}
function unmuteIOS() {
  if (unmuted) return;
  unmuted = true;
  try {
    if (navigator.audioSession) {
      navigator.audioSession.type = 'playback';
      return;
    }
  } catch {
    /* no audio session API */
  }
  if (!IOS) return;
  const el = document.createElement('audio');
  el.setAttribute('x-webkit-airplay', 'deny');
  el.preload = 'auto';
  el.loop = true;
  const url = silence();
  el.src = url;
  el.addEventListener('loadeddata', () => URL.revokeObjectURL(url), { once: true });
  el.play().catch(() => {
    unmuted = false;
  });
}

// The context, created and resumed on demand. Returns null where Web Audio is
// missing (very old browsers) so callers can quietly skip the sound.
export function audioContext() {
  if (!ctx) {
    const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
    if (!AC) return null;
    ctx = new AC({ latencyHint: 'interactive' });
    master = ctx.createGain();
    master.gain.value = masterLevel();
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -6;
    limiter.knee.value = 6;
    limiter.ratio.value = 12;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.2;
    master.connect(limiter).connect(ctx.destination);
  }
  // suspended until a gesture; 'interrupted' on iOS after a call or a trip to the background
  if (ctx.state !== 'running') ctx.resume().catch(() => {});
  unmuteIOS();
  return ctx;
}

// Resolves true once a context is running (at once if it is), or false if it
// isn't within `ms`: a line played into a context still asleep would wait
// there, and come out on top of everything else the moment it wakes.
export function whenRunning(ac, ms) {
  if (!ac) return Promise.resolve(false);
  if (ac.state === 'running') return Promise.resolve(true);
  return new Promise((resolve) => {
    const done = (ok) => {
      clearTimeout(timer);
      ac.removeEventListener('statechange', change);
      resolve(ok);
    };
    const change = () => ac.state === 'running' && done(true);
    const timer = setTimeout(() => done(false), ms);
    ac.addEventListener('statechange', change);
  });
}

// A press that starts a hold (pointerdown) isn't a gesture iOS will start audio
// in, so any later tap, click or key wakes a context that is still asleep.
if (typeof window !== 'undefined') {
  const wake = () => {
    if (!ctx) return;
    if (ctx.state !== 'running') ctx.resume().catch(() => {});
    unmuteIOS();
  };
  ['touchend', 'click', 'keydown'].forEach((type) => window.addEventListener(type, wake, { capture: true, passive: true }));
}

// Where every sound should connect: the master volume, which mutes with the setting.
export const output = () => (audioContext() ? master : null);

// Where the music room's instruments connect: the master volume, by way of
// the music volume.
export function musicOutput() {
  const ac = audioContext();
  if (!ac) return null;
  if (!music) {
    music = ac.createGain();
    music.gain.value = volumes().music;
    music.connect(master);
  }
  return music;
}

// Where speech should connect instead: the master volume by way of a tap that
// measures how loud the voice is, so a face on screen can move its mouth with
// it. The tap sits before the master volume, so mouths still move with the
// sound turned off (the subtitles are still there to read).
let voiceBus = null;
let voiceTap = null;
let levelBuf = null;
export function voiceOutput() {
  const ac = audioContext();
  if (!ac) return null;
  if (!voiceBus) {
    voiceBus = ac.createGain();
    voiceBus.gain.value = voicesLevel();
    voiceTap = ac.createAnalyser();
    voiceTap.fftSize = 512;
    voiceTap.smoothingTimeConstant = 0;
    levelBuf = new Float32Array(voiceTap.fftSize);
    voiceBus.connect(master);
    voiceBus.connect(voiceTap);
  }
  return voiceBus;
}

// How loud the voice is right now: the RMS of the last few milliseconds, 0
// for silence (and before anything has spoken).
export function voiceLevel() {
  if (!voiceTap) return 0;
  voiceTap.getFloatTimeDomainData(levelBuf);
  let sum = 0;
  for (let i = 0; i < levelBuf.length; i++) sum += levelBuf[i] * levelBuf[i];
  return Math.sqrt(sum / levelBuf.length);
}

// A tap on everything the site plays, for drawing it (Soundwave's visor).
// Created on demand, after the context exists; returns null before that.
let tap = null;
export function analyser() {
  if (!ctx) return null;
  if (!tap) {
    tap = ctx.createAnalyser();
    tap.fftSize = 1024;
    master.connect(tap);
  }
  return tap;
}

// Download a file's bytes ahead of time (on hover, say). This creates no audio
// context, so it is safe before the visitor has clicked anything.
const bytes = new Map();
export function prefetch(url) {
  if (!bytes.has(url)) {
    bytes.set(
      url,
      fetch(url).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(`${r.status} ${url}`)))),
    );
    bytes.get(url).catch(() => bytes.delete(url));
  }
  return bytes.get(url);
}

// Fetch and decode an audio file once.
const decoded = new Map();
export function loadBuffer(url) {
  const ac = audioContext();
  if (!ac) return Promise.resolve(null);
  if (!decoded.has(url)) {
    decoded.set(
      url,
      prefetch(url)
        // decoding detaches the buffer it is given, so decode a copy
        .then((data) => new Promise((resolve, reject) => ac.decodeAudioData(data.slice(0), resolve, reject)))
        // the decoded buffer is the cache now; the raw bytes would only double the memory
        .then((buf) => (bytes.delete(url), buf))
        .catch((e) => {
          decoded.delete(url);
          throw e;
        }),
    );
  }
  return decoded.get(url);
}
