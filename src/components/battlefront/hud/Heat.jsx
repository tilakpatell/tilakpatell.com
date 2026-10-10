// The heat bar (UI/InGame/Hud/Weapons: WeaponHeatBar): the game's arc under
// the reticle, red past the weapon's warning; while overheated the cooling
// window is drawn on it.
//
//   <Heat heat={0…1} warning={0…1} overheated={bool} window={[a, b]} />
const R = 34;
const SPAN = Math.PI * 0.6;
const arc = (from, to) => {
  const a0 = Math.PI / 2 + SPAN / 2 - from * SPAN;
  const a1 = Math.PI / 2 + SPAN / 2 - to * SPAN;
  const p = (a) => `${(40 + Math.cos(a) * R).toFixed(2)} ${(10 - Math.sin(a) * R + R).toFixed(2)}`;
  return `M ${p(a0)} A ${R} ${R} 0 0 1 ${p(a1)}`;
};

export default function Heat({ heat = 0, warning = 0.75, overheated = false, window: win = null }) {
  const warn = heat >= warning || overheated;
  return (
    <div className="bf-heat" data-warn={warn ? '' : undefined} aria-hidden="true">
      <svg width="80" height="28" viewBox="0 0 80 28">
        <path d={arc(0, 1)} fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="4" />
        {heat > 0 && <path className="bf-heat-fill" d={arc(0, Math.min(1, heat))} fill="none" stroke="#f2f5f8" strokeWidth="4" />}
        {overheated && win && <path d={arc(win[0], win[1])} fill="none" stroke="#2f7bff" strokeWidth="6" />}
      </svg>
    </div>
  );
}
