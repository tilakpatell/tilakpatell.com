// The length of an ellipse's rim (Ramanujan's approximation, near exact for
// any ring we draw): what a line of text set round one has to fill.
export const ellipseLength = (rx, ry) => Math.PI * (3 * (rx + ry) - Math.sqrt((3 * rx + ry) * (rx + 3 * ry)));
