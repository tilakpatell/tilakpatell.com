// The sector worker: generated space made off the main thread (gen/job.js's
// jobs), a sector whole or the sectors beyond as specks, every buffer handed
// back without a copy. One job at a time (runtime/workers.js gives a worker
// one), so a cancel comes after the job it was for, whose answer the pool
// then ignores. The beyond jobs' pool is one worker wide, so the sectors
// beyond this one keeps serve every beyond job.

import { runJob } from '../gen/job.js';

const cache = new Map(); // (the sectors beyond, kept: gen/job.js's beyondJob's)

self.onmessage = (e) => {
  const out = runJob(e.data, cache);
  if (out) self.postMessage(out.answer, out.transfer);
};
