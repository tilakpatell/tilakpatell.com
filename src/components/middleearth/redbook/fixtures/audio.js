// A Web Audio context that makes no sound, for the music’s tests in Node:
// just enough nodes to build the score’s graph, a clock the test moves by
// hand, and a record of every source started and stopped and every node
// made, so a test can see that nothing was made before the visitor woke the
// sound and nothing is left running after it goes.

function param(value = 0) {
  const p = { value, events: 0 };
  for (const k of ['setValueAtTime', 'linearRampToValueAtTime', 'exponentialRampToValueAtTime', 'setTargetAtTime', 'cancelScheduledValues'])
    p[k] = (v) => {
      p.events += 1;
      if (k !== 'cancelScheduledValues' && Number.isFinite(v)) p.value = v;
      return p;
    };
  return p;
}

export function fakeAudio({ rate = 8000 } = {}) {
  const made = [];
  const sources = [];
  const ctx = { currentTime: 0, sampleRate: rate, state: 'running', made, sources };
  const node = (extra = {}) => {
    const n = {
      context: ctx,
      outs: new Set(),
      connect(to) {
        n.outs.add(to);
        return to;
      },
      disconnect() {
        n.outs.clear();
        n.gone = true;
      },
      ...extra,
    };
    made.push(n);
    return n;
  };
  const source = (extra) => {
    const s = node({
      started: false,
      stopped: false,
      start() {
        if (s.started) throw new Error('started twice');
        s.started = true;
      },
      stop() {
        if (!s.started) throw new Error('stopped before it started');
        s.stopped = true;
      },
      ...extra,
    });
    sources.push(s);
    return s;
  };
  Object.assign(ctx, {
    createGain: () => node({ gain: param(1) }),
    createBiquadFilter: () => node({ type: 'lowpass', frequency: param(350), Q: param(1), gain: param(0) }),
    createConvolver: () => node({ buffer: null, normalize: true }),
    createStereoPanner: () => node({ pan: param(0) }),
    // (as a browser does: 'custom' comes only from a periodic wave, never set by hand)
    createOscillator: () => {
      const o = source({ frequency: param(440), detune: param(0) });
      let type = 'sine';
      Object.defineProperty(o, 'type', {
        enumerable: true,
        get: () => type,
        set(v) {
          if (v === 'custom') throw new Error("InvalidStateError: 'type' cannot be set directly to 'custom'");
          type = v;
        },
      });
      o.setPeriodicWave = () => {
        type = 'custom';
      };
      return o;
    },
    createBufferSource: () => source({ buffer: null, loop: false, playbackRate: param(1) }),
    createPeriodicWave: () => ({}),
    createBuffer(channels, length, sampleRate) {
      const data = Array.from({ length: channels }, () => new Float32Array(length));
      return { numberOfChannels: channels, length, sampleRate, getChannelData: (i) => data[i], copyToChannel: (d, i) => data[i].set(d) };
    },
  });
  const bus = ctx.createGain();
  const rt = { audio: { bus: () => bus } };
  return { ctx, bus, rt };
}
