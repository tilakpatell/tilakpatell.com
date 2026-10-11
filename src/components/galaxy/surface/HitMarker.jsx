import { hitMarker, killMarker } from '../../../lib/bf2017/ui/shapes';

// The hit marker over the crosshair, the 2017 game's own (lib/bf2017/ui/
// shapes.js's hitMarker: four ticks on the diagonals; killMarker on a
// kill, longer): drawn once a hit, keyed by the page so each is a fresh
// flash (the .surface-hitmark animation in surface.css). The parts' white
// is currentColor, as the kit's Reticle reads the game's shapes, so the
// page sets the ink: white for a hit, the warning colour for a kill. Drawn,
// not written, and pointer-events none.
const SHAPES = { hit: hitMarker(), kill: killMarker() };
const ink = (p) => (p.stroke ? 'none' : /^rgb\(255 255 255\)$/.test(p.fill) ? 'currentColor' : p.fill);

export default function HitMarker({ kill = false, className = '' }) {
  const s = SHAPES[kill ? 'kill' : 'hit'];
  return (
    <span className={`surface-hitmark ${className}`.trim()} data-kill={kill || undefined} data-shape={s.name} aria-hidden="true">
      <svg viewBox={s.viewBox} focusable="false">
        {s.paths.map((p, i) => (
          <path key={i} d={p.d} transform={p.transform} fill={ink(p)} fillRule={p.fillRule} stroke={p.stroke ? 'currentColor' : undefined} strokeWidth={p.strokeWidth} opacity={p.opacity} />
        ))}
      </svg>
    </span>
  );
}
