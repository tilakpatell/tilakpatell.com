import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { classicImportsOf, closure, glslSites } from './shadingClosure';

// A module that promises 'nodes' (so it gets the node renderer, on WebGPU
// or on WebGL 2) must keep it over everything it reaches, not its folder
// alone: nothing it imports, however far away, may make a ShaderMaterial,
// patch a shader with onBeforeCompile or build an EffectComposer, since
// WebGPURenderer can't run them. Every world module under src/components
// is read, and the fixture, so the check is known to run.

const ROOT = fileURLToPath(new URL('../', import.meta.url));

// The files that name those words without making them:
const EXEMPT = [
  'lib/three/frameGuard.js', // reads onBeforeCompile to tell two materials apart
  'lib/three/renderer.js', // the classic renderer's own factory; a nodes world reaches it for disposeTree
  'lib/three/gpuWork.js', // the GPU work queue, which compiles whatever material it's given
];
const exempt = (rel) => EXEMPT.includes(rel) || rel.startsWith('runtime/'); // (the runtime holds both backends)

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.jsx?$/.test(name) && !/\.test\.jsx?$/.test(name)) out.push(p);
  }
  return out;
}
const modules = () => walk(join(ROOT, 'components')).filter((p) => /[/\\]module\.js$/.test(p));
const isNodes = (file) => /shading:\s*'nodes'/.test(readFileSync(file, 'utf8'));
const disk = { read: (p) => readFileSync(p, 'utf8'), exists: (p) => existsSync(p) && statSync(p).isFile() };

// every GLSL site in the module's closure, as 'path: Name', paths from `root`
function sitesIn(entry, root) {
  const bad = [];
  for (const p of closure(entry, disk)) {
    const rel = relative(root, p).split(sep).join('/');
    if (exempt(rel)) continue;
    for (const name of glslSites(readFileSync(p, 'utf8'))) bad.push(`${rel}: ${name}`);
  }
  return bad.sort();
}

describe('a nodes module keeps its promise', () => {
  const files = [...modules(), join(ROOT, 'runtime/fixtures/nodesWorld.js'), join(ROOT, 'runtime/fixtures/litWorld.js')];

  it('reads the fixture, so the check is live', () => {
    expect(files.some((f) => f.endsWith('nodesWorld.js'))).toBe(true);
    expect(isNodes(join(ROOT, 'runtime/fixtures/nodesWorld.js'))).toBe(true);
  });

  it('fails a module whose GLSL is a file away', () => {
    const dir = mkdtempSync(join(tmpdir(), 'nodes-'));
    try {
      writeFileSync(join(dir, 'module.js'), "import { look } from './parts';\nexport default { id: 'x', shading: 'nodes', create: () => look() };\n");
      writeFileSync(join(dir, 'parts.js'), "export { look } from './look';\n");
      writeFileSync(join(dir, 'look.js'), "import { ShaderMaterial } from 'three';\nexport const look = () => new ShaderMaterial({});\n");
      expect(sitesIn(join(dir, 'module.js'), dir)).toEqual(['look.js: ShaderMaterial']);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  for (const file of files.filter(isNodes)) {
    it(`${relative(ROOT, file)} reaches no GLSL`, () => {
      expect(sitesIn(file, ROOT)).toEqual([]);
    });
  }
});

// Every classic branch a node closure leaves out (shadingClosure.js), by
// file and path, each with why it is safe: taken only on the classic
// renderer. A new one changes this list, so it is never added unseen.
const CLASSIC = {
  'lib/three/scatter/wind.js': ['../foliage.js'], // the GLSL sway, when the renderer is not a node one (`nodes` false)
};

describe('a classic branch is named', () => {
  it('every one in src is on the list, and every one on the list is there', () => {
    const found = {};
    for (const p of walk(ROOT)) {
      const specs = classicImportsOf(readFileSync(p, 'utf8'));
      if (specs.length) found[relative(ROOT, p).split(sep).join('/')] = specs;
    }
    expect(found).toEqual(CLASSIC);
  });

  it('only a module that says it has a classic path takes one at its root', () => {
    for (const file of modules()) {
      if (!classicImportsOf(readFileSync(file, 'utf8')).length) continue;
      expect(readFileSync(file, 'utf8')).toMatch(/classic:\s*true/);
    }
  });
});
