// CREDITS.md, from the lists the site credits from itself: every Sketchfab
// model (src/data/modelCredits.json, and the ones public/cc0/README.md lists
// by hand), every CC0 scan, sky and kit (public/games/credits.json,
// public/games/caribbean/credits.json, public/hq/CREDITS.md, and the kit
// packs' manifests, public/kit/*/index.json), every photo
// (src/data/photos.js), the fonts and the public data, and the README's
// thank-you to the artists. Run it after any of those change:
//
//   npm run credits
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join } from 'node:path';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const read = (p) => readFile(join(ROOT, p), 'utf8');
const json = async (p) => JSON.parse(await read(p));
// (as file URLs: a bare C: path isn't one, so Windows can't import it)
const { PHOTOS } = await import(pathToFileURL(join(ROOT, 'src/data/photos.js')).href);
const { profile } = await import(pathToFileURL(join(ROOT, 'src/data/profile.js')).href);

const cell = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim();
const link = (text, url) => (url ? `[${cell(text)}](${url})` : cell(text));
const licence = (l) => l.replace(/^CC-/, 'CC ').replace(/-(\d)/, ' $1'); // 'CC-BY-NC-SA-4.0' → 'CC BY-NC-SA 4.0'
const LICENCE_URL = {
  'CC-BY-4.0': 'https://creativecommons.org/licenses/by/4.0/',
  'CC-BY-NC-4.0': 'https://creativecommons.org/licenses/by-nc/4.0/',
  'CC-BY-NC-SA-4.0': 'https://creativecommons.org/licenses/by-nc-sa/4.0/',
};
const sketchfabId = (url) => url.match(/([0-9a-f]{32})\/?$/)?.[1] ?? url;
const authorUrl = (name) => `https://sketchfab.com/${encodeURIComponent(name)}`;

// ── 3D models from Sketchfab ──
const WORLDS = [
  ['universe', 'The universe map'],
  ['galaxy', 'A galaxy far, far away: in space'],
  ['galaxy-surface', 'A galaxy far, far away: down on the worlds'],
  ['cybertron', 'Cybertron'],
  ['avengers', 'Avengers HQ'],
  ['albuquerque', 'Albuquerque'],
  ['middle-earth', 'Middle-earth'],
  ['c-137', 'Dimension C-137'],
  ['invincible', 'Invincible'],
  ['earth', 'Earth'],
  ['dickansh', 'The secret world'],
];
const all = Object.values(await json('src/data/modelCredits.json'));
// (the ones used with their author's permission, a Battlefront II remaster's, in a section of their own)
const permitted = all.filter((m) => m.license === 'permission');
const models = all.filter((m) => m.license !== 'permission');
const known = new Set(models.map((m) => sketchfabId(m.source)));
// the ones public/cc0/README.md lists by hand: "- `file`: [Title](url) by author. What it is."
const cc0Readme = await read('public/cc0/README.md');
const byHand = cc0Readme.slice(cc0Readme.indexOf('from Sketchfab'));
for (const [, file, title, source, author, rest] of byHand.matchAll(/^- `([^`]+)`: \[([^\]]+)\]\(([^)]+)\) by ([^.\s]+(?:\.[^.\s]+)*)\.[ \t]*([^\n]*)/gm)) {
  if (known.has(sketchfabId(source))) continue;
  known.add(sketchfabId(source));
  const where = /optimus/.test(file) ? 'cybertron' : file.startsWith('avengers/') ? 'avengers' : 'albuquerque';
  models.push({ title, author, authorUrl: authorUrl(author), license: 'CC-BY-4.0', licenseUrl: LICENCE_URL['CC-BY-4.0'], source, where, as: rest.replace(/\.$/, '') || title });
}
// (a name with nothing to read in it goes by the handle in the artist's address)
for (const m of models) if (!/[\p{L}\p{N}]/u.test(m.author) && m.authorUrl) m.author = m.authorUrl.split('/').pop();
const artists = [...new Map(models.map((m) => [m.author, m.authorUrl ?? authorUrl(m.author)])).entries()].sort((a, b) => a[0].localeCompare(b[0], 'en', { sensitivity: 'base' }));

// ── CC0 scans, skies and kits ──
const cc0 = [];
for (const file of ['public/games/credits.json', 'public/games/caribbean/credits.json']) {
  for (const a of Object.values(await json(file))) if (/CC0/.test(a.license)) cc0.push({ name: a.name, source: a.source, by: a.authors.join(', ') });
}
for (const [, kind, name, from, url, by] of (await read('public/hq/CREDITS.md')).matchAll(/^\| (\w+) \| ([^|]+) \| \[([^\]]+)\]\(([^)]+)\) \| ([^|]+) \|$/gm)) {
  // (the same pipeline makes the Mario 64 tribute's sets, named m64-)
  const where = name.trim().startsWith('m64-') ? 'Super Mario 64' : 'Avengers HQ';
  cc0.push({ name: `${name.trim()} (${kind.toLowerCase()}, ${where})`, source: url, by: by.trim(), from });
}
// Quaternius's kits, where the galaxy uses them (public/cc0/README.md's line for the ground cover and far trees)
if (/models\/galaxy\/surface\/\{qfern/.test(cc0Readme)) cc0.push({ name: "Stylized Nature MegaKit (the galaxy's ground cover and far trees)", source: 'https://quaternius.com', by: 'Quaternius' });
// textures shared alike, and textures used with their owners' permission (the Minecraft tribute's): by name, owner and use
const shareAlike = Object.values(await json('public/games/credits.json')).filter((a) => /BY-SA/.test(a.license));
const permittedTextures = Object.values(await json('public/games/credits.json')).filter((a) => /permission/i.test(a.license));
const site = (url) => (/polyhaven/.test(url) ? 'Poly Haven' : /ambientcg/.test(url) ? 'ambientCG' : /kenney/.test(url) ? 'Kenney' : /quaternius/.test(url) ? 'Quaternius' : new URL(url).hostname);
const cc0Unique = [...new Map(cc0.map((a) => [`${a.source}|${a.name}`, a])).values()];
const kenney = cc0Unique.filter((a) => site(a.source) === 'Kenney');
// (Quaternius's kits: the planet landings' trees, rocks and street furniture, scripts/quaternius.mjs)
const quaternius = cc0Unique.filter((a) => site(a.source) === 'Quaternius');
const scans = cc0Unique.filter((a) => !['Kenney', 'Quaternius'].includes(site(a.source))).sort((a, b) => site(a.source).localeCompare(site(b.source)) || a.name.localeCompare(b.name));
const cc0People = [...new Set(scans.flatMap((a) => a.by.split(/,\s*/)))].filter((p) => p !== 'ambientCG').sort();

// the kit's packs (public/kit/<pack>/, scripts/kit/README.md), each from its
// manifest: who made it and its title from `source` ('Quaternius, Ultimate
// Space Kit (https://quaternius.com)'), its licence, how many models it has
async function kits() {
  const dirs = await readdir(join(ROOT, 'public/kit'), { withFileTypes: true }).catch(() => []);
  const out = [];
  for (const pack of dirs.filter((d) => d.isDirectory()).map((d) => d.name).sort()) {
    const m = await json(`public/kit/${pack}/index.json`);
    const [, by = m.source, title = pack, url] = m.source.match(/^([^,]+), (.+) \((https?:[^)]+)\)$/) ?? [];
    out.push({ pack, by, title, url, licence: m.licence, models: Object.keys(m.models).length });
  }
  return out;
}
const and = (list) => (list.length < 2 ? list.join('') : `${list.slice(0, -1).join(', ')} and ${list.at(-1)}`);
// one line a maker of the CC0 ones: each pack and its model count
const kitsBy = new Map();
for (const k of await kits()) if (k.licence === 'CC0-1.0') kitsBy.set(k.by, [...(kitsBy.get(k.by) ?? []), k]);
const kitLines = [...kitsBy].map(
  ([by, list]) =>
    `**Kits:** ${link(by, list[0].url)}'s ${and(list.map((k) => `*${k.title}* (${k.models} models)`))}, under [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/): trees, plants, rocks, space props and farm animals for the worlds, in [\`public/kit\`](public/kit) (brought in by [\`scripts/kit/import.mjs\`](scripts/kit/README.md)).`,
);

// ── photos ──
const photos = Object.values(PHOTOS)
  .filter((p) => p.credit)
  .map((p) => p.credit)
  .filter((c, i, all) => all.findIndex((d) => d.source === c.source) === i)
  .sort((a, b) => a.author.localeCompare(b.author));

// ── fonts ──
const pkg = await json('package.json');
const FONT_NAMES = { 'archivo': 'Archivo', 'bebas-neue': 'Bebas Neue', 'cinzel': 'Cinzel', 'cinzel-decorative': 'Cinzel Decorative', 'courier-prime': 'Courier Prime', 'jetbrains-mono': 'JetBrains Mono', 'luckiest-guy': 'Luckiest Guy', 'news-cycle': 'News Cycle', 'orbitron': 'Orbitron', 'press-start-2p': 'Press Start 2P', 'yatra-one': 'Yatra One', 'noto-sans-runic': 'Noto Sans Runic' };
const fonts = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies })
  .filter((d) => d.startsWith('@fontsource'))
  .map((d) => d.replace(/^@fontsource(-variable)?\//, ''))
  .map((id) => FONT_NAMES[id] ?? id)
  .sort();

const contact = `[${profile.email}](mailto:${profile.email}) or [LinkedIn](${profile.linkedin.url})`;
const md = [];
md.push(
  '# Credits',
  '',
  `[tilakpatell.com](${profile.site}) is built on a lot of other people's work: ${models.length} 3D models from ${artists.length} artists on Sketchfab, ${cc0Unique.length} free scans, skies and kit pieces, ${photos.length} photos, open fonts and public data. Thank you, all of you.`,
  '',
  `> **Made something here and I've missed you, got your name wrong, or you'd like it taken down?** Message me at ${contact} and I'll fix it straight away, or open a pull request.`,
  '',
  "Everything here is credited on the page that uses it too. This file is made by `npm run credits` (`scripts/credits.mjs`) from the same lists the site reads, so it can't fall out of step with them.",
  '',
  '## Contents',
  '',
  '- [3D models from Sketchfab](#3d-models-from-sketchfab)',
  ...(permitted.length ? ['- [Models used with permission](#models-used-with-permission)'] : []),
  ...(shareAlike.length ? ['- [Textures shared alike](#textures-shared-alike)'] : []),
  ...(permittedTextures.length ? ['- [Textures used with permission](#textures-used-with-permission)'] : []),
  '- [Scans, skies and kits (CC0)](#scans-skies-and-kits-cc0)',
  '- [Photos](#photos)',
  '- [Fonts](#fonts)',
  '- [Data and imagery](#data-and-imagery)',
  '- [Sound](#sound)',
  '- [Made for this site](#made-for-this-site)',
  '',
  '## 3D models from Sketchfab',
  '',
  `Each one is its artist's, used under the Creative Commons licence it's published with, and brought down to web size (textures resized and re-encoded, meshes simplified and compressed) by the import scripts in \`scripts/\`. None of them is changed beyond that, except where it says.`,
  '',
  `**The artists:** ${artists.map(([name, url]) => `[${name}](${url})`).join(' · ')}`,
  '',
);
for (const [id, label] of WORLDS) {
  const list = models.filter((m) => m.where === id).sort((a, b) => a.title.localeCompare(b.title));
  if (!list.length) continue;
  md.push(`### ${label}`, '', '| Model | Artist | Licence | On the site |', '| --- | --- | --- | --- |');
  for (const m of list) md.push(`| ${link(m.title, m.source)} | ${link(m.author, m.authorUrl ?? authorUrl(m.author))} | ${link(licence(m.license), m.licenseUrl ?? LICENCE_URL[m.license])} | ${cell(m.as)} |`);
  md.push('');
}
if (permitted.length) {
  md.push('## Models used with permission', '', `${permitted[0].permission}`, '', '| Model | Author | On the site |', '| --- | --- | --- |');
  for (const m of permitted.sort((a, b) => a.title.localeCompare(b.title))) md.push(`| ${link(m.title, m.source)} | ${link(m.author, m.authorUrl)} | ${cell(m.as)} |`);
  md.push('');
}
if (permittedTextures.length) {
  md.push('## Textures used with permission', '', 'Not the site’s, and not free to reuse: shown here by their owners’ leave.', '', '| Textures | By | On the site |', '| --- | --- | --- |');
  for (const a of permittedTextures) md.push(`| ${link(a.name, a.source)} | ${cell(a.authors.join(', '))} | ${cell(a.use)} |`);
  md.push('');
}
if (shareAlike.length) {
  md.push('## Textures shared alike', '', 'Used under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/); what the site builds from them is shared under the same licence.', '', '| Texture pack | By | On the site |', '| --- | --- | --- |');
  for (const a of shareAlike) md.push(`| ${link(a.name, a.source)} | ${cell(a.authors.join(', '))} | ${cell(a.use)} |`);
  md.push('');
}
md.push(
  '## Scans, skies and kits (CC0)',
  '',
  `Public domain, so no credit is needed, but they deserve it. From [Poly Haven](https://polyhaven.com) (${cc0People.join(', ')}), [ambientCG](https://ambientcg.com), [Kenney](https://kenney.nl), whose kits make up *Portal panic* and more (${kenney.length} pieces), and [Quaternius](https://quaternius.com), whose trees, rocks, flowers and street furniture stand about the planets you land on (${quaternius.length} pieces). The lists by game are in [\`public/games/credits.json\`](public/games/credits.json), [\`public/hq/CREDITS.md\`](public/hq/CREDITS.md) and [\`public/cc0/README.md\`](public/cc0/README.md).`,
  '',
  ...kitLines.flatMap((l) => [l, '']),
  '<details>',
  `<summary>All ${scans.length} scans and skies</summary>`,
  '',
  '| Asset | From | By |',
  '| --- | --- | --- |',
  ...scans.map((a) => `| ${link(a.name, a.source)} | ${site(a.source)} | ${cell(a.by)} |`),
  '',
  '</details>',
  '',
  '## Photos',
  '',
  'The Travel page and the backdrops behind some of the pages use these, each credited where it appears. My own photos are mine.',
  '',
  '<details>',
  `<summary>All ${photos.length} photos</summary>`,
  '',
  '| Photo | By | Licence |',
  '| --- | --- | --- |',
  ...photos.map((c) => `| ${link(c.title ?? 'Photo', c.source)} | ${cell(c.author)} | ${link(c.license, c.licenseUrl)} |`),
  '',
  '</details>',
  '',
  '## Fonts',
  '',
  `${fonts.join(', ')}: open fonts (SIL Open Font License), through [Fontsource](https://fontsource.org). Aurebesh is by [SilvinoR](https://github.com/silvinor) (SIL OFL), in [\`public/fonts/aurebesh\`](public/fonts/aurebesh/OFL.md); the other faces in [\`public/fonts\`](public/fonts) carry their own licences beside them.`,
  '',
  '## Data and imagery',
  '',
  "- **Earth's globe:** NASA Earth Observatory's Blue Marble Next Generation, Black Marble 2016, cloud and GEBCO images (public domain).",
  "- **The universe map's planets and sun:** [Solar System Scope](https://www.solarsystemscope.com/textures/)'s maps (CC BY 4.0), recoloured for Music's and Marvel's gas giants and laid under the Death Star's plates. The other fandoms' planets (Middle-earth from Tolkien's own map, New Mexico, the Caribbean, C-137, the Office's crumpled letterhead) are made in code by `scripts/build-fandom-planets.mjs`.",
  "- **The universe map's Milky Way:** [ESO/S. Brunier](https://www.eso.org/public/images/eso0932a/)'s all-sky panorama (CC BY 4.0), its stars taken out for the sky's own (`scripts/bake-universe-sky.mjs`).",
  "- **The Travel page's dotted globe:** Natural Earth's 1:50m country outlines (public domain), via [world-atlas](https://github.com/topojson/world-atlas).",
  '- **The GitHub snapshot on the home page:** GitHub\'s public API, read at build time.',
  '',
  '## Sound',
  '',
  "The short clips from the films and shows belong to their studios; where each came from is in [`public/audio/clips/README.md`](public/audio/clips/README.md). The ships' engines are listed in [`public/audio/engines/README.md`](public/audio/engines/README.md), Kenney's [Sci-Fi Sounds](https://kenney.nl/assets/sci-fi-sounds) (CC0) among them.",
  '',
  '## Made for this site',
  '',
  "The worlds' own characters, buildings and props (the Albuquerque town and its people, the Caribbean's ships, Middle-earth's places, Mark Grayson and more) were made for this site with [Meshy](https://www.meshy.ai), or modelled in code. The task behind each one is recorded next to it (`scripts/*-tasks.json`, `public/games/credits.json`).",
  '',
  '---',
  '',
  `Missed someone? ${contact}, or a pull request. Thank you.`,
  '',
);
await writeFile(join(ROOT, 'CREDITS.md'), md.join('\n'));

// and the README's thank-you: the counts and every artist, between its markers
const between = (text, name, body) => text.replace(new RegExp(`(<!-- ${name}:start -->)[\\s\\S]*?(<!-- ${name}:end -->)`), `$1${body}$2`);
let readme = await read('README.md');
readme = between(readme, 'counts', `${models.length} 3D models by ${artists.length} artists, ${cc0Unique.length} free scans, skies and kit pieces, ${photos.length} photos and ${fonts.length} open fonts`);
readme = between(readme, 'artists', `\n${artists.map(([name, url]) => `[${name}](${url})`).join(' · ')}\n`);
await writeFile(join(ROOT, 'README.md'), readme);
console.log(`CREDITS.md: ${models.length} models by ${artists.length} artists, ${cc0Unique.length} CC0 assets, ${photos.length} photos, ${fonts.length} fonts`);
