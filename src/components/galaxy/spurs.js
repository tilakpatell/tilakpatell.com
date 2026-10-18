// The galaxy's lesser hyperspace routes, beside the great ones (systems.js's
// LANES): the atlas's own, through the grid squares it gives their stops,
// as points in grid squares in the map's frame (a square's middle, or the
// system on the map that stands for its stop). The route finder takes them
// with the great ones (routes.js), the map draws them thinner (MapSvg.jsx);
// the war's fronts run along the great routes only (gcwRules.js reads
// LANES), so these add ways to fly, not fronts. The Shipwrights' Trace, the
// Sisar Run and the Kessel Run are left off: the first's stops lie where
// the map has other worlds, the other two are a few squares long.

export const SPURS = [
  // Centares on the Perlemian, round the Slice by Jabiim, Formos, Eadu, Teth and Gamorr to Tatooine, then west to Enarc by Naboo
  // (east of Roon, which is Scarif's square: Scarif behind its shield keeps off the lanes)
  { id: 'triellus', name: 'Triellus Trade Route', pts: [[17, 5.6], [18.5, 6.6], [19.5, 9.4], [20, 9.75], [20.4, 11.6], [19.5, 13.4], [19.1, 15.7], [17.6, 15.4], [17.4, 16.6], [14.6, 16.6]] },
  // from Bandomeer on the Hydian Way west by Agamar to Mygeeto, Muunilinst and Bastion
  { id: 'braxant', name: 'Braxant Run', pts: [[14.6, 5.5], [12.5, 4.6], [10.15, 4.5], [10.5, 3.4], [10.6, 2.4]] },
  // from Celanon on the Hydian Way by Ord Mantell to Dorin
  { id: 'celanon', name: 'Celanon Spur', pts: [[14.6, 5.5], [12.6, 5.9], [11, 6.05], [9.5, 7.6]] },
  // Coruscant's neighbour Brentaal by Alderaan to Commenor
  { id: 'commenor', name: 'Commenor Run', pts: [[11.5, 8.5], [12.5, 9.5], [13.6, 9.6]] },
  // from Coruscant west by Borleias, Marquinn and Dorin to Glee Anselm and Ansion
  { id: 'namadii', name: 'Namadii Corridor', pts: [[11.5, 8.5], [10.5, 8.6], [10.4, 7.6], [9.5, 7.6], [9.5, 6.6], [8.5, 5.6]] },
  // the Hutts' road, from Gyndine east across the Hydian Way to Nal Hutta
  { id: 'pabol', name: 'Ootmian Pabol', pts: [[14.5, 11.5], [18.5, 11.5]] },
];
