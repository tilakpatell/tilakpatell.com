#!/usr/bin/env node
// Builds the Rust ports under wasm/<name>/ into src/lib/wasm/<name>/ (lane
// X2: docs/stack/webassembly.md): wasm-pack, the web target, release, its
// glue and .wasm committed (the site's CI has no Rust), the .d.ts files and
// wasm-pack's own .gitignore left out. Then the crate's own tests.
//
//   node scripts/wasm-build.mjs [name …]   (every crate when none is named)
//
// Needs rustup's wasm32-unknown-unknown target and `cargo install wasm-pack`;
// wasm-opt comes from binaryen on the PATH (`npx binaryen` gives one where
// wasm-pack can't download its own).

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const names = process.argv.slice(2).length ? process.argv.slice(2) : readdirSync(join(ROOT, 'wasm')).filter((n) => existsSync(join(ROOT, 'wasm', n, 'Cargo.toml')));
for (const name of names) {
  const crate = join(ROOT, 'wasm', name);
  const out = join(ROOT, 'src/lib/wasm', name);
  console.log(`wasm-build: ${name}`);
  execFileSync('cargo', ['test', '--release'], { cwd: crate, stdio: 'inherit' });
  execFileSync('wasm-pack', ['build', '--target', 'web', '--release', '--out-dir', out, '--out-name', name, '--no-pack'], { cwd: crate, stdio: 'inherit' });
  for (const f of readdirSync(out)) if (f === '.gitignore' || f.endsWith('.d.ts')) rmSync(join(out, f));
}
