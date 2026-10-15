// lib/level/png16's decode in a module worker (png16Off.js): a level's
// 16-bit heightmaps, unfiltered here so the page's main thread is not.
import { decodePng16 } from './png16.js';

self.onmessage = async ({ data: { id, bytes } }) => {
  try {
    const { data, w, h } = await decodePng16(bytes);
    self.postMessage({ id, data, w, h }, [data.buffer]);
  } catch (err) {
    self.postMessage({ id, error: String(err?.message ?? err) });
  }
};
