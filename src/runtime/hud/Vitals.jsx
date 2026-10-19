// The vitals, in the flight cluster: one glass block with the world's word
// for them ("Shields", "Deflectors", "Health"), the percent, and a bar that
// blinks red when low. A world may add lines of its own under the bar (the
// galaxy's speed and kills). ./cluster.js writes the numbers.
export default function Vitals({ label, icon = null, className = '', children = null }) {
  return (
    <div className={`hud-glass hud-vitals-block ${className}`.trim()} aria-hidden="true">
      <div className="hud-line">
        {icon}
        <span className="hud-label">{label}</span>
        <b className="hud-vitals-n">100%</b>
      </div>
      <span className="hud-bar hud-vitals">
        <span />
      </span>
      {children}
    </div>
  );
}
