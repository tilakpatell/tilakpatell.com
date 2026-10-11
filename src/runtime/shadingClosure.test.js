import { describe, expect, it } from 'vitest';
import { classicImportsOf, closure, glslSites, importsOf, resolveImport } from './shadingClosure';

// an in-memory tree, as the file system is passed in
const fsOf = (tree) => ({ read: (p) => tree[p], exists: (p) => p in tree });

describe('importsOf', () => {
  it('finds every form of import, and one in a comment too', () => {
    const src = [
      "import * as THREE from 'three';",
      "import { a,\n  b } from './ab';",
      "export { c } from './c.js';",
      "export * from './d';",
      "import './side';",
      "const e = await import('./e.jsx');",
      "// import { f } from './f';",
    ].join('\n');
    expect(importsOf(src)).toEqual(expect.arrayContaining(['three', './ab', './c.js', './d', './side', './e.jsx', './f']));
  });
});

describe('resolveImport', () => {
  const { exists } = fsOf({ 'w/look.jsx': '', 'w/parts/index.js': '', 'w/a.js': '', 'w/model.glb': '' });
  it('tries the path, .js, .jsx and the index files', () => {
    expect(resolveImport('w/m.js', './look', { exists })).toBe('w/look.jsx');
    expect(resolveImport('w/m.js', './parts', { exists })).toBe('w/parts/index.js');
    expect(resolveImport('w/m.js', './a.js', { exists })).toBe('w/a.js');
  });
  it('leaves packages, missing files and what isn’t code', () => {
    expect(resolveImport('w/m.js', 'three', { exists })).toBe(null);
    expect(resolveImport('w/m.js', './gone', { exists })).toBe(null);
    expect(resolveImport('w/m.js', './model.glb?url', { exists })).toBe(null);
  });
});

describe('closure', () => {
  it('reaches through static, dynamic and re-exports, and leaves the tests out', () => {
    const tree = {
      'a.js': "import './b'; import('./c.jsx')",
      'b.js': "export * from './d/index'",
      'c.jsx': '',
      'd/index.js': "import './e.test.js'",
      'd/e.test.js': '',
    };
    expect([...closure('a.js', fsOf(tree))].sort()).toEqual(['a.js', 'b.js', 'c.jsx', 'd/index.js']);
  });
  it('goes round a cycle once', () => {
    const tree = { 'a.js': "import './b'", 'b.js': "import './a'" };
    expect([...closure('a.js', fsOf(tree))].sort()).toEqual(['a.js', 'b.js']);
  });
});

describe('glslSites', () => {
  it('names what is used, once, and not what a comment mentions', () => {
    expect(glslSites('// a ShaderMaterial in a comment\nnew THREE.ShaderMaterial()')).toEqual(['ShaderMaterial']);
    expect(glslSites('/* EffectComposer */ const x = 1;')).toEqual([]);
    expect(glslSites('m.onBeforeCompile = fn')).toEqual(['onBeforeCompile']);
    expect(glslSites('new RawShaderMaterial(); new ShaderMaterial(); new ShaderMaterial()')).toEqual(['RawShaderMaterial', 'ShaderMaterial']);
    expect(glslSites("import { EffectComposer } from 'x'; new RenderPass(); new UnrealBloomPass(); new OutputPass(); new ShaderPass()")).toEqual(['EffectComposer', 'ShaderPass', 'UnrealBloomPass', 'RenderPass', 'OutputPass']);
  });
  it('keeps a URL in a string whole', () => {
    expect(glslSites("const u = 'https://x.org'; new ShaderMaterial()")).toEqual(['ShaderMaterial']);
  });
});

describe('a classic branch', () => {
  it('is left out of the node closure, and found by name', () => {
    const src = "const s = await (k === 'webgl' ? import(/* classic */ './sceneClassic') : import('./sceneNodes'));\nimport(/* @vite-ignore */ './other');";
    expect(importsOf(src)).toEqual(['./sceneNodes', './other']);
    expect(classicImportsOf(src)).toEqual(['./sceneClassic']);
    const tree = { 'm.js': src, 'sceneNodes.js': '', 'other.js': '', 'sceneClassic.js': "import { ShaderMaterial } from 'three';" };
    expect([...closure('m.js', fsOf(tree))].sort()).toEqual(['m.js', 'other.js', 'sceneNodes.js']);
  });
});
