// The music room's shared mix: every instrument goes through here, with a
// little air around it (a short, dark room, as much as the player sets), to
// the site's master volume; and the room's recorder.

import { musicOutput } from '../../lib/audio';

let bus = null;
let wet = null;
let sum = null;
let roomLevel = 0.35; // how much room: 0 (dry) to 1 (a hall)
const wetFor = (v) => 0.46 * Math.max(0, Math.min(1, v)) ** 1.2;

export function mix(ac) {
  if (bus) return bus;
  const dry = ac.createGain();
  dry.gain.value = 0.9;
  const room = ac.createConvolver();
  room.buffer = roomImpulse(ac, 1.5);
  wet = ac.createGain();
  wet.gain.value = wetFor(roomLevel);
  sum = ac.createGain();
  sum.gain.value = 0.85;
  dry.connect(sum);
  dry.connect(room).connect(wet).connect(sum);
  sum.connect(musicOutput());
  bus = dry;
  return bus;
}

// How much of the room is heard, 0 to 1. Kept until the mix exists.
export function setRoom(v) {
  roomLevel = Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : roomLevel;
  if (wet) wet.gain.setTargetAtTime(wetFor(roomLevel), wet.context.currentTime, 0.08);
}

// ── Recording ──────────────────────────────────────────────────────────────
// Everything the room plays, as it's heard (room and all), recorded in the
// browser and handed back as a file. Returns null where the browser can't.
const canRecord = () => typeof window !== 'undefined' && typeof window.MediaRecorder === 'function';

export function recordRoom(ac) {
  if (!canRecord() || !ac?.createMediaStreamDestination) return null;
  mix(ac);
  const dest = ac.createMediaStreamDestination();
  sum.connect(dest);
  const type = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm', 'audio/ogg;codecs=opus'].find((t) => window.MediaRecorder.isTypeSupported?.(t));
  let rec;
  try {
    rec = new window.MediaRecorder(dest.stream, type ? { mimeType: type } : undefined);
  } catch {
    sum.disconnect(dest);
    return null;
  }
  const chunks = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  rec.start(500);
  let done = null;
  return {
    stop() {
      if (!done)
        done = new Promise((resolve) => {
          rec.onstop = () => {
            try {
              sum.disconnect(dest);
            } catch {
              /* already gone */
            }
            const mime = rec.mimeType || type || 'audio/webm';
            resolve({ blob: new Blob(chunks, { type: mime }), ext: mime.includes('mp4') ? 'm4a' : mime.includes('ogg') ? 'ogg' : 'webm' });
          };
          if (rec.state === 'inactive') rec.onstop();
          else rec.stop();
        });
      return done;
    },
  };
}

function roomImpulse(ac, seconds) {
  const n = Math.floor(ac.sampleRate * seconds);
  const ir = ac.createBuffer(2, n, ac.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = ir.getChannelData(c);
    let lp = 0;
    for (let i = 0; i < n; i++) {
      lp = lp * 0.6 + (Math.random() * 2 - 1) * 0.4;
      d[i] = lp * Math.pow(1 - i / n, 2.6);
    }
  }
  return ir;
}

// Decode an audio file's bytes. Works before the visitor has clicked anything
// (an offline context decodes without a gesture), so a sample set can be ready
// before its first note; falls back to the live context where offline
// decoding isn't there. AudioBuffers play in any context.
export function decode(bytes, ac = null) {
  const copy = bytes.slice(0); // decoding detaches the buffer it is given
  const OAC = typeof window !== 'undefined' && (window.OfflineAudioContext || window.webkitOfflineAudioContext);
  const ctx = ac || (OAC ? new OAC(1, 1, 44100) : null);
  if (!ctx) return Promise.reject(new Error('no audio'));
  return new Promise((resolve, reject) => {
    const p = ctx.decodeAudioData(copy, resolve, reject);
    if (p && typeof p.then === 'function') p.then(resolve, reject);
  });
}
