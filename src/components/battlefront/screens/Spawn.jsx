import { useEffect, useRef, useState } from 'react';
import DeployScreen from '../hud/DeployScreen.jsx';
import { offerIcon } from '../hud/icons.js';
import { offerRows } from '../hud/widgets.js';
import { prune } from './tree';
import { useTree } from './useTree';
import GameScreen from './GameScreen.jsx';

// The spawn screen: the game's SpawnOverlayScreen tree over the level's
// overview, with the offers (lane 5's offerRows: the classes, then the
// reinforcements and the heroes at their Battle Point cost) in the game's
// cells down its left side. The arrows move, Enter deploys the highlighted
// one (the page's input hears Enter too, as before). With no tree it is lane
// 5's DeployScreen, which takes the same props.
//
// Under them, where to deploy (lane 5's squad strip: `deploy.spawns`, the
// side's HQ then each squadmate, one that cannot be spawned on greyed with
// the game's reason); choosing one calls `onSpawn(spawn)` as lane 5's does.
//
// <Spawn deploy={{ open, offers, spawns }} points={n} name={(o) => text} title="Deploy" onDeploy={(o) => …} onPick={(o) => …} onSpawn={(s) => …} />
const PRE_ROUND = /^(PreroundText|Game Starting In: |Players Needed|BreadcrumbList)$/;

export default function Spawn({ screen = 'SpawnOverlayScreen', ...props }) {
  const raw = useTree(screen);
  if (!raw || !props.deploy?.open) return raw ? null : <DeployScreen {...props} />;
  return <SpawnTree tree={prune(raw, (b) => PRE_ROUND.test(b.id.split('/').pop()) || /FooterBar/.test(b.id))} {...props} />;
}

function SpawnTree({ tree, deploy, points = 0, name = (o) => o.id, title = 'Deploy', onDeploy, onPick, onSpawn }) {
  const spawns = deploy?.spawns ?? [];
  const [at, setAt] = useState('hq');
  const where = spawns.find((c) => c.id === at && !c.blocked) ?? spawns[0] ?? null;
  const rows = offerRows(deploy?.offers ?? [], points);
  const first = rows.find((r) => r.affordable) ?? null;
  const [picked, setPicked] = useState(first?.id ?? null);
  const list = useRef(null);
  const tell = useRef(null);
  tell.current = () => first && onPick?.(first);
  const firstId = first?.id ?? null;
  useEffect(() => tell.current(), [firstId]);
  const chosen = rows.find((r) => r.id === picked && r.affordable) ?? first;
  const pick = (o) => {
    if (!o.affordable) return;
    setPicked(o.id);
    onPick?.(o);
  };
  const onKeyDown = (e) => {
    const buttons = [...(list.current?.querySelectorAll('button') ?? [])];
    const i = buttons.indexOf(document.activeElement);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      buttons[(i + (e.key === 'ArrowDown' ? 1 : buttons.length - 1)) % buttons.length]?.focus();
    }
  };
  return (
    <GameScreen tree={tree} label={title} keys={[['↑↓', 'Choose'], ['Enter', title]]} className="bf-spawn-screen">
      <ul ref={list} className="bf-spawn-screen-list" onKeyDown={onKeyDown}>
        {rows.map((o) => (
          <li key={`${o.kind}:${o.id}`}>
            <button type="button" className="bf-spawn-screen-cell" data-kind={o.kind} aria-pressed={chosen?.id === o.id} aria-disabled={!o.affordable || undefined} onFocus={() => pick(o)} onClick={() => (o.affordable ? onDeploy?.(o) : null)}>
              <img src={offerIcon(o)} alt="" width="40" height="40" />
              <span className="bf-spawn-screen-name">{name(o)}</span>
              <span className="bf-num">{o.cost ? o.cost.toLocaleString('en-GB') : ''}</span>
            </button>
          </li>
        ))}
      </ul>
      {spawns.length > 1 && (
        <ul className="bf-spawn-screen-where" aria-label="Where to deploy">
          {spawns.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                className="bf-spawn-screen-cell"
                data-spawn={c.kind ?? c.id}
                aria-pressed={where?.id === c.id}
                aria-disabled={c.blocked ? true : undefined}
                onClick={() => {
                  if (c.blocked) return;
                  setAt(c.id);
                  onSpawn?.(c);
                }}
              >
                <span />
                <span className="bf-spawn-screen-name">{c.name}</span>
                <span className="bf-num">{c.reason ?? ''}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="bf-spawn-screen-points">
        Battle Points <span className="bf-num">{points.toLocaleString('en-GB')}</span>
      </p>
    </GameScreen>
  );
}
