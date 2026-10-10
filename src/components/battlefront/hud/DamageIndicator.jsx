// The damage indicator (UI/InGame/Hud/DamageIndicator): an arc round the
// middle toward where each hit came from, fading over a second.
//
//   <DamageIndicator hits={[{ id, angle, age }]} />  (angle: radians, 0 ahead, clockwise)
export const HIT_SHOWN = 1.2; // s
export default function DamageIndicator({ hits = [] }) {
  const live = hits.filter((h) => h.age < HIT_SHOWN);
  if (!live.length) return null;
  return (
    <div className="bf-damage" aria-hidden="true">
      {live.map((h) => (
        <span key={h.id} style={{ transform: `rotate(${h.angle}rad) translateY(-120px)`, opacity: 1 - h.age / HIT_SHOWN }} />
      ))}
    </div>
  );
}
