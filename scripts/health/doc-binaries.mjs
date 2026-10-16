// Evidence is pictures on the bucket (docs/health/RULES.md): a binary over a
// megabyte under docs/ goes to the bucket by hash through
// scripts/assets-publish.mjs and is linked from the lane’s README, since every
// clone carries a committed one forever. The count may only fall. It reads
// what is committed, not the working tree: the paths and their sizes come
// from git’s tree at HEAD, so a screenshot left untracked or a file edited in
// a checkout never moves the count.
// Design: docs/superpowers/specs/2026-10-15-engine-floor-design.md, §4.6.
import { execFileSync } from 'node:child_process';
import { metric } from './context.mjs';

export const LIMIT = 1_048_576;

// pure, so the test hands it [{ file, size }]; n is the file’s kB
export function countBinaries(files) {
  const detail = files.filter(({ size }) => size > LIMIT).map(({ file, size }) => ({ file, n: Math.ceil(size / 1024) }));
  return metric({ id: 'doc-binaries', label: 'files over 1 MB committed under docs/', unit: 'files', detail });
}

export default async function docBinaries(ctx) {
  // `<mode> blob <hash> <size>\t<path>`, a NUL after each
  const tree = execFileSync('git', ['ls-tree', '-r', '-l', '-z', 'HEAD', '--', 'docs'], { cwd: ctx.root, maxBuffer: 64 * 1024 * 1024 }).toString();
  const files = tree.split('\0').filter(Boolean).map((row) => {
    const [head, file] = row.split('\t');
    return { file, size: Number(head.trim().split(/\s+/)[3]) || 0 };
  });
  return countBinaries(files);
}
