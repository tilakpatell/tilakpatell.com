// The stream spike’s wire: what the sender (the owner’s desktop) and the
// receiver (`#/stream`) say to each other, and the lines the numbers are
// judged against. Signalling goes as broadcast messages on one Supabase
// Realtime channel a stream; the input and the pings go on the WebRTC data
// channel as JSON text. Everything read off the wire is checked here, since
// a public channel is anyone’s to post on.
// Design: docs/superpowers/specs/2026-10-11-bf2017-picture-everywhere-design.md §7;
// decision: docs/decisions/2026-10-11-the-stream-from-the-desktop.md.
//
// channelName(id) → 'stream:<id>' (throws on an id a channel can’t carry)
// streamId(random?) → a fresh id, 16 characters of [a-z0-9]
// signal(kind, from, body) → { v, kind, from, ...body }; isSignal(m) → bool
// encodeInput(e) → text; decodeInput(text) → e | null (clamped, checked)
// preferCodecs(codecs) → the same codecs, the ones CODECS names first

export const PROTOCOL = 1;

export const THRESHOLDS = {
  lanP95Ms: 80,
  internetP95Ms: 150,
  minMbps: 15,
  maxMbps: 25,
  frameP95Ms: 16.7,
  width: 1920,
  height: 1080,
  fps: 60,
  _source: {
    lanP95Ms: 'plan R2 task 1; Nvidia GeForce Now system requirements (round trip under 80 ms)',
    internetP95Ms: 'plan R2 task 1',
    minMbps: 'plan R2 task 1; Nvidia GeForce Now system requirements (15 Mbit/s, 720p60)',
    maxMbps: 'plan R2 task 1; Nvidia GeForce Now system requirements (25 Mbit/s, 1080p60)',
    frameP95Ms: 'design §4 lane U2 gate; scripts/galaxy-budget.mjs (60 frames a second)',
    width: 'plan R2 task 1 (1080p)',
    height: 'plan R2 task 1 (1080p)',
    fps: 'plan R2 task 1 (60 frames)',
  },
};

// H.264 first: the encoder NVENC and every phone’s decoder speak it; AV1
// next where both ends have it; the rest as the browser offers them
export const CODECS = ['video/H264', 'video/AV1', 'video/VP9', 'video/VP8'];

// public STUN only; a TURN relay is a listed cost, not built (the plan)
export const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];

const ROLES = ['sender', 'receiver'];
const KINDS = ['hello', 'offer', 'answer', 'ice', 'bye'];
const ID = /^[a-z0-9-]{4,64}$/;

export function channelName(id) {
  if (typeof id !== 'string' || !ID.test(id)) throw new Error('a stream id is 4 to 64 of a-z, 0-9 and -');
  return `stream:${id}`;
}

// a crypto draw where there is one: the id is all that keeps a public
// channel to its two ends
const draw = () => (globalThis.crypto?.getRandomValues ? globalThis.crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32 : Math.random());

export function streamId(random = draw) {
  let s = '';
  for (let i = 0; i < 16; i++) s += '0123456789abcdefghijklmnopqrstuvwxyz'[Math.floor(random() * 36 + i * 7) % 36];
  return s;
}

export function signal(kind, from, body = {}) {
  if (!KINDS.includes(kind) || !ROLES.includes(from)) throw new Error(`no signal ${kind} from ${from}`);
  return { v: PROTOCOL, kind, from, ...body };
}

export function isSignal(m) {
  return Boolean(m) && typeof m === 'object' && m.v === PROTOCOL && KINDS.includes(m.kind) && ROLES.includes(m.from);
}

export function encodeInput(e) {
  return JSON.stringify(e);
}

const POINTER_KINDS = ['down', 'up', 'move', 'wheel'];
const clamp01 = (n) => Math.min(1, Math.max(0, Number(n) || 0));
const short = (s) => typeof s === 'string' && s.length <= 32;

export function decodeInput(text) {
  let e;
  try {
    e = JSON.parse(text);
  } catch {
    return null;
  }
  if (!e || typeof e !== 'object') return null;
  if (e.t === 'key') {
    if (!short(e.code) || (e.key != null && !short(e.key))) return null;
    return { t: 'key', down: Boolean(e.down), code: e.code, ...(e.key != null ? { key: e.key } : {}) };
  }
  if (e.t === 'pointer') {
    if (!POINTER_KINDS.includes(e.kind)) return null;
    const out = { t: 'pointer', kind: e.kind, x: clamp01(e.x), y: clamp01(e.y) };
    if (e.button != null) out.button = Math.trunc(Number(e.button) || 0);
    if (e.buttons != null) out.buttons = Math.trunc(Number(e.buttons) || 0);
    if (e.kind === 'wheel') out.dy = Math.max(-2000, Math.min(2000, Number(e.dy) || 0));
    return out;
  }
  if (e.t === 'report') return report(e);
  if (e.t === 'ping') {
    const n = Math.trunc(Number(e.n));
    if (!Number.isFinite(n) || n < 0) return null;
    return { t: 'ping', n, at: Number(e.at) || 0 };
  }
  return null;
}

// the receiver’s numbers, sent back every few seconds so the desktop script
// writes the phone’s side of the run too: numbers kept, text cut short
const num = (v) => (Number.isFinite(Number(v)) && v !== null ? Math.round(Number(v) * 100) / 100 : null);
const text = (v, n) => (typeof v === 'string' ? v.slice(0, n) : null);
function report(e) {
  const l = e.latency ?? {};
  return {
    t: 'report',
    where: e.where === 'internet' ? 'internet' : 'lan',
    latency: { n: num(l.n), p50: num(l.p50), p95: num(l.p95), max: num(l.max), lost: num(l.lost) },
    mbps: { mean: num(e.mbps?.mean), p95: num(e.mbps?.p95) },
    fps: { mean: num(e.fps?.mean), min: num(e.fps?.min) },
    rttMs: num(e.rttMs),
    size: text(e.size, 16),
    codec: text(e.codec, 32),
    verdict: { latency: Boolean(e.verdict?.latency), bitrate: Boolean(e.verdict?.bitrate), size: Boolean(e.verdict?.size), ok: Boolean(e.verdict?.ok) },
    ua: text(e.ua, 200),
  };
}

export function preferCodecs(codecs) {
  const rank = (c) => {
    const i = CODECS.indexOf(c.mimeType);
    return i < 0 ? CODECS.length : i;
  };
  return [...codecs].sort((a, b) => rank(a) - rank(b));
}
