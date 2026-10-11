// The stream spike’s measures, from the receiver’s side: the WebRTC stats
// report read into rates, the pings’ input-to-picture times summed, and the
// run judged against the decision’s lines (protocol.js’s THRESHOLDS).
//
// percentile(values, p) → nearest-rank value | null
// inboundVideo(report) → the inbound video’s counters, its codec and the
//   nominated pair’s round trip in ms | null
// rates(prev, next) → { mbps, fps, decodeMs, jitterMs, width, height, codec } | null
// summarise({ latencies, samples, lost }) → { latency, mbps, fps, size, codec }
// verdict(summary, 'lan' | 'internet') → { latency, bitrate, size, ok }
import { THRESHOLDS } from './protocol';

export function percentile(values, p) {
  if (!values?.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1))];
}

const each = (report, fn) => (typeof report?.forEach === 'function' ? report.forEach(fn) : Object.values(report ?? {}).forEach(fn));

export function inboundVideo(report) {
  let video = null;
  let rttMs = null;
  const byId = new Map();
  each(report, (s) => {
    if (s.id) byId.set(s.id, s);
  });
  each(report, (s, key) => {
    if (key && !s.id) byId.set(key, s);
    if (s.type === 'inbound-rtp' && s.kind === 'video') video = s;
    if (s.type === 'candidate-pair' && s.nominated && s.state === 'succeeded' && s.currentRoundTripTime != null) rttMs = s.currentRoundTripTime * 1000;
  });
  if (!video) return null;
  const codec = video.codecId ? (byId.get(video.codecId)?.mimeType ?? null) : null;
  return { ...video, codec, rttMs };
}

const round = (n, d = 1) => Math.round(n * 10 ** d) / 10 ** d;

export function rates(prev, next) {
  if (!prev || !next) return null;
  const dt = (next.timestamp - prev.timestamp) / 1000;
  if (!(dt > 0)) return null;
  const frames = (next.framesDecoded ?? 0) - (prev.framesDecoded ?? 0);
  const emitted = (next.jitterBufferEmittedCount ?? 0) - (prev.jitterBufferEmittedCount ?? 0);
  return {
    mbps: round(((next.bytesReceived - prev.bytesReceived) * 8) / dt / 1e6, 2),
    fps: round(frames / dt),
    decodeMs: frames > 0 ? round((((next.totalDecodeTime ?? 0) - (prev.totalDecodeTime ?? 0)) * 1000) / frames) : null,
    jitterMs: emitted > 0 ? round((((next.jitterBufferDelay ?? 0) - (prev.jitterBufferDelay ?? 0)) * 1000) / emitted) : null,
    width: next.frameWidth ?? null,
    height: next.frameHeight ?? null,
    codec: next.codec ?? null,
  };
}

const mean = (xs) => (xs.length ? round(xs.reduce((a, b) => a + b, 0) / xs.length, 2) : null);

export function summarise({ latencies = [], samples = [], lost = 0 } = {}) {
  const mbps = samples.map((s) => s.mbps).filter(Number.isFinite);
  const fps = samples.map((s) => s.fps).filter(Number.isFinite);
  const last = samples.at(-1) ?? {};
  return {
    latency: { n: latencies.length, p50: percentile(latencies, 0.5), p95: percentile(latencies, 0.95), max: latencies.length ? Math.max(...latencies) : null, lost },
    mbps: { mean: mean(mbps), p95: percentile(mbps, 0.95) },
    fps: { mean: mean(fps), min: fps.length ? Math.min(...fps) : null },
    size: last.width ? `${last.width}×${last.height}` : null,
    codec: last.codec ?? null,
  };
}

export function verdict(summary, where = 'lan') {
  const line = where === 'internet' ? THRESHOLDS.internetP95Ms : THRESHOLDS.lanP95Ms;
  const latency = summary.latency.p95 != null && summary.latency.p95 < line;
  const bitrate = summary.mbps.mean != null && summary.mbps.mean <= THRESHOLDS.maxMbps;
  const size = summary.size === `${THRESHOLDS.width}×${THRESHOLDS.height}`;
  return { latency, bitrate, size, ok: latency && bitrate && size };
}
