// A comic strip over the city (episode 8, ./missions.js): one panel at a
// time, who says it and what, the next on E or after a few seconds
// (InvWorld.jsx keeps the strip in its sim and advances it). Black border,
// the show's title yellow, text on glass as the HUD rules want.
import { NAMES } from './Panels.names';

export default function Panels({ strip }) {
  if (!strip) return null;
  const [who, text] = strip.lines[strip.i] ?? [];
  if (!text) return null;
  return (
    <div className="iw-panels" role="dialog" aria-live="polite" aria-label="A panel">
      <div className="iw-panel" key={strip.i}>
        <b className="iw-panel-who">{NAMES[who] ?? who}</b>
        <p className="iw-panel-text">{text}</p>
        <span className="iw-panel-hint">
          <kbd className="hud-cap">E</kbd> {strip.i + 1} of {strip.lines.length}
        </span>
      </div>
    </div>
  );
}
