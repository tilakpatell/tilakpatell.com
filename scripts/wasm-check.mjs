#!/usr/bin/env node
// Every WebAssembly binary a build publishes, checked before it goes out
// (lane X2: docs/stack/webassembly.md; deploy.yml runs it after the build):
// each .wasm under the folder validates, and every .wasm a chunk names by
// the build's own hashed name (Vite's `<name>-<8 characters>.wasm`) is
// there. (A bare name in a chunk is a library's default it never fetches
// here: three's KTX2 loader's transcoder path, Rapier's, whose wasm is inlined.) GitHub Pages serves .wasm as application/wasm (what
// WebAssembly.instantiateStreaming asks for); the bucket's publish types it
// so too (assets-publish.mjs).
//
//   node scripts/wasm-check.mjs [dist]   → exit 1 with a line a problem
//   checkWasm(dir) → { binaries: [{ file, bytes }], problems: [string] }

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

export function checkWasm(dir) {
  const files = walk(dir);
  const problems = [];
  const binaries = files.filter((f) => f.endsWith('.wasm')).map((file) => ({ file, bytes: statSync(file).size }));
  for (const b of binaries) if (!WebAssembly.validate(readFileSync(b.file))) problems.push(`${b.file}: not a valid WebAssembly module`);
  const have = new Set(binaries.map((b) => basename(b.file)));
  for (const f of files.filter((x) => x.endsWith('.js'))) {
    for (const m of readFileSync(f, 'utf8').matchAll(/["'`/]([\w.]+-[\w-]{8}\.wasm)["'`]/g)) if (!have.has(m[1])) problems.push(`${f}: names ${m[1]}, which the build does not have`);
  }
  return { binaries, problems };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dir = process.argv[2] ?? 'dist';
  if (!existsSync(dir)) {
    console.error(`wasm-check: no ${dir}`);
    process.exit(1);
  }
  const { binaries, problems } = checkWasm(dir);
  for (const b of binaries) console.log(`wasm-check: ${b.file} ${(b.bytes / 1024).toFixed(0)} KB`);
  for (const p of problems) console.error(`wasm-check: ${p}`);
  if (problems.length) process.exit(1);
  console.log(`wasm-check: ${binaries.length} binaries, all valid`);
}
