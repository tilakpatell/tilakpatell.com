import { PIPS } from './cluster.js';

// The arms, in the flight cluster: the line picked (its name, coloured by
// the line), three marks for the three lines with the picked one lit, and
// the ordnance rack's rounds, a pip each (the last one filling as a round
// comes back). With `keys`, the keys that change it. ./cluster.js writes it.
export default function Arms({ className = '', keys = false }) {
  return (
    <div className={`hud-glass hud-arms ${className}`.trim()} aria-hidden="true">
      <div className="hud-line">
        <b className="hud-arms-name" />
        {keys && (
          <span className="hud-keys">
            <kbd className="hud-cap">R</kbd> or <kbd className="hud-cap">1</kbd> <kbd className="hud-cap">2</kbd> <kbd className="hud-cap">3</kbd>
          </span>
        )}
      </div>
      <span className="hud-arms-lines">
        <i className="hud-arms-line" />
        <i className="hud-arms-line" />
        <i className="hud-arms-line" />
      </span>
      <span className="hud-arms-rack">
        {Array.from({ length: PIPS }, (_, i) => (
          <i key={i} className="hud-arms-pip" />
        ))}
      </span>
    </div>
  );
}
