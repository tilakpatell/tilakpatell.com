// Hogwarts' things and creatures, static (no skeleton), made the way
// scripts/hogwarts-cast.mjs makes the people (§4.10's props, plan B5): four
// concept pictures from the thing's words, one picked by looking, TRELLIS.2,
// scripts/gen3d's bake, three cuts for the web (web.mjs's webReady at
// budget.mjs's cutsFor), into public/models/hogwarts/props/, credited, and a
// four-view sheet under docs/gen3d/hogwarts/props/.
//
//   node scripts/hogwarts-cast-props.mjs <picture | model | bake | cut | sheet | all> [--only a,b] [--fresh]
//   node scripts/hogwarts-cast-props.mjs pick NAME SEED
//
// State in scripts/hogwarts-cast-tasks.json beside the people's, under
// `props:NAME`, so a step is never made twice.

import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { due, only, record, TASKS } from './hogwarts-cast.mjs';
import { NAMES_NEVER } from './hogwarts-cast-figures.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const OUT = join(ROOT, 'public', 'models', 'hogwarts', 'props');
export const SHEETS = join(ROOT, 'docs', 'gen3d', 'hogwarts', 'props');
const CACHE = join(ROOT, 'scripts', 'gen3d', 'cache', 'hogwarts-props');
export const STEPS = ['picture', 'model', 'bake', 'cut', 'sheet'];

// faces: the top cut's (the bake's), the others scaled from it (budget.mjs cutsFor);
// tex: the top cut's atlas. Every look a thing alone, as the picture step frames it.
export const PROPS = {
  express: { faces: 40000, tex: 2048, what: 'a scarlet steam locomotive', look: 'A grand old scarlet steam locomotive engine with gold lining and brass fittings, a tall black chimney, big red spoked wheels, a cab at the back, side view from three-quarters' },
  carriage: { faces: 24000, tex: 2048, what: 'a scarlet railway carriage', look: 'An old-fashioned scarlet railway passenger carriage with gold lining, a row of small windows and compartment doors, a curved black roof, on black wheels' },
  boat: { faces: 10000, tex: 1024, what: 'a small wooden rowing boat with a lantern', look: 'A small old wooden rowing boat with curved planks, two seats and a lantern on a short pole at its bow' },
  sortinghat: { faces: 10000, tex: 1024, what: 'a patched old pointed hat with a face', look: 'A battered, patched and frayed old pointed wizard’s hat of brown leather with a wide floppy brim, its folds and a rip near the brim making a wise old face with eyes and a mouth' },
  broom: { faces: 6000, tex: 1024, what: 'a racing broomstick', look: 'A sleek polished wooden racing broomstick with a long straight handle and a neat bundle of twigs bound at the tail, lying level' },
  snitch: { faces: 3000, tex: 1024, what: 'a small golden winged ball', look: 'A small round golden ball the size of a walnut with two thin silver feathered wings spread out, polished and gleaming' },
  quaffle: { faces: 3000, tex: 1024, what: 'a red leather ball', look: 'A worn bright red leather ball the size of a football, stitched in panels, with three small dimples' },
  bludger: { faces: 3000, tex: 1024, what: 'a black iron ball', look: 'A heavy round black iron ball slightly smaller than a football, dented and scuffed' },
  trunk: { faces: 6000, tex: 1024, what: 'a school trunk', look: 'An old wooden travelling trunk with brass corners, leather straps and a brass lock, its lid shut' },
  cauldron: { faces: 6000, tex: 1024, what: 'a pewter cauldron', look: 'A round pewter cauldron on three short legs with a thick rim and a curved handle, empty' },
  telescope: { faces: 6000, tex: 1024, what: 'a brass telescope on a tripod', look: 'An old brass telescope with polished tubes on a small wooden tripod stand' },
  pumpkin: { faces: 4000, tex: 1024, what: 'a huge pumpkin', look: 'A huge round ribbed orange pumpkin with a thick curling green stalk' },
  owl: { faces: 8000, tex: 1024, what: 'a snowy owl', look: 'A snowy white owl with a few black flecks, round yellow eyes, perched upright with its wings folded, on its own two feet' },
  cat: { faces: 10000, tex: 1024, what: 'a skinny dust-coloured cat', look: 'A scrawny, skeletal dust-grey cat with bulging pale yellow lamp-like eyes, standing on all four legs side-on, tail up, its head turned to the viewer' },
  boarhound: { faces: 14000, tex: 2048, what: 'a big black boarhound', look: 'A huge black boarhound dog with a big head, droopy jowls and a long tail, standing on all four legs side-on' },
  hippogriff: { faces: 24000, tex: 2048, what: 'a grey hippogriff', look: 'A grey hippogriff: the front of a great eagle with a hooked beak, fierce orange eyes and feathered forelegs with talons, the back of a horse with grey hindquarters and a tail, its big grey wings folded at its sides, standing on all four legs side-on' },
  thestral: { faces: 24000, tex: 2048, what: 'a black skeletal winged horse', look: 'A skeletal black winged horse with a dragonish head, white blank eyes, its black skin stretched over every bone, big leathery bat-like wings folded at its sides, standing on all four legs side-on' },
  mandrake: { faces: 8000, tex: 1024, what: 'a potted mandrake', look: 'A clay flowerpot full of soil with a tuft of tall purple-green leaves, a small ugly baby-like root creature with a screaming face half out of the soil' },
  frame: { faces: 8000, tex: 1024, what: 'a gilt portrait frame', look: 'An ornate carved gilt picture frame, oval inside a rectangle, its canvas a plain soft dark painting of a curtained room with no one in it, seen from the front' },
  witch: { faces: 16000, tex: 2048, what: 'a stone statue of a hump-backed witch', look: 'An old grey stone statue of a hunched, hump-backed, one-eyed witch with a crooked nose, leaning on a stick, on a square stone plinth' },
  knocker: { faces: 6000, tex: 1024, what: 'a bronze eagle door knocker', look: 'A bronze door knocker shaped like an eagle with spread wings holding a heavy ring in its beak, on a round backplate, seen from the front' },
};

const load = () => (existsSync(TASKS) ? JSON.parse(readFileSync(TASKS, 'utf8')) : {});
const saveOne = (key, s) => writeFileSync(TASKS, `${JSON.stringify({ ...load(), [key]: s[key] }, null, 2)}\n`);
const dirOf = (name) => join(CACHE, name);
const kb = (f) => `${(statSync(f).size / 1024).toFixed(0)} KB`;
const digestOf = async (...p) => (await import('./gen3d/steps.mjs')).digest(...p);

export function words(name) {
  const p = PROPS[name]?.look;
  if (!p) throw new Error(`no prop ${name}`);
  const hit = p.match(NAMES_NEVER);
  if (hit) throw new Error(`${name}'s words name someone ("${hit[0]}")`);
  return p;
}

// a prop's credit (public/games/credits.json), as the gen3d models' are
export const credit = (name) => ({
  source: 'https://github.com/microsoft/TRELLIS.2',
  name: `${PROPS[name].what}, for the Hogwarts world, made on the site owner's machine from a concept picture drawn there (FLUX.1-schnell, scripts/gen3d/picture.mjs) with TRELLIS.2 (trellis.cpp), baked in Blender (scripts/hogwarts-cast-props.mjs)`,
  authors: ['Tilak Patel, with Microsoft TRELLIS.2'],
  license: 'Generated for this site; TRELLIS.2 is MIT, FLUX.1-schnell Apache 2.0',
});

const steps = {
  async picture(name, s, { fresh, log }) {
    const w = words(name);
    const key = await digestOf(w, 1, 4);
    if (!due(s, `props:${name}`, 'picture', key, { fresh })) return log('pictures as they were');
    const { picture } = await import('./gen3d/picture.mjs');
    mkdirSync(dirOf(name), { recursive: true });
    const files = [];
    for (let seed = 1; seed <= 4; seed++) {
      const file = join(dirOf(name), `concept-${seed}.png`);
      await picture(w, file, { seed });
      files.push(file);
    }
    const { default: sharp } = await import('sharp');
    await sharp({ create: { width: 2048, height: 512, channels: 3, background: '#fff' } })
      .composite(await Promise.all(files.map(async (f, i) => ({ input: await sharp(f).resize(512, 512).png().toBuffer(), left: i * 512, top: 0 }))))
      .png()
      .toFile(join(dirOf(name), 'candidates.png'));
    record(s, `props:${name}`, 'picture', key, { seeds: [1, 2, 3, 4] });
    delete s[`props:${name}`].pick;
    log(`4 pictures: look at ${relative(ROOT, join(dirOf(name), 'candidates.png'))}, then pick one`);
  },
  async model(name, s, { fresh, log }) {
    const seed = s[`props:${name}`]?.pick?.seed;
    if (!seed) throw new Error(`${name}: no picture picked (pick ${name} SEED)`);
    const concept = join(dirOf(name), `concept-${seed}.png`);
    const key = await digestOf(readFileSync(concept), 'trelliscpp', 1024);
    const raw = join(dirOf(name), 'raw.glb');
    if (!due(s, `props:${name}`, 'model', key, { fresh }) && existsSync(raw)) return log('model as it was');
    const { waitForGpu } = await import('./desktop/lib.mjs');
    await waitForGpu(20000, { log });
    const { prepare } = await import('./gen3d/prepare.mjs');
    const { generate } = await import('./gen3d/generate.mjs');
    const ready = join(dirOf(name), 'prepared.png');
    await prepare(concept, ready);
    const r = await generate(ready, raw, { engine: 'trelliscpp', seed: 42, res: 1024 });
    record(s, `props:${name}`, 'model', key, { seconds: Math.round(r.seconds) });
    log(`raw model in ${Math.round(r.seconds)} s`);
  },
  async bake(name, s, { fresh, log }) {
    const p = PROPS[name];
    const raw = join(dirOf(name), 'raw.glb');
    const baked = join(dirOf(name), 'baked.glb');
    const key = await digestOf(s[`props:${name}`]?.model?.key, p.faces, p.tex);
    if (!due(s, `props:${name}`, 'bake', key, { fresh }) && existsSync(baked)) return log('bake as it was');
    const { bake } = await import('./gen3d/bake.mjs');
    const r = await bake(raw, baked, { faces: p.faces, tex: p.tex });
    record(s, `props:${name}`, 'bake', key, { seconds: Math.round(r.seconds) });
    log(`baked to ${p.faces} faces in ${Math.round(r.seconds)} s`);
  },
  async cut(name, s, { fresh, log }) {
    const p = PROPS[name];
    const baked = join(dirOf(name), 'baked.glb');
    const key = await digestOf(s[`props:${name}`]?.bake?.key, p.faces, p.tex);
    if (!due(s, `props:${name}`, 'cut', key, { fresh }) && existsSync(join(OUT, `${name}.glb`))) return log('cuts as they were');
    const { io, webReady } = await import('./gen3d/web.mjs');
    const { check, cutsFor } = await import('./gen3d/budget.mjs');
    const nio = await io();
    mkdirSync(OUT, { recursive: true });
    const sizes = {};
    for (const [tier, c] of Object.entries(cutsFor(p.faces, p.tex))) {
      const doc = await nio.read(baked);
      const { after } = await webReady(doc, { tris: c.faces, tex: c.tex });
      const file = join(OUT, `${name}${c.suffix}.glb`);
      const bytes = (await nio.writeBinary(doc)).byteLength;
      const problems = check({ tris: c.faces, after, bytes, max: c.bytes });
      if (problems.length) throw new Error(`${name} (${tier}): ${problems.join('; ')}`);
      await nio.write(file, doc);
      sizes[tier] = { triangles: Math.round(after), bytes };
      log(`${tier}: ${Math.round(after)} triangles, ${kb(file)}`);
    }
    const creditsFile = join(ROOT, 'public', 'games', 'credits.json');
    const credits = JSON.parse(readFileSync(creditsFile, 'utf8'));
    credits[`hogwarts/props/${name}`] = credit(name);
    writeFileSync(creditsFile, `${JSON.stringify(credits, null, 2)}\n`);
    record(s, `props:${name}`, 'cut', key, { sizes });
  },
  // four views of the shipped cut (judge.mjs's sheet, through the dev server at BASE)
  async sheet(name, s, { fresh, log }) {
    const file = join(OUT, `${name}.glb`);
    const out = join(SHEETS, `${name}.webp`);
    const key = await digestOf(readFileSync(file));
    if (!due(s, `props:${name}`, 'sheet', key, { fresh }) && existsSync(out)) return log('sheet as it was');
    const { sheet } = await import('./gen3d/judge.mjs');
    const { default: sharp } = await import('sharp');
    mkdirSync(SHEETS, { recursive: true });
    const png = join(dirOf(name), 'sheet.png');
    await sheet(png, [file]);
    await sharp(png).resize(1280).webp({ quality: 80 }).toFile(out);
    record(s, `props:${name}`, 'sheet', key, { bytes: statSync(out).size });
    log(`look at ${relative(ROOT, out)}`);
  },
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const i = args.indexOf('--only');
  const onlyArg = i >= 0 ? args.splice(i, 2)[1] : undefined;
  const fresh = args.includes('--fresh');
  const [step, ...rest] = args.filter((a) => a !== '--fresh');
  if (step === 'pick') {
    const [name, seed] = rest;
    const s = load();
    if (!s[`props:${name}`]?.picture?.seeds?.includes(Number(seed))) throw new Error('usage: pick NAME SEED, once its pictures are made');
    s[`props:${name}`].pick = { seed: Number(seed), at: new Date().toISOString().slice(0, 10) };
    copyFileSync(join(dirOf(name), `concept-${seed}.png`), join(dirOf(name), 'concept.png'));
    saveOne(`props:${name}`, s);
    console.log(`${name}: concept-${seed}.png picked`);
  } else if (step) {
    const names = only(onlyArg ?? rest.join(','), PROPS);
    for (const name of names)
      for (const st of step === 'all' ? STEPS : [step]) {
        if (!steps[st]) throw new Error(`no step ${st} (${[...STEPS, 'all', 'pick'].join(', ')})`);
        const s = load();
        await steps[st](name, s, { fresh, log: (m) => console.log(`[${name}] ${st}: ${m}`) });
        saveOne(`props:${name}`, s);
      }
  } else throw new Error(`usage: node scripts/hogwarts-cast-props.mjs <${[...STEPS, 'all'].join(' | ')}> [--only a,b] | pick NAME SEED`);
}
