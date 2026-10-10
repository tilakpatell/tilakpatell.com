// The clips' census: every clip of the 2017 drop (web/anims.jsonl), each
// with the state the coverage ledger gives it (docs/superpowers/specs/
// 2026-10-10-bf2017-every-asset-design.md, lane Z's states): `used` when a
// pack the site loads carries it (its `extras.source`), `owned` when a
// running lane's design keeps the rig (the cast left's lanes B, Y and W,
// #839), `excluded` when the era rule leaves it out (the sequel's), else
// `unowned`. Counted by skeleton, and on the humanoid by the family its
// name starts with (`A_`, `C_`, `Cover_`…, the game's own prefixes: A an
// action, C a cycle, L a loop, P a pose, T a transition). Pure: the manifest
// and the used names in, rows and a page out (scripts/bf2017-clips.mjs
// --census writes the page).
//
//   familyOf(name)                 → the name's first part ('A_Luke_…' → 'A')
//   skeletonOf(entry)              → the skeleton's last part ('Walrus_HumanMale')
//   ownerOf(entry)                 → { state: 'owned' | 'excluded', by } | null
//   firstHeld(anims, names, ok)    → the first spelling the manifest has that `ok` takes, else null
//   censusRows(anims, used)        → { bySkeleton, byFamily, totals }
//   censusMarkdown(rows, { date }) → the page

import { isSequel } from './bf2017-manifest.mjs';

export const familyOf = (name) => String(name).split(/[_ ]/)[0];
export const skeletonOf = (entry) => String(entry?.skeleton ?? '').split('/').pop();

// the cast left's rigs (#839's plans, lanes B, Y and W): lane A keeps off them
const OWNED_SKELETONS = {
  Dewback_01_Ske: 'B',
  Bantha_01_Ske: 'B',
  Eopie_01_Ske: 'B',
  Ronto_01_Ske: 'B',
  Jawa_01_Ske: 'B',
  Aiwha_01_Ske: 'B',
  Yoda_01_Ske: 'Y',
  GeneralGrievous_01_Ske: 'Y',
};
// (the walkers' wrecks, every piece its own skeleton; the tauntaun's rider, lane B's, on the humanoid)
const OWNED_PATTERNS = [
  [/^AT(AT|ST)_Destruction_/i, 'W', 'skeleton'],
  [/TauntaunRider/i, 'B', 'name'],
];
// the era rule's rigs: the sequel's own droids, beasts and walker
const SEQUEL_SKELETONS = new Set(['Dio_SKEL', 'CrystalFox_01_Ske', 'Steelpecker_01_Ske', 'BB8_Ske', 'ATM6_Ske', 'RadarTechnician_Ske']);

export function ownerOf(entry) {
  const sk = skeletonOf(entry);
  if (OWNED_SKELETONS[sk]) return { state: 'owned', by: OWNED_SKELETONS[sk] };
  for (const [re, by, what] of OWNED_PATTERNS) if (re.test(what === 'name' ? entry.name : sk)) return { state: 'owned', by };
  if (SEQUEL_SKELETONS.has(sk) || isSequel(entry.name) || /^(Jakku|Crait|Takodana)_/i.test(entry.name)) return { state: 'excluded', by: 'era' };
  return null;
}

export function firstHeld(anims, names, ok = () => true) {
  for (const n of [].concat(names ?? [])) {
    const e = anims.get(n) ?? [...anims.values()].find((x) => x.name.toLowerCase() === String(n).toLowerCase());
    if (e && ok(e)) return e.name;
  }
  return null;
}

const STATES = ['used', 'owned', 'excluded', 'unowned'];
const zero = () => Object.fromEntries(STATES.map((s) => [s, 0]));

export function censusRows(anims, used) {
  const bySkeleton = {};
  const byFamily = {};
  const totals = zero();
  for (const e of anims.values()) {
    const owner = ownerOf(e);
    // (a used clip is used, whoever else might want it)
    const state = used.has(e.name) ? 'used' : (owner?.state ?? 'unowned');
    const sk = skeletonOf(e);
    (bySkeleton[sk] ??= zero())[state]++;
    totals[state]++;
    if (sk === 'Walrus_HumanMale') (byFamily[familyOf(e.name)] ??= zero())[state]++;
  }
  return { bySkeleton, byFamily, totals };
}

const table = (rows, head) => {
  const lines = [`| ${head} | clips | ${STATES.join(' | ')} |`, `| --- | ---: | ${STATES.map(() => '---:').join(' | ')} |`];
  const sum = (r) => STATES.reduce((a, s) => a + r[s], 0);
  for (const [k, r] of Object.entries(rows).sort((a, b) => sum(b[1]) - sum(a[1]))) lines.push(`| ${k} | ${sum(r)} | ${STATES.map((s) => r[s]).join(' | ')} |`);
  return lines.join('\n');
};

export function censusMarkdown({ bySkeleton, byFamily, totals }, { date = '' } = {}) {
  const all = STATES.reduce((a, s) => a + totals[s], 0);
  return `# The clips' census${date ? ` (${date})` : ''}

Written by \`node scripts/bf2017-clips.mjs --census\` from \`web/anims.jsonl\` and the site's clip sets (every pack \`bf2017-clips.mjs\` and \`bf2017-rigclips.mjs\` builds, by the first spelling the drop has). \`used\`: a pack the site loads carries it; \`owned\`: the cast left's lanes B, Y and W (#839) keep the rig; \`excluded\`: the era rule; \`unowned\`: nobody's yet.

**${all} clips**: ${STATES.map((s) => `${totals[s]} ${s}`).join(' · ')}.

## By skeleton

${table(bySkeleton, 'skeleton')}

## The humanoid (Walrus_HumanMale) by family

${table(byFamily, 'family')}
`;
}
