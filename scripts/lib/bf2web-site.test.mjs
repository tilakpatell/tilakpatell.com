import { describe, expect, it } from 'vitest';
import { CONTRACT, SHARED_UI, adopted, programNeeds, contractProblems, hookProblems, missingFiles, newest, rulebookProblems, uiDataFor, uploadPlan } from './bf2web-site.mjs';

const sha = (c) => c.repeat(64);
const entry = (path, bytes = 10, s = sha('a')) => ({ path, role: 'retail-derived', bytes, sha256: s });
const manifest = (extra = [], over = {}) => ({
  schema: CONTRACT.schema,
  created: '2026-10-28T09:09:08.569Z',
  routes: { '/export/': {}, '/ui-data/': {}, '/profile/': {} },
  entries: [...CONTRACT.files.map((f) => entry(f)), ...extra],
  ...over,
});
const WORLD_PLAY = "window.__playFlow = flow; flow.sessions.push(record); s.endReason = reason; const setState = state => { document.body.className = 'play-' + state; }; if (action === 'quit') end();";

describe('a bf2-web build against the site’s contract', () => {
  it('takes a build that keeps to it', () => {
    expect(contractProblems(manifest())).toEqual([]);
    expect(hookProblems(WORLD_PLAY)).toEqual([]);
  });

  it('names what a build broke, so a person looks at that change and not every build', () => {
    expect(contractProblems(manifest([], { schema: 'bf2-play-site/2' }))[0]).toMatch(/schema "bf2-play-site\/2"/);
    expect(contractProblems(manifest([], { routes: { '/export/': {}, '/assets/': {} } }))).toEqual(['a root the Worker doesn’t serve: /assets/']);
    expect(contractProblems({ ...manifest(), entries: manifest().entries.filter((e) => e.path !== 'ui/main.js') })).toEqual(['missing ui/main.js']);
    expect(contractProblems(manifest([entry('../secret'), entry('a//b'), { path: 'x', bytes: -1, sha256: 'no' }]))).toEqual([
      'an unsafe path: "../secret"',
      'an unsafe path: "a//b"',
      'no size: x',
      'no sha256: x',
    ]);
    expect(contractProblems(null)).toEqual(['no manifest']);
    expect(hookProblems(WORLD_PLAY.replace('endReason', 'reason'))).toEqual(['the play page no longer has a session’s endReason']);
    expect(hookProblems('')).toEqual(['no runtime/world-play.mjs']);
  });

  it('holds an upload to every file its manifest lists, at its size', () => {
    const m = manifest();
    const listed = [{ key: 'sites/b/manifest.json', size: 1 }, ...m.entries.map((e) => ({ key: `sites/b/${e.path}`, size: e.bytes }))];
    expect(missingFiles(m, 'sites/b/', listed)).toEqual([]);
    expect(missingFiles(m, 'sites/b/', listed.slice(0, -1))).toEqual(['not uploaded: runtime/world-play.mjs']);
    expect(missingFiles(m, 'sites/b/', listed.slice(1).map((f, i) => (i === 0 ? { ...f, size: 3 } : f)))).toEqual(['manifest.json not uploaded', 'index.html: 3 bytes, the manifest says 10']);
  });

  it('asks for the front end’s nine rulebooks', () => {
    const all = CONTRACT.rulebooks.map((r) => ({ key: `library/ui/frontend/${r}`, size: 1 }));
    expect(rulebookProblems(all)).toEqual([]);
    expect(rulebookProblems(all.filter((f) => !f.key.endsWith('fonts.json')))).toEqual(['rulebook missing: fonts.json']);
  });

  it('serves a build’s own rulebooks when it carries all nine, else the shared ones', () => {
    const own = CONTRACT.rulebooks.map((r) => ({ key: `sites/b/ui-data/${r}`, size: 1 }));
    const shared = CONTRACT.rulebooks.map((r) => ({ key: `${SHARED_UI}${r}`, size: 1 }));
    expect(uiDataFor('b', own, [])).toEqual({ uiData: 'sites/b/ui-data/', problems: [] });
    expect(uiDataFor('b', own.slice(1), shared)).toEqual({ uiData: SHARED_UI, problems: [] });
    expect(uiDataFor('b', [], shared.slice(1)).problems).toEqual(['rulebook missing: screens.json']);
  });
});

describe('which build the site plays', () => {
  const at = (id, created, problems = []) => ({ id, created, problems });

  it('takes the newest good build newer than the one it plays, and none when nothing is newer', () => {
    const current = { id: 'main-0000000a', created: '2026-10-28T09:00:00Z' };
    const cs = [at('main-0000000a', '2026-10-28T09:00:00Z'), at('main-0000000b', '2026-10-29T09:00:00Z'), at('main-0000000c', '2026-10-30T09:00:00Z', ['missing ui/main.js'])];
    expect(newest(cs, current)).toBe('main-0000000b');
    expect(newest([at('main-0000000a', '2026-10-28T09:00:00Z'), at('main-000000ff', '2026-10-27T09:00:00Z')], current)).toBeNull();
    expect(newest(cs, null)).toBe('main-0000000b');
  });

  it('takes only a build of bf2-web’s main on its own, never a branch’s or a worktree’s', () => {
    const current = { id: 'main-da7a51b3', created: '2026-10-28T09:09:08Z' };
    // (2026-10-28: the desktop's round-1030 worktree build, uploaded beside main's, was adopted until this)
    expect(newest([at('r1030-306142c9', '2026-10-28T15:15:35Z')], current)).toBeNull();
    expect(newest([at('r1030-306142c9', '2026-10-28T15:15:35Z'), at('main-f675e260', '2026-10-28T14:00:00Z')], current)).toBe('main-f675e260');
  });

  it('names the build in play.json with its size, keeping the rest', () => {
    const play = { _about: 'x', build: 'main-a', site: 'sites/main-a/', export: 'web/', uiData: 'library/ui/frontend/', exportAllow: ['fonts/'], mb: 1 };
    const m = manifest([entry('big', 2_000_000_000)]);
    expect(adopted(play, 'main-b', m)).toEqual({ ...play, build: 'main-b', site: 'sites/main-b/', mb: 2000 });
    expect(adopted(play, 'main-b', m, 'sites/main-b/ui-data/').uiData).toBe('sites/main-b/ui-data/');
    expect(adopted(play, 'main-b', m, undefined, { features: [], limits: { maxBindGroups: 4 } }).needs).toEqual({ features: [], limits: { maxBindGroups: 4 } });
  });
});

describe('what a build asks of the visitor’s GPU', () => {
  const tex = (group, binding) => ({ group, binding, layout: { texture: { sampleType: 'float', viewDimension: '2d' } } });
  const smp = (group, binding) => ({ group, binding, layout: { sampler: { type: 'filtering' } } });
  const ubo = (group, binding) => ({ group, binding, layout: { buffer: { type: 'uniform' } } });

  it('counts each stage’s bindings against WebGPU’s per-stage limits, and the groups a layout spans', () => {
    // (Hoth's worst material: 23 textures in its pixel stage, over the default 16, so a GPU that allows 16 never makes its pipeline)
    const material = { vertex: { bindings: [ubo(0, 0)] }, pixel: { wgsl: 'fn main() {}', bindings: [ubo(0, 1), ...Array.from({ length: 23 }, (_, i) => tex(1, i)), smp(2, 0), smp(2, 1)] } };
    const { limits, features } = programNeeds([material]);
    expect(limits).toMatchObject({ maxSampledTexturesPerShaderStage: 23, maxSamplersPerShaderStage: 2, maxUniformBuffersPerShaderStage: 1, maxBindGroups: 3 });
    expect(features).toEqual([]);
  });

  it('asks for dual-source blending when a material blends so, and counts only the programs the build draws', () => {
    const dual = { name: 'material/dual', vertex: { bindings: [] }, pixel: { wgsl: 'enable dual_source_blending;\nfn main() {}', bindings: [] } };
    const wide = { name: 'material/unused', vertex: { bindings: [] }, pixel: { wgsl: '', bindings: Array.from({ length: 30 }, (_, i) => tex(0, i)) } };
    expect(programNeeds([dual, wide]).limits.maxSampledTexturesPerShaderStage).toBe(30);
    const { limits, features } = programNeeds([dual, wide], new Set(['material/dual']));
    expect(features).toEqual(['dual-source-blending']);
    expect(limits.maxSampledTexturesPerShaderStage).toBe(0);
  });
});

describe('uploading a build', () => {
  it('copies what the last build has byte for byte, skips what is up already, puts the rest and the manifest last', () => {
    const m = manifest([entry('scene.res', 5, sha('b')), entry('new.res', 6, sha('c'))]);
    const previous = manifest([entry('scene.res', 5, sha('b')), entry('new.res', 6, sha('d'))]);
    const plan = uploadPlan(m, { prefix: 'sites/n/', previous, previousPrefix: 'sites/o/', existing: [{ key: 'sites/n/index.html', size: 10 }] });
    expect(plan.find((p) => p.key === 'sites/n/index.html')).toEqual({ action: 'skip', key: 'sites/n/index.html' });
    expect(plan.find((p) => p.key === 'sites/n/scene.res')).toEqual({ action: 'copy', key: 'sites/n/scene.res', from: 'sites/o/scene.res' });
    expect(plan.find((p) => p.key === 'sites/n/new.res')).toEqual({ action: 'put', key: 'sites/n/new.res', path: 'new.res' });
    expect(plan.at(-1)).toEqual({ action: 'put', key: 'sites/n/manifest.json', path: 'manifest.json' });
    expect(uploadPlan(m, { prefix: 'sites/n/' }).filter((p) => p.action === 'put')).toHaveLength(m.entries.length + 1);
  });
});
