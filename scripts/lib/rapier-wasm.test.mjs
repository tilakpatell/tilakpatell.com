import { describe, expect, it } from 'vitest';
import { shimFor } from './rapier-wasm.mjs';

const root = '/home/u/site';
const scalar = `${root}/node_modules/@dimforge/rapier3d/raw.js`;
const simd = `${root}/node_modules/@dimforge/rapier3d-simd/raw.js`;

describe('shimFor', () => {
  it('sends the scalar package’s wasm import to the scalar shim', () => {
    expect(shimFor('./rapier_wasm3d', scalar, { root })).toBe(`${root}/src/lib/physics/raw/scalar.js`);
  });

  it('sends the SIMD package’s to the SIMD shim', () => {
    expect(shimFor('./rapier_wasm3d', simd, { root })).toBe(`${root}/src/lib/physics/raw/simd.js`);
  });

  it('matches the spellings the glue may use', () => {
    for (const s of ['./rapier_wasm3d', './rapier_wasm3d.js', '../rapier_wasm3d.js']) expect(shimFor(s, scalar, { root })).toBeTruthy();
  });

  it('matches a Windows importer path', () => {
    expect(shimFor('./rapier_wasm3d', 'C:\\site\\node_modules\\@dimforge\\rapier3d-simd\\raw.js', { root })).toBe(`${root}/src/lib/physics/raw/simd.js`);
  });

  it('leaves everything else alone', () => {
    expect(shimFor('./rapier_wasm3d_bg.js', scalar, { root })).toBeNull();
    expect(shimFor('./rapier_wasm3d', `${root}/src/lib/physics/engine.js`, { root })).toBeNull();
    expect(shimFor('three', scalar, { root })).toBeNull();
    expect(shimFor('./rapier_wasm3d', undefined, { root })).toBeNull();
  });
});
