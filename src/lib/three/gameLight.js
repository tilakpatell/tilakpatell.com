// The game's light, read for the site: a level's VisualEnvironment records
// and its outdoor probe (scripts/bf2017-light.mjs writes them, one JSON a
// world under src/data/bf2017/light/) turned into the shapes the surface
// already reads: site.sky, site.light, site.fog. Pure, so the numbers are
// pinned in tests; the scene wires them (gameSite).
//
//   siteLightFrom(entry) → { sky, light, fog, exposure, bloom, grading, wind } | null
//   gameSite(site, light, state) → the site under the game's light, or the
//     site itself when the world has no record
//
// The game's units are a camera's: the sun in lux, the sky's brightness in
// its own scale (SkyComponentData.LuminanceScale), the exposure in EV. Two
// constants, set once on Hoth's sunny weather against the site's own Hoth
// and held for every world, carry them to the site's: GAME_TO_SITE (lux,
// exposed, to the site's sun) and SKY_TO_SITE (the sky's brightness,
// exposed, to the dome's horizon and the fill). The probe gives the sky's
// colours and how its zenith stands to its horizon, never its level: the
// probes of a level's weathers are not baked to one scale (Hoth's sunset
// probe is a day's). PROBE_TO_SITE is the fallback, a probe's own radiance,
// for a record that sets no sky brightness.

export const GAME_TO_SITE = 0.0713;
export const SKY_TO_SITE = 0.2006;
export const PROBE_TO_SITE = 52.4;

// Bloom as a share of Hoth sunny's, the world the site's bloom was set on.
const BLOOM_REF = 0.1;
const DEG = Math.PI / 180;
const lum = (c) => c[0] * 0.2126 + c[1] * 0.7152 + c[2] * 0.0722;
const round = (v, k = 1000) => Math.round(v * k) / k;

// Linear RGB to the '#rrggbb' the sites write; over 1, scaled down whole so
// the hue holds.
export function hexOf(c) {
  const top = Math.max(c[0], c[1], c[2], 1);
  const enc = (v) => {
    const x = Math.min(1, Math.max(0, v / top));
    const s = x <= 0.0031308 ? x * 12.92 : 1.055 * x ** (1 / 2.4) - 0.055;
    return Math.round(s * 255).toString(16).padStart(2, '0');
  };
  return `#${enc(c[0])}${enc(c[1])}${enc(c[2])}`;
}

const defined = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));

// A colour as a tint: its brightest channel at 1.
const tint = (c) => {
  const m = Math.max(c[0], c[1], c[2]);
  return m > 0 ? c.map((v) => v / m) : null;
};

// The exposure the game's camera settles at. With its auto exposure on, it
// meters a grey card of 0.18 for the scene's mean, lit by the sun and by the
// sky (as bright as the record's LuminanceScale, so a storm's weak sun does
// not open it up to the sun alone), and clamps the EV to the record's range;
// off, the record's EV. Compensation opens it up. Where the view is in a
// room the sky does not reach (`room`: the luminance, in nits, the game's own
// capture of that room reads: the interiors', light/apply.js), that is
// what the meter sees, as it is.
export function exposureOf(entry) {
  const t = entry?.tonemap ?? {};
  const comp = t.compensation ?? 0;
  let ev = t.ev ?? 12;
  if (t.auto !== false && (t.minEV !== undefined || t.maxEV !== undefined)) {
    const sun = entry?.sun ?? {};
    const lit = Math.max(1, 0.18 * (((sun.lux ?? 0) * Math.max(0.05, Math.sin((sun.el ?? 45) * DEG))) / Math.PI + (entry?.sky?.luminance ?? 0)) + (entry?.room?.luminance ?? 0));
    ev = Math.min(t.maxEV ?? Infinity, Math.max(t.minEV ?? -Infinity, Math.log2((lit * 100) / 12.5)));
  }
  return 2 ** (comp - ev);
}

// The distance at which the game's fog curve reaches half, and the
// exponential-squared density that does the same.
function fogDensity(fog) {
  const { start = 0, end, curve } = fog ?? {};
  if (!(end > start) || !Array.isArray(curve)) return null;
  const at = (t) => ((curve[0] * t + curve[1]) * t + curve[2]) * t + curve[3];
  let t = 0;
  for (let i = 1; i <= 200; i++) {
    if (at(i / 200) >= 0.5) {
      t = i / 200;
      break;
    }
  }
  if (!t) return null;
  return Math.sqrt(Math.LN2) / (start + t * (end - start));
}

export function siteLightFrom(entry, { factor = GAME_TO_SITE, skyFactor = SKY_TO_SITE, probeFactor = PROBE_TO_SITE } = {}) {
  if (!entry) return null;
  const m = exposureOf(entry);
  const sun = entry.sun ?? {};
  const probe = entry.probe ?? null;
  // the sky's level at the site: its horizon's luminance, and so the fill
  // from it (the zenith is a small patch over the probe, often the sky's
  // brightest, and would light everything as if it were all of it)
  const level = !probe ? null : entry.sky?.luminance !== undefined ? entry.sky.luminance * m * skyFactor : lum(probe.horizon) * m * probeFactor;
  // the probe's radiance to the site's, so its horizon reads at that level
  const probeScale = probe ? level / Math.max(1e-9, lum(probe.horizon)) : null;
  const dome = (c) => (c ? hexOf(c.map((v) => v * probeScale)) : undefined);
  const zenith = dome(probe?.zenith);
  const horizon = dome(probe?.horizon);
  const upper = level;
  const en = entry.enlighten ?? {};
  const skyTint = tint(en.sky ?? probe?.zenith ?? [0, 0, 0]);
  const groundTint = tint(en.terrain ?? en.ground ?? probe?.ground ?? [0, 0, 0]);
  const density = fogDensity(entry.fog);
  const sunTint = tint(sun.color ?? [1, 1, 1]);
  const g = entry.grading ?? {};
  return {
    sky: {
      zenith,
      horizon,
      hazeColor: horizon,
      suns: sun.az !== undefined && sun.el !== undefined ? [defined({ az: round(sun.az * DEG), el: round(sun.el * DEG), color: sunTint ? hexOf(sunTint) : undefined })] : [],
    },
    light: {
      sun: sun.lux !== undefined ? round(sun.lux * m * factor, 100) : undefined,
      sky: skyTint ? hexOf(skyTint) : undefined,
      ground: groundTint ? hexOf(groundTint) : undefined,
      ambient: upper !== null ? round(upper, 100) : undefined,
    },
    fog: { color: horizon, density: density !== null ? round(density, 1e6) : undefined },
    // (folded into the light's intensities above: the site's exposure stays its own)
    exposure: round(m, 1e9),
    // (the probe as the scene's environment, at the site's: gameLit.js)
    probeScale: probeScale !== null ? round(probeScale, 1e9) : null,
    bloom: entry.tonemap?.bloom !== undefined ? round(entry.tonemap.bloom / BLOOM_REF, 100) : 1,
    grading: { brightness: g.brightness ?? 1, contrast: g.contrast ?? 1, saturation: g.saturation ?? 1, lut: g.lut ?? null, lutSize: g.lutSize ?? null },
    wind: entry.wind ? { dir: round((entry.wind.dir ?? 0) * DEG), strength: entry.wind.strength ?? 0 } : null,
  };
}


// The site under the game's light: its sky, light and fog laid over with
// what the record derives, everything the record does not say kept (the
// clouds, the moons, the sun's size and glow, the haze's amount). The fog
// is never thinner than the site's own, while the ground under it is the
// site's (a clearer fog would show where its land ends).
export function gameSite(site, light, state) {
  const d = siteLightFrom(weatherEntry(light, state));
  if (!d || !site) return site;
  const suns = site.sky?.suns ?? [];
  const sky = { ...site.sky, ...defined({ zenith: d.sky.zenith, horizon: d.sky.horizon, hazeColor: d.sky.hazeColor }) };
  if (d.sky.suns[0]) sky.suns = [{ ...suns[0], ...d.sky.suns[0] }, ...suns.slice(1)];
  const fog = { ...site.fog, ...defined({ color: d.fog.color }) };
  if (d.fog.density !== undefined) fog.density = Math.max(site.fog?.density ?? 0, d.fog.density);
  return { ...site, sky, light: { ...site.light, ...defined(d.light) }, fog, gameLit: d };
}

// The cube map's faces in three.js's order and frame: for a texel at (u, v)
// in -1…1, u to the right and v down the image, the direction it looks.
const FACES = {
  px: (u, v) => [1, -v, -u],
  nx: (u, v) => [-1, -v, u],
  py: (u, v) => [u, 1, v],
  ny: (u, v) => [u, -1, -v],
  pz: (u, v) => [u, -v, 1],
  nz: (u, v) => [-u, -v, -1],
};

// The sun's direction from a probe when the level names no sun entity: the
// brightest texels, weighted by how bright, so a disc a few texels wide reads
// as its middle rather than one corner. faces: { px…nz: Float32Array RGB }.
export function sunFromProbe(faces, size) {
  let peak = 0;
  for (const k in FACES) {
    const f = faces[k];
    for (let i = 0; i < f.length; i += 3) peak = Math.max(peak, f[i] * 0.2126 + f[i + 1] * 0.7152 + f[i + 2] * 0.0722);
  }
  if (!(peak > 0)) return null;
  // the disc, not the sky round it: within a tenth of the brightest
  const floor = peak * 0.9;
  const d = [0, 0, 0];
  for (const k in FACES) {
    const f = faces[k];
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = (y * size + x) * 3;
        const lum = f[i] * 0.2126 + f[i + 1] * 0.7152 + f[i + 2] * 0.0722;
        if (lum < floor) continue;
        const dir = FACES[k]((2 * (x + 0.5)) / size - 1, (2 * (y + 0.5)) / size - 1);
        const len = Math.hypot(dir[0], dir[1], dir[2]);
        for (let c = 0; c < 3; c++) d[c] += (dir[c] / len) * lum;
      }
    }
  }
  const len = Math.hypot(d[0], d[1], d[2]);
  return len > 0 ? d.map((c) => c / len) : null;
}

// The spec's four sky states to the level's weathers, as the levels name
// them. The surface has no such states yet (weather.js draws particles), so
// whoever picks the state passes its name; anything else is the level's
// main weather.
const STATES = { clear: ['sunny'], dusk: ['sunset', 'dusk'], overcast: ['cloudy', 'overcast', 'foggy'], storm: ['blizzard', 'stormy'] };

// The entry a world is lit by for a state: the state's weather, else the
// level's main one, else sunny, else the first that isn't a room; null for
// a world without a record, so the caller keeps the site's own light.
export function weatherEntry(light, state) {
  const w = light?.weathers;
  if (!w) return null;
  const named = (STATES[state] ?? []).map((k) => w[k]).find(Boolean);
  const pick = named ?? w[light.main] ?? w.sunny ?? Object.entries(w).find(([k]) => k !== 'interior')?.[1];
  return pick ?? null;
}

// A grading LUT stored as a strip of slices: n slices of n × n laid side by
// side, either way round. Anything else is not a LUT the pass can take, and
// the grade falls back to brightness, contrast and saturation.
export function lutShape(width, height) {
  for (const n of [32, 16]) {
    if ((width === n * n && height === n) || (width === n && height === n * n)) return n;
  }
  return null;
}
