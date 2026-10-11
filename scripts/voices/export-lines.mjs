// Lists every line the crews say that has no recording of its own, for
// generate.py to make in the speaker's voice: `npm run voices:lines`.
// The site's modules are read through Vite's own module runner, the way the
// dev server reads them (extensionless imports, import.meta.env), so this
// needs nothing past Vite itself.
// Writes scripts/voices/lines.json: [{ id, who, text }], one per distinct line,
// with the same id the site looks it up by (src/lib/voiced.js).

import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// who has a voice to make (Artoo and Chewie don't speak Basic, and 'comms'
// is anybody on the radio)
export const VOICED = ['rick', 'morty', 'luke', 'han', 'walt', 'jesse', 'hank'];
// and the worlds' speakers with a voice of their own (common.py keeps the same list)
export const WORLD_VOICED = [
  'gandalf', 'aragorn', 'sam', 'frodo', 'galadriel', 'boromir', 'pippin', 'gimli', 'saruman', 'gollum', 'elrond', 'merry',
  'butterbur', 'theoden', 'legolas', 'arwen', 'bilbo', 'hama', 'haldir', 'denethor', 'grima', 'celeborn',
  'michael', 'jim', 'erin',
  // Metherria's customers (Jesse is one of the crews already)
  'badger', 'pete', 'tuco', 'mike', 'gus', 'lydia', 'declan', 'saul',
  // the Avengers compound
  'thor', 'natasha', 'hulk',
  // Cybertron
  'ratchet', 'bulkhead', 'arcee', 'jazz', 'grimlock', 'jetfire', 'magnus', 'zeta', 'soundwave', 'shockwave', 'barricade', 'starscream',
];

const isLine = (v) => Array.isArray(v) && typeof v[0] === 'string' && typeof v[1] === 'string' && v.length <= 3 && v.every((x) => typeof x === 'string');

export function unrecorded(sources, lineId) {
  const found = new Map();
  const walk = (v) => {
    if (isLine(v)) {
      const [who, text, clip] = v;
      if (!clip && VOICED.includes(who)) found.set(lineId(who, text), { id: lineId(who, text), who, text });
    } else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  };
  sources.forEach(walk);
  return [...found.values()].sort((a, b) => a.who.localeCompare(b.who) || a.text.localeCompare(b.text));
}

// The worlds' conversations (Middle-earth's towns, the Office, the Citadel):
// { who, say } nodes, made in the speaker's voice (voiceOf) when it's one of
// `voices`, saying what's said aloud (spoken: the quoted part of a line that
// mixes in narration), with the id the site looks it up by: the line as shown.
export function conversationLines(sources, { lineId, voiceOf, spoken }, voices) {
  const found = new Map();
  const walk = (v) => {
    if (Array.isArray(v)) return v.forEach(walk);
    if (!v || typeof v !== 'object') return undefined;
    const voice = typeof v.who === 'string' && typeof v.say === 'string' ? voiceOf(v.who) : null;
    if (voice && voices.includes(voice)) found.set(lineId(voice, v.say), { id: lineId(voice, v.say), who: voice, text: spoken(v.say) });
    return Object.values(v).forEach(walk);
  };
  sources.forEach(walk);
  return [...found.values()];
}

// The worlds' people, in their own formats: a person's `lines` (and the
// ones they say `after` you've done something) by their `id`; a mission's
// offer by its `giver`; a customer's reactions by the key they're under.
export function peopleLines(sources, { lineId, voiceOf, spoken }, voices) {
  const found = new Map();
  const add = (who, text) => {
    const voice = voiceOf(who);
    if (voice && voices.includes(voice) && typeof text === 'string' && spoken(text)) found.set(lineId(voice, text), { id: lineId(voice, text), who: voice, text: spoken(text) });
  };
  const walk = (v, key) => {
    if (Array.isArray(v)) return v.forEach((x) => walk(x));
    if (!v || typeof v !== 'object') return undefined;
    const who = typeof v.id === 'string' ? v.id : key;
    if (who && Array.isArray(v.lines)) v.lines.forEach((t) => add(who, t));
    if (who && Array.isArray(v.after?.lines)) v.after.lines.forEach((t) => add(who, t));
    if (key && v.lines && typeof v.lines === 'object' && !Array.isArray(v.lines)) Object.values(v.lines).forEach((t) => add(key, t));
    if (typeof v.giver === 'string' && typeof v.say === 'string') add(v.giver, v.say);
    return Object.entries(v).forEach(([k, x]) => walk(x, k));
  };
  sources.forEach((s) => walk(s));
  return [...found.values()];
}

// Each world's own list of what its people say aloud, kept beside the world's data in a
// voicelines.js that exports VOICELINES: [{ who, text }], `who` the speaker as the site passes it to
// useVoiced or sayVoiced (voiceOf makes it a voice) and `text` the line as it does. A world wired
// this way needs nothing here: every voicelines.js under src/ is read, and every voice in them made.
export function worldLines(lists, { lineId, voiceOf, spoken }) {
  const found = new Map();
  for (const list of lists) {
    for (const { who, text } of list ?? []) {
      const voice = voiceOf(who);
      const said = typeof text === 'string' ? spoken(text) : '';
      if (voice && said) found.set(lineId(voice, text), { id: lineId(voice, text), who: voice, text: said });
    }
  }
  return [...found.values()];
}

// the voicelines.js files under a folder, as paths from `root`
export function voicelineFiles(root, dir = 'src') {
  return readdirSync(join(root, dir), { withFileTypes: true }).flatMap((d) => {
    const path = `${dir}/${d.name}`;
    if (d.isDirectory()) return voicelineFiles(root, path);
    return d.name === 'voicelines.js' ? [path] : [];
  });
}

const here = dirname(fileURLToPath(import.meta.url));
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { runnerImport } = await import('vite');
  const { default: librarySlice } = await import('../library-slice.mjs');
  const root = resolve(here, '../..');
  // no config file: the site's plugins (prerender, the icons) have nothing to do
  // here, but the object library imports `virtual:bf2017-published`, which only
  // librarySlice serves (lane D3), and the ground's sites reach the library
  const load = async (path) => (await runnerImport(join(root, path), { root, configFile: false, logLevel: 'error', plugins: [librarySlice()] })).module;
  const voiced = await load('src/lib/voiced.js');
  // the site's own lists: the crews, the galaxy, the cockpit, the ground, the worlds' conversations and people
  const siteLines = async () => {
    const [{ CREWS }, { GALAXY_LINES }, { VEHICLES }, { SITES }, { MISSIONS }, { crewLines }, { lineId }] = await Promise.all([
      load('src/components/universe/crews.js'),
      load('src/components/galaxy/lines.js'),
      load('src/components/cockpit/vehicles.js'),
      // on the ground: each landing site's places, its missions, and climbing out, riding and leaving
      load('src/components/galaxy/surface/sites/index.js'),
      load('src/components/galaxy/surface/missions/index.js'),
      load('src/components/galaxy/surface/lines.js'),
      load('src/lib/voiced.js'),
    ]);
    const surface = [SITES, MISSIONS, CREWS.map((c) => crewLines(c.id))];
    // the worlds' conversations: every Middle-earth town's, the Office's and the Citadel's
    const towns = readdirSync(join(root, 'src/components/middleearth/towns'), { withFileTypes: true })
      .filter((d) => d.isDirectory() && existsSync(join(root, 'src/components/middleearth/towns', d.name, 'story.js')))
      .map((d) => `src/components/middleearth/towns/${d.name}/story.js`);
    const worlds = await Promise.all([...towns, 'src/components/office/world/story.js', 'src/components/rickmorty/citadel/story.js', 'src/components/rickmorty/citadel/shouts.js'].map(load));
    // and the worlds' people in their own formats: the Avengers compound's cast, Cybertron's bots and missions, Metherria's customers
    const [{ CAST }, { AREAS, MISSIONS: CYBERTRON }, { CUSTOMERS }] = await Promise.all([
      load('src/components/avengers/world/rules.js'),
      load('src/components/cybertron/game/areas/index.js'),
      load('src/components/albuquerque/metherria/rules.js'),
    ]);
    const people = peopleLines([CAST, Object.values(AREAS).map((a) => a.people ?? []), CYBERTRON, CUSTOMERS], voiced, [...VOICED, ...WORLD_VOICED]);
    return [...unrecorded([CREWS, GALAXY_LINES, VEHICLES.map((v) => v.lines), ...surface], lineId), ...conversationLines(worlds, voiced, [...VOICED, ...WORLD_VOICED]), ...people];
  };
  // VOICES_LINES_FROM=voicelines: the voicelines.js files alone, for a contract test over a
  // fixture src/ tree that has none of the site's other lists (scripts/ai-e2e)
  const lines = process.env.VOICES_LINES_FROM === 'voicelines' ? [] : await siteLines();
  const own = await Promise.all(voicelineFiles(root).map(load));
  const listed = new Set(lines.map((l) => l.id));
  lines.push(...worldLines(own.map((m) => m.VOICELINES), voiced).filter((l) => !listed.has(l.id)));
  // --extra FILE: lines asked for ahead of the code that will say them ({ who, text } each; scripts/voices/runner.mjs)
  const extraAt = process.argv.indexOf('--extra');
  if (extraAt > 0) {
    const extra = JSON.parse(readFileSync(process.argv[extraAt + 1], 'utf8'));
    const known = new Set(lines.map((l) => l.id));
    for (const { who, text } of extra) {
      const voice = voiced.voiceOf(who);
      const id = voice && voiced.lineId(voice, text);
      if (voice && !known.has(id)) lines.push({ id, who: voice, text: voiced.spoken(text) });
    }
  }
  // --out FILE: somewhere else (the asset tests read the lines without touching this machine's own list)
  const outAt = process.argv.indexOf('--out');
  const out = outAt > 0 ? resolve(process.argv[outAt + 1]) : join(here, 'lines.json');
  writeFileSync(out, `${JSON.stringify(lines, null, 1)}\n`);
  const count = lines.reduce((n, l) => ({ ...n, [l.who]: (n[l.who] ?? 0) + 1 }), {});
  const by = Object.entries(count).map(([who, n]) => `${who} ${n}`);
  console.log(`${lines.length} lines without a recording (${by.join(', ')}) -> ${outAt > 0 ? out : 'scripts/voices/lines.json'}`);
}
