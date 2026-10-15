// Evidence is pictures on the bucket (docs/health/RULES.md): a binary over a
// megabyte under docs/ goes to the bucket by hash through
// scripts/assets-publish.mjs and is linked from the lane’s README, since every
// clone carries a committed one forever. The count may only fall. It reads
// the files git tracks, not the working tree, so a screenshot left untracked
// in a checkout never fails CI.
// Design: docs/superpowers/specs/2026-10-15-engine-floor-design.md, §4.6.
import { execFileSync } from 'node:child_process';
import { stat as fsStat } from 'node:fs/promises';
import { join } from 'node:path';
import { metric } from './context.mjs';

export const LIMIT = 1_048_576;

// pure, so the test hands it paths and a fake stat; n is the file’s kB
export async function countBinaries(files, { stat = fsStat } = {}) {
  const detail = [];
  for (const file of files) {
    const size = await stat(file).then((s) => s.size, () => 0);
    if (size > LIMIT) detail.push({ file, n: Math.ceil(size / 1024) });
  }
  return metric({ id: 'doc-binaries', label: 'files over 1 MB committed under docs/', unit: 'files', detail });
}

export default async function docBinaries(ctx) {
  const listed = execFileSync('git', ['ls-files', '-z', 'docs'], { cwd: ctx.root, maxBuffer: 64 * 1024 * 1024 }).toString().split('\0').filter(Boolean);
  return countBinaries(listed, { stat: (f) => fsStat(join(ctx.root, f)) });
}
