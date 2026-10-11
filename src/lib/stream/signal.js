// The handshake between the sender and one receiver, over any broadcast
// channel ({ send(msg), onMessage(fn) → off, close() }: realtime.js makes one
// on Supabase Realtime). The receiver says hello until an offer comes; the
// sender answers a hello with an offer from its peer connection; the
// receiver answers; ICE candidates go both ways, held until the far side’s
// description is set. Each receiver’s hello carries a session id and every
// later message names it, so a second receiver, or a stale one, is ignored:
// one stream at a time (the decision: one encoder, one desktop).
//
// connect({ role, channel, pc, session?, helloMs?, onState? }) → { close(), session }
//   role 'receiver' | 'sender'; pc an RTCPeerConnection (or its shape)
import { isSignal, signal, streamId } from './protocol';

export function connect({ role, channel, pc, session = role === 'receiver' ? streamId() : null, helloMs = 1000, onState = () => {} }) {
  let current = session;
  let described = false;
  let held = [];
  let hello = null;
  let closed = false;
  const send = (kind, body) => channel.send(signal(kind, role, { session: current, ...body }));

  const addIce = async (c) => {
    if (!described) return held.push(c);
    await pc.addIceCandidate(c).catch(() => onState('ice-refused'));
  };
  const flush = async () => {
    described = true;
    const queued = held;
    held = [];
    for (const c of queued) await addIce(c);
  };

  pc.onicecandidate = (e) => {
    if (e.candidate && current) send('ice', { candidate: e.candidate.toJSON ? e.candidate.toJSON() : e.candidate });
  };

  const off = channel.onMessage(async (m) => {
    if (closed || !isSignal(m) || m.from === role) return;
    if (role === 'sender' && m.kind === 'hello') {
      // a new receiver only when there is none, or the last one is gone
      const gone = ['failed', 'closed', 'disconnected'].includes(pc.connectionState);
      if (current && current !== m.session && !gone) return onState('busy');
      if (current === m.session && described) return;
      current = m.session;
      onState('offering');
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      return send('offer', { sdp: pc.localDescription?.sdp ?? offer.sdp });
    }
    if (m.session !== current) return;
    if (role === 'receiver' && m.kind === 'offer') {
      clearInterval(hello);
      onState('answering');
      await pc.setRemoteDescription({ type: 'offer', sdp: m.sdp });
      await flush();
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      return send('answer', { sdp: pc.localDescription?.sdp ?? answer.sdp });
    }
    if (role === 'sender' && m.kind === 'answer') {
      await pc.setRemoteDescription({ type: 'answer', sdp: m.sdp });
      onState('answered');
      return flush();
    }
    if (m.kind === 'ice' && m.candidate) return addIce(m.candidate);
    if (m.kind === 'bye') {
      onState('bye');
      if (role === 'sender') {
        current = null;
        described = false;
      }
    }
  });

  if (role === 'receiver') {
    send('hello', {});
    hello = setInterval(() => send('hello', {}), helloMs);
  }

  return {
    get session() {
      return current;
    },
    close() {
      if (closed) return;
      if (current) send('bye', {});
      closed = true;
      clearInterval(hello);
      off();
    },
  };
}
