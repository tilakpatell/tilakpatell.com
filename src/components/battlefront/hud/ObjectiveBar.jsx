import { shape } from '../../../lib/bf2017/ui/shapes.js';

// The mode's bar at the top middle (UI/InGame/Hud/GameModes/FantasyBattle/
// DefaultGameModeFantasyBattleEscort and …Conquest): the tickets at 40 down
// (Shared/TicketsWidget, 176 × 40 on glass with the GameMode_Soldier icon
// at 48 and the count in Univers 620 Bold 24 px at 0.85), the stage's line
// under it (the Conquest screen's 300 × 45 glass at 86, Univers 620 Bold
// 22 px), then the objectives (Shared/ObjectiveListWidget: 48-unit
// hexagons 10 apart, MultiplayerObjectiveHUD's Hexagon_Default_Inside at
// 0.8 with the letter, the capture meter swept round the edge).
//
//   <ObjectiveBar stage="TAKE OUT ANY THREATS TO THE AT-ATS" objectives={[{ id, name, meter }]} tickets={n} />
const HEX = shape('Hexagon_Default_Inside');
const SOLDIER = shape('GameMode_Soldier');
export default function ObjectiveBar({ stage = null, objectives = [], tickets = null }) {
  if (!stage && !objectives.length && tickets == null) return null;
  return (
    <div className="bf-objectives">
      {tickets != null && (
        <div className="bf-tickets" aria-label={`${tickets} reinforcements`}>
          <svg viewBox={SOLDIER.viewBox} aria-hidden="true">
            {SOLDIER.paths.map((p, i) => (
              <path key={i} d={p.d} fill="currentColor" fillRule="evenodd" />
            ))}
          </svg>
          <span className="bf-num">{tickets}</span>
        </div>
      )}
      {stage && <div className="bf-stage-name">{stage}</div>}
      {objectives.length > 0 && (
        <div className="bf-obj-row">
          {objectives.map((o) => {
            const meter = Math.min(1, Math.abs(o.meter ?? 0));
            return (
              <div key={o.id} className="bf-obj" aria-label={`${o.name}: ${Math.round(meter * 100)} per cent`}>
                <svg viewBox={HEX.viewBox} aria-hidden="true">
                  <path d={HEX.paths[0].d} fill="currentColor" opacity="0.8" />
                  {meter > 0 && <path d={HEX.paths[0].d} fill="none" stroke="currentColor" strokeWidth="6" pathLength="1" strokeDasharray={`${meter} 1`} />}
                </svg>
                <b>{o.name}</b>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
