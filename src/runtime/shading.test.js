import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// A module that promises 'nodes' (so it may get the WebGPU backend) must
// keep it: nothing in its folder may make a ShaderMaterial, patch a
// shader with onBeforeCompile or build an EffectComposer, since
// WebGPURenderer can't run them. Every world module under src/components
// is read, and the fixture, so the check is known to run.

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const FORBIDDEN = [/\bRawShaderMaterial\b/, /\bShaderMaterial\b/, /\bonBeforeCompile\b/, /\bEffectComposer\b/];

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

describe('a nodes module keeps its promise', () => {
  const files = [...modules(), join(ROOT, 'runtime/fixtures/nodesWorld.js')];

  it('reads the fixture, so the check is live', () => {
    expect(files.some((f) => f.endsWith('nodesWorld.js'))).toBe(true);
    expect(isNodes(join(ROOT, 'runtime/fixtures/nodesWorld.js'))).toBe(true);
  });

  for (const file of files.filter(isNodes)) {
    it(`${relative(ROOT, file)} uses no GLSL`, () => {
      const bad = [];
      for (const p of walk(dirname(file))) {
        const src = readFileSync(p, 'utf8');
        for (const re of FORBIDDEN) if (re.test(src)) bad.push(`${relative(ROOT, p)}: ${re.source}`);
      }
      expect(bad).toEqual([]);
    });
  }
});
