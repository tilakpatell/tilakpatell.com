import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { connect } from './signal';
import { signal } from './protocol';

// two ends of one broadcast channel; a message never comes back to its sender
function bus() {
  const ends = [];
  const make = () => {
    const end = { fns: [], sent: [] };
    end.send = (m) => {
      end.sent.push(m);
      for (const other of ends) if (other !== end) for (const f of other.fns) f(structuredClone(m));
    };
    end.onMessage = (f) => {
      end.fns.push(f);
      return () => (end.fns = end.fns.filter((g) => g !== f));
    };
    ends.push(end);
    return end;
  };
  return make;
}

function fakePc(name) {
  const pc = { name, connectionState: 'new', added: [], local: null, remote: null };
  pc.createOffer = async () => ({ type: 'offer', sdp: `offer-${name}` });
  pc.createAnswer = async () => ({ type: 'answer', sdp: `answer-${name}` });
  pc.setLocalDescription = async (d) => {
    pc.local = d;
    pc.localDescription = d;
  };
  pc.setRemoteDescription = async (d) => {
    pc.remote = d;
  };
  pc.addIceCandidate = async (c) => {
    pc.added.push(c);
  };
  return pc;
}

const settle = () => new Promise((r) => setTimeout(r, 0));

describe('the stream’s handshake', () => {
  beforeEach(() => vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] }));
  afterEach(() => vi.useRealTimers());

  it('meets a receiver that came first, and trades ICE once described', async () => {
    const make = bus();
    const [rx, tx] = [make(), make()];
    const rpc = fakePc('r');
    const spc = fakePc('s');
    const r = connect({ role: 'receiver', channel: rx, pc: rpc, session: 'sess-one' });
    // a candidate the receiver gathers before anything: held by the far side
    const s = connect({ role: 'sender', channel: tx, pc: spc });
    vi.advanceTimersByTime(1000);
    await settle();
    await settle();
    await settle();
    expect(spc.local.sdp).toBe('offer-s');
    expect(rpc.remote).toEqual({ type: 'offer', sdp: 'offer-s' });
    expect(spc.remote).toEqual({ type: 'answer', sdp: 'answer-r' });
    expect(s.session).toBe('sess-one');
    spc.onicecandidate({ candidate: { candidate: 'c1' } });
    rpc.onicecandidate({ candidate: { candidate: 'c2' } });
    await settle();
    expect(rpc.added).toEqual([{ candidate: 'c1' }]);
    expect(spc.added).toEqual([{ candidate: 'c2' }]);
    // the hellos stop once the offer came
    const hellos = rx.sent.filter((m) => m.kind === 'hello').length;
    vi.advanceTimersByTime(5000);
    expect(rx.sent.filter((m) => m.kind === 'hello').length).toBe(hellos);
    r.close();
    s.close();
  });

  it('holds candidates that arrive before the offer', async () => {
    const make = bus();
    const [rx, tx] = [make(), make()];
    const rpc = fakePc('r');
    connect({ role: 'receiver', channel: rx, pc: rpc, session: 'sess-two' });
    tx.send(signal('ice', 'sender', { session: 'sess-two', candidate: { candidate: 'early' } }));
    await settle();
    expect(rpc.added).toEqual([]);
    tx.send(signal('offer', 'sender', { session: 'sess-two', sdp: 'o' }));
    await settle();
    await settle();
    expect(rpc.added).toEqual([{ candidate: 'early' }]);
  });

  it('ignores a second receiver while the first holds the stream, and junk', async () => {
    const make = bus();
    const [tx, a, b] = [make(), make(), make()];
    const spc = fakePc('s');
    const states = [];
    connect({ role: 'sender', channel: tx, pc: spc, onState: (s) => states.push(s) });
    a.send(signal('hello', 'receiver', { session: 'first' }));
    await settle();
    b.send(signal('hello', 'receiver', { session: 'second' }));
    b.send({ kind: 'offer', from: 'receiver', sdp: 'x' });
    await settle();
    expect(tx.sent.filter((m) => m.kind === 'offer').map((m) => m.session)).toEqual(['first']);
    expect(states).toContain('busy');
    // the first gone, the second gets its turn
    spc.connectionState = 'closed';
    b.send(signal('hello', 'receiver', { session: 'second' }));
    await settle();
    expect(tx.sent.filter((m) => m.kind === 'offer').map((m) => m.session)).toEqual(['first', 'second']);
  });

  it('offers once to a receiver’s repeated hellos, and again only if no answer comes', async () => {
    const make = bus();
    const [tx, rx] = [make(), make()];
    const spc = fakePc('s');
    const states = [];
    connect({ role: 'sender', channel: tx, pc: spc, onState: (s) => states.push(s) });
    const hello = signal('hello', 'receiver', { session: 'again' });
    rx.send(hello);
    rx.send(hello);
    await settle();
    rx.send(hello);
    await settle();
    expect(tx.sent.filter((m) => m.kind === 'offer')).toHaveLength(1);
    const real = performance.now;
    performance.now = () => real.call(performance) + 6000;
    rx.send(hello);
    await settle();
    performance.now = real;
    expect(tx.sent.filter((m) => m.kind === 'offer')).toHaveLength(2);
    // a description the peer refuses is a state, not an unhandled rejection
    spc.setRemoteDescription = async () => {
      throw new Error('wrong state');
    };
    rx.send(signal('answer', 'receiver', { session: 'again', sdp: 'a' }));
    await settle();
    await settle();
    expect(states).toContain('error: wrong state');
  });

  it('says bye on close and stops listening', async () => {
    const make = bus();
    const [rx, tx] = [make(), make()];
    const r = connect({ role: 'receiver', channel: rx, pc: fakePc('r'), session: 'sess-three' });
    r.close();
    expect(rx.sent.at(-1)).toMatchObject({ kind: 'bye', session: 'sess-three' });
    expect(rx.fns).toHaveLength(0);
    tx.send(signal('offer', 'sender', { session: 'sess-three', sdp: 'o' }));
  });
});
