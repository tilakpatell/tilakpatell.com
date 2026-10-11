// How big a landing's model is drawn, as a pure function: kept from
// ./models.js (which re-exports it) so a world that sizes a model of its
// own (the galaxy surface's placer) reaches no shader through it.
//
// sizeFor(size, { tall, long, wide }) → the scale

// the scale that brings a model of `size` (a Vector3) to the spec's size
export function sizeFor(size, { tall, long, wide } = {}) {
  if (tall) return tall / (size.y || 1);
  if (long) return long / (Math.max(size.x, size.z) || 1);
  if (wide) return wide / (Math.max(size.x, size.z) || 1);
  return 1;
}
