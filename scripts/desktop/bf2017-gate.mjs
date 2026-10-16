// Lane W's `gate` job (the picture-everywhere design, §3.5 and §7; the
// plan's task 7): every Star Wars world at ultra on the owner's graphics
// chip, the gate the cloud cannot run. scripts/galaxy-check.mjs draws each
// world through the dev server in headless Chrome at 2,560 × 1,440 on the
// real GPU, twice:
//
//   d3d11    ANGLE on Direct3D 11 (WebGL 2: the classic renderer, or the
//            node renderer's WebGL 2 backend for a 'nodes' world)
//   webgpu   ?gpu=webgpu with WebGPU on (the node renderer's own backend,
//            for a 'nodes' world; a 'glsl' world draws as in d3d11 and its
//            row says webgl)
//
// and holds each to its ultra row (src/lib/budgets.js through
// scripts/galaxy-budget.mjs: the draw calls, the models' megabytes, a frame
// p95 of 16.7 ms). Each world's p50 and p95, calls, triangles, megabytes and
// the backend that drew it go to docs/superpowers/evidence/bf2017-picture/
// gate/<date>.json with a screenshot a world and leg (WebP, 960 wide); the
// full shots are the run's artifact. When there is no ultra baseline yet
// (lab/baseline/surface-ultra.json, galaxy-check's TODO), the d3d11 leg's
// numbers become it. The job is red when any world is over 16.7 ms p95.
//
//   node scripts/desktop/bf2017-gate.mjs [--dry] [--only hoth,endor] [--no-pr]
//   GATE_LEGS=d3d11 … (one leg)

import { spawn } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { budget } from '../../src/lib/budgets.js';
import { limitsFor, overBy } from '../galaxy-budget.mjs';
import { kill, sleep } from './lib.mjs';
import { runCli, step, today } from './bf2017-desk.mjs';

export const LEGS = { d3d11: { angle: 'd3d11', gpu: null }, webgpu: { angle: 'd3d11', gpu: 'webgpu' } };
const FRAME_MS = 16.7; // the design's ultra gate: a frame's p95 at 2,560 × 1,440
export const PORT = 5188;
const GATE_DIR = 'docs/superpowers/evidence/bf2017-picture/gate';

// The Star Wars worlds: every surface the high baseline measures (17 on 2026-10-11).
export const worldsOf = (root) => JSON.parse(readFileSync(join(root, 'lab/baseline/surface-high.json'), 'utf8')).map((r) => r.id);

// galaxy-check's environment for a leg.
export function checkEnv(leg, { out, chrome, base = `http://127.0.0.1:${PORT}` }, env = process.env) {
  const l = LEGS[leg];
  return { ...env, QUALITY: 'ultra', ANGLE: l.angle, ...(l.gpu ? { GPU: l.gpu } : {}), CHROME: chrome, JSON: '1', OUT: out, BUDGET: '1', BASE: base, PHASE_WAIT: env.PHASE_WAIT ?? '900000' };
}

// A leg's results held to the ultra row: a line a world, red when over.
export function judge(results, { base = [], realGpu = true } = {}) {
  const row = budget('ultra');
  return results.map((r) => {
    if (r.error) return { id: r.id, pass: false, over: [r.error] };
    const l = limitsFor({ id: r.id, quality: 'ultra', row, base: base.find((b) => b.id === r.id) ?? null, realGpu });
    const over = [...overBy(r, l), ...(r.errors?.length ? [`${r.errors.length} page error(s): ${r.errors[0]}`] : [])];
    return { id: r.id, backend: r.backend ?? null, p50: r.p50, p95: r.p95, calls: r.calls, triangles: r.triangles, mb: r.glbMB, loadS: r.loaded, pass: !over.length, over };
  });
}

export function gateMarkdown(legs) {
  const lines = [];
  for (const [leg, rows] of Object.entries(legs)) {
    const red = rows.filter((r) => !r.pass);
    lines.push(`### ${leg}: ${rows.length - red.length} of ${rows.length} within the ultra row${red.length ? `; **over: ${red.map((r) => r.id).join(', ')}**` : ''}`, '', '| world | backend | p50 ms | p95 ms | calls | triangles | MB | |', '| --- | --- | --: | --: | --: | --: | --: | --- |');
    for (const r of rows) lines.push(`| ${r.id} | ${r.backend ?? ''} | ${r.p50 ?? ''} | ${r.p95 ?? ''} | ${r.calls ?? ''} | ${r.triangles ?? ''} | ${r.mb ?? ''} | ${r.pass ? 'pass' : r.over.join('; ')} |`);
    lines.push('');
  }
  return lines.join('\n');
}

const legsOf = (env) => (env.GATE_LEGS ?? 'd3d11,webgpu').split(',').filter((l) => LEGS[l]);

// The dev server, up until stopped. → { stop }
async function devServer(root, log) {
  const p = spawn(process.execPath, [join(root, 'node_modules/vite/bin/vite.js'), '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], { cwd: root, stdio: 'ignore', windowsHide: true });
  for (let i = 0; i < 120; i++) {
    try {
      if ((await fetch(`http://127.0.0.1:${PORT}/`)).ok) {
        log(`dev server up on ${PORT}`);
        return { stop: () => kill(p.pid) };
      }
    } catch {
      /* not yet */
    }
    await sleep(1000);
  }
  kill(p.pid);
  throw new Error(`the dev server did not come up on ${PORT} in two minutes`);
}

export const spec = {
  job: 'gate',
  title: 'The ultra frame gate on the desktop',
  vram: 12 * 1024,
  columns: ['name', 'legs'],
  needs: (d) => [{ name: 'Chrome (the real GPU, WebGPU)', file: d.chrome, fix: 'install Google Chrome, or set CHROME to a Chromium with WebGPU' }],
  async plan({ root, env }) {
    const legs = legsOf(env);
    return {
      items: worldsOf(root).map((id) => ({ name: id, legs: legs.join(', ') })),
      notes: [`legs: ${legs.join(', ')} (ANGLE d3d11; webgpu adds ?gpu=webgpu)`, `held to the ultra row (src/lib/budgets.js) and ${FRAME_MS} ms p95 at 2,560 × 1,440`, `baseline: ${existsSync(join(root, 'lab/baseline/surface-ultra.json')) ? 'lab/baseline/surface-ultra.json' : 'none yet (the d3d11 leg makes lab/baseline/surface-ultra.json)'}`],
    };
  },
  async run(items, { root, d, env, log }) {
    const ids = items.map((i) => i.name);
    const temp = join(env.RUNNER_TEMP ?? join(root, 'lab'), 'bf2017-gate');
    const baseFile = join(root, 'lab/baseline/surface-ultra.json');
    const base = existsSync(baseFile) ? JSON.parse(readFileSync(baseFile, 'utf8')) : [];
    const server = await devServer(root, log);
    const legs = {};
    const raw = {};
    try {
      for (const leg of legsOf(env)) {
        const out = join(temp, leg);
        mkdirSync(out, { recursive: true });
        try {
          step(process.execPath, ['scripts/galaxy-check.mjs', 'surface', ids.join(',')], { cwd: root, env: checkEnv(leg, { out, chrome: d.chrome }, env), log });
        } catch {
          log(`${leg}: galaxy-check exited red (the rows below say why)`);
        }
        const file = join(out, 'surface-ultra.json');
        raw[leg] = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : ids.map((id) => ({ id, error: 'no result (galaxy-check stopped before writing)' }));
        legs[leg] = judge(raw[leg], { base });
      }
    } finally {
      server.stop();
    }
    const dir = join(root, GATE_DIR);
    mkdirSync(join(dir, 'shots'), { recursive: true });
    const { default: sharp } = await import('sharp');
    for (const [leg, rows] of Object.entries(raw)) {
      for (const r of rows) {
        const png = join(temp, leg, `surface-${r.id}-ultra.png`);
        if (existsSync(png)) await sharp(png).resize(960).webp({ quality: 72 }).toFile(join(dir, 'shots', `${r.id}-${leg}.webp`));
      }
    }
    const stamp = today();
    writeFileSync(join(dir, `${stamp}.json`), `${JSON.stringify({ _source: `scripts/desktop/bf2017-gate.mjs on the owner's desktop: scripts/galaxy-check.mjs surface at ultra, 2,560 × 1,440, ANGLE d3d11 (and ?gpu=webgpu), frame times over 4 s with the clock held; held to src/lib/budgets.js's ultra row and ${FRAME_MS} ms p95`, at: new Date().toISOString(), legs, raw }, null, 1)}\n`);
    const files = [GATE_DIR];
    if (!base.length && raw.d3d11?.some((r) => !r.error)) {
      copyFileSync(join(temp, 'd3d11', 'surface-ultra.json'), baseFile);
      files.push('lab/baseline/surface-ultra.json');
      log('no ultra baseline before: the d3d11 leg is it now');
    }
    const red = Object.values(legs).some((rows) => rows.some((r) => !r.pass));
    const report = `${gateMarkdown(legs)}\n${files.includes('lab/baseline/surface-ultra.json') ? 'There was no ultra baseline: this run’s d3d11 leg is `lab/baseline/surface-ultra.json` now.\n' : ''}Shots: \`${GATE_DIR}/shots/\` (960 wide); the full ones are the run’s artifact.`;
    return { files, report, failed: red };
  },
};

if (process.argv[1] === fileURLToPath(import.meta.url)) await runCli(spec);
