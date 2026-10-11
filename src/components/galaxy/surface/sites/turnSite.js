// A site's layout turned about its 0, 0 and moved (lane E3). The game's level
// is laid as the game laid it (scripts/bf2017-level.mjs keeps it square: its
// heightmaps and parts are not turned), so where a world's own scene faces
// another way than the game's map (Kashyyyk's lagoon at +z, the game's sea at
// −x), the site's places, things, people and quests are turned to the map
// instead, and moved by `by` after the turn (the site's beach onto the game's
// shore). The turn is index.js's: a thing facing +z with yaw 0 faces
// [sin t, cos t] after it, so a yaw adds `t`. Pure: a raw site in, a new one out.
//
//   turnSite(raw, { yaw, by }) → raw, every position turned by yaw and moved
//     by [dx, dz], every heading turned by yaw
//   turnAt(turn) → ([x, z]) → [x, z], one point as turnSite moves it (for
//     what places itself on a site from outside it: an assault's posts)

const r3 = (v) => Math.round(v * 1000) / 1000 + 0; // (+ 0: no −0)

export function turnAt(turn) {
  const t = turn?.yaw ?? 0;
  const [dx, dz] = turn?.by ?? [0, 0];
  const c = Math.cos(t);
  const s = Math.sin(t);
  return ([x, z]) => [r3(x * c + z * s + dx), r3(-x * s + z * c + dz)];
}

export function turnSite(raw, turn) {
  const t = turn?.yaw ?? 0;
  const [dx, dz] = turn?.by ?? [0, 0];
  if (!t && !dx && !dz) return raw;
  const xz = turnAt(turn);
  const xyz = ([x, y, z]) => {
    const [a, b] = xz([x, z]);
    return [a, y, b];
  };
  const at = (o) => (o?.at ? { ...o, at: xz(o.at) } : o);
  // (a heading left out is 0, and is turned too; a figure's `face` left out
  // is its own choosing, and stays left out)
  const headed = (o, key) => (o && (o[key] != null || key === 'yaw') ? { ...o, [key]: (o[key] ?? 0) + t } : o);
  const all = (list, f) => list?.map(f);
  const thing = (o) => headed(at(o), 'yaw');
  const tos = (list) => list?.map((e) => (e.to ? { ...e, to: xz(e.to) } : e));
  // (a quest step's spots, gates, spawns, respawn and the `to` of its start and end)
  const step = (st) => ({
    ...at(st),
    ...(st.gates ? { gates: st.gates.map(xz) } : {}),
    ...(st.spots ? { spots: st.spots.map(xz) } : {}),
    ...(st.spawn ? { spawn: Array.isArray(st.spawn) ? st.spawn.map(at) : at(st.spawn) } : {}),
    ...(st.respawn ? { respawn: xz(st.respawn) } : {}),
    ...(st.start ? { start: tos(st.start) } : {}),
    ...(st.end ? { end: tos(st.end) } : {}),
  });
  const g = raw.ground;
  const out = {
    land: headed(at(raw.land), 'yaw'),
    ground: g && { ...g, ...Object.fromEntries(['flats', 'pits', 'layers', 'flight'].filter((k) => g[k]).map((k) => [k, g[k].map(at)])) },
    // (a place's own things are laid relative to it: its yaw turns them)
    places: all(raw.places, (p) => headed(at(p), 'yaw')),
    things: all(raw.things, thing),
    rides: all(raw.rides, thing),
    life: all(raw.life, (a) => ({ ...headed(at(a), 'face'), ...(a.path ? { path: a.path.map(xz) } : {}) })),
    wants: all(raw.wants, (w) => ({ ...at(w), ...(w.spots ? { spots: w.spots.map(xz) } : {}) })),
    quests: all(raw.quests, (q) => ({ ...q, steps: q.steps.map(step) })),
    skyships: all(raw.skyships, (k) => ({ ...k, at: xyz(k.at), yaw: (k.yaw ?? 0) + t })),
  };
  // (what the raw site leaves out stays left out, for siteFrom's defaults)
  return { ...raw, ...Object.fromEntries(Object.entries(out).filter(([, v]) => v !== undefined)) };
}
