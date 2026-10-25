// The flight HUD's measures of itself, for what sits over it (FlightHud.jsx
// writes them on the map as custom properties when the browser says the
// parts have changed size: layout, not a HUD number).
//
//   clusterHeight(row, over) → px   the cluster's row, and the strip over it
//     (the galaxy's pickups' chips) with the grid's gap, when it has a height

export const clusterHeight = (row, over) => (row?.offsetHeight ?? 0) + (over?.offsetHeight ? over.offsetHeight + 6 : 0);
