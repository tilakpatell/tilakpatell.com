// The material audit: per world, how much of what its pack draws is bound
// as the game binds it (lane colour: docs/superpowers/plans/
// 2026-10-10-bf2017-accuracy-lane-colour.md, task 5; scripts/lib/
// bf2017-material-audit.mjs). Reads the pack's level.json (its meshes and
// their materials), its variations.json (scripts/bf2017-variations.mjs) and
// the material dump (web/materials.jsonl, fetched into lab/assets/bf2017/),
// and writes docs/superpowers/evidence/bf2017-colour/<world>.md and the
// summary table in that folder's README.md (between its audit markers).
//
//   node scripts/bf2017-material-audit.mjs <world> [<world> …]

import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { auditPack, summarise } from './lib/bf2017-material-audit.mjs';
import { webFile } from './bf2017-shader-names.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'docs/superpowers/evidence/bf2017-colour');
const START = '<!-- audit:start -->';
const END = '<!-- audit:end -->';
const STATES = ['bound', 'default-only', 'missing-texture', 'unbound', 'no-entry'];

async function main() {
  const worlds = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  if (!worlds.length) {
    console.error('usage: node scripts/bf2017-material-audit.mjs <world> [<world> …]');
    process.exit(2);
  }
  const dump = new Map();
  for (const l of (await readFile(await webFile('materials.jsonl'), 'utf8')).split('\n')) {
    if (!l.trim()) continue;
    const r = JSON.parse(l);
    dump.set(r.mesh.toLowerCase(), r);
  }
  await mkdir(OUT, { recursive: true });
  const summary = [];
  for (const world of worlds) {
    const packDir = join(ROOT, 'public/models/galaxy/bf2017/levels', world);
    const pack = JSON.parse(await readFile(join(packDir, 'level.json'), 'utf8'));
    const file = join(packDir, 'variations.json');
    const variations = existsSync(file) ? JSON.parse(await readFile(file, 'utf8')) : { meshes: {}, maps: {} };
    const rows = auditPack({ meshes: pack.meshes, dump, variations });
    const s = summarise(rows);
    summary.push({ world, level: pack.map, variations: existsSync(file), ...s });
    const byState = (st) => rows.filter((r) => r.state === st);
    const lines = [
      `# ${world}: the materials as the game binds them`,
      '',
      `Written by \`node scripts/bf2017-material-audit.mjs ${world}\` from \`${pack.map}\`'s pack${existsSync(file) ? ' and its variations.json' : ' (no variations.json: every material `no-entry`)'}; do not edit by hand.`,
      '',
      '| materials | bound | default-only | missing-texture | unbound | no-entry | bound share |',
      '|---|---|---|---|---|---|---|',
      `| ${s.materials} | ${s.bound} | ${s['default-only']} | ${s['missing-texture']} | ${s.unbound} | ${s['no-entry']} | ${(s.share * 100).toFixed(1)} % |`,
      '',
    ];
    for (const st of STATES.filter((x) => x !== 'bound')) {
      const list = byState(st);
      if (!list.length) continue;
      lines.push(`## ${st} (${list.length})`, '');
      for (const r of list) lines.push(`- \`${r.mesh}\` #${r.material}${r.variation ? ` (${r.variation})` : ''}${r.slots ? `: ${r.slots.join(', ')}` : ''}`);
      lines.push('');
    }
    await writeFile(join(OUT, `${world}.md`), `${lines.join('\n')}\n`);
    console.log(`${world}: ${JSON.stringify(s)}`);
  }

  // the README's summary: the rows of this run over the rows already there
  const readme = join(OUT, 'README.md');
  const body = existsSync(readme) ? await readFile(readme, 'utf8') : `# Lane colour: the variation chain\n\n${START}\n${END}\n`;
  const old = new Map();
  const cut = body.indexOf(START);
  const end = body.indexOf(END);
  if (cut >= 0 && end > cut) {
    for (const l of body.slice(cut, end).split('\n')) {
      const m = l.match(/^\| `([^`]+)` \|/);
      if (m) old.set(m[1], l);
    }
  }
  for (const r of summary) old.set(r.world, `| \`${r.world}\` | \`${r.level}\` | ${r.materials} | ${r.bound} | ${r['default-only']} | ${r['missing-texture']} | ${r.unbound} | ${r['no-entry']} | ${(r.share * 100).toFixed(1)} % |`);
  const table = [START, '| world | level | materials | bound | default-only | missing-texture | unbound | no-entry | bound share |', '|---|---|---|---|---|---|---|---|---|', ...[...old.keys()].sort().map((k) => old.get(k)), END].join('\n');
  await writeFile(readme, cut >= 0 && end > cut ? `${body.slice(0, cut)}${table}${body.slice(end + END.length)}` : `${body.trimEnd()}\n\n${table}\n`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
