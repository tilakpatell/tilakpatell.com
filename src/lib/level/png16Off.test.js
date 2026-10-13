import { describe, expect, it, vi } from 'vitest';
import { createPng16Off } from './png16Off';

// A worker stand-in that answers as png16.worker.js does, or fails
function fakeWorker({ fail = false, answer = null } = {}) {
  const w = {
    posted: [],
    onmessage: null,
    onerror: null,
    postMessage(msg, transfer) {
      w.posted.push({ msg, transfer });
      setTimeout(() => {
        if (fail) return w.onerror?.({ message: 'no module workers' });
        const data = new Uint16Array([1, 2, 3, 4]);
        w.onmessage?.({ data: answer ?? { id: msg.id, data, w: 2, h: 2 } });
      }, 0);
    },
    terminate: vi.fn(),
  };
  return w;
}

// Hoth's terrain decode was 394 to 843 ms of the main thread (near.png) and
// 405 (far.png) in the container: off it, the main thread decoding only
// where no worker can be made
describe('the 16-bit PNG decode off the main thread', () => {
  it('posts a copy of the bytes (the caller’s stay whole) and answers with the worker’s heights', async () => {
    const w = fakeWorker();
    const off = createPng16Off({ make: () => w, onMain: vi.fn() });
    const bytes = new Uint8Array([9, 9, 9]);
    const got = await off.decode(bytes);
    expect(got).toEqual({ data: new Uint16Array([1, 2, 3, 4]), w: 2, h: 2 });
    expect(bytes.byteLength).toBe(3);
    expect(w.posted[0].transfer[0]).not.toBe(bytes.buffer);
  });

  it('decodes on the main thread where no worker can be made, or the worker fails, and keeps to it after', async () => {
    const onMain = vi.fn(async () => ({ data: new Uint16Array(1), w: 1, h: 1 }));
    const none = createPng16Off({ make: () => null, onMain });
    expect(await none.decode(new Uint8Array(1))).toEqual({ data: new Uint16Array(1), w: 1, h: 1 });
    const failing = fakeWorker({ fail: true });
    const broken = createPng16Off({ make: () => failing, onMain });
    expect((await broken.decode(new Uint8Array(1))).w).toBe(1);
    await broken.decode(new Uint8Array(1));
    expect(failing.posted.length).toBe(1);
    expect(onMain).toHaveBeenCalledTimes(3);
  });

  it('passes a decode error on, as the main thread would', async () => {
    const w = fakeWorker({ answer: { id: 0, error: 'not a PNG' } });
    const off = createPng16Off({ make: () => w, onMain: vi.fn() });
    await expect(off.decode(new Uint8Array(1))).rejects.toThrow('not a PNG');
  });

  it('rejects an error with no message too, never answering with no heights', async () => {
    const w = fakeWorker({ answer: { id: 0, error: '' } });
    const off = createPng16Off({ make: () => w, onMain: vi.fn() });
    await expect(off.decode(new Uint8Array(1))).rejects.toThrow(/could not be decoded/);
  });

  it('falls back to the main thread when a message cannot be read', async () => {
    const onMain = vi.fn(async () => ({ data: new Uint16Array(1), w: 1, h: 1 }));
    const w = fakeWorker();
    w.postMessage = (msg, transfer) => {
      w.posted.push({ msg, transfer });
      setTimeout(() => w.onmessageerror?.({}), 0);
    };
    const off = createPng16Off({ make: () => w, onMain });
    expect((await off.decode(new Uint8Array(1))).w).toBe(1);
    expect(onMain).toHaveBeenCalledTimes(1);
  });
});
