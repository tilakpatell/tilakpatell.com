// The galaxy's small creatures, droids and aliens from Star Wars Battlefront
// II (2017), each on a skeleton of its own (src/lib/three/walrusSets/
// fauna.js's FAUNA, which walrusClips.js's OWN_RIGS takes in): for each,
// its model fetched with every LOD (scripts/bf2017-fetch.mjs), imported as
// a crew figure at phase 2's full fidelity (scripts/bf2017-import.mjs --rig
// --crew --full --join: the game's LOD0 with its own KTX2 maps, to the
// bucket; a `.lod1` light cut, committed) and its rig's clips packed
// (scripts/bf2017-clips.mjs <rig>, clips-<rig>.glb). It prints each kind's
// CREW row (for crewList.js) and the commands it ran.
//
//   node scripts/bf2017-fauna.mjs [<rig>,…] [--skip-fetch] [--skip-import] [--skip-pack] [--far] [--root <export>]
//
//   far    a `.far` cut as well (the import’s --far: the chain’s last LOD,
//          for the herds past the level’s mid)
//   root   the drop read from here instead of the fetch’s lab/assets/bf2017:
//          the desktop’s export (C:\Users\tilak\Downloads\BF2_Extract, whose
//          web/ holds the manifests, the models, their maps and the clips
//          as the bucket’s does), with nothing fetched
//
// A row’s `parts` (what the beast wears: the dewback’s saddle), `cuts` and
// `light` go to the import as --parts, --cuts and --lod1-tex with --lod1-maps.
//
// Then: node scripts/assets-publish.mjs --only '<the full cuts and packs>',
// node scripts/assets-check.mjs, and the rows into crewList.js.

import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FAUNA } from '../src/lib/three/walrusSets/fauna.js';
import { parseArgs } from './lib/args.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const run = (script, args) => {
  console.log(`$ node scripts/${script} ${args.map((a) => (/[\s']/.test(a) ? `'${a}'` : a)).join(' ')}`);
  return execFileSync(process.execPath, [join(ROOT, 'scripts', script), ...args], { cwd: ROOT, encoding: 'utf8', env: { ...process.env, NODE_USE_ENV_PROXY: process.env.NODE_USE_ENV_PROXY ?? '1' }, stdio: ['ignore', 'pipe', 'inherit'] });
};
// what the import's CREW row says, with the own rig's names in
const crewRow = (rig, printed) => {
  const m = printed.match(/^\s+\w+: \{ (.*) \},$/m);
  return m ? `  ${FAUNA[rig].body}: { ${m[1].replace("rig: 'walrus'", `rig: 'own', ownRig: '${rig}'`)} },` : null;
};

// The import’s arguments for a row: the fauna’s own (--rig --crew --full
// --join), its parts and cuts, and --far and --root where asked.
export function importArgs(rig, row, { far = false, root = null } = {}) {
  const args = [row.model, '--kind', row.body, '--as', `The game’s ${rig}`, '--rig', '--crew', '--full', '--join'];
  if (row.parts?.length) args.push('--parts', row.parts.join(','));
  if (row.cuts) args.push('--cuts', row.cuts);
  if (row.light) args.push('--lod1-tex', String(row.light.tex), '--lod1-maps', String(row.light.maps));
  if (far) args.push('--far');
  if (root) args.push('--root', root);
  return args;
}
// (the clip packer reads the same drop)
export const packArgs = (rig, { root = null } = {}) => [rig, ...(root ? ['--root', root] : [])];

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2));
  const only = args._[0] ? String(args._[0]).split(',') : Object.keys(FAUNA);
  const root = typeof args.root === 'string' ? args.root : null;
  const rows = [];
  for (const rig of only) {
    const f = FAUNA[rig];
    if (!f) throw new Error(`${rig}: not in FAUNA (${Object.keys(FAUNA).join(', ')})`);
    // (an export on disk has every LOD already: nothing to fetch)
    if (!args.skipFetch && !root) run('bf2017-fetch.mjs', [f.model, '--lod', 'all']);
    if (!args.skipImport) {
      const out = run('bf2017-import.mjs', importArgs(rig, f, { far: Boolean(args.far), root }));
      rows.push(crewRow(rig, out) ?? `  (${rig}: no row printed)`);
    }
    if (!args.skipPack) console.log(run('bf2017-clips.mjs', packArgs(rig, { root })).split('\n').slice(-3).join('\n'));
  }
  if (rows.length) console.log(`\nthe CREW rows:\n${rows.join('\n')}`);
}
