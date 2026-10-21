// The galaxy's cities' houses (galaxy/surface/sites/city.js fills a city's
// streets with them): the buildings a city has many of, beside the one
// landmark scripts/meshy-galaxy-worlds.mjs made for it, so Coronet City is
// streets of tenements round its shipyard tower and not one tower on a
// field. Made by scripts/meshy-galaxy-buildings.mjs like its own and in its
// format (that script's header has the fields); each drawn from words
// first, as a whole street of one picture would come out flat. Light
// enough to stand by the dozen (20,000 triangles, 1K maps), a light copy
// beside each. Their tasks go in scripts/meshy-galaxy-cities-tasks.json
// (MESHY_TASKS), made on the account whose key is MESHY_API_KEY_ACC_3.
//
//   MESHY_API_KEY=$MESHY_API_KEY_ACC_3 MESHY_TASKS=scripts/meshy-galaxy-cities-tasks.json MESHY_REVIEW=lab/meshy/cities node scripts/meshy-galaxy-buildings.mjs <step> <kind …>

// one drawn from words first (the script adds the look and the shot)
const house = (prompt, metres, along, more = {}) => ({ prompt, metres, along, tris: 20000, tex: 1024, ...more });

export const BUILDINGS = {
  // Corellia, Coronet City: its old stone tenements and its shopfronts
  coronetblock: house('A four-storey tenement block of an old shipbuilding city: weathered tan sandstone and grey ferrocrete, rows of small square windows with metal shutters, a ground-floor arcade of shopfronts under a metal awning, rooftop vents, pipes and an antenna, grimy and industrial.', 20, 'h'),
  coronetshop: house('A two-storey shop building of an old shipbuilding city: a stone ground floor with a wide shop window and a roll-up metal door, a metal-clad upper floor with a small balcony, hanging cables and a glowing sign of abstract alien glyphs (no letters), worn spacer-port style.', 10, 'h'),
  // Ord Mantell, Worlport: a junk world's tenements and its market hall
  worlportblock: house('A three-storey tenement of a junk-world city: walls patched from scrap hull plates and rusted metal panels over a stone base, mismatched windows, external ladders and walkways, hanging cables, rust and grime.', 16, 'h'),
  worlportmarket: house('A low covered market hall of a junk-world city: a long arched roof of corrugated rusted metal on steel posts, open sides with stalls and crates under it, hanging lamps, scrap and grime.', 22, 'w'),
  // Vardos, Kestro City: a neat old capital's town houses
  kestrohouse: house('A three-storey town house of a neat, wealthy old capital: smooth pale cream stone walls, tall narrow arched windows, a steep slate-blue roof with dormers, an ornate cornice, a grand front door with steps.', 16, 'h'),
  // Utapau, Pau City: the Pau'ans' rounded dwellings
  pauhouse: house('A rounded dwelling standing free on flat ground: stacked bulbous bone-white plaster domes, each narrower than the one below, small round windows, a ledge by its round door, weathered pale stone, nothing behind it.', 14, 'h'),
  // Mygeeto: the crystal city's blocks
  mygeetoblock: house('A tall faceted city block of a frozen crystal city: angled panels of glowing pale blue crystal set in dark grey metal frames, sharp crystalline spires on its top, frost on its ledges.', 40, 'h'),
  // Cato Neimoidia: a bridge city's residences
  catohab: house('A rounded residence of a rich merchant city: a curved shell-shaped hall of smooth olive-grey stone with gold trim, big oval windows, a domed roof, elegant and wealthy.', 16, 'h'),
  // Jedha, the Holy City: its sandstone houses and towers
  jedhahouse: house('A small house of an ancient desert pilgrim city: rough sandstone blocks, a flat roof with a small dome, faded cloth awnings over its windows, wooden beams jutting out of the walls, weathered and dusty.', 9, 'h'),
  jedhatower: house('A stepped tower of an ancient desert pilgrim city: three tiers of rough sandstone blocks, each smaller than the one below, arched windows, faded red cloth banners, weathered and dusty.', 22, 'h'),
  // Plazir-15: the city's white villas
  plazirvilla: house('A white villa of a bright, clean utopian city: smooth white walls in rounded art-deco curves, round windows, pale gold trim, terraces with potted plants.', 12, 'h'),
  // Kafrene: the trading post's habitation blocks
  kafreneshack: house('A grimy habitation block of an asteroid mining outpost: stacked cargo containers and metal modules joined by pipes and catwalks, small lit windows, vents and ducts, grime and rust.', 14, 'h'),
  // Trask: the harbour's fishing halls
  traskhall: house('A harbour fishing hall of a misty estuary town: grey weathered stone walls, a steep dark timber roof, big doors open onto a quay, nets, barrels and crates along its walls.', 18, 'w'),
  // Lothal, Capital City: the Empire's blocks
  lothalblock: house('An imperial city block of a frontier capital: grey ferrocrete with horizontal bands of dark windows, a squat round tower at one corner, two plain red stripes, no emblems, clean and oppressive.', 24, 'h'),
};
