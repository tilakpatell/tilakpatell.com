import { HEAT_CELLS, heatCells } from './widgets.js';

// The heat bar (UI/InGame/Hud/Weapons/Widgets/WeaponHeat: WeaponHeatWidget
// on every crosshair screen, WeaponHeatProgress 256 × 12 under the middle
// of the view, 120 down on the reference: PF_Hud_WeaponHeatVerticalPosition):
// 32 sections of 8 (WeaponHeatSectionsBG: a black at 0.5 under each, the
// alarm red, palette 12, under it past the warning), lit to the heat in
// white (WeaponHeatSectionsSolid), gone while the gun is cool. Overheated,
// the cooling flush (WeaponHeatMinigame) draws its window on the bar in the
// friendly blue and the scrubber (HeatBarScrubber, 24 × 4) sweeping it.
//
//   <Heat heat={0…1} warning={0…1} overheated={bool} window={[a, b]} />
export default function Heat({ heat = 0, warning = 0.75, overheated = false, window: win = null }) {
  const warn = heat >= warning || overheated;
  const cells = heatCells(heat, warning);
  return (
    <div className="bf-heat" data-warn={warn ? '' : undefined} data-cool={heat <= 0 && !overheated ? '' : undefined} aria-hidden="true">
      <div className="bf-heat-cells">
        {cells.map((c, i) => (
          <span key={i} className="bf-heat-cell" data-on={c === 'off' ? undefined : c} />
        ))}
      </div>
      {overheated && win && <span className="bf-heat-window" style={{ left: `${win[0] * 100}%`, width: `${(win[1] - win[0]) * 100}%` }} />}
      {overheated && <span className="bf-heat-scrubber" style={{ left: `${Math.min(1, heat) * 100}%` }} />}
    </div>
  );
}
export { HEAT_CELLS };
