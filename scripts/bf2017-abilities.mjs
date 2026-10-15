// The 2017 heroes' abilities, from the game's own gameplay data, into one
// small file the site reads: src/data/bf2017Abilities.json. For each hero
// (scripts/lib/bf2017-abilities.mjs's HEROES_2017, none of the sequel era)
// it reads the kit (GP_Hero_<Hero>), each of its own abilities (the times,
// the button, the modifiers), the prefab that does it and the prefabs and
// projectiles that prefab hands work to, and every affector they apply,
// and keeps each number the data gives with where it came from. A number
// the data doesn't give isn't there; the site's rules (abilityRules.js)
// say what they put in its place.
//
//   node scripts/bf2017-abilities.mjs [--root lab/assets/bf2017] [--out src/data/bf2017Abilities.json] [--heroes Luke,DarthVader]
//
//   root   the fetch's folder: data.tsv (the index of every data asset)
//          and data/<name>.json for the ones fetched. An asset the index
//          lists that isn't fetched is named at the end, to fetch
//          (bf2017-fetch.mjs, or the bucket's data/<path>.json.gz) and
//          run again; nothing is fetched here
//   out    the JSON written ('-' prints it)
//
// The data is the game's, from the owner's drop (docs/assets/battlefront-2017.md);
// the file keeps numbers and names only.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from './lib/args.mjs';
import { HEROES_2017, KIND, abilitiesOfKit, abilityRow, affectorFacts, healthOf, outputRoles, prefabFacts, readAbility, shareRoles } from './lib/bf2017-abilities.mjs';
import { isSequel } from './lib/bf2017-manifest.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// the index: an asset's name (any case) → its file under root
export function readIndex(root) {
  const idx = new Map();
  const tsv = join(root, 'data.tsv');
  if (!existsSync(tsv)) return idx;
  for (const line of readFileSync(tsv, 'utf8').split('\n')) {
    const [name, type, file] = line.split('\t');
    if (name && file) idx.set(name.toLowerCase(), { name, type, file });
  }
  return idx;
}

export function makeLoader(root, idx) {
  const missing = new Set();
  const cache = new Map();
  const load = (name) => {
    if (!name) return null;
    const key = name.toLowerCase();
    if (cache.has(key)) return cache.get(key);
    const file = idx.get(key)?.file ?? `data/${name}.json`;
    const path = join(root, file);
    let doc = null;
    if (existsSync(path)) doc = JSON.parse(readFileSync(path, 'utf8'));
    else if (idx.has(key)) missing.add(file);
    cache.set(key, doc);
    return doc;
  };
  return { load, missing };
}

// a hero's kit asset: Gameplay/Kits/Hero/<Folder>/[Kits/]GP_Hero_<…> (not a later season's copy)
export function kitOf(idx, folder) {
  const re = new RegExp(`^gameplay/kits/hero/${folder.toLowerCase()}/(kits?/)?gp_hero_[^/]+$`);
  for (const [key, v] of idx) if (re.test(key) && !/_ap$|-ap$/.test(key)) return v.name;
  return `Gameplay/Kits/Hero/${folder}/GP_Hero_${folder}`;
}

// an ability's prefab and everything it hands work to (three deep), as one set of facts
function factsOf(load, blueprint, abilityId) {
  const facts = { applies: [], radii: [], refs: [], missile: null };
  const roles = {};
  const seen = new Set();
  const visit = (name, depth) => {
    if (!name || seen.has(name.toLowerCase()) || depth > 3) return;
    seen.add(name.toLowerCase());
    const doc = load(name);
    if (!doc) return;
    const f = prefabFacts(doc);
    facts.applies.push(...f.applies);
    facts.radii = [...new Set([...facts.radii, ...f.radii])].sort((a, b) => a - b);
    facts.missile ??= f.missile;
    for (const [h, r] of Object.entries(outputRoles(doc, abilityId))) roles[h] ??= r;
    for (const r of f.refs) visit(r, depth + 1);
  };
  visit(blueprint, 0);
  return { facts, roles };
}

// a hero's own abilities (the ones KIND names: not the weapon it carries), read
function heroAbilities(load, gpName) {
  const gp = load(gpName);
  if (!gp) return null;
  const read = [];
  for (const name of abilitiesOfKit(gp)) {
    const kind = KIND[name.split('/').pop()];
    const doc = kind ? load(name) : null;
    if (!doc) continue;
    const ability = readAbility(doc);
    const { facts, roles } = factsOf(load, ability.blueprint, ability.id);
    const affectors = {};
    for (const ap of facts.applies) {
      const a = load(ap.affector);
      if (a) affectors[ap.affector] = affectorFacts(a);
    }
    read.push({ ability, roles, facts, affectors, kind });
  }
  const hp = load(healthOf(gp));
  return { kit: gpName.split('/').pop(), health: hp ? affectorFacts(hp).maxHealth : null, read };
}

export function build({ root, heroes = Object.keys(HEROES_2017) }) {
  const idx = readIndex(root);
  const { load, missing } = makeLoader(root, idx);
  const got = {};
  for (const folder of heroes) {
    if (isSequel(folder) || !HEROES_2017[folder]) continue;
    const h = heroAbilities(load, kitOf(idx, folder));
    if (h) got[HEROES_2017[folder]] = h;
  }
  // (an output one prefab hides behind arithmetic is named by another's that doesn't)
  shareRoles(Object.values(got).flatMap((h) => h.read));
  const out = Object.fromEntries(Object.entries(got).map(([id, h]) => [id, { kit: h.kit, health: h.health, abilities: h.read.map(abilityRow) }]));
  return { heroes: out, missing: [...missing].sort() };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2));
  const root = args.root ?? join(ROOT, 'lab/assets/bf2017');
  const heroes = typeof args.heroes === 'string' ? args.heroes.split(',') : undefined;
  const { heroes: got, missing } = build({ root, heroes });
  const file = {
    about: 'Star Wars Battlefront II (2017): each hero’s own abilities as the game’s gameplay data has them (scripts/bf2017-abilities.mjs). Seconds, metres, degrees (cone: from straight ahead to the edge), the game’s hit points (a trooper has 150; `health` the hero’s own, from the MaxHealthAffectorAsset it spawns with); `from` says where each number was read.',
    heroes: got,
  };
  const text = `${JSON.stringify(file, null, 1)}\n`;
  if (args.out === '-') process.stdout.write(text);
  else {
    const out = args.out ?? join(ROOT, 'src/data/bf2017Abilities.json');
    writeFileSync(out, text);
    const n = Object.values(got).reduce((s, h) => s + h.abilities.length, 0);
    console.log(`${Object.keys(got).length} heroes, ${n} abilities, ${(text.length / 1024).toFixed(1)} KB → ${out}`);
  }
  if (missing.length) console.log(`not fetched (${missing.length}):\n${missing.join('\n')}`);
}
