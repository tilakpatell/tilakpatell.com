import { useEffect, useRef, useState } from 'react';
import { CLASS_ICON, iconSrc, offerIcon } from './icons.js';
import { offerRows } from './widgets.js';

// The deploy screen (UI/Customize/Screens/SpawnOverlayScreen): over the
// level's overview camera while the battle runs; the classes, then the
// reinforcements and the heroes at their Battle Point cost, greyed when they
// cannot be had. Under them, where to deploy (UI/InGame/Spawn/FastSpawnScreen's
// strip): the side's HQ, then each squadmate, one who cannot be spawned on
// greyed with the game's reason. Enter deploys the one picked (the page's
// input reads it; this listens too, for a click on the button). A modal
// dialog: the focus starts on the first offer and stays inside.
//
//   <DeployScreen deploy={{ open, offers, spawns, timeLeft }} points={n} name={(offer) => text} onDeploy={(offer) => …} onPick={(offer) => …} onSpawn={(spawn) => …} />
export default function DeployScreen({ deploy, points = 0, name = (o) => o.id, title = 'Deploy', onDeploy, onPick, onSpawn }) {
  const rows = offerRows(deploy?.offers ?? [], points);
  const first = rows.find((r) => r.affordable) ?? null;
  const [picked, setPicked] = useState(first?.id ?? null);
  const firstButton = useRef(null);
  const chosen = rows.find((r) => r.id === picked && r.affordable) ?? first;
  const spawns = deploy?.spawns ?? [];
  const [at, setAt] = useState('hq');
  const where = spawns.find((c) => c.id === at && !c.blocked) ?? spawns[0] ?? null;
  // (the highlight is what Enter deploys: the page hears the first one too)
  const firstId = first?.id ?? null;
  const tell = useRef(null);
  tell.current = () => first && onPick?.(first);
  useEffect(() => {
    firstButton.current?.focus({ preventScroll: true });
    tell.current();
  }, [firstId]);
  if (!deploy?.open) return null;
  return (
    <div className="bf-screen" role="dialog" aria-modal="true" aria-labelledby="bf-deploy-title">
      <div className="bf-panel">
        <h2 id="bf-deploy-title">{title}</h2>
        <ul className="bf-offers">
          {rows.map((o, i) => (
            <li key={`${o.kind}:${o.id}`}>
              <button
                ref={i === 0 ? firstButton : undefined}
                type="button"
                className="bf-offer"
                aria-pressed={chosen?.id === o.id}
                aria-disabled={!o.affordable}
                onClick={() => {
                  if (!o.affordable) return;
                  setPicked(o.id);
                  onPick?.(o);
                }}
                onDoubleClick={() => o.affordable && onDeploy?.(o)}
              >
                <img src={offerIcon(o)} alt="" width="36" height="36" />
                <span>{name(o)}</span>
                <span className="bf-num">{o.cost ? o.cost.toLocaleString('en-GB') : ''}</span>
              </button>
            </li>
          ))}
        </ul>
        {spawns.length > 1 && (
          <ul className="bf-spawns" aria-label="Where to deploy">
            {spawns.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  className="bf-spawn"
                  aria-pressed={where?.id === c.id}
                  aria-disabled={Boolean(c.blocked)}
                  onClick={() => {
                    if (c.blocked) return;
                    setAt(c.id);
                    onSpawn?.(c);
                  }}
                >
                  {c.kind === 'mate' && <img src={iconSrc(CLASS_ICON[c.cls] ?? CLASS_ICON.assault)} alt="" width="28" height="28" />}
                  <span>{c.name}</span>
                  {c.reason && <span className="bf-spawn-why">{c.reason}</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="bf-deploy-foot">
          <span>
            Battle Points <span className="bf-num">{points.toLocaleString('en-GB')}</span>
          </span>
          <button type="button" className="bf-offer" style={{ width: 'auto' }} disabled={!chosen} onClick={() => chosen && onDeploy?.(chosen)}>
            <span />
            <span>
              <kbd className="hud-cap">Enter</kbd> Deploy
            </span>
            <span />
          </button>
        </div>
      </div>
    </div>
  );
}
