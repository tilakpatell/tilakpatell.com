// One shared Web Audio context for every sound on the site, and the visitor's
// sound setting. Browsers only let audio start after a click or key press, so
// call `audioContext()` at the very start of an event handler, before any
// `await`: on iOS a context resumed later than that stays silent.

const KEY = 'tp-sound';
let ctx = null;
let master = null;
const listeners = new Set();

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
  if (master) master.gain.setTargetAtTime(on ? 1 : 0, ctx.currentTime, 0.05);
  listeners.forEach((fn) => fn(on));
}

export function onSoundChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
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
    master.gain.value = soundOn() ? 1 : 0;
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
