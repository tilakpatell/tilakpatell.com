// What the worlds' own props are built from (./kitCore.js says what and
// how), with the classic renderer's looks: lib/three/foliage's light and
// wind on the plants, lib/three/core's wear on the scanned surfaces,
// lib/three/scans' set, lib/three/kit's models, and the props' windows,
// shield and shafts (props/windows.js, props/shaders.js). nodes/kit.js is the same on the node renderer.

import { faceless, wind, wrapLighting } from '../../../lib/three/foliage';
import { wear } from '../../../lib/three/core';
import { loadScan, scanOf } from '../../../lib/three/scans';
import { loadKit } from '../../../lib/three/kit';
import { litWindows } from './props/windows';
import { shaftMaterial, shieldMaterial } from './props/shaders';
import { createKitWith } from './kitCore';

export * from './kitCore';
export { loadScan, scanOf };

const LOOKS_GLSL = { faceless, wind, wrapLighting, wear, loadScan, scanOf, loadKit, litWindows, shield: shieldMaterial, shaft: shaftMaterial };

export const densityOf = (role, fallback) => (scanOf(role)?.metres ? 1 / scanOf(role).metres : fallback);
export const createKit = (opts) => createKitWith(LOOKS_GLSL, opts);
