// The crosshair, at the middle of the view: four ticks that close in with
// the sights (`tight`, 0…1), a flash on a hit, a ring while locked on. Its
// state comes from ./reticle.js's reticleState. Drawn, not written (nothing
// to read under 0.7 rem), and pointer-events none so a click goes through
// to the canvas. A world skins it by colour through --hud-ink, --hud-accent
// and --hud-bad, as with the rest of the kit. Given a `shape` (a game's
// crosshair as src/lib/bf2017/ui/shapes.js resolves it: { viewBox, paths }),
// it draws that in place of its own ticks, in the ink unless the hit turns it.
export default function Reticle({ state, shape = null, className = '' }) {
  if (!state?.shown) return null;
  const flags = { 'data-hit': state.hit != null || undefined, 'data-locked': state.locked || undefined };
  if (shape)
    return (
      <div className={`hud-reticle hud-reticle-shape ${className}`.trim()} style={{ '--tight': state.tight ?? 0 }} {...flags} data-shape={shape.name} aria-hidden="true">
        <svg viewBox={shape.viewBox} focusable="false">
          {shape.paths.map((p, i) => (
            <path key={i} d={p.d} transform={p.transform} fill={p.stroke ? 'none' : p.fill === 'currentColor' || /^rgb\(255 255 255\)$/.test(p.fill) ? 'currentColor' : p.fill} fillRule={p.fillRule} stroke={p.stroke ? 'currentColor' : undefined} strokeWidth={p.strokeWidth} strokeLinecap={p.strokeLinecap} opacity={p.opacity} />
          ))}
        </svg>
        <b />
      </div>
    );
  return (
    <div className={`hud-reticle ${className}`.trim()} style={{ '--tight': state.tight ?? 0 }} {...flags} aria-hidden="true">
      <i data-at="t" />
      <i data-at="r" />
      <i data-at="b" />
      <i data-at="l" />
      <b />
    </div>
  );
}
