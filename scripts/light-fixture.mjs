#!/usr/bin/env node
/* global window, document */
// The lit fixture on both of the node renderer's kinds, headless: lane R's
// proof (docs/superpowers/plans/2026-10-10-galaxy-engine-laneR-light.md).
//
//   node scripts/light-fixture.mjs [--tier ultra] [--post on|off] [--sky on|off]
//     [--grid] [--particles] [--only render,ao,…] [--label name] [--size 1600x900] [--ms 5000] [--legs webgpu,webgl]
//     [--volume [on|off]] [--weather interior|sunny|felucia] [--view wide|edge|sun] [--pan]
//     [--weather] [--decals] [--seconds 0,12.5,30]   (lane Q4: the weathering and the placed decals, without --volume)
//     [--hoth] [--shadows [--light-sun] [--clouds]] [--filter pcss|pcf]
//     [--picture [on|off]]   (lane Q6: Hoth's record's picture, or the same frame without it)
//     [--world <w>]          (lane P: with --picture, <w>'s own main weather and picture in Hoth's place)
//     [--frame]              (the shots and the mean luminance alone: no environment pair, recompile count or timing)
//     [--upscale [fsr1|taau:]0.77]   (lane U: the picture drawn under the screen and upscaled)
//   node scripts/light-fixture.mjs --materials [--legs webgl] [--variations]
//   node scripts/light-fixture.mjs --camera [--size 1600x900] [--legs webgpu,webgl]
//
// Lane S (docs/superpowers/plans/2026-10-10-bf-fidelity-laneS-shadows.md):
// --hoth draws the fixture under Hoth Sunny's record on snow at the house's
// exposure (1.4, the classic stack's), its lamps off, and writes the frame's
// mean linear luminance (`meanLum`, as lane G's README measures it) beside
// the shot; lane S's runs write to evidence/galaxy-engine/S/.
// --shadows draws lane S's shadow scene under Hoth's record (figures at 2,
// 20 and 60 m, a wall, a post row to 200 m) and shoots it twice: the near
// view (<label>-<leg>.png) and the cascades' far edge (<label>-<leg>-seam.png);
// --light-sun casts along the light instead of the record's shadow sun;
// the pen1 and pen10 shots frame a board's shadow 1 m and 10 m under it.
// --filter pcf forces three's PCF on the sun (the PCSS cost's baseline).
// The contact view frames the 2 m figure's feet, with its contact shadow
// and without (-contact-off); --clouds adds the strip from 70 m up under
// cloud shadows (the fixture's test layer: litWorld.js's CLOUD_TEST), and
// again after 60 s of drift on Hoth's wind.
//
// --picture (lane Q6, docs/superpowers/plans/2026-10-10-bf2017-surfaces-laneQ6-picture.md):
// --hoth under the record's picture (src/lib/three/light/grade.js): its
// LUT after a linear tone map, its five Gaussians, its HBAO numbers, its
// painted panorama, fog gradient and cloud texture, the urls from
// src/data/bf2017/light/hoth.picture.json (scripts/bf2017-picture.mjs);
// `--picture off` is the same --hoth frame without them, the before. Into
// docs/superpowers/evidence/bf2017-surfaces/Q6/: the frame
// (<label>-<leg>.png), the horizon where the panorama meets the scattering
// (-horizon, and -horizon-nopost with the chain off) and the snow from
// 90 m up under the cloud texture (-cloudtex); `horizon` in the JSON is
// the sky's mean linear luminance in two bands over the horizon with the
// chain off (`meet`: 1°–2°, inside the fade; `painted`: 3.5°–6°, the
// panorama alone), which a --picture run sets beside the --picture off
// run's: the ratio is Review Focus 2's (within 10 %).
//
// --world <w> (lane P, docs/superpowers/plans/2026-10-11-bf2017-picture-laneP-picture.md):
// with --picture [off], the same frame under <w>'s main weather (src/data/
// bf2017/light/<w>.json's `main`): its VE records from the bucket's
// data/<name>.json.gz (cached under lab/assets/bf2017/, the keys from the
// environment) as the fixture's entry, its picture from <w>.picture.json;
// the snow, the ring and the house's exposure stay Hoth's, so the worlds
// compare. Into docs/superpowers/evidence/bf2017-picture/p/ as
// <w>-picture-… and <w>-nopicture-….
//
// --camera (lane C): scripts/light-fixture/camera.html instead, a figure
// with a wall behind it and a corner beside it through the soldier camera
// on the rig, a scripted 3 s orbit shot every half second into
// docs/superpowers/evidence/galaxy-engine/C/orbit-<t>-<leg>.png, with the
// orbit's largest frame-to-frame step, its shortest arm and the frames the
// camera spent behind a wall's face (none, or it clipped) in camera.json.
//
// --materials (lane Q1, docs/superpowers/plans/2026-10-10-bf2017-surfaces-laneQ1-materials.md):
// the seven fixture rows' recipes (the five families, hair and a head) (scripts/fixtures/bf2017/materials/), each
// on a cube over its mesh's own GLB material, and a wall under the first,
// their maps fetched from the bucket by name into lab/assets/bf2017/ (the
// keys from the environment; NODE_USE_ENV_PROXY=1 in a cloud session). Shot
// at the GLB's own material and at each tier into
// docs/superpowers/evidence/bf2017-surfaces/Q1/fixture-<tier>-<leg>.png and
// wall-<tier>-<leg>.png; the low tier against the GLB's (the design's
// "low equals the GLB": mean and largest difference, 0…255) and each cube's
// features into materials-<leg>.json.
// --variations (lane colour, docs/superpowers/plans/2026-10-10-bf2017-accuracy-lane-colour.md):
// instead of the seven, Hoth's crate (Box_M_01_A) twice, as the dump has it
// and through Hoth's variations.json in its snow variation, at high and
// ultra into docs/superpowers/evidence/bf2017-colour/crate-<tier>-<leg>.png,
// and the report (each cube's features, the pack's variations counts) into
// variations-<leg>.json.
//
// For each leg (?gpu=webgpu, and ?gpu=webgl: the node renderer on a WebGL 2
// context) it opens scripts/light-fixture/index.html on a Vite dev server
// and:
// - shoots the fixture after 60 fixed frames into
//   docs/superpowers/evidence/galaxy-engine/R/<label>-<leg>.png;
// - the environment (A2): the frame with scene.environment and without,
//   the mean difference per channel (0…255); none means the placed lights'
//   lighting dropped the environment;
// - no recompile: the renderer's pipelines counted before and after a
//   placed light moves and changes colour over 30 frames;
// - the frame time: frames drawn back to back for --ms, each waited on,
//   the mean, the median and the 95th percentile (the mean is the one to
//   read: a post chain's frames queue behind one another, so a few carry
//   the wait for the rest);
// - with --grid (A3): an arena-sized probe grid baked, the bake's time to
//   the GPU's end, a shot with it and the frame time again.
// - with --volume (lane V): the hangar of scripts/light-fixture/volumeWorld.js
//   instead, its shots and numbers into galaxy-engine/V/, a second shot at
//   the figure's edge inside a lit cone (<label>-<leg>-edge.png) and the
//   volumes drawn; `--volume off` is the same hangar without them, the
//   before to compare with; --weather and --view pick the hangar's weather
//   (lane V's fog with media) and its first view; --pan shoots the walk
//   toward the wall that covers the sun (<label>-<leg>-pan<t>.png at t 0,
//   0.5, 0.75, 1: the sun flare's occluder curve).
// - with --particles (fidelity lane X): the game's effects from their own
//   tables over the ring (Hoth's steam, smoke and falling snow, a bolt into
//   snow, a GR-75's engine and a TIE's contrail on ships), a shot still and
//   a shot during a 6 m/s pan (the streaks), the effects' stats, and the GPU
//   twin's parity with the CPU step after 120 frames; into
//   docs/superpowers/evidence/galaxy-engine/X/.
// - with --upscale (fidelity lane U): the chain drawn at that internal
//   resolution and brought up by FSR1 or TAAU (TAAU when the chain has
//   TRAA, unless named), the same numbers into galaxy-engine/U/, with the
//   canvas's CSS size and its drawing buffer beside them (the HUD is DOM:
//   the CSS size must stay the screen's).
// The numbers go to <label>.json beside the shots and to stdout as a table.
//
// On Linux without a display both legs draw on SwiftShader (CPU): the
// shots are the check, the frame times are the CPU's and only compare one
// leg with the other. The owner's laptop gives the real table. In the
// cloud container the WebGPU device is lost even under a bare cube (Dawn:
// "A valid external Instance reference no longer exists";
// scripts/gpu-parity/README.md), so there the webgpu leg fails, says so
// and does not gate; the webgl leg gates.

import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const volumeAt = argv.indexOf('--volume');
const volume = volumeAt < 0 ? null : argv[volumeAt + 1] !== 'off';
const q4Flags = volume == null && (argv.includes('--weather') || argv.includes('--decals'));
const particles = volume == null && !q4Flags && argv.includes('--particles');
const pictureAt = argv.indexOf('--picture');
const picture = volume == null && !q4Flags && pictureAt >= 0 ? argv[pictureAt + 1] !== 'off' : null;
const laneS = volume == null && ['--hoth', '--shadows', '--clouds'].some((f) => argv.includes(f));
// --upscale [kind:]scale (lane U)
const upscaleArg = argv.includes('--upscale') ? argv[argv.indexOf('--upscale') + 1] : null;
const upscale = upscaleArg && !upscaleArg.startsWith('--') ? (([a, b]) => (b == null ? { scale: Number(a) } : { kind: a, scale: Number(b) }))(upscaleArg.split(':')) : null;
const world = picture != null && argv.includes('--world') ? argv[argv.indexOf('--world') + 1] : null;
const OUT = join(ROOT, q4Flags ? 'docs/superpowers/evidence/bf2017-surfaces/Q4' : world ? 'docs/superpowers/evidence/bf2017-picture/p' : picture != null ? 'docs/superpowers/evidence/bf2017-surfaces/Q6' : join('docs/superpowers/evidence/galaxy-engine', upscale ? 'U' : laneS ? 'S' : particles ? 'X' : volume == null ? 'R' : 'V'));
const arg = (k, d) => {
  const i = argv.indexOf(`--${k}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d;
};
const tier = arg('tier', 'ultra');
const post = volume != null ? arg('post', 'on') === 'on' : arg('post', 'off') === 'on';
const baseLabel = arg(
  'label',
  q4Flags && argv.includes('--weather')
    ? 'weather'
    : q4Flags
      ? 'decals'
      : volume != null
        ? `${volume ? 'volume' : 'novolume'}-${tier}`
        : picture != null
          ? `${picture ? 'picture' : 'nopicture'}-${post ? `post-${tier}` : `lit-${tier}`}`
        : `${arg('filter', null) ? `${arg('filter', null)}-` : ''}${argv.includes('--shadows') ? `shadows${argv.includes('--light-sun') ? '-lightsun' : ''}${argv.includes('--clouds') ? '-clouds' : ''}-` : argv.includes('--hoth') ? 'hoth-' : ''}${post ? `post-${tier}` : `lit-${tier}`}`,
);
const label = particles && arg('label', null) == null ? `particles-${baseLabel}` : upscale && arg('label', null) == null ? `${baseLabel}-${upscale.kind ?? 'auto'}-${upscale.scale}` : world && arg('label', null) == null ? `${world}-${baseLabel}` : baseLabel;
const [W, H] = arg('size', '1600x900').split('x').map(Number);
const ms = Number(arg('ms', 5000));
const legs = arg('legs', 'webgpu,webgl').split(',');
const sky = arg('sky', 'on') === 'on';
const grid = argv.includes('--grid');
const only = arg('only', null)?.split(',');
const weather = q4Flags && argv.includes('--weather');
const decals = q4Flags && argv.includes('--decals');
const seconds = arg('seconds', '0,12.5,30').split(',').map(Number);
const q4 = weather || decals;
// metres the camera rises between the grazing pair's two frames
const GRAZE_JITTER = 0.003;
const shadows = volume == null && argv.includes('--shadows');
const hoth = volume == null && (argv.includes('--hoth') || shadows || picture != null);
// (lane Q6) the record's picture's urls, from the dev server's root
const worldLight = world ? JSON.parse(readFileSync(join(ROOT, 'src/data/bf2017/light', `${world}.json`), 'utf8')) : null;
const pictureUrls = () => {
  const w = JSON.parse(readFileSync(join(ROOT, 'src/data/bf2017/light', `${world ?? 'hoth'}.picture.json`), 'utf8')).weathers[worldLight?.main ?? 'sunny'];
  // (the numbers the stack reads; the sources stay in the file)
  const at = (o) => o && { ...o, _source: undefined, url: `/${o.url}` };
  return { lut: at(w.lut), panorama: at(w.panorama), gradient: at(w.gradient), cloudShadow: at(w.cloudShadow) };
};
// (lane P) the world's main weather as the light stack's entry, from its records
const worldEntry = async () => {
  const { bucketFile } = await import('./lib/bf2017-bucket.mjs');
  const { entryOf } = await import('./lib/bf2017-picture.mjs');
  const { gunzipSync } = await import('node:zlib');
  const sources = worldLight.weathers[worldLight.main].source;
  const raws = [];
  for (const n of sources) raws.push(JSON.parse(gunzipSync(readFileSync(await bucketFile(join(ROOT, 'lab/assets/bf2017'), `data/${n}.json.gz`))).toString('utf8')));
  return entryOf(sources.at(-1), ...raws);
};
// the house tone mapper's exposure (src/lib/three/house.js LOOK.exposure): the classic stack's
const HOUSE_EXPOSURE = 1.4;
// (handed to the page by an init script: too long for its URL)
const entry = world ? await worldEntry() : null;
const fixture = {
  tier,
  post,
  sky,
  env: true,
  only,
  ...(particles ? { particles } : {}),
  ...(volume != null ? { volume, weather: arg('weather', 'interior'), view: arg('view', 'wide') } : {}),
  ...(q4 ? { placed: false } : {}),
  ...(weather ? { weather: seconds[0] } : {}),
  ...(decals ? { decals: await decalPack() } : {}),
  ...(hoth ? { hoth: true, exposure: HOUSE_EXPOSURE } : {}),
  ...(shadows ? { shadows: true, lightSun: argv.includes('--light-sun'), clouds: argv.includes('--clouds') } : {}),
  ...(arg('filter', null) ? { filter: arg('filter', null) } : {}),
  ...(picture ? { picture: pictureUrls() } : {}),

  ...(upscale ? { upscale } : {}),
};

// The --decals pack: the decal fixtures' records (ten of Naboo_01's
// projected, Endor_01's textured volume decal) read by
// scripts/lib/bf2017-decals.mjs, then laid on the fixture's wall (the
// blaster holes, facing the camera) and the ground before it (the streaks,
// each turned about its normal), the volume box over the wall's foot; each
// keeps its own size, the holes' cut to the wall's height. The textures
// come from lab/assets/bf2017/web/ (bf2017-fetch.mjs --raw <file>).
async function decalPack() {
  const { decalsOf } = await import('./lib/bf2017-decals.mjs');
  const read = (f) => JSON.parse(readFileSync(join(ROOT, 'scripts/fixtures/bf2017/decals', f), 'utf8'));
  const flat = (x) => Object.values(decalsOf(x).cells).flat();
  const [naboo, endor] = [read('naboo.extras.json'), read('endor.extras.json')];
  const recs = [...flat(naboo), ...flat(endor)];
  const files = { ...naboo.textureFiles, ...endor.textureFiles };
  const yawQ = (a) => [0, Math.sin(a / 2), 0, Math.cos(a / 2)];
  const qmul = ([ax, ay, az, aw], [bx, by, bz, bw]) => [aw * bx + ax * bw + ay * bz - az * by, aw * by - ax * bz + ay * bw + az * bx, aw * bz + ax * by - ay * bx + az * bw, aw * bw - ax * bx - ay * by - az * bz];
  // a projected box projects along its X (bf2017-decals.mjs's AXIS): on
  // the wall X → −Z (off its face), Y → −X, Z → up; on the ground X → up,
  // Y → Z, Z → X, then turned about the up
  const WALL = [-0.5, 0.5, 0.5, 0.5];
  const GROUND = [0.5, 0.5, 0.5, 0.5];
  const holes = recs.filter((d) => d.kind === 'projected' && /BlasterHole/.test(d.texture));
  const streaks = recs.filter((d) => d.kind === 'projected' && !/BlasterHole/.test(d.texture));
  // (the streaks' boxes are 5 to 13 m across on Naboo's floors: scaled to
  // 4.5 m at most so six fit before the wall, their shape kept)
  const fit = ([, y, z], most) => {
    const k = Math.min(1, most / Math.max(y, z));
    return [2, y * k, z * k];
  };
  const laid = [
    ...holes.map((d, i) => ({ ...d, position: [-4.2 + i * 2.8, 2.6, 25.8], quaternion: WALL, normal: [0, 0, -1], size: fit(d.size, 2.4) })),
    ...streaks.map((d, i) => ({ ...d, position: [-4.5 + (i % 3) * 4.5, 0, 23.4 - Math.floor(i / 3) * 3.6], quaternion: qmul(yawQ(i * 0.9), GROUND), normal: [0, 1, 0], size: fit(d.size, 4.5) })),
    ...recs.filter((d) => d.kind === 'volume').map((d) => ({ ...d, position: [5.6, 0, 24.6], quaternion: yawQ(0.3), size: [3.6, 2.5, 3.6] })),
  ];
  const cells = {};
  for (const d of laid) (cells[`${Math.floor(d.position[0] / 128)},${Math.floor(d.position[2] / 128)}`] ??= []).push(d);
  const textures = [...new Set(laid.map((d) => d.texture))];
  for (const t of textures) {
    if (!existsSync(join(ROOT, 'lab/assets/bf2017/web', files[t]))) {
      console.error(`no ${files[t]} under lab/assets/bf2017/web: NODE_USE_ENV_PROXY=1 node scripts/bf2017-fetch.mjs --raw ${files[t]}`);
      process.exit(2);
    }
  }
  const kinds = { projected: laid.filter((d) => d.kind === 'projected').length, volume: laid.filter((d) => d.kind === 'volume').length };
  return { format: 1, cell: 128, count: laid.length, kinds, textures, files: Object.fromEntries(textures.map((t) => [t, `lab/assets/bf2017/web/${files[t]}`])), cells };
}

const { chromium } = await import('playwright-core');
const sharp = (await import('sharp')).default;
const { adapterFor, angleFor, findChromium, launchArgs } = await import('./lib/chromium.mjs');
const exe = findChromium();
if (!exe) {
  console.error('no Chromium (set CHROMIUM=/path/to/chrome)');
  process.exit(2);
}
// Where the picture is drawn: the machine's own chip (Metal on a Mac, ANGLE
// over D3D11 and WebGPU on D3D12 on Windows), SwiftShader on Linux without
// a display; ANGLE= overrides (scripts/lib/chromium.mjs).
const adapter = adapterFor();
const swift = adapter === 'swiftshader';
const angle = angleFor();
const args = launchArgs({ angle, webgpu: true, adapter, uncapped: true });

const { createServer } = await import('vite');
const server = await createServer({ root: ROOT, configFile: join(ROOT, 'vite.config.js'), server: { host: '127.0.0.1', port: 0, hmr: false, watch: null }, logLevel: 'error' });
await server.listen();
const base = `http://127.0.0.1:${server.httpServer.address().port}`;
const browser = await chromium.launch({ executablePath: exe, args });

if (argv.includes('--camera')) {
  const out = join(ROOT, 'docs/superpowers/evidence/galaxy-engine/C');
  mkdirSync(out, { recursive: true });
  const rows = [];
  for (const leg of legs) {
    const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message.split('\n')[0]));
    page.on('console', (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errors.push(m.text().slice(0, 300)));
    const row = { leg, shots: [] };
    try {
      await page.goto(`${base}/scripts/light-fixture/camera.html?gpu=${leg}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
      await page.waitForFunction(() => window.__cam?.ready || window.__cam?.error, null, { timeout: 240000 });
      const err = await page.evaluate(() => window.__cam.error);
      if (err) throw new Error(err);
      row.backend = await page.evaluate(() => window.__cam.backend);
      for (let i = 0; i <= 6; i++) {
        const s = i / 2;
        const at = await page.evaluate((x) => window.__cam.to(x), s);
        const name = `orbit-${s.toFixed(1)}-${leg}.png`;
        writeFileSync(join(out, name), await page.locator('canvas').screenshot());
        row.shots.push({ name, t: Number(at.t.toFixed(2)), yaw: Number(at.yaw.toFixed(1)), arm: Number(at.arm.toFixed(3)) });
      }
      const log = await page.evaluate(() => window.__cam.log());
      Object.assign(row, { frames: log.frames, maxStepCm: Number((log.maxStep * 100).toFixed(2)), minArm: Number(log.minArm.toFixed(3)), behindWall: log.behindWall });
    } catch (e) {
      row.error = String(e.message ?? e).split('\n')[0];
    }
    if (errors.length) row.errors = [...new Set(errors)].slice(0, 5);
    rows.push(row);
    await page.close();
  }
  await browser.close();
  await server.close();
  writeFileSync(join(out, 'camera.json'), `${JSON.stringify({ size: `${W}x${H}`, adapter: swift ? 'swiftshader' : angle === 'swiftshader' ? 'swiftshader' : `system (${angle})`, rows }, null, 2)}\n`);
  console.log('| leg | backend | frames | largest step cm | shortest arm m | frames behind a wall |');
  console.log('|---|---|---|---|---|---|');
  for (const r of rows) console.log(r.error ? `| ${r.leg} | failed: ${r.error} |` : `| ${r.leg} | ${r.backend} | ${r.frames} | ${r.maxStepCm} | ${r.minArm} | ${r.behindWall} |`);
  process.exit(rows.some((r) => (r.error && r.leg !== 'webgpu') || r.behindWall > 0) ? 1 : 0);
}

const raw = async (png) => sharp(png).raw().toBuffer();
// the mean linear luminance of a shot (sRGB decoded, Rec. 709 weights)
const lin = (v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const meanLum = async (png) => {
  const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const LUT = Array.from({ length: 256 }, (_, i) => lin(i / 255));
  let s = 0;
  for (let i = 0; i < data.length; i += info.channels) s += 0.2126 * LUT[data[i]] + 0.7152 * LUT[data[i + 1]] + 0.0722 * LUT[data[i + 2]];
  return s / (data.length / info.channels);
};
// (lane Q6) the sky's mean linear luminance in two bands over a level
// view's horizon: the screen row of an elevation e is H/2 − tan(e)/tan(fov/2) · H/2
const FIXTURE_FOV = 55; // litWorld.js's camera
const horizonBands = async (png) => {
  const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const LUT = Array.from({ length: 256 }, (_, i) => lin(i / 255));
  const rowOf = (deg) => Math.round(info.height / 2 - (Math.tan((deg * Math.PI) / 180) / Math.tan((FIXTURE_FOV * Math.PI) / 360)) * (info.height / 2));
  const band = (lo, hi) => {
    let s = 0;
    let n = 0;
    for (let y = rowOf(hi); y <= rowOf(lo); y++) {
      for (let x = 0; x < info.width; x++) {
        const i = (y * info.width + x) * info.channels;
        s += 0.2126 * LUT[data[i]] + 0.7152 * LUT[data[i + 1]] + 0.0722 * LUT[data[i + 2]];
        n++;
      }
    }
    return Number((s / n).toFixed(4));
  };
  return { meet: band(1, 2), painted: band(3.5, 6) };
};
const meanDiff = (a, b) => {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]);
  return s / a.length;
};
const pct = (xs, p) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : null;
};

if (argv.includes('--materials')) {
  const code = await materialsRun();
  await browser.close();
  await server.close();
  process.exit(code);
}

mkdirSync(OUT, { recursive: true });
const rows = [];
for (const leg of legs) {
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message.split('\n')[0]));
  page.setDefaultTimeout(180000);
  page.on('console', (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errors.push(m.text().slice(0, 300)));
  const row = { leg, tier, post };
  try {
    if (entry) await page.addInitScript((e) => (window.__fixtureEntry = e), entry);
    await page.goto(`${base}/scripts/light-fixture/index.html?gpu=${leg}&fixture=${encodeURIComponent(JSON.stringify(fixture))}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
    await page.waitForFunction(() => window.__lit?.ready || window.__lit?.error, null, { timeout: 240000 });
    const err = await page.evaluate(() => window.__lit.error);
    if (err) throw new Error(err);
    Object.assign(row, await page.evaluate(() => ({ backend: window.__lit.backend, clustered: window.__lit.probe.light?.clustered ?? null, passes: window.__lit.probe.passes })));
    const shot = async () => page.locator('canvas').screenshot();
    if (q4) {
      row.shots = [];
      const save = async (name) => {
        const png = await shot();
        writeFileSync(join(OUT, `${name}-${leg}.png`), png);
        row.shots.push(`${name}-${leg}.png`);
        return png;
      };
      if (weather) {
        await page.evaluate(() => window.__lit.probe.view('crate'));
        row.amounts = {};
        for (const s of seconds) {
          row.amounts[s] = await page.evaluate((t) => window.__lit.probe.setWeather(t), s);
          await page.evaluate(() => window.__lit.draw(8));
          await save(`weather-${s}s`);
          // (counted once the view has drawn: the rest move a uniform only)
          row.programsBefore ??= await page.evaluate(() => window.__lit.probe.programs());
        }
        row.programsAfter = await page.evaluate(() => window.__lit.probe.programs());
      }
      if (decals) {
        Object.assign(row, await page.evaluate(() => window.__lit.probe.decals()));
        await page.evaluate(() => (window.__lit.probe.view('decals'), window.__lit.draw(8)));
        await save('decals');
        await page.evaluate(() => (window.__lit.probe.view('floor'), window.__lit.draw(8)));
        await save('decals-floor');
        // Z-fighting (Review Focus 5): the grazing view and the same view with
        // the camera raised GRAZE_JITTER; the change between them with the
        // decals, less the change without them, is what the decals add: a
        // decal that fights its surface speckles there
        const graze = async (jitter, on, name) => {
          await page.evaluate(([j, o]) => (window.__lit.probe.view('grazing', j), window.__lit.probe.showDecals(o), window.__lit.draw(4)), [jitter, on]);
          return raw(name ? await save(name) : await shot());
        };
        const a = await graze(0, true, 'decals-grazing-a');
        const b = await graze(GRAZE_JITTER, true, 'decals-grazing-b');
        const a0 = await graze(0, false);
        const b0 = await graze(GRAZE_JITTER, false);
        let s = 0;
        for (let i = 0; i < a.length; i++) s += Math.abs(Math.abs(a[i] - b[i]) - Math.abs(a0[i] - b0[i]));
        row.grazingFlicker = Number((s / a.length).toFixed(3));
        row.grazingMove = Number(meanDiff(a0, b0).toFixed(3));
      }
    } else {
      await page.evaluate(() => window.__lit.draw(60));
      const png = await shot();
      writeFileSync(join(OUT, `${label}-${leg}.png`), png);
      row.shot = `${label}-${leg}.png`;
      // (lane U: the canvas's CSS size stays the screen's; only its drawing is lowered)
      row.canvas = await page.evaluate(() => {
        const c = document.querySelector('canvas');
        return { css: [c.clientWidth, c.clientHeight], buffer: [c.width, c.height] };
      });
      if (particles) {
        row.parity = await page.evaluate(() => window.__lit.probe.particles.parity(120));
        row.simMode = await page.evaluate(() => window.__lit.probe.particles.mode);
        await page.evaluate(() => (window.__lit.probe.pan(6), window.__lit.draw(20)));
        writeFileSync(join(OUT, `${label}-${leg}-pan.png`), await shot());
        await page.evaluate(() => (window.__lit.probe.pan(0), window.__lit.draw(1)));
        row.stats = await page.evaluate(() => window.__lit.probe.particles.stats?.() ?? null);
      }
      row.meanLum = Number((await meanLum(png)).toFixed(4));
      if (picture != null) {
        row.picture = await page.evaluate(() => window.__lit.probe.grade && { tonemap: window.__lit.probe.grade.tonemap, lut: window.__lit.probe.grade.lut?.name ?? null });
        const save = async (name) => {
          const p = await shot();
          writeFileSync(join(OUT, `${label}-${leg}-${name}.png`), p);
          return p;
        };
        await page.evaluate(() => (window.__lit.probe.view('horizon'), window.__lit.draw(8)));
        await save('horizon');
        await page.evaluate(() => (window.__lit.probe.setPost(false), window.__lit.draw(4)));
        row.horizon = await horizonBands(await save('horizon-nopost'));
        await page.evaluate(() => (window.__lit.probe.setPost(true), window.__lit.probe.view('cloudTex'), window.__lit.draw(8)));
        await save('cloudtex');
        await page.evaluate(() => (window.__lit.probe.view('main'), window.__lit.draw(4)));
      }
      if (shadows) {
        for (const v of ['seam', 'pen1', 'pen10', 'contact']) {
          await page.evaluate((name) => (window.__lit.probe.view(name), window.__lit.draw(8)), v);
          writeFileSync(join(OUT, `${label}-${leg}-${v}.png`), await shot());
        }
        await page.evaluate(() => (window.__lit.probe.contact(false), window.__lit.draw(4)));
        writeFileSync(join(OUT, `${label}-${leg}-contact-off.png`), await shot());
        await page.evaluate(() => (window.__lit.probe.contact(true), window.__lit.draw(4)));
        if (argv.includes('--clouds')) {
          // the cloud shadows, then 60 s of drift on the weather's wind
          await page.evaluate(() => (window.__lit.probe.view('clouds'), window.__lit.draw(8)));
          writeFileSync(join(OUT, `${label}-${leg}-clouds.png`), await shot());
          await page.evaluate(() => (window.__lit.probe.advance(60), window.__lit.draw(8)));
          writeFileSync(join(OUT, `${label}-${leg}-clouds-60s.png`), await shot());
        }
        await page.evaluate(() => (window.__lit.probe.view('near'), window.__lit.draw(8)));
      }
      if (volume != null) {
        row.volumesLit = await page.evaluate(() => window.__lit.probe.lit());
        await page.evaluate(() => (window.__lit.probe.view('edge'), window.__lit.draw(8)));
        writeFileSync(join(OUT, `${label}-${leg}-edge.png`), await shot());
        if (argv.includes('--pan')) {
          for (const t of [0, 0.5, 0.75, 1]) {
            await page.evaluate((x) => (window.__lit.probe.pan(x), window.__lit.draw(6)), t);
            writeFileSync(join(OUT, `${label}-${leg}-pan${t}.png`), await shot());
          }
        }
        await page.evaluate((v) => (window.__lit.probe.view(v), window.__lit.draw(4)), fixture.view);
      }
      // (--frame: a sweep over many worlds in software GL, where each of
      // these costs minutes and none is the question)
      if (argv.includes('--frame')) throw Object.assign(new Error('frame'), { frameOnly: true });
      // A2: with and without the environment
      await page.evaluate(() => (window.__lit.probe.setEnv(false), window.__lit.draw(8)));
      const without = await raw(await shot());
      await page.evaluate(() => (window.__lit.probe.setEnv(true), window.__lit.draw(8)));
      const withEnv = await raw(await shot());
      row.envDiff = Number(meanDiff(withEnv, without).toFixed(2));
      // no recompile when a placed light moves
      row.programsBefore = await page.evaluate(() => window.__lit.probe.programs());
      await page.evaluate(async () => {
        for (let i = 0; i < 30; i++) {
          window.__lit.probe.nudge(i / 10);
          await window.__lit.draw(1);
        }
      });
      row.programsAfter = await page.evaluate(() => window.__lit.probe.programs());
      const intervals = await page.evaluate((t) => window.__lit.time(t), ms);
      row.frames = intervals.length;
      row.mean = Number((intervals.reduce((a, b) => a + b, 0) / Math.max(1, intervals.length)).toFixed(1));
      row.median = Number(pct(intervals, 0.5)?.toFixed(1));
      row.p95 = Number(pct(intervals, 0.95)?.toFixed(1));
      if (grid) {
        const bake = await page.evaluate(() => window.__lit.bakeGrid());
        row.gridBakeMs = Number(bake.total.toFixed(1));
        await page.evaluate(() => window.__lit.draw(4));
        writeFileSync(join(OUT, `${label}-${leg}-grid.png`), await shot());
        const after = await page.evaluate((t) => window.__lit.time(t), ms);
        row.gridMedian = Number(pct(after, 0.5)?.toFixed(1));
        row.gridMean = Number((after.reduce((a, b) => a + b, 0) / Math.max(1, after.length)).toFixed(1));
      }
    }
  } catch (e) {
    if (!e?.frameOnly) row.error = String(e.message ?? e).split('\n')[0];
  }
  if (errors.length) row.errors = [...new Set(errors)].slice(0, 5);
  rows.push(row);
  await page.close();
}
await browser.close();
await server.close();

writeFileSync(join(OUT, `${label}.json`), `${JSON.stringify({ size: `${W}x${H}`, adapter: swift ? 'swiftshader' : 'system', rows }, null, 2)}\n`);
if (picture) {
  // Review Focus 2: the painted sky against the model's at the same bands, from the --picture off run
  const before = join(OUT, `${label.replace(/(^|-)picture-/, '$1nopicture-')}.json`);
  if (existsSync(before)) {
    const b = JSON.parse(readFileSync(before, 'utf8')).rows;
    for (const r of rows) {
      const o = b.find((x) => x.leg === r.leg);
      if (r.horizon && o?.horizon) console.log(`${r.leg}: the horizon, painted over the model: ${(r.horizon.meet / o.horizon.meet).toFixed(3)} where they meet (1°–2°), ${(r.horizon.painted / o.horizon.painted).toFixed(3)} above (3.5°–6°); mean ms ${o.mean} → ${r.mean}`);
    }
  } else console.log(`(no ${before}: run with --picture off first for the comparison)`);
}
if (q4) {
  for (const r of rows) console.log(r.error ? `${r.leg}: failed: ${r.error}` : `${r.leg} (${r.backend}): ${r.shots.join(', ')}${r.amounts ? ` · accumulation ${JSON.stringify(r.amounts)} · programs ${r.programsBefore} → ${r.programsAfter}` : ''}${r.draws != null ? ` · decals ${r.count} in ${r.draws} draws (${r.textures} textures) · grazing: the scene moves ${r.grazingMove} between the pair, the decals add ${r.grazingFlicker}` : ''}`);
  for (const r of rows) if (r.errors) console.log(`  ${r.leg} errors: ${r.errors.join(' / ')}`);
  process.exit(rows.some((r) => r.error && r.leg !== 'webgpu') ? 1 : 0);
}
console.log(`| leg | backend | passes | clustered | mean lum | env diff | programs before → after | mean ms | median ms | p95 ms | grid bake ms | mean with grid | volumes lit |`);
console.log(`|---|---|---|---|---|---|---|---|---|---|---|---|---|`);
for (const r of rows) {
  if (r.error) console.log(`| ${r.leg} | failed: ${r.error} |`);
  else console.log(`| ${r.leg} | ${r.backend} | ${(r.passes ?? []).join(' ') || 'none'} | ${r.clustered} | ${r.meanLum} | ${r.envDiff} | ${r.programsBefore} → ${r.programsAfter} | ${r.mean} | ${r.median} | ${r.p95} | ${r.gridBakeMs ?? '–'} | ${r.gridMean ?? '–'} | ${r.volumesLit ?? '–'} |`);
  if (r.parity) console.log(`  particles (${r.simMode}): parity ${JSON.stringify(r.parity)}${r.stats ? `; stats ${JSON.stringify(r.stats)}` : ''}`);
  if (r.errors) console.log(`  errors: ${r.errors.join(' / ')}`);
}
process.exit(rows.some((r) => r.error && r.leg !== 'webgpu') ? 1 : 0);

// ---- --materials (lane Q1)

// Hoth's crate as the dump has it and in the variation the pack's
// variations.json gives it (or Box_M_01_A_Snow, the mesh's one variation,
// where the pack leaves the mesh mixed)
async function variationList() {
  const { readFileSync } = await import('node:fs');
  const { spawnSync } = await import('node:child_process');
  const { recipeOf } = await import('./lib/bf2017-recipes.mjs');
  const { applyVariation, variationFor } = await import('../src/components/galaxy/surface/level/levelVariations.js');
  const row = JSON.parse(readFileSync(join(ROOT, 'scripts/fixtures/bf2017/variations/crate.jsonl'), 'utf8').trim());
  const json = JSON.parse(readFileSync(join(ROOT, 'public/models/galaxy/bf2017/levels/hoth/variations.json'), 'utf8'));
  const glbFile = join(ROOT, 'lab/assets/bf2017/web/models', `${row.mesh}.glb`);
  if (!existsSync(glbFile)) spawnSync(process.execPath, [join(ROOT, 'scripts/bf2017-fetch.mjs'), row.mesh, '--lod', '0'], { stdio: 'inherit', env: process.env });
  const glb = existsSync(glbFile) ? `/lab/assets/bf2017/web/models/${row.mesh}.glb` : null;
  const recipe = { ...recipeOf(row, 0), _source: undefined };
  const mesh = json.meshes[row.mesh];
  const v = variationFor(json, `models/${row.mesh}.glb`) ?? variationFor({ ...json, meshes: { [row.mesh]: { ...mesh, use: 'Box_M_01_A_Snow' } } }, `models/${row.mesh}.glb`);
  const varied = applyVariation(recipe, v, 0);
  const counts = json.counts;
  return {
    list: [
      { label: 'crate', recipe, glb, maps: {} },
      { label: `crate:${v?.name ?? 'none'}`, recipe: varied, glb, maps: {} },
    ],
    report: { mesh: row.mesh, by: mesh?.by ?? null, uses: mesh?.uses ?? null, drawn: v?.name ?? null, variations: { applied: counts.byInstances + counts.byRule, rule: counts.byRule, mixed: counts.mixed, missing: counts.missingTextures } },
  };
}

async function materialList() {
  const { readFileSync } = await import('node:fs');
  const { spawnSync } = await import('node:child_process');
  const { candidatesOf, recipeOf } = await import('./lib/bf2017-recipes.mjs');
  const { MAP_KINDS } = await import('../src/lib/three/surface/families.js');
  const { keys, getObject } = await import('./bf2017-fetch.mjs');
  const env = keys();
  const cache = join(ROOT, 'lab/assets/bf2017');
  const list = [];
  // (each row's material shown: the head's is its second, the face; the first is its eyes)
  for (const [label, index] of [
    ['props', 0],
    ['vehicle', 0],
    ['character', 0],
    ['vegetation', 0],
    ['emissive', 0],
    ['hair', 0],
    ['head', 1],
  ]) {
    const row = JSON.parse(readFileSync(join(ROOT, 'scripts/fixtures/bf2017/materials', `${label}.jsonl`), 'utf8').trim());
    const recipe = recipeOf(row, index);
    const glbFile = join(cache, 'web/models', `${row.mesh}.glb`);
    if (!existsSync(glbFile)) spawnSync(process.execPath, [join(ROOT, 'scripts/bf2017-fetch.mjs'), row.mesh, '--lod', '0'], { stdio: 'inherit', env: process.env });
    const maps = {};
    const flat = { ...recipe.maps, breakupColor: recipe.maps.breakup?.color, breakupNormal: recipe.maps.breakup?.normal };
    for (const [key, name] of Object.entries(flat)) {
      if (typeof name !== 'string' || !MAP_KINDS[key]) continue;
      // (a detail array: every slice, encoded from the export's PNGs into
      // the lab cache where the bucket has no KTX2)
      if (key === 'detailArray') {
        maps.detailSlices = await arraySlices(env, cache, name, getObject);
        if (!maps.detailSlices) console.log(`missing: ${label} ${key} ${name}`);
        continue;
      }
      const into = key;
      maps[into] = null;
      for (const c of candidatesOf(name, MAP_KINDS[key])) {
        const got = await getObject(env, cache, `web/${c}`);
        if (got.state === 'fetched' || got.state === 'kept') {
          maps[into] = `/lab/assets/bf2017/web/${c}`;
          break;
        }
      }
      if (!maps[into]) console.log(`missing: ${label} ${key} ${name}`);
    }
    // (the URL carries the recipe: its sources stay behind)
    const lean = { ...recipe, _source: undefined };
    list.push({ label, recipe: lean, glb: existsSync(glbFile) ? `/lab/assets/bf2017/web/models/${row.mesh}.glb` : null, maps });
  }
  return list;
}

async function arraySlices(env, cache, name, getObject) {
  const { readFileSync, writeFileSync: write, mkdirSync: mkdir } = await import('node:fs');
  const { encodeImage } = await import('./ktx2.mjs');
  const index = await getObject(env, cache, 'web/textures.jsonl');
  const t = readFileSync(index.file, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l))
    .find((r) => r.name.toLowerCase() === name.toLowerCase());
  if (!t) return null;
  const out = [];
  for (const png of t.files ?? [t.file]) {
    const rel = `encoded/${png.replace(/\.png$/, '.ktx2')}`;
    const file = join(cache, rel);
    if (!existsSync(file)) {
      const got = await getObject(env, cache, `web/${png}`);
      if (got.state !== 'fetched' && got.state !== 'kept') return null;
      mkdir(dirname(file), { recursive: true });
      write(file, (await encodeImage(readFileSync(got.file), { role: 'normal' })).ktx2);
    }
    out.push(`/lab/assets/bf2017/${rel}`);
  }
  return out;
}

async function materialsRun() {
  const variations = argv.includes('--variations') ? await variationList() : null;
  const out = join(ROOT, variations ? 'docs/superpowers/evidence/bf2017-colour' : 'docs/superpowers/evidence/bf2017-surfaces/Q1');
  mkdirSync(out, { recursive: true });
  const list = variations ? variations.list : await materialList();
  const configs = variations
    ? [
        ['game', 'high'],
        ['game', 'ultra'],
      ]
    : [
        ['glb', 'low'],
        ['game', 'low'],
        ['game', 'mid'],
        ['game', 'high'],
        ['game', 'ultra'],
      ];
  let failed = false;
  for (const leg of legs) {
    const result = { leg, adapter: swift ? 'swiftshader' : 'system', shots: {}, features: null, lowVsGlb: {}, errors: [] };
    const raws = {};
    for (const [mode, t] of configs) {
      const name = mode === 'glb' ? 'glb' : t;
      const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
      page.setDefaultTimeout(240000);
      page.on('pageerror', (e) => result.errors.push(e.message.split('\n')[0]));
      try {
        const f = { tier: t, post: false, sky: true, env: true, materials: { mode, list } };
        if (entry) await page.addInitScript((e) => (window.__fixtureEntry = e), entry);
    await page.goto(`${base}/scripts/light-fixture/index.html?gpu=${leg}&fixture=${encodeURIComponent(JSON.stringify(f))}`, { waitUntil: 'domcontentloaded', timeout: 240000 });
        await page.waitForFunction(() => window.__lit?.ready || window.__lit?.error, null, { timeout: 300000 });
        const err = await page.evaluate(() => window.__lit.error);
        if (err) throw new Error(err);
        if (name === 'ultra') result.features = await page.evaluate(() => window.__lit.probe.recipes());
        for (const view of variations ? ['row'] : ['row', 'wall']) {
          await page.evaluate((v) => (window.__lit.probe.view(v), window.__lit.draw(60)), view);
          const png = await page.locator('canvas').screenshot();
          const file = variations ? `crate-${name}-${leg}.png` : `${view === 'row' ? 'fixture' : 'wall'}-${name}-${leg}.png`;
          writeFileSync(join(out, file), png);
          result.shots[`${view}-${name}`] = file;
          raws[`${view}-${name}`] = await raw(png);
        }
      } catch (e) {
        result.errors.push(`${name}: ${String(e.message ?? e).split('\n')[0]}`);
        if (leg !== 'webgpu') failed = true;
      }
      await page.close();
    }
    for (const view of ['row', 'wall']) {
      const a = raws[`${view}-glb`];
      const b = raws[`${view}-low`];
      if (!a || !b) continue;
      let max = 0;
      let over = 0;
      for (let i = 0; i < a.length; i++) {
        const d = Math.abs(a[i] - b[i]);
        if (d > max) max = d;
        if (d > 1) over++;
      }
      result.lowVsGlb[view] = { mean: Number(meanDiff(a, b).toFixed(3)), max, overOne: over };
    }
    if (variations) Object.assign(result, variations.report);
    writeFileSync(join(out, `${variations ? 'variations' : 'materials'}-${leg}.json`), `${JSON.stringify(result, null, 2)}\n`);
    console.log(`${leg}: low vs the GLB ${JSON.stringify(result.lowVsGlb)}; ${Object.keys(result.shots).length} shots${result.errors.length ? `; errors: ${[...new Set(result.errors)].slice(0, 4).join(' / ')}` : ''}`);
    for (const c of result.features ?? []) console.log(`  ${c.label.padEnd(11)} ${c.features.join(', ') || '(none)'}`);
  }
  return failed ? 1 : 0;
}
