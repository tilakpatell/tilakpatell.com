import { shape } from '../../../lib/bf2017/ui/shapes.js';

// The damage indicator (UI/InGame/Hud/DamageIndicator/DamageIndicatorCrosshair
// → …DirectionalAnimation): a chevron (Crosshairs_MarkerDamageIndicator,
// 14 × 28) 157 units out from the middle of the view toward where each
// hit came from, two smaller beside it 5° and 10° round, fading away.
//
//   <DamageIndicator hits={[{ id, angle, age }]} />  (angle: radians, 0 ahead, clockwise)
export const HIT_SHOWN = 1.2; // s
const MARK = shape('Crosshairs_MarkerDamageIndicator');
const WINGS = [0, -5, 5, -10, 10]; // degrees round the hit's way (the Mid, Left, Right and Outer copies)
export default function DamageIndicator({ hits = [] }) {
  const live = hits.filter((h) => h.age < HIT_SHOWN);
  if (!live.length) return null;
  return (
    <div className="bf-damage" aria-hidden="true">
      {live.map((h) => (
        <span key={h.id} className="bf-damage-hit" style={{ transform: `rotate(${h.angle}rad)`, opacity: 1 - h.age / HIT_SHOWN }}>
          {WINGS.map((deg, i) => (
            <svg key={deg} viewBox={MARK.viewBox} className="bf-damage-mark" data-outer={i > 2 ? '' : undefined} style={{ transform: `rotate(${deg}deg) translateY(calc(-157 * var(--bf-u)))` }}>
              <path d={MARK.paths[0].d} fill="currentColor" />
            </svg>
          ))}
        </span>
      ))}
    </div>
  );
}
