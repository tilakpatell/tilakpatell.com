// The one place the nebulae name a GLSL material. The clouds (./index.js)
// and the fog (./fog.js) both make theirs here, so the health check’s
// glsl-sites (scripts/health/glsl-sites.mjs: what a WebGPU port removes)
// counts the nebulae once, and the port has one line to rewrite.
//
// glslMaterial(opts) → a three ShaderMaterial of opts

import * as THREE from 'three';

export const glslMaterial = (opts) => new THREE.ShaderMaterial(opts);
