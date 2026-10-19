// A colour made hot (over 1, for the bloom to find) and a canvas made a
// texture, repeating and sharp at a glancing angle. Moved out of
// lib/stage3d.js (which re-exports both) so that a 'nodes' world can paint
// a canvas without that file's post chain in its closure.
//
//   hot(hex, k) → THREE.Color, k times the colour
//   canvasTexture(canvas, renderer, { repeat, srgb, wrap }) → THREE.CanvasTexture

import * as THREE from 'three';
import { sharpen } from './textures';

// Bright colours for things that glow: above 1, so bloom picks them up.
export const hot = (hex, k = 1) => new THREE.Color(hex).multiplyScalar(k);

// A canvas as a texture, repeating, sharp at a glancing angle.
export function canvasTexture(canvas, renderer, { repeat = [1, 1], srgb = true, wrap = true } = {}) {
  return sharpen(new THREE.CanvasTexture(canvas), { renderer, color: srgb ? true : undefined, wrap: Boolean(wrap), repeat });
}
