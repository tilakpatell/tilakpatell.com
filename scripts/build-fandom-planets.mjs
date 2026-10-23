// Bakes the universe map's fandom planets' maps into public/textures/universe/
// (scripts/planets/: one baker a planet, on the shared kit in sphere.mjs).
//
//   node scripts/build-fandom-planets.mjs               every planet
//   node scripts/build-fandom-planets.mjs middleearth   just the ones named
//   node --max-old-space-size=12288 scripts/build-fandom-planets.mjs --ultra [names]
//                                                      the 8192 colour maps
//                                                      (-8k.ktx2) worn near at ultra
//
// Every one is made from nothing but code (Marvel's Earth-616 traces Natural
// Earth's coasts, from the world-atlas package, and wears the real Earth's
// night lights, from the map's own earth-night-hq.webp).

const ALL = ['middleearth', 'breakingbad', 'caribbean', 'rickmorty', 'office', 'potter', 'music', 'marvel'];
const args = process.argv.slice(2);
// (--ultra: sphere.mjs reads it before any baker is loaded)
if (args.includes('--ultra')) process.env.PLANETS_8K = '1';
const named = args.filter((a) => !a.startsWith('--'));
const want = named.length ? named : ALL;
for (const id of want) {
  if (!ALL.includes(id)) throw new Error(`no baker for ${id} (there are: ${ALL.join(', ')})`);
  const t = Date.now();
  const { bake } = await import(`./planets/${id}.mjs`);
  await bake();
  console.log(`${id}: ${((Date.now() - t) / 1000).toFixed(1)} s`);
}
