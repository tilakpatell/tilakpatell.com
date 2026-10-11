import { describe, expect, it } from 'vitest';
import { inboundVideo, percentile, rates, summarise, verdict } from './stats';

describe('the stream’s numbers', () => {
  it('takes percentiles by the nearest rank', () => {
    expect(percentile([], 0.5)).toBeNull();
    expect(percentile([3, 1, 2], 0.5)).toBe(2);
    expect(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 0.95)).toBe(10);
    expect(percentile([10, 20], 0)).toBe(10);
  });

  it('finds the inbound video and its codec in a stats report', () => {
    const report = new Map([
      ['a', { type: 'inbound-rtp', kind: 'audio', bytesReceived: 9 }],
      ['b', { type: 'inbound-rtp', kind: 'video', bytesReceived: 100, codecId: 'c' }],
      ['c', { type: 'codec', mimeType: 'video/H264' }],
      ['d', { type: 'candidate-pair', state: 'succeeded', nominated: true, currentRoundTripTime: 0.012 }],
    ]);
    expect(inboundVideo(report)).toMatchObject({ bytesReceived: 100, codec: 'video/H264', rttMs: 12 });
    expect(inboundVideo(new Map())).toBeNull();
  });

  it('turns two snapshots into rates', () => {
    const a = { timestamp: 1000, bytesReceived: 0, framesDecoded: 0, totalDecodeTime: 0, jitterBufferDelay: 0, jitterBufferEmittedCount: 0 };
    const b = { timestamp: 2000, bytesReceived: 2_500_000, framesDecoded: 60, totalDecodeTime: 0.12, jitterBufferDelay: 1.2, jitterBufferEmittedCount: 60, frameWidth: 1920, frameHeight: 1080, codec: 'video/VP8' };
    expect(rates(a, b)).toEqual({ mbps: 20, fps: 60, decodeMs: 2, jitterMs: 20, width: 1920, height: 1080, codec: 'video/VP8' });
    expect(rates(b, b)).toBeNull();
    expect(rates(null, b)).toBeNull();
  });

  it('sums a run and judges it against the lines', () => {
    const s = summarise({ latencies: [40, 50, 60, 70], samples: [{ mbps: 18, fps: 60, width: 1920, height: 1080, codec: 'video/H264' }, { mbps: 22, fps: 58, width: 1920, height: 1080, codec: 'video/H264' }], lost: 1 });
    expect(s.latency).toEqual({ n: 4, p50: 50, p95: 70, max: 70, lost: 1 });
    expect(s.mbps.mean).toBe(20);
    expect(s.fps.mean).toBe(59);
    expect(s.size).toBe('1920×1080');
    expect(s.codec).toBe('video/H264');
    const v = verdict(s, 'lan');
    expect(v).toMatchObject({ latency: true, bitrate: true, size: true, ok: true });
    expect(verdict({ ...s, latency: { ...s.latency, p95: 90 } }, 'lan').ok).toBe(false);
    expect(verdict({ ...s, latency: { ...s.latency, p95: 90 } }, 'internet').latency).toBe(true);
    expect(verdict({ ...s, mbps: { mean: 40 } }, 'lan').bitrate).toBe(false);
    expect(verdict(summarise({ latencies: [], samples: [] }), 'lan').ok).toBe(false);
  });
});
