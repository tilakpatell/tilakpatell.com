// The places on the map that aren't on the road: no pin, no "on to", no
// seal on the map. Each is found only by looking (Orthanc: click the tower
// itself, standing black in its ring at Isengard; Minas Tirith: click the
// white city on its mountain; Edoras: click the golden hall on its hill),
// and opens like a chapter, at its own
// address (#/middle-earth/orthanc). `at` is on the
// 800×560 sheet (./mapData.js); `reach` how near a click on the flat map
// (no graphics chip, so no tower to click) has to land.
export const HIDDEN = [
  { id: 'orthanc', name: 'Orthanc', title: 'Inside the tower of Isengard', at: [378, 362], reach: 12 },
  { id: 'minas-tirith', name: 'Minas Tirith', title: 'The city of the kings', at: [520, 444], reach: 14 },
  { id: 'edoras', name: 'Edoras', title: 'The court of Rohan', at: [418, 410], reach: 12 },
];

export const hidden = (id) => HIDDEN.find((h) => h.id === id) || null;

// the hidden place a click on the sheet at (x, y) found, if any
export const hiddenAt = (x, y) => HIDDEN.find((h) => Math.hypot(h.at[0] - x, h.at[1] - y) < h.reach) || null;
