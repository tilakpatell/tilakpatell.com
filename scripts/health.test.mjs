import { describe, expect, it } from 'vitest';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeContext, metric } from './health/context.mjs';
import bigFiles, { CEILING, WARN } from './health/big-files.mjs';
import boundaryBreaks, { worlds } from './health/boundary-breaks.mjs';
import cycles from './health/cycles.mjs';
import { graph, resolve, uncomment } from './health/graph.mjs';
import lintDisables from './health/lint-disables.mjs';
import todoNotes from './health/todo-notes.mjs';
import hudKit from './health/hud-kit.mjs';
import kbdStyles, { capRules } from './health/kbd-styles.mjs';
import stackPages from './health/stack-pages.mjs';
import glslSites, { EXEMPT, NAMES, sites } from './health/glsl-sites.mjs';
import renderers, { EXEMPT as RENDERER_EXEMPT } from './health/renderers.mjs';
import loops, { EXEMPT as LOOP_EXEMPT } from './health/loops.mjs';
import clientJson, { FLOOR } from './health/client-json-kb.mjs';
import { countBinaries, LIMIT } from './health/doc-binaries.mjs';
import { check, describe as words, ratchet } from './health/ratchet.mjs';

const TREE = fileURLToPath(new URL('./health/fixtures/tree/', import.meta.url));
const ctx = await makeContext(TREE);

describe('the measure, on a fixture tree', () => {
  it('big-files counts files over the ceiling and lists every file over the warning line, tests left out', async () => {
    const m = await bigFiles(ctx);
    expect(m.value).toBe(1);
    expect(m.detail.map((d) => d.file)).toEqual(['src/world/long.js', 'src/world/mid.js']);
    expect(m.detail[0].n).toBeGreaterThan(CEILING);
    expect(m.detail[1].n).toBeGreaterThan(WARN);
    expect(m.better).toBe('lower');
  });

  it('lint-disables counts every form, in src and scripts', async () => {
    const m = await lintDisables(ctx);
    expect(m.value).toBe(3);
    expect(m.detail).toEqual([{ file: 'src/world/small.js', n: 2 }, { file: 'scripts/tool.mjs', n: 1 }]);
  });

  it('kbd-styles counts the rules that draw a key cap outside the house one, walking the CSS itself', async () => {
    const m = await kbdStyles(ctx);
    expect(m.value).toBe(2);
    expect(m.detail).toEqual([{ file: 'src/world/world.css', n: 2 }]);
  });

  it('kbd-styles reads a selector, not a word', () => {
    expect(capRules('.a kbd { x: 1 } .b-kbd { x: 1 } .kbd-ish { x: 1 } .keyboard { x: 1 }')).toBe(2);
    expect(capRules('/* kbd { } */ .a { x: 1 }')).toBe(0);
    expect(capRules('@media (x) { .a > kbd, .b { x: 1 } }')).toBe(1);
  });

  it('todo-notes counts TODO, FIXME and HACK under src only', async () => {
    const m = await todoNotes(ctx);
    expect(m.value).toBe(2);
    expect(m.detail).toEqual([{ file: 'src/world/small.js', n: 2 }]);
  });
});

describe('the stack pages, on a fixture tree', () => {
  it('counts the packages of package.json with no row in the stack index, and names each', async () => {
    const m = await stackPages(ctx);
    expect(m.value).toBe(2);
    expect(m.detail).toEqual([
      { file: 'docs/stack/README.md', n: 1, note: '@gltf-transform/core' },
      { file: 'docs/stack/README.md', n: 1, note: 'lonely' },
    ]);
  });
  it('counts every package when there is no index', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'stack-pages-'));
    await writeFile(join(dir, 'package.json'), JSON.stringify({ dependencies: { a: '1' }, devDependencies: { b: '1' } }));
    expect((await stackPages(await makeContext(dir))).value).toBe(2);
  });
});

describe('the GLSL sites, on a fixture tree', () => {
  it('counts the names a WebGPU port removes, comments, tests and the exempt infrastructure left out', async () => {
    const m = await glslSites(ctx);
    expect(m.value).toBe(2);
    expect(m.detail).toEqual([{ file: 'src/world/glsl.js', n: 2 }]);
  });
  it('reads RawShaderMaterial as one site, not two, and agrees with the WebGPU design’s exempt list', () => {
    expect(NAMES).toContain('RawShaderMaterial');
    expect(sites('new RawShaderMaterial(); new ShaderMaterial(); myShaderMaterialish; x.RenderPass')).toBe(3);
    expect(EXEMPT).toEqual(['src/lib/three/frameGuard.js', 'src/lib/three/renderer.js', 'src/lib/three/gpuWork.js', 'src/runtime/']);
  });
});

describe('the engine floor’s measure, on fixture trees', () => {
  const fixture = (name) => fileURLToPath(new URL(`./health/fixtures/${name}/`, import.meta.url));

  it('renderers counts the constructors in code outside the runtime, comments, strings and tests left out', async () => {
    const m = await renderers(await makeContext(fixture('renderers')));
    expect(m.value).toBe(1);
    expect(m.detail).toEqual([{ file: 'src/a/stage.js', n: 1 }]);
    expect(RENDERER_EXEMPT).toEqual(['src/runtime/']);
  });

  it('loops counts a file that asks for frames once, however often it asks; a cancel alone, the allowed loops and tests are none', async () => {
    const m = await loops(await makeContext(fixture('loops')));
    expect(m.value).toBe(1);
    expect(m.detail).toEqual([{ file: 'src/a/spin.js', n: 1 }]);
    expect(LOOP_EXEMPT).toEqual(['src/runtime/', 'src/lib/three/loop.js', 'src/lib/shownLoop.js']);
  });

  it('client-json-kb sums each record over the floor once, read by the client; a ?url, a script and a test are none', async () => {
    const m = await clientJson(await makeContext(fixture('client-json')));
    expect(FLOOR).toBe(65536);
    expect(m.value).toBe(69);
    expect(m.detail).toEqual([{ file: 'src/data/big.json', n: 69, note: 'src/a/reads.js' }]);
  });

  it('doc-binaries counts the files over a megabyte', async () => {
    const sizes = { 'docs/a.png': 2 * 1024 * 1024, 'docs/b.md': 10 * 1024 };
    const m = await countBinaries(Object.keys(sizes), { stat: async (f) => ({ size: sizes[f] }) });
    expect(LIMIT).toBe(1_048_576);
    expect(m.value).toBe(1);
    expect(m.detail).toEqual([{ file: 'docs/a.png', n: 2048 }]);
  });
});

describe('the HUD kit, on a fixture tree', () => {
  it('counts the worlds whose HUD imports nothing from the kit', async () => {
    const hud = await makeContext(fileURLToPath(new URL('./health/fixtures/hud/', import.meta.url)));
    const m = await hudKit(hud, ['alpha', 'beta', 'missing']);
    expect(m.value).toBe(1);
    expect(m.detail).toEqual([{ file: 'src/components/beta', n: 1 }]);
  });
  it('counts a world on the kit through the towns’ shared HUD', async () => {
    const hud = await makeContext(fileURLToPath(new URL('./health/fixtures/hud/', import.meta.url)));
    expect((await hudKit(hud, ['gamma'])).value).toBe(0);
  });
  it('counts a world on the kit through its own page', async () => {
    const hud = await makeContext(fileURLToPath(new URL('./health/fixtures/hud/', import.meta.url)));
    expect((await hudKit(hud, ['beta'], { beta: ['src/pages/BetaPage.jsx'] })).value).toBe(0);
  });
});

describe('the import graph, on a fixture tree', () => {
  const GRAPH = fileURLToPath(new URL('./health/fixtures/graph/', import.meta.url));
  const at = (p) => join(GRAPH, 'src', p);

  it('resolves a folder, a missing extension, a query, a glob and nothing for a package', async () => {
    expect(await resolve('./e', at('d.js'))).toEqual([at('e/index.js')]);
    expect(await resolve('./g', at('f.jsx'))).toEqual([at('g.jsx')]);
    expect(await resolve('../i', at('e/index.js'))).toEqual([at('i.js')]);
    expect(await resolve('./i.js?raw', at('h.js'))).toEqual([at('i.js')]);
    expect(await resolve('./data/*.json', at('h.js'))).toEqual([at('data/one.json'), at('data/two.json')]);
    expect(await resolve('./data/**/*.json', at('h.js'))).toEqual([at('data/deep/three.json'), at('data/one.json'), at('data/two.json')]);
    expect(await resolve('react', at('i.js'))).toEqual([]);
    expect(await resolve('./nowhere', at('i.js'))).toEqual([]);
  });

  it('has an edge for every relative import, a test file\'s among them, and is built once a run', async () => {
    const gctx = await makeContext(GRAPH);
    const g = await graph(gctx);
    expect(g.edges.map((e) => `${e.from} -> ${e.to}`)).toEqual([
      'src/App.jsx -> src/pages/P.jsx',
      'src/a.js -> src/b.js',
      'src/b.js -> src/c.js',
      'src/c.js -> src/a.js',
      'src/components/alpha/scene.js -> src/components/beta/index.js',
      'src/components/alpha/scene.js -> src/components/beta/props.js',
      'src/components/alpha/scene.js -> src/components/beta/shared/kit.js',
      'src/components/alpha/scene.js -> src/components/beta/sub/index.js',
      'src/components/alpha/scene.js -> src/components/x/thing.js',
      'src/components/beta/index.js -> src/components/beta/props.js',
      'src/components/beta/scene.js -> src/components/beta/props.js',
      'src/components/worlds/registry.js -> src/components/beta/props.js',
      'src/d.js -> src/e/index.js',
      'src/e/index.js -> src/i.js',
      'src/f.jsx -> src/f.css',
      'src/f.jsx -> src/g.jsx',
      'src/h.js -> src/data/deep/three.json',
      'src/h.js -> src/data/one.json',
      'src/h.js -> src/data/two.json',
      'src/h.js -> src/i.js',
      'src/j.js -> src/i.js',
      'src/j.js -> src/k.js',
      'src/k.js -> src/j.js',
      'src/lib/bad.js -> src/components/x/thing.js',
      'src/pages/P.test.jsx -> src/pages/P.jsx',
      'src/t.js -> src/t.test.js',
      'src/t.test.js -> src/t.js',
    ]);
    expect(g.files).toContain('src/t.test.js');
    expect(g.isTest('src/t.test.js')).toBe(true);
    expect(g.isTest('src/t.js')).toBe(false);
    expect(await graph(gctx)).toBe(g);
  });

  it('blanks comments in place but steps over strings, templates and regexes whole', () => {
    const gone = (s) => ' '.repeat(s.length);
    const lines = (...l) => l.join('\n');
    expect(uncomment(lines(
      "import { a, // a's own",
      "} from './a.js'; /* gone */ const glob = './data/*.json';",
      "const url = 'http://x', re = /[/*]/g, half = n / 2; // gone",
      'const t = `${ { a: \'//\' }.a } // kept */`;',
      "if (s) return /'/.test(s); // gone",
    ))).toBe(lines(
      `import { a, ${gone("// a's own")}`,
      `} from './a.js'; ${gone('/* gone */')} const glob = './data/*.json';`,
      `const url = 'http://x', re = /[/*]/g, half = n / 2; ${gone('// gone')}`,
      'const t = `${ { a: \'//\' }.a } // kept */`;',
      `if (s) return /'/.test(s); ${gone('// gone')}`,
    ));
  });

  it('finds each cycle once, shortest first, from its alphabetically first file, tests left out', async () => {
    const g = await graph(await makeContext(GRAPH));
    expect(g.cycles()).toEqual([['src/j.js', 'src/k.js'], ['src/a.js', 'src/b.js', 'src/c.js']]);
  });

  it('cycles counts them, a row each, in the graph\'s order', async () => {
    const m = await cycles(await makeContext(GRAPH));
    expect(m).toMatchObject({ id: 'cycles', value: 2, unit: 'cycles', better: 'lower' });
    expect(m.detail).toEqual([{ file: 'src/j.js → src/k.js', n: 2 }, { file: 'src/a.js → src/b.js → src/c.js', n: 3 }]);
  });

  it('a world is a folder under src/components with a scene.js or a *World.jsx at any depth, less the ones listed', async () => {
    const g = await graph(await makeContext(GRAPH));
    const found = worlds(g.files);
    expect(['alpha', 'beta', 'worlds', 'x'].filter((f) => found.has(f))).toEqual(['alpha', 'beta']);
    const named = worlds(['src/components/gamma/deep/GammaWorld.jsx', 'src/components/cockpit/scene.js', 'src/components/Nav.jsx']);
    expect(named.has('gamma')).toBe(true);
    expect(named.has('cockpit')).toBe(false);
    expect(named.has('caribbean')).toBe(true);
  });

  it('boundary-breaks counts each import across a line RULES.md draws, once, with the rule it breaks', async () => {
    const m = await boundaryBreaks(await makeContext(GRAPH));
    expect(m).toMatchObject({ id: 'boundary-breaks', value: 3, unit: 'imports', better: 'lower' });
    // and no break: alpha through beta's index.js and shared/, alpha taking x's
    // piece, worlds/ reaching into beta, App.jsx mounting a page, a page's test
    // importing its page. Rows go in the rules' order, then by path: every
    // row is 1, and lib's break must lead the cap, not wait behind the worlds'
    expect(m.detail).toEqual([
      { file: 'src/lib/bad.js → src/components/x/thing.js', n: 1, note: 'lib knows no page' },
      { file: 'src/components/alpha/scene.js → src/components/beta/props.js', n: 1, note: 'worlds are islands' },
      { file: 'src/components/alpha/scene.js → src/components/beta/sub/index.js', n: 1, note: 'worlds are islands' },
    ]);
  });
});

describe('metric()', () => {
  const detail = [{ file: 'a.js', n: 1 }, { file: 'b.js', n: 3 }, { file: 'c.js', n: 2 }];
  const thirty = Array.from({ length: 30 }, (_, n) => ({ file: `${n}.js`, n }));

  it('sorts the detail worst first and keeps 25 rows', () => {
    expect(metric({ id: 'x', detail }).detail.map((d) => d.file)).toEqual(['b.js', 'c.js', 'a.js']);
    expect(metric({ id: 'x', detail: thirty }).detail.map((d) => d.n)).toEqual([...Array(30).keys()].reverse().slice(0, 25));
  });

  it('keeps the order of a caller whose detail is already worst first, still 25 rows at most', () => {
    const m = metric({ id: 'x', detail, ordered: true });
    expect(m.detail.map((d) => d.file)).toEqual(['a.js', 'b.js', 'c.js']);
    expect(m).not.toHaveProperty('ordered');
    expect(metric({ id: 'x', detail: thirty, ordered: true }).detail.map((d) => d.n)).toEqual([...Array(25).keys()]);
  });
});

describe('the ratchet', () => {
  const metrics = [
    { id: 'big-files', value: 3, unit: 'files', detail: [{ file: 'a.js', n: 2000 }] },
    { id: 'entry-kb', value: 141, unit: 'kB', detail: [] },
    { id: 'new-one', value: 9, unit: 'things', detail: [] },
  ];

  it('check names only what is over a budget it has; a metric without a budget never fails', () => {
    expect(check(metrics, { 'big-files': 3, 'entry-kb': 145 })).toEqual([]);
    const over = check(metrics, { 'big-files': 2, 'entry-kb': 145 });
    expect(over).toHaveLength(1);
    expect(over[0]).toMatchObject({ id: 'big-files', value: 3, budget: 2, worst: [{ file: 'a.js', n: 2000 }] });
    expect(words(over)).toContain('big-files: 3 files over budget 2');
    expect(words(over)).toContain('a.js  2000');
    // a row's note names what the file and count can't (the package with no page)
    expect(words([{ id: 'stack-pages', value: 1, budget: 0, unit: 'packages', worst: [{ file: 'docs/stack/README.md', n: 1, note: 'left-pad' }] }])).toContain('docs/stack/README.md  1  left-pad');
  });

  it('ratchet only lowers, adds a budget for a new metric, rounds kB up to the next 5 and sorts the keys', () => {
    const next = ratchet(metrics, { 'big-files': 5, 'entry-kb': 140, zzz: 1 });
    expect(next).toEqual({ 'big-files': 3, 'entry-kb': 140, 'new-one': 9, zzz: 1 });
    expect(Object.keys(next)).toEqual(['big-files', 'entry-kb', 'new-one', 'zzz']);
    expect(ratchet([{ id: 'entry-kb', value: 141, unit: 'kB', detail: [] }], {})).toEqual({ 'entry-kb': 145 });
  });

  it('ratchet leaves a skipped metric alone', () => {
    expect(ratchet([{ id: 'total-js-kb', value: 0, skipped: true, detail: [] }], { 'total-js-kb': 5000 })).toEqual({ 'total-js-kb': 5000 });
  });
});
