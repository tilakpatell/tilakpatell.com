// Which files import which package, written into the stack index
// (docs/stack/README.md) between its census markers. A page records no
// number a person counted: the counts come from here, and --check says when
// the index has fallen behind the code.
// Design: docs/superpowers/specs/2026-10-08-render-stack-and-stack-docs-design.md.
//
//   node scripts/stack-census.mjs            # print the table, and where each package is imported
//   node scripts/stack-census.mjs --write    # splice the table into docs/stack/README.md
//   node scripts/stack-census.mjs --check    # exit 1 when the index's table is stale (the steward runs it)
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeContext } from './health/context.mjs';
import { DYNAMIC, FROM, SIDE_EFFECT, isTest, uncomment } from './health/graph.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const INDEX = 'docs/stack/README.md';
const START = '<!-- census:start -->';
const END = '<!-- census:end -->';

// the page each package belongs to, grouped where a package is only ever used
// with another (the spec's table, with yaml on testing's page and React's
// types on React's, where the code that uses them is); stack-census.test.mjs fails on a package
// of package.json missing here
const group = (page, names) => Object.fromEntries(names.map((n) => [n, page]));
export const PAGES = {
  ...group('three.md', ['three']),
  ...group('physics-rapier.md', ['@dimforge/rapier3d-compat']),
  ...group('react.md', ['react', 'react-dom', 'react-router-dom', 'react-icons', '@types/react', '@types/react-dom']),
  ...group('multiplayer-nostr.md', ['@noble/secp256k1']),
  ...group('supabase.md', ['@supabase/supabase-js']),
  ...group('fonts.md', [
    '@fontsource-variable/archivo', '@fontsource/bebas-neue', '@fontsource/cinzel', '@fontsource/cinzel-decorative',
    '@fontsource/courier-prime', '@fontsource/jetbrains-mono', '@fontsource/luckiest-guy', '@fontsource/news-cycle',
    '@fontsource/noto-sans-runic', '@fontsource/orbitron', '@fontsource/press-start-2p', '@fontsource/yatra-one',
  ]),
  ...group('build.md', [
    'vite', '@vitejs/plugin-react', 'tailwindcss', 'postcss', 'autoprefixer', 'eslint', '@eslint/js',
    'eslint-plugin-react', 'eslint-plugin-react-hooks', 'eslint-plugin-react-refresh', 'globals', 'gh-pages',
  ]),
  ...group('testing.md', ['vitest', 'playwright-core', 'fake-indexeddb', 'yaml']),
  ...group('assets-pipeline.md', [
    '@gltf-transform/core', '@gltf-transform/extensions', '@gltf-transform/functions', 'meshoptimizer', 'basisu',
    'sharp', 'fflate', 'watlas', 'd3-geo', 'topojson-client', 'world-atlas',
  ]),
};

// 'three/examples/jsm/x.js' is three's; a scoped name keeps its scope. A
// relative path, an absolute one and a scheme ('node:', 'virtual:') are no
// package of package.json's
export function packageOf(specifier) {
  if (/^[./]/.test(specifier) || /^[a-z][\w+.-]*:/i.test(specifier)) return null;
  const parts = specifier.split('/');
  return specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
}

// the folder a file counts under: at most three deep, so src/lib/three and
// scripts read as one place each, not as every subfolder of a world
const folderOf = (rel) => rel.split('/').slice(0, -1).slice(0, 3).join('/');

export async function census(ctx) {
  const out = new Map();
  for (const p of [...ctx.src, ...ctx.scripts]) {
    if (isTest(p)) continue;
    // a commented import is not an import
    const code = uncomment(await ctx.read(p));
    const pkgs = new Set();
    for (const re of [FROM, SIDE_EFFECT, DYNAMIC]) for (const [, , spec] of code.matchAll(re)) {
      const name = packageOf(spec);
      if (name) pkgs.add(name);
    }
    const folder = folderOf(ctx.rel(p));
    for (const name of pkgs) {
      const entry = out.get(name) ?? { files: 0, folders: new Map() };
      entry.files += 1;
      entry.folders.set(folder, (entry.folders.get(folder) ?? 0) + 1);
      out.set(name, entry);
    }
  }
  return new Map([...out].map(([name, { files, folders }]) => [name, {
    files,
    where: [...folders].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 5).map(([f]) => f),
  }]));
}

// one row per package of package.json, the most imported first; a package
// nothing imports (a CLI, a font read through CSS, a type) still has its row
export function table(counts, pkg, pages = PAGES) {
  const versions = { ...pkg.devDependencies, ...pkg.dependencies };
  const rows = Object.keys(versions)
    .map((name) => ({ name, files: counts.get(name)?.files ?? 0 }))
    .sort((a, b) => b.files - a.files || a.name.localeCompare(b.name))
    .map(({ name, files }) => `| \`${name}\` | ${versions[name]} | ${pages[name] ? `[${pages[name]}](${pages[name]})` : '—'} | ${files} |`);
  return ['| package | version | page | files |', '| --- | --- | --- | --- |', ...rows].join('\n');
}

const bounds = (markdown) => {
  const a = markdown.indexOf(START);
  const b = markdown.indexOf(END);
  if (a < 0 || b < a) throw new Error(`${INDEX} needs ${START} and ${END}, in that order`);
  return [a + START.length, b];
};

export function splice(markdown, block) {
  const [a, b] = bounds(markdown);
  return `${markdown.slice(0, a)}\n${block}\n${markdown.slice(b)}`;
}

export const stale = (markdown, block) => {
  const [a, b] = bounds(markdown);
  return markdown.slice(a, b).trim() !== block.trim();
};

async function main() {
  const args = new Set(process.argv.slice(2));
  const ctx = await makeContext(ROOT);
  const counts = await census(ctx);
  const pkg = JSON.parse(await readFile(join(ROOT, 'package.json'), 'utf8'));
  const block = table(counts, pkg);
  const path = join(ROOT, INDEX);
  if (args.has('--write')) {
    await writeFile(path, splice(await readFile(path, 'utf8'), block));
    console.log(`wrote ${INDEX}`);
  } else if (args.has('--check')) {
    if (stale(await readFile(path, 'utf8'), block)) {
      console.error(`${INDEX}: the census table is stale; run node scripts/stack-census.mjs --write`);
      process.exitCode = 1;
    } else console.log(`${INDEX}: the census table is current`);
  } else {
    console.log(block);
    console.log('');
    for (const [name, { files, where }] of [...counts].sort((a, b) => b[1].files - a[1].files)) console.log(`${name} (${files}): ${where.join(', ')}`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
