// The endless space's sector worker: a sector made whole, or the sectors past
// the 3 × 3 × 3 as specks (gen/job.js, pure and tested there), answered with
// every buffer handed back without a copy. One job at a time (runtime/
// workers.js gives a worker one), so a cancel for a queued sector never
// reaches here; one for the sector being made comes after its answer, which
// the pool then ignores. The beyond's pool has one worker, so its cache of
// made sectors is one cache.

import { beyondJob, sectorJob } from '../gen/job.js';

const cache = new Map();

self.onmessage = (e) => {
  const msg = e.data;
  if (!msg || msg.type === 'cancel') return;
  const { answer, transfer } = msg.type === 'beyond' ? beyondJob(msg, cache) : sectorJob(msg);
  self.postMessage(answer, transfer);
};
