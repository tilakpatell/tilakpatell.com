// The three ability slots (UI/InGame/Hud/Abilities: AbilityRecharge,
// AbilityState): each with its key, a ring that fills as it recharges and
// its charges as pips.
//
//   <Abilities slots={[{ slot, recharge: 0…1, charges, ready }]} />
const C = 2 * Math.PI * 23;
export default function Abilities({ slots = [] }) {
  if (!slots.length) return null;
  return (
    <div className="bf-abilities">
      {slots.map((s) => (
        <div key={s.slot} className="bf-ability bf-glass">
          <svg width="52" height="52" viewBox="0 0 52 52" aria-hidden="true">
            <circle cx="26" cy="26" r="23" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="3" />
            <circle cx="26" cy="26" r="23" fill="none" stroke="#f2f5f8" strokeWidth="3" strokeDasharray={`${(s.ready ? 1 : (s.recharge ?? 0)) * C} ${C}`} transform="rotate(-90 26 26)" />
          </svg>
          <kbd className="hud-cap">{s.slot}</kbd>
        </div>
      ))}
    </div>
  );
}
