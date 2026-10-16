// Ask the desktop for a 3D model, voice lines or a clip from words, from any machine with gh
// signed in (a cloud session, a laptop): the request is checked here, then
// opened as an issue with the pipeline's label, which starts the workflow
// on the desktop (or waits for it). Prints the issue and how to follow it.
//
//   node scripts/desktop/ask.mjs gen3d NAME --what "a TIE fighter" --image URL [--image URL2 …] [--prompt "…"] [--faces 30000] [--options "tex: 2048  seed: 7"] [--note "why"]
//   node scripts/desktop/ask.mjs voices [NAME] [--only rick,morty] [--line "rick: Wubba lubba dub dub."]… [--note "why"]
//   node scripts/desktop/ask.mjs motion NAME --prompt "a two-handed overhead sword strike, stepping forward" [--seconds 3] [--seed 42] [--options "model: lite  with: sword.a"] [--note "why"]
//   add --dry-run to see the issue without opening it
//
// Then: node scripts/desktop/status.mjs (or the issue, which says when it's
// started, made, or failed and why).

import { fileURLToPath } from 'node:url';
import { gh } from './lib.mjs';

async function pipelineFor(name) {
  if (name === 'gen3d') return (await import('../gen3d/runner.mjs')).pipeline;
  if (name === 'voices') return (await import('../voices/runner.mjs')).pipeline;
  if (name === 'motion') return (await import('../motion/runner.mjs')).pipeline;
  throw new Error(`no pipeline "${name}": gen3d, voices or motion`);
}

// argv after the pipeline's name → the request's inputs (repeated flags collected)
export function inputs(kind, argv) {
  const out = {};
  const many = { image: [], line: [] };
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const m = argv[i].match(/^--([a-z-]+)$/);
    if (!m) {
      rest.push(argv[i]);
      continue;
    }
    const key = m[1];
    if (key === 'dry-run') {
      out.dryRun = true;
      continue;
    }
    const value = argv[++i];
    if (value === undefined) throw new Error(`--${key} needs a value`);
    if (key in many) many[key].push(value);
    else out[key] = value;
  }
  if (rest[0]) out.name = rest[0];
  if (many.image.length) out.image = many.image.join(', ');
  if (many.line.length) out.lines = many.line.join('\n');
  if (kind === 'voices' && out.only) out.only = out.only.split(/[,\s]+/).filter(Boolean).join(', ');
  return out;
}

export async function ask(kind, argv) {
  const p = await pipelineFor(kind);
  const { dryRun, note, ...given } = inputs(kind, argv);
  const { title, body } = p.request(given);
  const full = `${body}${note ? `\n\n${note}` : ''}`;
  if (dryRun) return { title, body: full };
  const url = gh('issue', 'create', '--title', title, '--body', full, '--label', p.label);
  return { title, body: full, url };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [kind, ...argv] = process.argv.slice(2);
  if (!kind || kind === '--help') {
    console.log('usage:\n  node scripts/desktop/ask.mjs gen3d NAME --what "…" (--image URL | --prompt "…") [--faces N] [--options "tex: 2048  seed: 7"] [--note "…"] [--dry-run]\n  node scripts/desktop/ask.mjs voices [NAME] [--only rick,morty] [--line "who: text"]… [--dry-run]\n  node scripts/desktop/ask.mjs motion NAME --prompt "…" [--seconds 3] [--seed 42] [--options "model: lite  with: sword.a"] [--note "…"] [--dry-run]');
    process.exit(kind ? 0 : 1);
  }
  try {
    const r = await ask(kind, argv);
    if (!r.url) console.log(`${r.title}\n---\n${r.body}\n---\n(dry run: nothing opened)`);
    else console.log(`${r.url}\nThe desktop takes it when it's on; the issue says when it starts, and links the pull request when it's made.\nFollow: node scripts/desktop/status.mjs`);
  } catch (e) {
    console.error(`Not asked: ${e.message}`);
    process.exit(1);
  }
}
