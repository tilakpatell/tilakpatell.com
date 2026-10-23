// The abilities on foot, in the cluster: G and V (and a world's others: the
// galaxy's dodge and emote), a tile each with its key, its icon if it has
// one, its name and the seconds left while it cools down (a shade running
// down over it), lit while it's on (an overcharge, a sprint, a jetpack
// burning). `onPress(slot, down)` makes each a button (a touch screen's
// thumbs: held, as the jetpack wants, and let go). ./cluster.js's
// abilities writer writes the names, the cooldowns and what's on (in the
// cluster, or wherever `rootRef` is: createAbilitiesWriter).
const prevent = (e) => e.preventDefault();

export default function Abilities({ slots, onPress = null, className = '', rootRef = null }) {
  const inner = (s) => (
    <>
      <kbd className="hud-cap">{s.key}</kbd>
      {s.icon ?? null}
      <span className="hud-ability-name">{s.name ?? ''}</span>
      <small className="hud-ability-left" />
    </>
  );
  return (
    <ul ref={rootRef} className={`hud-glass hud-abilities ${className}`.trim()} data-press={onPress ? '' : undefined} aria-hidden={onPress ? undefined : 'true'}>
      {slots.map((s) => (
        <li key={s.slot} className="hud-ability" data-slot={s.slot}>
          {onPress ? (
            <button
              type="button"
              className="hud-ability-btn"
              onPointerDown={(e) => {
                e.preventDefault();
                onPress(s.slot, true);
              }}
              onPointerUp={() => onPress(s.slot, false)}
              onPointerCancel={() => onPress(s.slot, false)}
              onPointerLeave={() => onPress(s.slot, false)}
              onContextMenu={prevent}
            >
              {inner(s)}
            </button>
          ) : (
            inner(s)
          )}
        </li>
      ))}
    </ul>
  );
}
