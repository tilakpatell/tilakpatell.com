# Weather in the galaxy: does it still fit a static site, and what the best games and sites do

Date: 2026-10-06. A spike, not a design: the question was whether adding real weather patterns to the Star Wars worlds means leaving GitHub Pages, and what to borrow from games and weather sites. The answer is in the first section; the rest is the evidence.

## Stay static

Nothing weather needs a server for. The site already solves the hard part, shared state without a backend, three ways, and weather uses the same three:

1. **A seeded function of the wall clock.** `galaxy/gcw.js` runs the whole Galactic Civil War as `history(n, ms)`: every browser computes the same fronts from the same clock and the same seed, and no message is sent. Weather is the same shape: `weatherAt(systemId, ms)` from noise seeded by the system and the hour gives every pilot online the same sandstorm at the same minute, tested in Node, with zero network. This is the backbone.
2. **A public API fetched from the browser.** Open-Meteo needs no key, allows cross-origin requests, has no ads or cookies, and is free for non-commercial use up to about 10,000 calls a day ([open-meteo.com](https://open-meteo.com/), [API Bouncer's guide](https://apibouncer.com/guides/build-weather-dashboard), [public-api.org](https://public-api.org/api/1412/open-meteo)). That is the same kind of call `FindMeOnline.jsx` already makes to GitHub. Each planet has a real filming location, so Hoth can have Finse's weather today. Cache an hour in `sessionStorage`; when the fetch fails, the seeded weather carries on and nobody notices.
3. **Nostr, only for what a player caused.** A storm someone called down, if that ever becomes a feature, travels like the siege's damage does (`universe/tally.js`). Not needed for the first three tiers below.

A server would only earn its keep for secrets (a paid weather key), persistence while nobody is online (the tally's floor already covers that), or anti-cheat. None apply. The cost of staying static is the one Flight Simulator pays too: live weather is a forecast model, not a sensor, and it changes on the model's schedule, so it should be labelled as live and blended, never promised to the minute.

## What's here already

`surface/weather.js` draws seven kinds of particle (sand, snow, rain, ash, embers, motes, spray) in a box that rides the camera, one GPU clock, 45% of the count on a phone. Each site declares a fixed list (`site.weather`), a fixed fog, a sky dome with a cloud `cover`, a ground `wind` angle, and Kamino alone has `lightning: { every, strength }` flashing the dome and the hemisphere light. From orbit, every planet body already takes `clouds.cover` (`bodies.js`). Reduced motion drops the particles entirely.

So the pieces exist; what is missing is *time* (nothing changes), *consequence* (nothing reacts to it), and *visibility from afar* (you can't see a storm coming). Those three gaps are exactly what the games below are good at.

## What the best games do with weather

| Game | What it does | The lesson for the galaxy |
|---|---|---|
| Breath of the Wild | Weather changes every four in-game hours per region. Rain makes climbing slip, lightning strikes metal, fire spreads in dry wind, and the team chose not to let the player control it: "Link against nature" was more fun ([Zelda Wiki](https://zelda.fandom.com/wiki/Weather), [Zelda Dungeon on Fujibayashi](https://www.zeldadungeon.net/?p=128905)). | Weather is a clock-driven state, per planet, that other systems read. Give it at least one consequence per planet. Never a weather button. |
| Ghost of Tsushima | The wind is the compass: it blows toward the objective, moving grass, cloth, leaves and hundreds of thousands of particles ("vorticles") ([GDC 2021](https://gdconf.com/news/see-how-ghost-tsushima’s-guiding-wind-came-life-gdc-2021), [Game Developer](https://gamedeveloper.com/design/using-vorticles-to-simulate-wind-in-i-ghost-of-tsushima-i-)). | Wind that points at the nearest quest, and bends foliage, cloaks and the sand streaks, replaces a HUD marker. The sites already carry a `wind` angle; it should move. |
| Sea of Thieves | The storm is one big physical thing roaming the map. You see it from far off, choose to go through or around, and inside it the bell rings, the compass spins and the wheel pulls ([wiki](https://seaofthieves.wiki.gg/wiki/Storm), [TheSixthAxis](https://www.thesixthaxis.com/2017/07/10/the-storms-in-sea-of-thieves-look-incredible)). | Weather must be visible before you land: a storm band on the planet from orbit, a mark on the holotable. Instruments react: the cockpit shakes, the HUD fuzzes. |
| Death Stranding | Timefall is rain with a cost; it changes which route you take ([GameSpot](https://www.gamespot.com/articles/death-stranding-timefall-guide-how-weather-works-a/1100-6471005)). | One planet with weather that costs something: Mustafar's ashfall blinds the landing, Hoth's blizzard grounds the ship until it passes. |
| Red Dead Redemption 2 | Weather by region and time of day; temperature changes what you wear ([GamesHorizon](https://gameshorizon.com/features/10-open-world-games-with-realistic-weather-effects/)). | A climate table per planet, not one shared dice roll. Tatooine never snows; Kamino is never dry. |
| No Man's Sky | Storms are survival hazards with a warning and a shelter mechanic; VFX per hazard type ([Sean Cruz's VFX breakdown](https://seancruz.artstation.com/projects/VdENA5)). | A "storm incoming" line from the crew before it hits; shelter (a hut, the ship) as the answer. |
| Microsoft Flight Simulator | Live weather from Meteoblue's forecast model, blended with hourly airport METARs ([meteoblue](https://www.meteoblue.com/uk/blog/article/news?page=11), [forum analysis](https://forums.flightsimulator.com/t/discussion-is-this-how-msfs-combines-mb-forecast-and-metar/313223)). | Real weather makes a world feel alive even when it's calm. Label it as live and name the place. |
| Battlefront II (DICE), Outlaws | Hoth in day and dusk variants; Jakku with sandstorms and shifting terrain; Toshara as "a savanna moon shaped by strong winds" ([Battlefront wiki](https://battlefront.fandom.com/wiki/File:Hoth-tile-lg_(1).jpg), [PlayStation](https://www.playstation.com/en-us/games/star-wars-outlaws/)). | Star Wars weather is canon: Hoth's night cold, Tatooine's sandstorm (the Mos Eisley one), Kamino's permanent storm, Dagobah's fog. Use the films' own set pieces as the weather events. |

## What the best weather sites do

- **earth.nullschool.net** draws global wind as line-integral-convolution streamlines over a globe: brightness is wind strength, the lines follow the flow ([Cool Infographics](https://coolinfographics.com/blog/2017/7/31/earth-a-visualization-project.html)). **Windy** does the same with flowing particles over NOAA data, updated four times daily. The lesson for the holotable: a wind-flow layer over the galaxy map, streamlines in the war's colours, is one shader and reads as alive at a glance.
- **Apple Weather** (since iOS 15) has thousands of animated backgrounds keyed to sun position, cloud and precipitation, and notifies when rain starts and stops ([TechCrunch](https://techcrunch.com/?p=2162347), [MacRumors](https://www.macrumors.com/guide/ios-15-weather-app/amp)). The lesson: the system card on the holotable should show the planet's weather now and the next change ("sandstorm clearing in 12 min"), and the sky's sun should move.

## Techniques worth using (all WebGL, all in the stack)

- Volumetric-looking clouds in the dome by weather-driven density and cover (the dome already samples noise; cover becomes a uniform that moves).
- Real lightning geometry, not only a flash: three.js ships `LightningStrike` in its examples (`webgl_lightningstrike`); thunder delayed by distance.
- Wet ground: darken the palette and drop roughness with rain intensity; snow accumulates by lerping the ground palette toward white over a blizzard's length.
- On the visor: frost at the edges on Hoth, dust on Tatooine, droplets on Kamino, driven by intensity, faded on a phone.
- Sound: wind, rain and thunder as gains on the surface's audio, scaled by intensity (the runtime already has a gain per module).
- Accessibility and tiers: reduced motion keeps the colour and fog changes and drops the particles, as now; `low` tier halves counts again.

## Recommended shape, in tiers

Each tier ships on its own and is worth having alone.

1. **Weather as state.** A pure `galaxy/weather.js` beside `gcw.js`: a climate table per system (kinds and their odds), and `weatherAt(id, ms)` returning `{ kind, intensity 0..1, wind: { dir, speed }, cover, visibility, lightning, next }` from seeded noise over the wall clock, with transitions over a minute or two so nothing pops. Tests in Node. The surface and the orbit read it; `site.weather` becomes the planet's possible weather, not its fixed weather. `surface/scene.js` is at 2,089 lines, over the 1,500 ceiling in `docs/health/RULES.md`, so the driver that applies the state (particles, fog, sky cover, light, wind) goes in a new `surface/climate.js`, not into the scene.
2. **Weather you feel.** Sky cover, fog, sun strength and the hemisphere light follow intensity; the wind angle rotates and bends the sand streaks, snow drift and foliage; lightning gets geometry and thunder; one consequence per planet (Hoth: no take-off in a blizzard; Tatooine: a sandstorm halves speeder visibility; Kamino: lightning hits the mast; Mustafar: ashfall dims the landing lights). The crew says it's coming.
3. **Weather you see from space.** `bodies.js`'s `clouds.cover` and a storm band follow the same state, so the planet looks stormy before the dive; the holotable's system card shows now and next, and a wind-flow layer over the map.
4. **Live weather from Earth.** Open-Meteo at each planet's filming location, fetched once an hour from the browser and blended in as a nudge on the seeded state, shown in the card as "Live from Finse, Norway". Falls back silently.

### Filming locations to key live weather on

| System | Place on Earth | Lat, lon | Note |
|---|---|---|---|
| Tatooine | Tozeur / Chott el Djerid, Tunisia | 33.92, 8.13 | Mos Espa set; Matmata is the Lars homestead |
| Hoth | Finse (Hardangerjøkulen glacier), Norway | 60.60, 7.50 | The Battle of Hoth |
| Endor | Redwood National Park, California | 41.21, −124.00 | The forest moon |
| Yavin 4 | Tikal, Guatemala | 17.22, −89.62 | The rebel base temples |
| Scarif | Laamu Atoll, Maldives | 1.93, 73.53 | Rogue One's beaches |
| Mustafar | Mount Etna, Sicily | 37.75, 14.99 | The lava plates |
| Naboo | Lake Como (Villa del Balbianello), Italy | 45.96, 9.20 | Varykino; Seville's Plaza de España for Theed |
| Kashyyyk | Phuket / Phang Nga Bay, Thailand | 8.27, 98.50 | The Wookiee coast plates |
| Geonosis | Chott el Djerid, Tunisia | 33.70, 8.40 | The desert plates; share Tatooine's cell |
| Dagobah, Kamino, Bespin, Coruscant | Studio sets | | Keep the seeded weather; Kamino is always a storm by canon |
| Nevarro | Vasquez Rocks region, California | 34.49, −118.32 | Volcanic plains stand-in |
| Mandalore, Lothal, Sorgan | Studio (the Volume) | | Seeded only |

Coordinates are to be checked against a reliable filming-locations list before they ship ([Reader's Digest's list](https://www.readersdigest.co.nz/culture/19-star-wars-filming-locations-you-can-actually-visit), [Fox's eight real locations](https://www.fox35orlando.com/news/visit-the-star-wars-sagas-most-iconic-places-at-these-8-real-world-locations)).

## Sources

- Open-Meteo: [open-meteo.com](https://open-meteo.com/), [API Bouncer guide](https://apibouncer.com/guides/build-weather-dashboard), [API Bouncer listing](https://www.apibouncer.com/apis/1168/open-meteo), [public-api.org](https://public-api.org/api/1412/open-meteo).
- Breath of the Wild: [Zelda Wiki: Weather](https://zelda.fandom.com/wiki/Weather), [Zelda Dungeon: player-controlled weather considered](https://www.zeldadungeon.net/?p=128905), [Zelda Universe](https://zeldauniverse.net/2018/02/19/rain-rain-go-away-breath-of-the-wild-devs-considered-player-controlled-weather-system/).
- Ghost of Tsushima: [GDC 2021 guiding wind](https://gdconf.com/news/see-how-ghost-tsushima’s-guiding-wind-came-life-gdc-2021), [Game Developer: vorticles](https://gamedeveloper.com/design/using-vorticles-to-simulate-wind-in-i-ghost-of-tsushima-i-), [VFX Voice](https://vfxvoice.com/creating-the-way-of-the-warrior-for-ghost-of-tsushima/).
- Sea of Thieves: [Storm](https://seaofthieves.wiki.gg/wiki/Storm), [Weather](https://seaofthieves.wiki.gg/wiki/Weather), [TheSixthAxis](https://www.thesixthaxis.com/2017/07/10/the-storms-in-sea-of-thieves-look-incredible).
- Death Stranding: [GameSpot timefall guide](https://www.gamespot.com/articles/death-stranding-timefall-guide-how-weather-works-a/1100-6471005).
- Red Dead Redemption 2 and others: [GamesHorizon](https://gameshorizon.com/features/10-open-world-games-with-realistic-weather-effects/), [TheGamer](https://www.thegamer.com/games-with-dynamic-weather-effects-storms-lighting/).
- No Man's Sky: [Sean Cruz, weather VFX](https://seancruz.artstation.com/projects/VdENA5).
- Flight Simulator: [meteoblue](https://www.meteoblue.com/uk/blog/article/news?page=11), [MSFS forum on blending](https://forums.flightsimulator.com/t/discussion-is-this-how-msfs-combines-mb-forecast-and-metar/313223).
- Battlefront and Outlaws: [Battlefront wiki, Hoth](https://battlefront.fandom.com/wiki/File:Hoth-tile-lg_(1).jpg), [PlayStation: Star Wars Outlaws](https://www.playstation.com/en-us/games/star-wars-outlaws/).
- Weather sites: [earth.nullschool, Cool Infographics](https://coolinfographics.com/blog/2017/7/31/earth-a-visualization-project.html), [TechCrunch on Apple Weather](https://techcrunch.com/?p=2162347), [MacRumors iOS 15 Weather](https://www.macrumors.com/guide/ios-15-weather-app/amp).
- Filming locations: [Reader's Digest](https://www.readersdigest.co.nz/culture/19-star-wars-filming-locations-you-can-actually-visit), [Fox 35](https://www.fox35orlando.com/news/visit-the-star-wars-sagas-most-iconic-places-at-these-8-real-world-locations).
