// The receiver’s half: the peer connection that answers the desktop’s offer,
// the video it plays, the input it sends back, and the numbers. Input to
// picture is timed by the frame stamp: a numbered ping goes out on the data
// channel, and each decoded frame’s corner is read (requestVideoFrameCallback)
// until the number shows; the time from sending to that frame’s expected
// display is one sample. No clock has to agree with the desktop’s.
//
// startReceiver({ client, id, video, where, onState, pingMs }) → Promise<{ stop, sendInput, numbers }>
import { ICE_SERVERS, encodeInput } from '../../lib/stream/protocol';
import { CELLS, cellMeans, cellSize, readStamp } from '../../lib/stream/stamp';
import { connect } from '../../lib/stream/signal';
import { realtimeChannel } from '../../lib/stream/realtime';
import { inboundVideo, rates, summarise, verdict } from '../../lib/stream/stats';

const KEEP = 600; // samples kept (ten minutes of one a second; pings: two and a half at four a second)

export async function startReceiver({ client, id, video, where = 'lan', onState = () => {}, pingMs = 250 }) {
  const latencies = [];
  const samples = [];
  const sent = new Map();
  let lost = 0;
  let n = 0;
  let dc = null;
  let alive = true;

  const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
  pc.ontrack = (e) => {
    video.srcObject = e.streams[0] ?? new MediaStream([e.track]);
    video.play().catch(() => onState('tap to play'));
  };
  pc.ondatachannel = (e) => {
    dc = e.channel;
  };
  pc.onconnectionstatechange = () => onState(pc.connectionState);

  const channel = await realtimeChannel(client, id, { onStatus: (s) => onState(`signalling ${s.toLowerCase()}`) });
  const link = connect({ role: 'receiver', channel, pc, onState });

  const sendInput = (e) => {
    if (dc?.readyState === 'open') dc.send(encodeInput(e));
  };

  const ping = setInterval(() => {
    if (dc?.readyState !== 'open') return;
    const now = performance.now();
    // a ping not seen in five seconds counts as lost
    for (const [k, at] of sent) if (now - at > 5000) sent.delete(k) && lost++;
    n = (n + 1) % 65536;
    sent.set(n, now);
    sendInput({ t: 'ping', n, at: now });
  }, pingMs);

  const strip = document.createElement('canvas');
  const sg = strip.getContext('2d', { willReadFrequently: true });
  const onFrame = (now, meta) => {
    if (!alive) return;
    const w = meta?.width ?? video.videoWidth;
    if (w) {
      const cell = cellSize(w);
      strip.width = cell * CELLS;
      strip.height = cell;
      sg.drawImage(video, 0, 0, strip.width, cell, 0, 0, strip.width, cell);
      const seen = readStamp(cellMeans(sg.getImageData(0, 0, strip.width, cell).data, strip.width, cell));
      if (seen != null && sent.has(seen)) {
        latencies.push((meta?.expectedDisplayTime ?? now) - sent.get(seen));
        if (latencies.length > KEEP) latencies.shift();
        // the older pings this frame overtook will never show
        for (const k of [...sent.keys()]) if (sent.get(k) <= sent.get(seen)) sent.delete(k);
      }
    }
    video.requestVideoFrameCallback(onFrame);
  };
  if (video.requestVideoFrameCallback) video.requestVideoFrameCallback(onFrame);

  let prev = null;
  const poll = setInterval(async () => {
    const s = inboundVideo(await pc.getStats());
    if (!s) return;
    const r = rates(prev, s);
    prev = s;
    if (r) {
      samples.push({ ...r, rttMs: s.rttMs });
      if (samples.length > KEEP) samples.shift();
    }
  }, 1000);

  const numbers = () => ({ ...summarise({ latencies, samples, lost }), last: samples.at(-1) ?? null, connection: pc.connectionState });

  // the numbers back to the desktop every five seconds, for its evidence
  const tell = setInterval(() => {
    const s = numbers();
    sendInput({ t: 'report', where, ...s, rttMs: s.last?.rttMs ?? null, verdict: verdict(s, where), ua: navigator.userAgent });
  }, 5000);

  return {
    sendInput,
    numbers,
    raw: () => ({ latencies: [...latencies], samples: [...samples] }),
    stop() {
      alive = false;
      clearInterval(ping);
      clearInterval(poll);
      clearInterval(tell);
      link.close();
      channel.close();
      pc.close();
    },
  };
}
