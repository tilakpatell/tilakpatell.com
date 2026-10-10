// The Battlefront II (2017) drop's manifest (`web/models.jsonl` in the
// bf2017-assets bucket): one JSON line per model, with its LOD chain (up to
// six cuts, each with its file, triangles and bytes), bounds in metres, rig,
// textures and the derived maps the uploader makes. The uploader has already
// cut every model for the web at each level, so the import picks a cut from
// the chain rather than simplifying one (the spec's fact 1): a picked cut
// keeps DICE's own LOD work, which a simplifier would only approximate.

// The sequel era, which the site shows none of (.claude/skills/autopilot/
// SKILL.md): the folder names the drop files it under.
export const SEQUEL = ['kyloren', 'rey', 'finn', 'captainphasma', 'firstorder', 'starkiller', 'takodana', 'jakku', 'resurgent', 'xwing_t70', 'tiefighterfirstorder', 'tiefighterspecialforces', 'resistance', 'ep7', 'ep9', 'skytrooper', 'jump_cop', 'newera', 'kylo', 'phasma', 'bb8', 'bb9e', 'crait', 'spacebear'];

// (a short name is matched only between separators, so 'rey' never catches
// 'grey' or 'osprey'; a long one anywhere in a segment, so 'firstorder'
// catches 'stormtrooper_firstorder_01')
const SEQUEL_TESTS = SEQUEL.map((s) => (s.length < 5 ? new RegExp(`(^|[_\\-.\\d])${s}($|[_\\-.\\d])`) : new RegExp(s.replace(/[_-]/g, '[_-]'))));

export function isSequel(name) {
  return name
    .toLowerCase()
    .split('/')
    .some((seg) => SEQUEL_TESTS.some((re) => re.test(seg)));
}

export function readManifest(text) {
  const m = new Map();
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    const entry = JSON.parse(line);
    m.set(entry.name, entry);
  }
  return m;
}

// The site's three cuts from a model's chain: the plain one is the first
// (most detailed) LOD within `plainMax` triangles, else the lightest there is;
// the light one (`.lod1`) the first lighter than that within `lod1Max`; the
// ultra one LOD0, when asked for and it is not already the plain cut.
export function cutsFor(entry, { lod1Max = 2500, plainMax = 12000, ultra = false } = {}) {
  const lods = [...entry.lods].sort((a, b) => a.lod - b.lod);
  const plain = lods.find((l) => l.triangles <= plainMax) ?? lods[lods.length - 1];
  const lod1 = lods.find((l) => l.lod > plain.lod && l.triangles <= lod1Max) ?? null;
  return { lod1, plain, ultra: ultra && lods[0].lod < plain.lod ? lods[0] : null };
}

// The cuts of the full-fidelity import (the design's section 6, as revised
// 2026-10-10, 05:40): the plain cut is the game's LOD0 itself, never
// simplified (it lives in the bucket, not in git); the light one (`.lod1`)
// the first LOD after it within `lod1Max` triangles (a soldier's LOD4), else
// the lightest; the far one (`.far`, for the squads past the level's `mid`)
// the chain's last, when it is lighter still.
export function fullCuts(entry, { lod1Max = 1500 } = {}) {
  const lods = [...entry.lods].sort((a, b) => a.lod - b.lod);
  const plain = lods[0];
  const rest = lods.slice(1);
  const lod1 = rest.find((l) => l.triangles <= lod1Max) ?? rest[rest.length - 1] ?? null;
  const last = lods[lods.length - 1];
  return { plain, lod1, far: lod1 && last.lod > lod1.lod ? last : null };
}

const folderOf = (name) => name.slice(0, name.lastIndexOf('/') + 1);
const globRe = (glob) => new RegExp(`^${glob.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*').replace(/\?/g, '[^/]')}$`);
// (Frostbite's variants a composite never wants: unused, menu, wrecked and cutscene copies)
const NEVER = /donotuse|frontend|wreck|cutscene/i;

// A composite's parts: the models in its folder whose last segment matches a
// glob, and any named in full (an item with a `/`: a hero's head and hair
// are under characters/heads/, not the body's folder), whatever its folder.
export function partsOf(manifest, name, globs) {
  const folder = folderOf(name);
  const full = globs.filter((g) => g.includes('/'));
  const res = globs.filter((g) => !g.includes('/')).map(globRe);
  const out = [];
  for (const [other, entry] of manifest) {
    if (other === name || folderOf(other) !== folder) continue;
    const last = other.slice(folder.length);
    if (NEVER.test(last) || !res.some((re) => re.test(last))) continue;
    out.push(entry);
  }
  for (const n of full) {
    const entry = manifest.get(n);
    // (a full name is asked for by name: one the manifest hasn't is a typo, and a hero would come out headless)
    if (!entry) throw new Error(`part ${n}: not in the manifest (try the fetch's --list)`);
    if (n !== name && !out.includes(entry)) out.push(entry);
  }
  return out;
}
