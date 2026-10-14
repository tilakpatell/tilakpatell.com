// The interiors' visual environments, blended in by where the view stands:
// the game's AreaProximityEntityData (bf2-re findings 60). Each area names the VEs
// its Out drives (a reference's Visibility) and the shapes it measures from;
// its visibility is
//
//   v = max(0, 1 − d / ProximityDistance)
//
// d the distance from the view to the nearest of its shapes, 0 inside one
// (the live image's per-entity update FUN_140b75090: the view's position
// turned into each OBB's frame, FUN_146a198a0's point-to-box distance, the
// least kept, 1 − d / distance clamped at 0). Hoth: VE_PV_Hoth_Interior_01
// over 20 m and VE_No_Sun over 1 m of the same nine boxes (the hangars, the
// corridors, the fuel rooms), and the interior VE again in the two ice caves.
//
// A VE is a patch (findings 22 §1): it lerps only the fields its
// PropertyOverrides name toward its values, by its visibility, over what the
// VEs under it gave. Under it here is the weather (Hoth's variant, its
// reference at 8000); the patches' references are at 0, which the fold puts
// on top (the lower number last: the spawn wipe's VE_SpawnScreen_BlackFade_01,
// an explicit 1000, must cover the field's 8000 for the wipe to go black).
// Fields that do not lerp (a switch, a texture) take the patch's value from
// half visibility (hand: the fold's rule for them is not read). A value the
// patch itself turns off is not taken: the interior's FogColor (1, 1, 1)
// beside its FogColorEnable false, its ForwardLightScattering… beside
// ForwardLightScatteringEnabled false (a field under the prefix of a
// `…Enable`/`…Enabled` the patch sets false); the switch itself is.
//
// areaDistance(shape, p) → m                      (pure)
// areaVisibility(area, p) → 0…1                   (pure)
// visibilities(areas, p) → { [ve]: 0…1 }          (pure: a VE's most over its areas)
// patchRecord(record, patches, vis) → record      (pure: the weather's record with each patch folded in)
// switchedOff(fields) → prefixes                  (pure: what a component's own switches turn off)
// skyShare(patches, vis) → 0…1                    (pure: what of the sky the view still has)
// insideOf(lighting) → { areas, patches } | null  (the rulebook's rows, as applyGameLight takes them)

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

export function areaDistance(shape, p) {
  const d = [p[0] - shape.at[0], p[1] - shape.at[1], p[2] - shape.at[2]];
  if (shape.kind === 'sphere') return Math.max(0, Math.hypot(d[0], d[1], d[2]) - (shape.r ?? 0));
  // (the view in the box's frame: along each axis over the axis's length², as the game's update does)
  const basis = shape.basis ?? [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ];
  let out = 0;
  for (let k = 0; k < 3; k++) {
    const axis = basis[k];
    const local = dot(axis, d) / Math.max(1e-12, dot(axis, axis));
    const over = Math.abs(local) - shape.half[k];
    if (over > 0) out += over * over;
  }
  return Math.sqrt(out);
}

export function areaVisibility(area, p) {
  let d = Infinity;
  for (const s of area.shapes ?? []) {
    d = Math.min(d, areaDistance(s, p));
    if (d <= 0) break;
  }
  if (!(area.proximity > 0) || !Number.isFinite(d)) return d <= 0 ? 1 : 0;
  return Math.max(0, 1 - d / area.proximity);
}

export function visibilities(areas, p) {
  const out = {};
  for (const a of areas ?? []) {
    const v = areaVisibility(a, p);
    for (const { ve } of a.ves ?? []) out[ve] = Math.max(out[ve] ?? 0, v);
  }
  return out;
}

const mix = (a, b, t) => (t >= 1 ? b : a + (b - a) * t);
function blend(from, to, t) {
  if (typeof to === 'number' && typeof from === 'number') return mix(from, to, t);
  if (Array.isArray(to) && Array.isArray(from) && to.length === from.length && to.every((v) => typeof v === 'number')) return from.map((v, i) => mix(v, to[i], t));
  return t >= 0.5 ? to : from;
}

// the patches in the fold's order: the higher reference number first, the lower on top
const ordered = (patches) => Object.entries(patches ?? {}).sort(([, a], [, b]) => (b.reference ?? 0) - (a.reference ?? 0));

// the prefixes a component's own switches turn off (FogColorEnable false: 'FogColor')
export const switchedOff = (fields) =>
  Object.entries(fields ?? {})
    .filter(([f, v]) => v === false && /Enabled?$/.test(f) && f !== 'Enable')
    .map(([f]) => f.replace(/Enabled?$/, ''));

export function patchRecord(record, patches, vis) {
  const out = { ...record };
  for (const [ve, patch] of ordered(patches)) {
    const t = Math.min(1, Math.max(0, vis?.[ve] ?? 0));
    if (!(t > 0)) continue;
    for (const [type, fields] of Object.entries(patch.components ?? {})) {
      // (ShaderParams are many a VE, a named parameter each: none the site draws with)
      if (type === 'ShaderParams') continue;
      const key = `${type}ComponentData`;
      const was = out[key]?.[0] ?? {};
      const next = { ...was };
      const off = switchedOff(fields);
      for (const [f, v] of Object.entries(fields)) {
        if (f.startsWith('_')) continue;
        if (off.some((p) => f.startsWith(p) && !/Enabled?$/.test(f))) continue;
        next[f] = was[f] === undefined ? (t >= 0.5 ? v : undefined) : blend(was[f], v, t);
        if (next[f] === undefined) delete next[f];
      }
      out[key] = [next, ...(out[key]?.slice(1) ?? [])];
    }
  }
  return out;
}

// The sky the view still sees: the share the patches that put the sun out
// leave (VE_No_Sun's SunIntensity 0.001 lux: its core is under the
// mountain). Hand: the game has no sky light term (findings 15); the site's
// hemisphere and the meter's sky stand in for Enlighten's sky bounce and the
// histogram's view of the sky, and neither reaches in under the rock.
export function skyShare(patches, vis) {
  let out = 1;
  for (const [ve, patch] of Object.entries(patches ?? {})) {
    const sun = patch.components?.OutdoorLight?.SunIntensity;
    if (typeof sun === 'number' && sun < 1) out = Math.min(out, 1 - Math.min(1, Math.max(0, vis?.[ve] ?? 0)));
  }
  return out;
}

// the rulebook's rows (maps/<level>.lighting.json: areas, patches) as the
// light stack takes them, each patch with the reference number its areas place it at
export function insideOf(lighting) {
  const areas = (lighting?.areas ?? []).filter((a) => a.shapes?.length && a.ves?.length);
  if (!areas.length) return null;
  const patches = {};
  for (const a of areas) {
    for (const { ve, priority } of a.ves) {
      const p = lighting.patches?.[ve];
      if (p && !patches[ve]) patches[ve] = { ...p, reference: p.explicit ? p.priority : priority };
    }
  }
  return Object.keys(patches).length ? { areas, patches } : null;
}
