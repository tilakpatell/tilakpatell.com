import { existsSync, readFileSync, statSync } from 'node:fs';
import { afterAll, describe, expect, it, vi } from 'vitest';

// the sector worker as the page sees it: a message in, at most one answer out
const { runJob } = vi.hoisted(() => ({ runJob: vi.fn() }));
vi.mock('../gen/job.js', () => ({ runJob }));

const posted = [];
globalThis.self = { postMessage: (data, transfer) => posted.push({ data, transfer }) };
await import('./sector.worker.js');
afterAll(() => delete globalThis.self);
const ask = (msg) => {
  posted.length = 0;
  globalThis.self.onmessage({ data: msg });
  return [...posted];
};

// every package a file imports, or any file it imports does, followed through its relative imports
const SPECS = /^\s*(?:import|export)\b[^;]*?\bfrom\s*['"]([^'"]+)['"]|^\s*import\s*['"]([^'"]+)['"]|\bimport\(\s*['"]([^'"]+)['"]\s*\)/gm;
function packagesUnder(url, seen = new Set(), out = new Set()) {
  const path = url.pathname;
  if (seen.has(path)) return out;
  seen.add(path);
  const src = readFileSync(url, 'utf8');
  for (const m of src.matchAll(SPECS)) {
    const spec = m[1] ?? m[2] ?? m[3];
    if (!spec.startsWith('.')) {
      out.add(spec);
      continue;
    }
    const next = [spec, `${spec}.js`, `${spec}.jsx`, `${spec}/index.js`].map((s) => new URL(s.replace(/\?.*$/, ''), url)).find((u) => existsSync(u) && statSync(u).isFile());
    if (!next) throw new Error(`can't find ${spec} from ${path}`);
    if (/\.(m?js|jsx)$/.test(next.pathname)) packagesUnder(next, seen, out);
  }
  return out;
}

describe('the sector worker', () => {
  it('posts a job’s answer with its buffers handed over', () => {
    const at = new Float32Array(3);
    runJob.mockReturnValueOnce({ answer: { key: 'k', at }, transfer: [at.buffer] });
    expect(ask({ type: 'sector', key: 'k' })).toEqual([{ data: { key: 'k', at }, transfer: [at.buffer] }]);
    expect(runJob.mock.lastCall[0]).toEqual({ type: 'sector', key: 'k' });
  });

  it('keeps one cache for every job it’s given', () => {
    runJob.mockReturnValue(null);
    ask({ type: 'beyond', key: 'a' });
    ask({ type: 'beyond', key: 'b' });
    const [one, two] = runJob.mock.calls.slice(-2).map((c) => c[1]);
    expect(one).toBeInstanceOf(Map);
    expect(two).toBe(one);
  });

  it('says nothing when the job has nothing to say (a cancel)', () => {
    runJob.mockReturnValueOnce(null);
    expect(ask({ type: 'cancel', key: 'k' })).toEqual([]);
  });

  it('lets a job’s failure through, so the pool gives the job up', () => {
    runJob.mockImplementationOnce(() => {
      throw new Error('no such job');
    });
    expect(() => ask({ type: 'x', key: 'k' })).toThrow('no such job');
  });

  it('takes no package anywhere it reaches, so it never carries three.js', () => {
    const files = new Set();
    expect([...packagesUnder(new URL('./sector.worker.js', import.meta.url), files)]).toEqual([]);
    expect([...files].some((f) => f.endsWith('/gen/space.js'))).toBe(true);
    expect(packagesUnder(new URL('./sectors.js', import.meta.url)).has('three')).toBe(true); // (it would see it)
  });
});
