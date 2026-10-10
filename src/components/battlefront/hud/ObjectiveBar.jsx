import { meterThirds } from './widgets.js';

// The objective bar (UI/InGame/Hud/Objectives: TopLevelObjective,
// SubLevelWidget): the stage's line in the game's words, each objective's
// name and its capture meter in thirds, and the tickets.
//
//   <ObjectiveBar stage="TAKE OUT ANY THREATS TO THE AT-ATS" objectives={[{ id, name, meter }]} tickets={n} />
export default function ObjectiveBar({ stage = null, objectives = [], tickets = null }) {
  if (!stage && !objectives.length) return null;
  return (
    <div className="bf-objectives">
      {stage && <div className="bf-stage-name bf-glass">{stage}</div>}
      {objectives.length > 0 && (
        <div className="bf-obj-row">
          {objectives.map((o) => (
            <div key={o.id} className="bf-obj bf-glass">
              <span>{o.name}</span>
              <span className="bf-thirds" aria-label={`${Math.round(Math.abs(o.meter ?? 0) * 100)} per cent`}>
                {meterThirds(o.meter ?? 0).map((on, i) => (
                  <span key={i} className="bf-third" data-on={on ? '' : undefined} />
                ))}
              </span>
            </div>
          ))}
        </div>
      )}
      {tickets != null && <div className="bf-tickets bf-num bf-glass">{tickets}</div>}
    </div>
  );
}
