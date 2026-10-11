import { describe, expect, it } from 'vitest';
import { THRESHOLDS, CODECS, channelName, decodeInput, encodeInput, isSignal, preferCodecs, signal, streamId } from './protocol';

describe('the stream protocol', () => {
  it('holds a source for every threshold', () => {
    for (const [k, v] of Object.entries(THRESHOLDS)) {
      if (k === '_source') continue;
      expect(typeof v).toBe('number');
      expect(THRESHOLDS._source[k], k).toBeTruthy();
    }
  });

  it('names a channel by its stream id and refuses a bad id', () => {
    expect(channelName('abc-123')).toBe('stream:abc-123');
    expect(() => channelName('a b')).toThrow();
    expect(() => channelName('')).toThrow();
  });

  it('makes ids that a channel accepts and that differ', () => {
    const a = streamId(() => 0.1);
    const b = streamId(() => 0.9);
    expect(() => channelName(a)).not.toThrow();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(10);
  });

  it('builds and checks the signalling messages', () => {
    const m = signal('offer', 'sender', { sdp: 'v=0' });
    expect(isSignal(m)).toBe(true);
    expect(isSignal({ ...m, kind: 'nope' })).toBe(false);
    expect(isSignal({ ...m, from: 'someone' })).toBe(false);
    expect(isSignal(null)).toBe(false);
    expect(() => signal('offer', 'nobody', {})).toThrow();
  });

  it('round-trips input through the data channel’s text', () => {
    const keys = { t: 'key', down: true, code: 'KeyW', key: 'w' };
    expect(decodeInput(encodeInput(keys))).toEqual(keys);
    const ptr = { t: 'pointer', kind: 'move', x: 0.25, y: 0.75, button: 0, buttons: 1 };
    expect(decodeInput(encodeInput(ptr))).toEqual(ptr);
    const ping = { t: 'ping', n: 7, at: 12.5 };
    expect(decodeInput(encodeInput(ping))).toEqual(ping);
  });

  it('carries a locked pointer’s motion, clamped', () => {
    expect(decodeInput(JSON.stringify({ t: 'pointer', kind: 'move', x: 0.5, y: 0.5, dx: 12.7, dy: -99999 }))).toMatchObject({ dx: 12, dy: -4000 });
    expect(decodeInput(JSON.stringify({ t: 'pointer', kind: 'move', x: 0.5, y: 0.5 })).dx).toBeUndefined();
  });

  it('clamps a pointer into the frame and drops what it cannot read', () => {
    expect(decodeInput(JSON.stringify({ t: 'pointer', kind: 'move', x: -2, y: 9 }))).toMatchObject({ x: 0, y: 1 });
    expect(decodeInput('not json')).toBeNull();
    expect(decodeInput(JSON.stringify({ t: 'key', down: true, code: 'x'.repeat(80) }))).toBeNull();
    expect(decodeInput(JSON.stringify({ t: 'pointer', kind: 'eat', x: 0, y: 0 }))).toBeNull();
    expect(decodeInput(JSON.stringify({ t: 'shell', cmd: 'rm' }))).toBeNull();
  });

  it('keeps a receiver’s report to numbers and short text', () => {
    const r = decodeInput(JSON.stringify({ t: 'report', where: 'internet', latency: { n: 40, p50: 61.234, p95: 'x', max: 90, lost: 1 }, mbps: { mean: 18 }, fps: { mean: 59.5 }, size: '1920×1080', codec: 'video/H264', verdict: { ok: 1 }, ua: 'u'.repeat(500), evil: true }));
    expect(r).toMatchObject({ t: 'report', where: 'internet', latency: { n: 40, p50: 61.23, p95: null, max: 90, lost: 1 }, mbps: { mean: 18, p95: null }, size: '1920×1080', verdict: { ok: true, latency: false } });
    expect(r.ua).toHaveLength(200);
    expect(r.evil).toBeUndefined();
  });

  it('puts the preferred codecs first and keeps the rest', () => {
    const offered = [{ mimeType: 'video/VP8' }, { mimeType: 'video/H264' }, { mimeType: 'video/rtx' }, { mimeType: 'video/AV1' }];
    expect(preferCodecs(offered).map((c) => c.mimeType)).toEqual(['video/H264', 'video/AV1', 'video/VP8', 'video/rtx']);
    expect(CODECS[0]).toBe('video/H264');
  });
});
