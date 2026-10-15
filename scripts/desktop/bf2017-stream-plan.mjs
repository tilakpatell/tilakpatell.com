// The `stream` job of lane W's workflow (.github/workflows/bf2017-desktop.yml):
// lane R2's sender (scripts/desktop/bf2017-stream.mjs, PR #908) with the
// arguments its README names (docs/superpowers/evidence/bf2017-picture/r2/
// README.md), from the run's inputs. The sender is R2's; this only checks
// the inputs and that the sender is here, and says plainly when it is not.
//
//   node scripts/desktop/bf2017-stream-plan.mjs           the plan (the dry run): the command, or why there is none
//   node scripts/desktop/bf2017-stream-plan.mjs --args    one argument a line for the workflow; exit 1 with why when it can't run
//
// The inputs: STREAM_SOURCE (site | game), STREAM_WORLD (site only: hoth),
// STREAM_MINUTES (15), STREAM_NAME (the run's name: desktop-lan, or
// desktop-game-lan for the game).

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { REPO, summary } from './lib.mjs';

const SENDER = 'scripts/desktop/bf2017-stream.mjs';

// The sender's arguments from the inputs. → { args } | { error }
export function streamArgs(env = process.env) {
  const source = env.STREAM_SOURCE || 'site';
  const world = env.STREAM_WORLD || 'hoth';
  const minutes = Number(env.STREAM_MINUTES || 15);
  const name = env.STREAM_NAME || (source === 'game' ? 'desktop-game-lan' : 'desktop-lan');
  if (!['site', 'game'].includes(source)) return { error: `the source "${source}" is neither site nor game` };
  if (!/^[a-z][a-z0-9_]*$/.test(world)) return { error: `the world "${world}" is not a world's id (hoth, endor, …)` };
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > 110) return { error: `the minutes "${env.STREAM_MINUTES}" are not a whole number from 1 to 110 (the job stops at 120)` };
  if (!/^[a-z0-9][a-z0-9-]*$/.test(name)) return { error: `the name "${name}" is not a file stem (a-z, 0-9, dashes)` };
  return { args: [...(source === 'game' ? ['--source', 'game'] : ['--world', world]), '--minutes', String(minutes), '--name', name] };
}

// What the job does here. → { ok, text, args? }
export function plan(env = process.env, root = REPO, exists = existsSync) {
  if (!exists(join(root, SENDER))) {
    return { ok: false, text: `The stream's sender (\`${SENDER}\`) is not in this checkout: it is lane R2's, in PR #908 (\`claude/bf2017-r2-stream\`). Run this job again once #908 has merged.` };
  }
  const r = streamArgs(env);
  if (r.error) return { ok: false, text: `Can't stream: ${r.error}.` };
  return { ok: true, args: r.args, text: `Streams with \`node ${SENDER} ${r.args.join(' ')}\`, then waits for a phone at the address it prints (R2's README: \`docs/superpowers/evidence/bf2017-picture/r2/README.md\`). The numbers go to \`docs/superpowers/evidence/bf2017-picture/r2/${r.args.at(-1)}.json\`, kept as the run's artifact.` };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const p = plan();
  if (process.argv.includes('--args')) {
    if (!p.ok) {
      console.log(p.text);
      process.exitCode = 1;
    } else console.log(p.args.join('\n'));
  } else {
    const md = `## bf2017 stream (dry run: nothing streamed)\n\n${p.text}`;
    console.log(md);
    summary(md);
  }
}
