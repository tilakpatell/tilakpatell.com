export function spin(tick) {
  const id = requestAnimationFrame(tick);
  requestAnimationFrame(tick);
  return () => cancelAnimationFrame(id);
}
