// What the clouds' and the fog's materials share (./index.js, ./fog.js):
// the gas as a 3D texture and the forms' numbers as uniforms, from
// rules.js's FORMS, so the numbers have one source.

import * as THREE from 'three';
import { FORMS, FORM_INDEX } from './rules';
import { noiseVolume } from './volume';

// the 3D noise as a texture: two channels, tiling, smooth, no mips
export function volumeTexture(size) {
  const t = new THREE.Data3DTexture(noiseVolume(size, 1), size, size, size);
  t.format = THREE.RGFormat;
  t.type = THREE.UnsignedByteType;
  t.wrapS = t.wrapT = t.wrapR = THREE.RepeatWrapping;
  t.minFilter = t.magFilter = THREE.LinearFilter;
  t.generateMipmaps = false;
  t.unpackAlignment = 1;
  t.needsUpdate = true;
  return t;
}

// the forms' numbers as uniforms, from rules.js's FORMS (one source)
export const formUniforms = () => ({
  uForms: { value: Object.keys(FORM_INDEX).map((f) => new THREE.Vector4(FORMS[f].inner, FORMS[f].peak, FORMS[f].outer, FORMS[f].flat)) },
  uCore: { value: Object.keys(FORM_INDEX).map((f) => FORMS[f].core) },
});

