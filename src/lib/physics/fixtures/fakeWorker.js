// A module Worker for the tests, in-process: worker.js's `serve` on one
// side, the page's Worker face on the other, every message structured-
// cloned with its transfer list (so a message that couldn't cross a real
// thread, a function in it or a buffer used after it was sent, fails here
// too), and delivered on a later turn, as a real worker's are.
//
//   fakeWorker({ fail, silent }) → { postMessage, onmessage, onerror, terminate, crash(err), terminated }
//   fail: the worker's engine fails to come up with this message (a blocked wasm)
//   silent: the worker never answers

import { serve } from '../worker.js';

const later = (fn) => setTimeout(fn, 0);

export function fakeWorker({ fail = null, silent = false } = {}) {
  let alive = true;
  const scope = {
    onmessage: null,
    postMessage(msg, transfer = []) {
      if (!alive) return;
      const copy = structuredClone(msg, { transfer });
      later(() => alive && page.onmessage?.({ data: copy }));
    },
  };
  const page = {
    onmessage: null,
    onerror: null,
    terminated: false,
    postMessage(msg, transfer = []) {
      if (!alive) return;
      const copy = structuredClone(msg, { transfer });
      if (silent) return;
      later(() => alive && scope.onmessage?.({ data: copy }));
    },
    terminate() {
      alive = false;
      page.terminated = true;
    },
    crash(err) {
      alive = false;
      page.onerror?.({ message: err.message, error: err });
    },
  };
  serve(scope, fail ? { create: () => Promise.reject(new Error(fail)) } : {});
  return page;
}
