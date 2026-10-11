// The sender’s half, run inside the world page on the owner’s desktop. The
// desktop script (scripts/desktop/bf2017-stream.mjs) opens a world through
// the dev server and imports this file into it, so no world page carries a
// line of the stream. It copies the world’s canvas each frame into a 2D
// canvas at the stream’s size with the frame stamp in the corner (stamp.js),
// captures that as video, and offers it to the receiver over WebRTC; the
// data channel’s input goes back to the script to replay as real keys and
// pointer moves (window.__streamInput, the script’s binding), or is
// dispatched here when there is no script.
//
// startSender({ url, key, id, width, height, fps, maxMbps }) → Promise<window.__stream>
import { createClient } from '@supabase/supabase-js';
import { ICE_SERVERS, THRESHOLDS, decodeInput, preferCodecs } from '../../lib/stream/protocol';
import { cellSize, stampCells } from '../../lib/stream/stamp';
import { connect } from '../../lib/stream/signal';
import { realtimeChannel } from '../../lib/stream/realtime';
import { percentile } from '../../lib/stream/stats';

// the world’s canvas: the biggest on the page
function worldCanvas() {
  let best = null;
  for (const c of document.querySelectorAll('canvas')) if (!best || c.width * c.height > best.width * best.height) best = c;
  return best;
}

export async function startSender({ url, key, id, width = THRESHOLDS.width, height = THRESHOLDS.height, fps = THRESHOLDS.fps, maxMbps = THRESHOLDS.maxMbps }) {
  const state = { status: 'starting', stamp: 0, frames: [], encoder: null, codec: null, connection: 'new', log: [] };
  const log = (s) => state.log.push(`${Math.round(performance.now())} ${s}`);

  const comp = document.createElement('canvas');
  comp.width = width;
  comp.height = height;
  const g = comp.getContext('2d', { alpha: false, desynchronized: true });
  const cell = cellSize(width);
  let last = performance.now();
  let running = true;
  const paint = (now) => {
    if (!running) return;
    // the frame’s interval on the desktop, kept for the evidence: a rough
    // stand-in for lane W’s frame gate, which measures it properly
    state.frames.push(now - last);
    if (state.frames.length > 600) state.frames.shift();
    last = now;
    const src = worldCanvas();
    if (src && src.width) g.drawImage(src, 0, 0, width, height);
    else {
      g.fillStyle = '#202830';
      g.fillRect(0, 0, width, height);
    }
    stampCells(state.stamp).forEach((on, i) => {
      g.fillStyle = on ? '#ffffff' : '#000000';
      g.fillRect(i * cell, 0, cell, cell);
    });
    requestAnimationFrame(paint);
  };
  requestAnimationFrame(paint);

  const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
  const track = comp.captureStream(fps).getVideoTracks()[0];
  track.contentHint = 'motion';
  const tx = pc.addTransceiver(track, { direction: 'sendonly' });
  const caps = globalThis.RTCRtpSender?.getCapabilities?.('video');
  if (caps && tx.setCodecPreferences) tx.setCodecPreferences(preferCodecs(caps.codecs));
  const params = tx.sender.getParameters();
  params.encodings = [{ ...(params.encodings?.[0] ?? {}), maxBitrate: maxMbps * 1e6, maxFramerate: fps }];
  params.degradationPreference = 'maintain-framerate';
  await tx.sender.setParameters(params).catch((e) => log(`parameters refused: ${e.message}`));
  pc.onconnectionstatechange = () => {
    state.connection = pc.connectionState;
    log(`connection ${pc.connectionState}`);
  };

  const dc = pc.createDataChannel('input', { ordered: true });
  dc.onmessage = (ev) => {
    const e = decodeInput(ev.data);
    if (!e) return;
    // through the script when it is there, so a ping takes the same road as a key
    if (typeof window.__streamInput === 'function') return window.__streamInput(e);
    if (e.t === 'ping') state.stamp = e.n;
    else if (e.t === 'key') window.dispatchEvent(new KeyboardEvent(e.down ? 'keydown' : 'keyup', { code: e.code, key: e.key, bubbles: true }));
  };

  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const channel = await realtimeChannel(client, id, { onStatus: (s) => log(`realtime ${s}`) });
  const link = connect({ role: 'sender', channel, pc, onState: (s) => log(s) });
  state.status = 'waiting';

  const api = {
    state,
    stamp(n) {
      state.stamp = n;
    },
    async stats() {
      const report = await pc.getStats(tx.sender);
      let out = null;
      report.forEach((s) => {
        if (s.type === 'outbound-rtp' && s.kind === 'video') out = s;
      });
      const codec = out?.codecId ? report.get(out.codecId)?.mimeType : null;
      return {
        connection: pc.connectionState,
        encoder: out?.encoderImplementation ?? null,
        powerEfficient: out?.powerEfficientEncoder ?? null,
        codec,
        size: out?.frameWidth ? `${out.frameWidth}×${out.frameHeight}` : null,
        framesEncoded: out?.framesEncoded ?? 0,
        encodeMs: out?.framesEncoded ? Math.round((out.totalEncodeTime / out.framesEncoded) * 10000) / 10 : null,
        limitedBy: out?.qualityLimitationReason ?? null,
        frameMs: { p50: percentile(state.frames, 0.5), p95: percentile(state.frames, 0.95) },
      };
    },
    stop() {
      running = false;
      link.close();
      channel.close();
      pc.close();
    },
  };
  window.__stream = api;
  return api;
}
