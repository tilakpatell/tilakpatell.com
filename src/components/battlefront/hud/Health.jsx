import { shape } from '../../../lib/bf2017/ui/shapes.js';

// The soldier's health (UI/InGame/Hud/Health/PlayerHealth, 450 × 39 at the
// bottom middle, 50 up: PlayerRoundWidget): the number on the left
// (HealthNumber, Univers 520 Medium 24 px, palette 33, right-aligned in
// 48 at x 32), the bar from x 84 (SegmentedHealthBar: 330 × 8 in dashes of
// 98 with 2 between, the regen share at 0.05), the evade charges in a
// hexagon on the right (HealthEvade: 30 units, palette 35 at 0.85, the
// count in Univers 620 Bold 22 px), all inside the HealthBordersPlayer
// outline (bevels of 5) on glass with corners of 6.
//
// The officer's presence lays its overhealth (`over`, up to 100) over the
// bar's start and adds it to the number.
//
//   <Health hp={n} hpMax={n} evade={n | null} over={n} />
const BORDER = shape('HealthBordersPlayer');
const HEX = shape('Hexagon_Default_Inside');
export default function Health({ hp = 0, hpMax = 1, evade = null, over = 0 }) {
  const share = Math.max(0, Math.min(1, hp / (hpMax || 1)));
  return (
    <div className="bf-health" data-low={share < 0.3 ? '' : undefined}>
      <svg className="bf-health-border" viewBox={BORDER.viewBox} preserveAspectRatio="none" aria-hidden="true">
        <path d={BORDER.paths[0].d} fill="none" stroke="currentColor" strokeWidth="0.6" vectorEffect="non-scaling-stroke" opacity="0.6" />
      </svg>
      <div className="bf-health-num bf-num">{Math.ceil(hp + over)}</div>
      <div className="bf-health-bar" role="meter" aria-valuemin={0} aria-valuemax={hpMax} aria-valuenow={Math.ceil(hp)} aria-label="Health">
        <span style={{ width: `${share * 100}%` }} />
        {over > 0 && <span className="bf-health-over" style={{ width: `${Math.min(1, over / (hpMax || 1)) * 100}%` }} />}
      </div>
      {evade != null && (
        <div className="bf-evade" aria-label={`${evade} evades`}>
          <svg viewBox={HEX.viewBox} aria-hidden="true">
            <path d={HEX.paths[0].d} fill="rgb(50 60 65)" opacity="0.85" />
            <path d={HEX.paths[0].d} fill="none" stroke="currentColor" strokeWidth="4" />
          </svg>
          <b>{evade}</b>
        </div>
      )}
    </div>
  );
}
