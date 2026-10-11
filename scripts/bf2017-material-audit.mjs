// The material audit per world (the colour lane's task 5): how much of what
// each level pack draws is bound as the game binds it, from the level's mesh
// variation databases, the export's material dump and the pack's
// variations.json (scripts/lib/bf2017-material-audit.mjs). No network: the
// records fetched ahead into lab/assets/bf2017/ as scripts/bf2017-variations.mjs
// says.
//
//   node scripts/bf2017-material-audit.mjs <world>… [--root lab/assets/bf2017]
//
// Writes docs/superpowers/evidence/bf2017-colour/<world>.md (the counts, and
// every row not bound with its slots) and the summary table in that folder's
// README.md ("The material audit").

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from './lib/args.mjs';
import { STATES, auditPack } from './lib/bf2017-material-audit.mjs';
import { entriesOf } from './lib/bf2017-variations.mjs';
import { databases, materialRows, meshKey, readRecord, subsOf } from './bf2017-variations.mjs';

const ROOT = resolve(fileURLToPath(import.meta.url), '..', '..');
const LEVELS = join(ROOT, 'public', 'models', 'galaxy', 'bf2017', 'levels');
const OUT = join(ROOT, 'docs', 'superpowers', 'evidence', 'bf2017-colour');
const pct = (x) => `${(x * 100).toFixed(1)} %`;

export function worldPage(world, out) {
  const c = out.counts;
  const off = out.rows.filter((r) => r.state !== 'bound' && r.state !== 'no-entry');
  return [
    `# ${world}: the material audit`,
    '',
    `Written by \`node scripts/bf2017-material-audit.mjs ${world}\`. Each drawn material of the pack against the level's mesh variation databases (the colour lane's task 5).`,
    '',
    `| drawn materials | ${STATES.join(' | ')} | bound |`,
    `|${'---|'.repeat(STATES.length + 2)}`,
    `| ${out.rows.length} | ${STATES.map((s) => c[s]).join(' | ')} | ${pct(out.share)} |`,
    '',
    off.length ? '| mesh | material | state | variation | slots |\n|---|---|---|---|---|' : 'Every material in a database is bound.',
    ...off.map((r) => `| \`${r.mesh.split('/').pop()}\` | ${r.material} | ${r.state} | ${r.variation ? `\`${r.variation.split('/').pop()}\`` : ''} | ${(r.slots ?? []).join(', ')} |`),
    '',
  ].join('\n');
}

export function withSummary(readme, table) {
  const head = '## The material audit';
  const at = readme.indexOf(head);
  const section = `${head}\n\n${table}\n`;
  if (at < 0) return `${readme.replace(/\n*$/, '\n\n')}${section}`;
  const next = readme.indexOf('\n## ', at + 3);
  return `${readme.slice(0, at)}${section}${next < 0 ? '' : `\n${readme.slice(next + 1)}`}`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2));
  const root = resolve(args.root ?? join(ROOT, 'lab', 'assets', 'bf2017'));
  const lines = [];
  for (const world of args._) {
    const dir = join(LEVELS, world);
    const pack = JSON.parse(readFileSync(join(dir, 'level.json'), 'utf8'));
    const readme = existsSync(join(dir, 'README.md')) ? readFileSync(join(dir, 'README.md'), 'utf8') : '';
    const variations = existsSync(join(dir, 'variations.json')) ? JSON.parse(readFileSync(join(dir, 'variations.json'), 'utf8')) : null;
    const dbs = databases(root, pack.map, subsOf(readme, pack.map));
    const meshes = pack.meshes.filter((m) => (m.glb ?? []).some(Boolean)).map((m) => ({ key: meshKey(m.name), mats: m.mats ?? 1 }));
    const out = auditPack({
      meshes,
      entries: entriesOf(dbs.map((p) => ({ path: p, record: readRecord(join(root, p)) }))),
      materials: await materialRows(join(root, 'web', 'materials.jsonl'), new Set(meshes.map((m) => m.key))),
      variations,
    });
    writeFileSync(join(OUT, `${world}.md`), worldPage(world, out));
    console.log(`${world.padEnd(10)} ${out.rows.length} drawn materials: ${STATES.map((s) => `${s} ${out.counts[s]}`).join(', ')}; bound ${pct(out.share)}`);
    lines.push(`| ${world} | ${out.rows.length} | ${STATES.map((s) => out.counts[s]).join(' | ')} | ${pct(out.share)} |`);
  }
  const table = [`Written by \`node scripts/bf2017-material-audit.mjs ${args._.join(' ')}\`; each world's rows in \`<world>.md\`.`, '', `| world | drawn materials | ${STATES.join(' | ')} | bound |`, `|${'---|'.repeat(STATES.length + 3)}`, ...lines].join('\n');
  const readme = join(OUT, 'README.md');
  writeFileSync(readme, withSummary(readFileSync(readme, 'utf8'), table));
}
