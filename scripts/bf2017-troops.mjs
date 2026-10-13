// Writes src/data/bf2017/troops.json (and troops.outfits.json), the troops' roster from the 2017 game's
// records (lib/bf2017-troops.mjs): every class kit of the Original and
// Prequel eras by side and planet, the outfit you wear in it and the one the
// game's bots wear, every reinforcement's, each outfit's skins and the
// meshes each wears, the site's body for each skin, and `wear`: the body a
// class wears on a planet (figures.js reads it). The Collection reads the
// same file (src/data/bf2017/collection.json's `record` is an outfit here).
//
//   node scripts/bf2017-troops.mjs [--root C:/Users/tilak/Downloads/BF2_Extract] [--out src/data/bf2017/troops.json]
//
// BODIES below is the import's log: each kind imported with
// `bf2017-import.mjs --outfit <record>#<skin>` (its record and skin), or, for
// one imported before the outfits were read, the meshes it was made of.

import { writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from './lib/args.mjs';
import { indexAt, readRecordAt } from './lib/bf2017-records.mjs';
import { roster } from './lib/bf2017-troops.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const D = 'Characters/Dark';
const L = 'Characters/Light';
const H = 'Characters/Hero';

export const BODIES = {
  // the Original era, the Empire
  stormtroopermp: { record: `${D}/D_Assault_Orig/D_Assault_Orig_01/MPVUR_D_Assault_Orig_01`, skin: 'default' },
  snowtrooper: { record: `${D}/D_Assault_Orig/D_Assault_Orig_HO_01/MPVUR_D_Assault_Orig_HO_01` },
  heavystormtrooper: { record: `${D}/D_Heavy_Orig/D_Heavy_Orig_01/MPVUR_D_Heavy_Orig_01`, skin: 'default' },
  heavysnowtrooper: { record: `${D}/D_Heavy_Orig/D_Heavy_Orig_HO_01/MPVUR_D_Heavy_Orig_HO_01` },
  // (on Hoth the officer's outfit is the same meshes and maps: MPVUR_D_Officer_Orig_HO_01)
  imperialofficer: { record: `${D}/D_Officer_Orig/D_Officer_Orig_01/MPVUR_D_Officer_Orig_01`, skin: 'viktor' },
  scoutspecialist: { record: `${D}/D_Specialist_Orig/D_Specialist_Orig_01/MPVUR_D_Specialist_Orig_01`, skin: 'default' },
  // the Original era, the Rebels on Hoth
  hothtrooper: { record: `${L}/L_Assault_Orig/L_Assault_Orig_HO_01/MPVUR_L_Assault_Orig_HO_01`, skin: 'charlie' },
  hothheavy: { record: `${L}/L_Heavy_Orig/L_Heavy_Orig_HO_01/MPVUR_L_Heavy_Orig_HO_01`, skin: 'juan' },
  hothofficer: { record: `${L}/L_Officer_Orig/L_Officer_Orig_HO_01/MPVUR_L_Officer_Orig_HO_01`, skin: 'hector' },
  hothspecialist: { record: `${L}/L_Specialist_Orig/L_Specialist_Orig_HO_01/MPVUR_L_Specialist_Orig_HO_01`, skin: 'jingxu' },
  // the reinforcements
  deathtrooper: { record: `${H}/DeathTrooper/DeathTrooper_01/VUR_DeathTrooper_01` },
  wookiee: { record: `${H}/WookieWarrior/WookieWarrior_01/VUR_WookieWarrior_01`, skin: 'warrior' },
  // phase 2's, by their meshes (docs/superpowers/evidence/bf2017-phase2/cast.json)
  shoretrooper: { parts: ['characters/imperial/imperial_beachtrooper/imperial_beachtrooper_mesh'] },
  sandtrooper: { parts: ['characters/dark/d_heavy_orig/d_heavy_orig_mos_01/d_heavy_orig_mos_01_mesh', 'characters/dark/d_assault_orig/d_assault_orig_01/d_assault_orig_01_helmet_mesh', 'characters/dark/d_heavy_orig/d_heavy_orig_01/d_heavy_orig_01_backpack_mesh', 'characters/dark/d_heavy_orig/d_heavy_orig_01/d_heavy_orig_01_parts_mesh'] },
  rebel: { parts: ['characters/light/l_assault_orig/l_assault_orig_ds_01/l_assault_orig_ds_01_mesh', 'characters/bodyparts/hands_01/hands_01_mesh', 'characters/bodyparts/headgear_05/headgear_05_mesh', 'characters/heads/heads_hakan/heads_hakan_01_mesh'] },
  clone: { parts: ['characters/light/l_assault_preq/l_assault_preq_01/l_assault_preq_01_mesh', 'characters/light/l_assault_preq/l_assault_preq_01/l_assault_preq_01_helmet_mesh', 'characters/bodyparts/gloves_05/gloves_05_mesh'] },
  clonephase1: { parts: ['characters/light/l_assault_preq/l_assault_preq_01/l_assault_preq_01_mesh', 'characters/light/l_assault_preq/l_assault_preq_01/l_assault_preq_02_helmet_mesh', 'characters/bodyparts/gloves_05/gloves_05_mesh'] },
  ewok: { parts: ['characters/hero/ewok/ewok_01/ewok_01_mesh', 'characters/hero/ewok/ewok_01/ewok_hood_01_cloth_brown_mesh'] },
  superdroid: { parts: ['characters/hero/b2/b2_01/b2_01_mesh'] },
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2));
  const root = resolve(args.root ?? 'C:/Users/tilak/Downloads/BF2_Extract');
  const out = resolve(args.out ?? join(ROOT, 'src', 'data', 'bf2017', 'troops.json'));
  const names = indexAt(root).map((r) => r.name);
  const r = roster({ names, read: readRecordAt(root), bodies: BODIES });
  // (two files: the roster the game reads, and the outfits' skins whole beside it, for the tools and the Collection)
  const from = { export: 'build 489592', date: new Date().toISOString().slice(0, 10), script: 'scripts/bf2017-troops.mjs' };
  const { outfits, ...rest } = r;
  await writeFile(out, `${JSON.stringify({ _from: from, ...rest }, null, 1)}\n`);
  await writeFile(out.replace(/\.json$/, '.outfits.json'), `${JSON.stringify({ _from: from, outfits })}\n`);
  const skins = Object.values(r.outfits).flatMap((o) => o?.skins ?? []);
  console.log(`${Object.keys(r.classes).length} classes, ${Object.keys(r.specials).length} reinforcements, ${Object.keys(r.outfits).length} outfits, ${skins.length} skins (${skins.filter((s) => s.body).length} with a body, ${skins.filter((s) => s.stand).length} stood in); ${r.missing.length} missing → ${out}`);
  for (const [planet, rows] of Object.entries(r.wear)) console.log(`  ${planet}: ${Object.entries(rows).map(([id, w]) => `${id} ${w.player ?? '-'}/${w.bots ?? '-'}`).join(', ')}`);
  if (r.missing.length) console.log(`  missing: ${r.missing.slice(0, 12).join(', ')}${r.missing.length > 12 ? ' …' : ''}`);
}
