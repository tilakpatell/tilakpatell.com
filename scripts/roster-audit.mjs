// Who flies what in each war, as a table: every ship the galaxy's battles,
// fleets, hunters, traffic and scenery name, war by war and side by side,
// checked against the roster (src/components/galaxy/roster.js; the walk is
// rosterAudit.js's). A ✗ is a ship flown in the wrong war or by the wrong
// side; any at all and it exits 1.
//
//   node scripts/roster-audit.mjs [--json]

async function main() {
  // (the tables import three.js and Vite-only paths: loaded through Vite)
  const { createServer } = await import('vite');
  const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
  try {
    const { auditRoster, mixes } = await vite.ssrLoadModule('/src/components/galaxy/rosterAudit.js');
    const rows = auditRoster();
    if (process.argv.includes('--json')) console.log(JSON.stringify(rows, null, 1));
    else {
      const out = [];
      for (const war of [...new Set(rows.map((r) => r.war))]) {
        out.push(`\n## ${war}\n`, '| side | source | ships |', '| --- | --- | --- |');
        const by = new Map();
        for (const r of rows.filter((x) => x.war === war)) {
          const key = `${r.side ?? 'anyone'}|${r.source}`;
          by.set(key, [...(by.get(key) ?? []), r.ok ? r.kind : `✗ ${r.kind}`]);
        }
        for (const [key, kinds] of by) out.push(`| ${key.split('|').join(' | ')} | ${kinds.join(', ')} |`);
      }
      console.log(out.join('\n'));
    }
    const bad = mixes();
    for (const b of bad) console.error(`✗ ${b.war} ${b.side ?? 'anyone'} ${b.source}: ${b.kind}`);
    process.exitCode = bad.length ? 1 : 0;
  } finally {
    await vite.close();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
