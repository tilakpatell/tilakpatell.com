# Why Bruno's folio looks clean and the universe map doesn't yet: an audit

Date: 2026-10-08. The owner's ask: the universe map and the hero ships have had their visual upgrade (`docs/superpowers/HANDOFF-universe.md`: nine checkpoints merged, scored 2.5 to 3 on the scorecard) and still don't have the *cleanliness* of Bruno Simon's folio-2025 (`https://github.com/brunosimon/folio-2025`, bruno-simon.com). What is the difference, exactly, and which of it is assets, which is rendering, and which is composition?

Read: the two earlier notes on his work (`2026-10-06-bruno-simon-folio.md`, `2026-10-08-folio-2025-physics-terrain-streaming.md`, which quote his `MeshDefaultMaterial`, `Rendering.js` and palette), his share image (`static/social/share-image.png`, 1200 × 630), the site's `docs/readme/{hero,universe,galaxy-hero,destroyer}.webp` and the `lab/universe/baseline/high/` poses, and the code: `universe/post.js`, `skyShader.js`, `starField.js`, `landmarks.js`, `belt.js`, `lighting.js`, `livery.js`, `shipModels.js`, `hulls.js`, `flight.js`, `scene.js`'s `chaseView`, `lib/three/gltf.js`'s `SHIP_PROFILE`, and the hero GLBs inspected with gltf-transform.

## The short answer

It is not the assets, and it is not the renderer. The site has more rendering than he does (HDR, bloom, blue-noise dither, flares, eased exposure, real atmospheres, a lens round a black hole). The difference is **discipline in four places that his whole picture obeys and ours doesn't**:

1. **Frequency.** Nothing in his frame has detail finer than about four pixels. Ours has sub-pixel detail everywhere: 12,000 stars on a sky baked at 1536 to 2048 pixels a face with a "grain of light" noise term cubed into the band, 1024² photo-textured hulls drawn 150 pixels wide, pitted-rock noise on asteroids 6 pixels across. Sub-pixel detail reads as noise, and noise reads as dirt.
2. **Value structure.** His picture has three values: a bright ground, mid objects, one deep saturated shadow (median luminance 0.51, nothing under 0.05). Ours is dark with everything else in the middle: the home map's median is 0.03 and the ship, the planets' lit sides and the nebulae all sit between 0.15 and 0.5. Where a nebula or the galaxy's fog is in frame the dark goes too (`galaxy-hero.webp`: 0.4 % of pixels under 0.02). There is rarely a clean light and often no clean dark, so nothing has an edge.
3. **Palette.** He has one: a 128 × 4 palette texture every mesh samples, one shadow colour, one fog colour that is also the background. We have the Milky Way's photo colours, each planet's own, each fandom's own, the HD ships' photo albedo, a cyan engine, a blue nebula. Each is fine; together they are nine hues in one frame.
4. **Hero scale and contrast.** His car is about 35 % of the frame's width, red on a pink-orange ground, with hard black tyres and bright yellow lamps: the highest-contrast object in the picture. Our Falcon is 11 % of the frame's width at cruise (8 % boosting), grey-brown on blue-grey, lit at 2.35 by a star whose key direction is often behind it, with a 0.35 rim. It is the lowest-contrast object in the picture.

Everything below is the evidence and the numbers behind those four.

## His picture, measured from his repo

| what | his |
| --- | --- |
| materials | one `MeshDefaultMaterial` (TSL); `colorNode` from a 128 × 4 nearest-filtered palette; Lambert bypassed |
| shading | `outputColor = base × light; mix(outputColor, base × shadowColour, max(coreShadow, dropShadow, mask))`; core shadow `smoothstep(1, −0.25, n·l)` (deliberately wide: half the object is in the shadow colour) |
| shadow colour | `#6d3fff` day, `#4e009c` dusk, `#2f00db` night, `#db004f` dawn: saturated, never grey |
| bounce | under-facing fragments within 1.5 m take the terrain colour: `bounceOrientation × ((1.5 − y) / 1.5)²` |
| fog | `rangeFogFactor(near, far)` to a two-colour screen-radial gradient that is also `scene.backgroundNode`: the far edge of the world *is* the background |
| sky | none: the fog gradient |
| post | `cheapDOF` (a hash blur, tilt-shift by `smoothstep(0.2, 0.5, |v − 0.5|)`) + bloom threshold 1, strength 0.25, 5 mips; **no tone mapping**; pixel ratio capped at 2, MSAA under 2 |
| geometry | low-poly Blender, 266 meshes, draco + ETC1S; 94 k triangles in the 2019 static set |
| hero | the car is ~0.35 of the frame width from a fixed high three-quarter at FOV 40; red body, black tyres, yellow lamps, two blue-white lights under |
| frequency | palette texels are flat colour: zero texture detail; the grass is one-triangle blades 4 to 8 px tall; the DOF blurs the top and bottom thirds |

The whole thing is one shading model, one palette, one fog, and a lens that throws away the fine detail at the edges. "Clean" is that.

## Ours, measured

### The hero ship

| what | ours |
| --- | --- |
| model | `public/models/sketchfab/falcon-hd.glb`: 60,050 triangles, 6 materials, 9 textures (seven 1024², all photo-albedo with greebles), roughness 0.93 to 1 and metalness 0.35 to 0.4 as exported; `xwing-hd.glb` 133,795 triangles, 12 materials, 4 textures |
| tuned | `SHIP_PROFILE`: roughness clamped to 0.42–0.72, paint metalness 0.1, metal 0.65, `envMapIntensity` 1.3 (checkpoint 5) |
| size on screen | `LENGTH` 0.26 map units; chase camera `dist` 1.7 behind a target 0.4 ahead of the ship, FOV 34 vertical: the ship spans **0.26 / (2 × 2.1 × tan 17°) ≈ 20 % of the frame height and 11 % of its width** at rest; boosting (`dist` up to 3.3) **under 8 %** |
| texels per pixel | a 1024² albedo over a hull 180 px wide: **5 to 6 texels a pixel**: the greebles, panel lines and grime average to mud (mipmapping averages colour, not contrast: a sharp line over a dark panel becomes a mid grey) |
| light | key at 2.35 from the star that lights the camera's spot; fill cool; rim 0.35 × pow(1 − n·v, 3) × max(0, n·fillDir) in the fill's colour |
| colour | the Falcon's albedo is grey-beige, drawn dark: measured over its crop, **mean luminance 0.18 with a standard deviation of 0.11 to 0.15** in `hero.webp`, `universe.webp` and `galaxy-hero.webp`; Bruno's car over its crop is **mean 0.55, standard deviation 0.24**. The ship is separated from the sky by brightness (0.18 against a ring of 0.025 in `hero.webp`), but it is dim, small and flat inside its own outline: half his internal contrast at a third of his size |

(Measured with `sharp` over the raw pixels: luminance as Rec. 709 of the sRGB bytes; the crop is the ship's bounding box, the ring 40 px round it.) In `hero.webp` (the README's lead picture) the Falcon is 240 px wide on an 1800 px frame. In `universe.webp` it sits in front of a planet that is brighter, busier and greener than it (crop 0.22 against a ring of 0.08). In `galaxy-hero.webp` it is 0.18 against a grey fog of 0.14, and the engines (three cyan plumes 150 px long) are brighter and bigger than the ship.

### The sky

Since the vastness design (`2026-10-08-universe-vastness-design.md`, "One sky, as it is, sharper") the universe map draws the galaxy's sky, `galaxy/sky.js`, not its own. (`universe/skyShader.js` and `universe/starField.js`, the Milky Way photo and the 108,000-star Hipparcos field, have no importer left: 395 lines of dead code with `starCatalog.js`, and a health finding.)

| layer | what it draws | fine detail |
| --- | --- | --- |
| `galaxy/sky.js`, the bake | a cube texture, **2048 px a face on `ultra`, 1536 on `high`**, 1024 `mid`, 512 `low`: the galactic band in seven octaves of twisted noise, dust lanes, the core's bulge, three nebulae in their own colours, and "a fine grain of light down its middle" (`fbm4(d × 70)`, cubed) | the band: every pixel at the 34° lens's magnification |
| `galaxy/sky.js`, the stars | one `Points`: **12,000 on `ultra` and `high`**, 7,000 `mid`, 3,000 `low` (the first 4,200 as the sky always had them, the rest at 0.7 of their brightness) | one per ~75 px² at 1280 × 720 |
| `farStars.js` | every world past its reach as a 7–20 px star with spikes | tens |
| `landmarks.js` | the Maw, the Veil and the Cradle (14° across, warped noise with dust lanes), the big stars' glares | low: fine |
| `deepspace.js` | the nebulae's puff clouds you fly through, blue | low: fine |
| `belt.js` | pitted-rock noise on rocks 4 to 12 px across, in `lib/three/rock` | sub-pixel |

The result in every screenshot: a mid-blue field with thousands of white points of nearly equal brightness. Counted as local maxima brighter than 0.6 and 0.25 over their neighbours: **4,143 points in `universe.webp`, 1,674 in `galaxy-hero.webp`, 1,300 in `destroyer.webp`**, against a real dark sky's few hundred at the camera's 34° view. The floor is there on the home map (31 % of `hero.webp`'s pixels and 39 % of the overview pose's are under 0.02 luminance) and gone wherever a nebula, the Milky Way's bright band or the galaxy's fog is in frame: `galaxy-hero.webp` has **0.4 %** of its pixels under 0.02 and a median of 0.10; `destroyer.webp` 9.7 %. In those frames the stars sit on grey, and the planets' night sides and the ship's shadow side have nothing dark to stand against.

### The grade

`post.js`'s final pass: `uContrast` 0.07 (a smoothstep mix at 7 %: nearly none), `uSat` 1.06, `uVignette` 0.3, bloom strength 0.8 at threshold 1.7, the Khronos neutral shoulder from 0.8 up, no toe. The tone map's design is right for not crushing faint things; the consequence is that nothing is ever crushed, and the picture has no floor.

### The composition

- The chase camera's target is 0.4 ahead of the ship and 0.06 above it: the ship sits low in the frame with the horizon-less sky filling the top three-quarters.
- The engines (`engines.js`) at boost are longer than the ship.
- The HUD: the top bar, the side panel, the control line at the foot, a label per world, the nav ring, the arrival ring, the quad-laser pips: in `destroyer.webp` there are eleven text elements over the 3D. (Out of this audit's scope: the HUD has its own rules in `docs/health/RULES.md`; noted because it is a third of what "busy" means.)

## What is not the problem

- **Not the assets.** The HD Falcon is a good 60 k model with proper maps. Bruno's are low-poly flat-palette meshes: *less* asset, used at the scale and frequency the camera sees. A 1024² greebled albedo is the wrong asset for a 180 px hero, not a bad one.
- **Not the renderer.** HDR, bloom, dither, flares and exposure are all there and all correct. Bruno has fewer of them.
- **Not the lighting model.** Checkpoint 2's one-light-from-the-nearest-star is better than his fixed sun. What is missing is the *ratio*: his lit-to-shadow is a hard 1 : 0.4 in a saturated colour; ours is a soft 2.35 : fill with a 0.35 rim, which is a photographic ratio, not a graphic one.
- **Not performance.** The fixes below cost draws and pixels nowhere; most *remove* work (fewer stars, smaller textures, a cheaper belt).

## What would close the gap, in order of effect per change

1. **Hero scale and separation.** Put the ship at 20 to 25 % of the frame width at cruise (chase `dist` 1.1 behind a target 0.15 ahead; the camera a little higher so the ship reads against the sky's floor), with a key : fill : rim of about 1 : 0.25 : 0.5 and a rim that is *warm* when the key is cool and the reverse, so the silhouette is a line of light. The Falcon's albedo gets a 512² "clean" mip chain made by a *contrast-preserving* downscale (Kaiser, then a local-contrast lift of 1.3) rather than a box average, so panel lines survive at 2 texels a pixel. The X-wing the same. The engines capped at 0.6 of the ship's length and 0.8 of its luminance.
2. **A floor in the sky.** The galaxy sky's band and nebulae scaled so their brightest texel away from the core is 0.06 luminance in the universe map (the galaxy's own systems keep theirs: the map passes a `dim`), the cubed grain term off below `ultra`, and the stars past the first 4,200 drawn at 0.25 rather than 0.7, with the first 4,200's brightness law steepened so that a fifth of them carry most of the light. A toe in the tone curve: everything under 0.02 to black, a smoothstep to 0.08. The sky gets black between the stars, and the number of visible points falls by about four to one. The dead `skyShader.js` and `starField.js` go, with the catalogue they load (`starCatalog.js`'s data), which takes 395 lines and a 1 MB fetch off the map.
3. **One palette.** A `universe/palette.js` of nine named colours (the deep sky, the nebula blue, the star white, the sun's orange, the Falcon's bone, the X-wing's grey, the engine's blue, the shot's red, the ink of the labels) and every tint on the map taken from it: the nebulae, the belt's rock tones, the engines, the flares, the signs. The planets keep their own maps (they are the fandoms' identity) but their air and rim take the palette's sky blue.
4. **The lens.** A soft radial defocus in the final pass: `smoothstep(0.55, 1.0, r)` of a 5-tap blur, so the edges of the frame lose their fine detail, as his tilt-shift does. Chromatic aberration already rides the same falloff. Not a DOF; a vignette of sharpness.
5. **Frequency control on everything small.** Belt rocks under 10 px on screen are drawn flat-shaded in two tones (the noise is off: `lib/three/rock`'s detail fades by screen size, not distance); far traffic ships are a lit sprite below 12 px (already in `engines.js` for the engines; extend to the hull); the planets' detail noise is off under 60 px.

Each is measurable with the poses in `scripts/universe-check.mjs` (`luminance.contrast`, `edgeDensity`, `colorEntropyBits` on each shot) and a before and after at the same pose. The targets: `edgeDensity` on the sky *down* by half, `luminance.contrast` on the ship's crop *up* by a third, `colorEntropyBits` on the whole frame down by one bit, and the picture judged by eye at `falcon-sun`, `overview`, `belt` and `maw`.

## Sources

- `brunosimon/folio-2025`: `sources/Game/Rendering.js`, `Materials/MeshDefaultMaterial.js`, `Passes/cheapDOF.js`, `Game/Fog.js`, `Cycles/DayCycles.js`, `static/social/share-image.png` (as quoted in `2026-10-08-folio-2025-physics-terrain-streaming.md`).
- This repo at `04284f4a`: the files named above; `gltf-transform` over the three hero GLBs.
