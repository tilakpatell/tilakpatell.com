import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { checkWasm } from './wasm-check.mjs';

const EMPTY = new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0]); // the smallest valid module
let dir = null;
afterEach(() => dir && rmSync(dir, { recursive: true, force: true }));

function build(files) {
  dir = mkdtempSync(join(tmpdir(), 'wasm-check-'));
  mkdirSync(join(dir, 'assets'));
  for (const [name, body] of Object.entries(files)) writeFileSync(join(dir, 'assets', name), body);
  return dir;
}

describe('checkWasm', () => {
  it('passes a build whose binaries validate and are all there', () => {
    const r = checkWasm(build({ 'a-Cze3tPQg.wasm': EMPTY, 'a-1.js': 'new URL("a-Cze3tPQg.wasm", import.meta.url); setPath("basis_transcoder.wasm")' }));
    expect(r.problems).toEqual([]);
    expect(r.binaries).toHaveLength(1);
  });

  it('names a binary that does not validate', () => {
    expect(checkWasm(build({ 'b.wasm': new Uint8Array([0, 97, 115, 109, 9]) })).problems[0]).toMatch(/not a valid/);
  });

  it('names a chunk asking for a binary the build lacks', () => {
    expect(checkWasm(build({ 'c.js': 'fetch("/assets/gone-Ab3_x-9z.wasm")' })).problems[0]).toMatch(/gone-Ab3_x-9z\.wasm/);
  });
});
