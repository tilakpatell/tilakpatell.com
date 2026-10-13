// lib/level/png16's decode off the main thread: Hoth's terrain decode was
// 394 to 843 ms of the main thread for near.png and 405 for far.png in the
// container (the every-chip-plays addendum), a world's frames and its page
// held for each. One module worker (png16.worker.js) decodes; the bytes go
// as a copy (a caller's cache stays whole) and the heights come back
// transferred. Where no worker can be made, or the one made fails, the main
// thread decodes, from then on.
//
//   createPng16Off({ make, onMain }) → { decode(bytes) → Promise<{ data, w, h }> }
//   decodePng16Off(bytes): the page's own

import { decodePng16 } from './png16.js';

const makeWorker = () => (typeof Worker === 'undefined' ? null : new Worker(new URL('./png16.worker.js', import.meta.url), { type: 'module' }));

export function createPng16Off({ make = makeWorker, onMain = decodePng16 } = {}) {
  let worker; // undefined: not made yet; null: none to be had
  let next = 0;
  const waiting = new Map(); // id → { bytes, resolve, reject }
  const fallBack = () => {
    worker?.terminate?.();
    worker = null;
    for (const [id, w] of waiting) {
      waiting.delete(id);
      onMain(w.bytes).then(w.resolve, w.reject);
    }
  };
  const up = () => {
    if (worker !== undefined) return worker;
    try {
      worker = make() ?? null;
    } catch {
      worker = null;
    }
    if (!worker) return null;
    worker.onmessage = ({ data: m }) => {
      const w = waiting.get(m?.id);
      if (!w) return;
      waiting.delete(m.id);
      if ('error' in m) w.reject(new Error(m.error || 'the PNG could not be decoded'));
      else w.resolve({ data: m.data, w: m.w, h: m.h });
    };
    worker.onerror = fallBack;
    worker.onmessageerror = fallBack;
    return worker;
  };
  return {
    decode(bytes) {
      const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
      const w = up();
      if (!w) return onMain(b);
      return new Promise((resolve, reject) => {
        const id = next++;
        const copy = b.slice();
        waiting.set(id, { bytes: b, resolve, reject });
        try {
          w.postMessage({ id, bytes: copy }, [copy.buffer]);
        } catch {
          fallBack();
        }
      });
    },
  };
}

let page = null;
export const decodePng16Off = (bytes) => (page ??= createPng16Off()).decode(bytes);
