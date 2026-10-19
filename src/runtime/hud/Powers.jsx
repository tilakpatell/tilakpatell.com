// A ship's two powers on the HUD: a tile each with its icon, its short
// name and its key, and a ring round it that runs down while it's on and
// fills as it cools down or the big one charges, with the seconds (or the
// charge) in its corner. The world's frame loop writes the phase, the ring
// and the words as they change; a tap or a click uses it, as its key does.
// In the flight cluster (`placement`, on a desktop) a word under each says
// where it stands, and why a press was refused. Plain values in: each slot
// is { slot ('primary' | 'ultimate'), id, name, short, about, key, icon (an
// svg's insides) }, and `data` goes on the root as data-* (a world's skin
// hangs off it: the galaxy's `ship`).
export default function Powers({ slots = [], barRef = null, onPress = null, placement = null, data = {} }) {
  if (!slots.length) return null;
  const attrs = Object.fromEntries(Object.entries(data).map(([k, v]) => [`data-${k}`, v]));
  return (
    <div ref={barRef} className="hud-powers" {...attrs} data-place={placement || undefined} role="group" aria-label="Ship powers">
      {slots.map((s) => (
        <button
          key={s.slot}
          type="button"
          className="hud-power"
          data-slot={s.slot}
          data-power={s.id}
          data-phase={s.slot === 'primary' ? 'ready' : 'charging'}
          aria-label={`${s.name} (${s.key})`}
          title={`${s.name}: ${s.about}`}
          // (a press at once, as the Fire button does; a click from the keyboard, Enter or Space, too)
          onPointerDown={(e) => (e.preventDefault(), onPress?.(s.slot))}
          onClick={(e) => e.detail === 0 && onPress?.(s.slot)}
          onContextMenu={(e) => e.preventDefault()}
        >
          <svg className="hud-power-icon" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            {s.icon}
          </svg>
          <span className="hud-power-name">{s.short}</span>
          <span className="hud-power-state" aria-hidden="true" />
          <span className="hud-power-key">
            <kbd className="hud-cap">{s.key}</kbd>
          </span>
          <small aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}
