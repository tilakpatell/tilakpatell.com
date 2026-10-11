// A Chrome CPU profile (the DevTools protocol's Profiler.stop, a
// .cpuprofile) summed for lane X2's question: where the main thread's time
// goes, by module and by function, per frame. Pure; galaxy-check.mjs's
// PROFILE writes the summary beside the profile.
//
//   summarise(profile, { frames, top = 10, root = '/src/' }) → {
//     ms (sampled, idle left out), idleMs, frames,
//     modules: [{ module, selfMs, perFrame, share }],
//     self: [{ fn, selfMs, perFrame, share }],
//     total: [{ fn, totalMs, perFrame, share }] (a function's own time and its callees', each sample once) }
//   moduleOf(url, root) → 'src/lib/level/lod.js' | 'three' | 'rapier' | '(native)' | …
//
// A sample's time is the gap to the next one (DevTools' way: timeDeltas[i + 1]
// is how long samples[i] was on the stack); the last sample's is the mean.

const SPECIAL = new Set(['(program)', '(idle)', '(garbage collector)', '(root)']);

export function moduleOf(url, root = '/src/') {
  if (!url) return '(native)';
  const path = url.replace(/^[a-z]+:\/\/[^/]+/i, '').replace(/[?#].*$/, '');
  const dep = path.match(/node_modules\/(?:\.vite\/deps\/)?((?:@[^/]+\/)?[^/]+)/) ?? path.match(/\.vite\/deps\/([^/.]+(?:_[^/.]+)*)\.js/);
  if (dep) {
    const name = dep[1].replace(/_/g, '/');
    if (/rapier/.test(name)) return 'rapier';
    if (/^three/.test(name)) return 'three';
    return name;
  }
  const i = path.indexOf(root);
  if (i >= 0) return `src/${path.slice(i + root.length)}`;
  return path.replace(/^\//, '') || '(native)';
}

const label = (n, root) => {
  const f = n.callFrame;
  if (SPECIAL.has(f.functionName)) return f.functionName;
  return `${f.functionName || '(anonymous)'} ${moduleOf(f.url, root)}:${f.lineNumber + 1}`;
};

export function summarise(profile, { frames = 1, top = 10, root = '/src/' } = {}) {
  const byId = new Map(profile.nodes.map((n) => [n.id, n]));
  const parent = new Map();
  for (const n of profile.nodes) for (const c of n.children ?? []) parent.set(c, n.id);
  const { samples = [], timeDeltas = [] } = profile;
  const mean = samples.length > 1 ? (profile.endTime - profile.startTime) / samples.length : 0;
  const self = new Map();
  const total = new Map();
  const modules = new Map();
  let ms = 0;
  let idleMs = 0;
  for (let i = 0; i < samples.length; i++) {
    const dt = (i + 1 < timeDeltas.length ? timeDeltas[i + 1] : mean) / 1000;
    const node = byId.get(samples[i]);
    if (!node) continue;
    const name = node.callFrame.functionName;
    if (name === '(idle)') {
      idleMs += dt;
      continue;
    }
    ms += dt;
    const key = label(node, root);
    self.set(key, (self.get(key) ?? 0) + dt);
    const mod = SPECIAL.has(name) ? name : moduleOf(node.callFrame.url, root);
    modules.set(mod, (modules.get(mod) ?? 0) + dt);
    const seen = new Set();
    for (let id = node.id; id !== undefined; id = parent.get(id)) {
      const n = byId.get(id);
      if (n.callFrame.functionName === '(root)') break;
      const k = label(n, root);
      if (seen.has(k)) continue;
      seen.add(k);
      total.set(k, (total.get(k) ?? 0) + dt);
    }
  }
  const f = Math.max(1, frames);
  const rows = (m, field, keyName) =>
    [...m]
      .sort((a, b) => b[1] - a[1])
      .slice(0, top)
      .map(([k, v]) => ({ [keyName]: k, [field]: +v.toFixed(1), perFrame: +(v / f).toFixed(3), share: ms ? +(v / ms).toFixed(4) : 0 }));
  return { ms: +ms.toFixed(1), idleMs: +idleMs.toFixed(1), frames, modules: rows(modules, 'selfMs', 'module'), self: rows(self, 'selfMs', 'fn'), total: rows(total, 'totalMs', 'fn') };
}
