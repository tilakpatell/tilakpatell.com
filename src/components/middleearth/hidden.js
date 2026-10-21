// The places on the map that aren't on the road: no pin, no "on to", no
// seal on the map. Each is found only by looking (Orthanc: click the tower
// itself, standing black in its ring at Isengard; Edoras: click the golden
// hall on its hill), and opens like a chapter, at its own address
// (#/middle-earth/orthanc). Minas Tirith was one, and is a chapter now: the
// road comes to it after Mount Doom.
// `at` is on the 800×560 sheet, where Tolkien's geography puts it
// (./sheet.js); `reach` how near a click on the flat map (no graphics chip,
// so no tower to click) has to land.
import { placeAt } from './sheet';

export const HIDDEN = [
  { id: 'orthanc', name: 'Orthanc', title: 'Inside the tower of Isengard', at: placeAt('isengard'), reach: 12 },
  { id: 'edoras', name: 'Edoras', title: 'The court of Rohan', at: placeAt('edoras'), reach: 12 },
];

export const hidden = (id) => HIDDEN.find((h) => h.id === id) || null;

// the hidden place a click on the sheet at (x, y) found, if any
export const hiddenAt = (x, y) => HIDDEN.find((h) => Math.hypot(h.at[0] - x, h.at[1] - y) < h.reach) || null;
