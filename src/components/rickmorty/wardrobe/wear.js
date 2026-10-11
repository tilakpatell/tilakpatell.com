// A look on a figure, wherever the figure's made: every wardrobe body put
// into a cast's own table (as 'wd:<body>', so a cast's own kinds and their
// sizes stay as they are), and a figure dressed and undressed again.
//
//   createMeshyCast(withWardrobe())            a cast that can make any body
//   cast.load(null, [bodyAsset(look)], …)       its model, before…
//   cast.make(bodyKind(look))                  …the figure
//   const off = dress(figure, look)            colours and gear; off() takes them away
//
// Walt’s and Jesse’s bodies are the site’s own figures, by their whole
// path (meshyCast.js loads them so, on Rick’s clips); one loaded some other
// way (the crews out of the ship, the RV’s seats, Albuquerque’s people) is
// dressed the same, as { group } round its model.

// (The bodies' table and dress itself are ./wearCore.js's; here a figure's
// colours are dress.js's GLSL, and ./wearNodes.js dresses in nodes.)

import { dressColors } from './dress';
import { dressWith } from './wearCore';

export { bodyAsset, bodyKind, whoOf, withWardrobe } from './wearCore';

export const dress = dressWith(dressColors);
