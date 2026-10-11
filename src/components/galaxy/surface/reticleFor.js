import { blasterCrosshair } from '../../../lib/bf2017/ui/shapes';
import { heroById } from '../heroes';

// What the surface's reticle draws for who you play as (pages/GalaxySurface.jsx
// hands it to runtime/hud's Reticle): with a blaster in hand, the 2017 game's
// own crosshair (lib/bf2017/ui/shapes.js's blasterCrosshair: the dot and the
// four notches), as the Battlefront world draws it; with a lightsaber, the
// kit's ticks, and the lock-on ring on the one your strokes home on. A
// blaster fight shows no ring: the game marks a hit with its ticks
// (HitMarker.jsx), never a circle on the target. Pure.
//
//   reticleShape(hero) → the game's crosshair shape, or null for a saber (or nobody)
//   reticleLock(hero, combat) → the lock for the ring, a saber's alone

let blaster = null;
const sabre = (hero) => Boolean(hero && heroById(hero.id)?.weapon === 'saber');
export const reticleShape = (hero) => (hero && !sabre(hero) ? (blaster ??= blasterCrosshair()) : null);
export const reticleLock = (hero, combat) => (sabre(hero) ? (combat?.lock ?? null) : null);
