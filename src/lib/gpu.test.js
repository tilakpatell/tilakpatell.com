import { describe, expect, it } from 'vitest';
import { classify, gpuStatus, probe, resolve3D } from './gpu';

// `caveat`: the browser refuses a context that asks for no major performance
// caveat (what Chrome and Firefox do when hardware acceleration is off) but
// hands out a software one when asked without it.
const fakeDoc = (renderer, { webgl2 = true, webgl = true, caveat = false } = {}) => ({
  createElement: () => ({
    getContext: (kind, opts = {}) => {
      if (caveat && opts.failIfMajorPerformanceCaveat) return null;
      if ((kind === 'webgl2' && !webgl2) || (kind !== 'webgl2' && !webgl)) return null;
      return {
        getExtension: (name) => (name === 'WEBGL_debug_renderer_info' ? { UNMASKED_RENDERER_WEBGL: 1 } : name === 'WEBGL_lose_context' ? { loseContext: () => {} } : null),
        getParameter: () => renderer,
        RENDERER: 2,
      };
    },
  }),
});

describe('telling a real GPU from software WebGL', () => {
  it('calls SwiftShader, llvmpipe and Microsoft’s basic driver software', () => {
    for (const r of ['ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)), SwiftShader driver)', 'llvmpipe (LLVM 15.0.7, 256 bits)', 'ANGLE (Microsoft, Microsoft Basic Render Driver Direct3D11)', 'Apple Software Renderer']) {
      expect(classify(r).software).toBe(true);
    }
  });

  it('calls real graphics chips hardware', () => {
    for (const r of ['ANGLE (Intel, Intel(R) UHD Graphics 620 Direct3D11 vs_5_0 ps_5_0)', 'Apple M2', 'Adreno (TM) 650', 'Mali-G78', 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11)']) {
      expect(classify(r).software).toBe(false);
    }
  });

  it('finds WebGL 2 on a GPU', () => {
    expect(probe(fakeDoc('Apple M2'))).toMatchObject({ webgl: true, webgl2: true, software: false, ok: true });
  });

  it('falls back to WebGL 1 and still works', () => {
    expect(probe(fakeDoc('Adreno (TM) 506', { webgl2: false }))).toMatchObject({ webgl: true, webgl2: false, ok: true });
  });

  it('does not count software WebGL as good enough on its own', () => {
    expect(probe(fakeDoc('llvmpipe (LLVM 15)'))).toMatchObject({ webgl: true, software: true, ok: false });
  });

  it('reports no WebGL at all, or a browser that throws, as none', () => {
    expect(probe(fakeDoc('x', { webgl2: false, webgl: false }))).toMatchObject({ webgl: false, ok: false });
    expect(probe({ createElement: () => ({ getContext: () => { throw new Error('blocked'); } }) })).toMatchObject({ webgl: false, ok: false });
    expect(probe(undefined)).toMatchObject({ webgl: false, ok: false });
  });

  it('finds software WebGL when hardware acceleration is off, whatever the renderer calls itself', () => {
    // with acceleration off the strict request fails; the relaxed one works, in software
    const info = probe(fakeDoc('ANGLE (Google, Vulkan 1.3.0)', { caveat: true }));
    expect(info).toMatchObject({ webgl: true, software: true, ok: false, caveat: true });
  });
});

describe('why a WebGL-only game cannot start', () => {
  it('is fine on a graphics chip', () => {
    expect(gpuStatus({ webgl: true, software: false, ok: true })).toBe('ok');
  });

  it('blames hardware acceleration when WebGL runs in software', () => {
    expect(gpuStatus({ webgl: true, software: true, ok: false })).toBe('software');
  });

  it('says there is no WebGL when there is none', () => {
    expect(gpuStatus({ webgl: false, software: false, ok: false })).toBe('none');
  });
});

describe('choosing 3D or 2D', () => {
  const gpu = { webgl: true, ok: true };
  const soft = { webgl: true, ok: false };
  const none = { webgl: false, ok: false };

  it('uses 3D wherever WebGL exists, even drawn in software', () => {
    expect(resolve3D('auto', gpu)).toBe(true);
    expect(resolve3D('auto', soft)).toBe(true);
    expect(resolve3D('auto', none)).toBe(false);
  });

  it('lets the visitor turn it off, or on where WebGL exists at all', () => {
    expect(resolve3D('off', gpu)).toBe(false);
    expect(resolve3D('on', soft)).toBe(true);
    expect(resolve3D('on', none)).toBe(false);
  });
});

// (the owner's word, 2026-10-13: the site asks for the high-performance chip
// everywhere. A page cannot force it, lib/gpuHint says why, but no context
// may ask for less: on a Mac a low-power one keeps the built-in chip awake
// beside the card, and the frames cross between the two)
describe('every context the site makes', () => {
  it('asks for the high-performance chip, and none for low power', async () => {
    const { readdirSync, readFileSync, statSync } = await import('node:fs');
    const { join } = await import('node:path');
    const root = new URL('..', import.meta.url).pathname;
    const files = [];
    const walk = (dir) => {
      for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        if (statSync(p).isDirectory()) walk(p);
        else if (/\.(js|jsx)$/.test(name) && !/\.test\./.test(name)) files.push(p);
      }
    };
    walk(root);
    const MAKES = /new (?:THREE\.)?WebGLRenderer\(|new WebGPURenderer\(|getContext\(\s*['"](?:webgl2?|experimental-webgl|webgpu)['"]/;
    const makers = files.filter((f) => MAKES.test(readFileSync(f, 'utf8')));
    expect(makers.length).toBeGreaterThanOrEqual(15); // (the walk found them: 20 on 2026-10-13)
    const asksLess = files.filter((f) => /powerPreference:\s*['"]low-power['"]/.test(readFileSync(f, 'utf8')));
    const asksNothing = makers.filter((f) => !readFileSync(f, 'utf8').includes('high-performance'));
    expect(asksLess.map((f) => f.slice(root.length))).toEqual([]);
    expect(asksNothing.map((f) => f.slice(root.length))).toEqual([]);
  });
});
