import { useCallback, useState } from 'react';
import { WorldHost, useWorld } from '../../runtime';
import { loadRulebook, stringOf } from '../../lib/battlefront/rulebook.js';
import { useMediaQuery } from '../../lib/hooks';
import { wayOut } from '../worlds/worlds';
import BattlefrontHud from './hud/BattlefrontHud.jsx';
import battlefrontModule from './module.js';
import './hud/battlefront.css';

// The Battlefront world's page body: the module on the runtime, the game's
// HUD over it from the module's snapshots ('hud' events, a few a second),
// the deploy screen's choices sent back through world.do.
const rb = loadRulebook();
const NAMES = { 'd-orig-assault': 'ID_C_ASSAULT_TROOPER', 'l-orig-assault': 'ID_C_ASSAULT_TROOPER', 'd-orig-heavy': 'ID_C_HEAVY_TROOPER', 'l-orig-heavy': 'ID_C_HEAVY_TROOPER', 'd-orig-officer': 'ID_C_OFFICER', 'l-orig-officer': 'ID_C_OFFICER' };
// the game's word for an offer where its strings have one, else its own name
const offerName = (o) => {
  if (o.kind === 'class') return NAMES[o.id] ? stringOf(rb, NAMES[o.id]) : String(o.cls ?? o.id).toUpperCase();
  if (o.kind === 'hero') return rb.heroes[o.id]?.name ? stringOf(rb, rb.heroes[o.id].name) : o.id.toUpperCase();
  return o.id.replace(/([a-z])([A-Z])/g, '$1 $2').toUpperCase();
};
const WORDS = {
  title: 'Hoth · Galactic Assault',
  deploy: 'Deploy',
  earned: stringOf(rb, 'ID_DEATH_BATTLEPOINTS_EARNED'),
  total: stringOf(rb, 'ID_DEATH_TOTAL_BATTLE_POINTS'),
  offer: offerName,
  outcome: { won: stringOf(rb, 'ID_DOMINATION_GMTEXT_ROUND_WON'), lost: stringOf(rb, 'ID_DOMINATION_GMTEXT_ROUND_LOST'), draw: stringOf(rb, 'ID_MODE6_ROUND_DRAW') },
};

export default function BattlefrontWorld({ level = 'hoth', mode = 'galacticAssault' }) {
  const touch = useMediaQuery('(hover: none) and (pointer: coarse)');
  const [snap, setSnap] = useState(null);
  const onEvent = useCallback((e) => {
    if (e.type === 'hud') setSnap(e);
  }, []);
  const world = useWorld(battlefrontModule, { props: { level, mode }, onEvent, rebuild: `${level}/${mode}` });
  const send = (action, arg) => world.world?.do?.(action, arg);
  const loading = !snap || !snap.level?.loaded;
  return (
    <WorldHost world={world} className="bf-stage">
      {loading && (
        <p className="bf-loading bf-glass" role="status">
          Bringing Hoth in{snap?.level ? ` · ${Math.round((snap.level.progress ?? 0) * 100)} per cent` : ''}
        </p>
      )}
      {snap && (
        <BattlefrontHud
          view={snap}
          mine={snap.player?.team ?? 2}
          words={WORDS}
          markers={snap.markers ?? []}
          scoreboard={snap.showScoreboard}
          onDeploy={(o) => send('deploy', o.kind === 'class' ? { classId: o.id } : {})}
          onPick={(o) => send('pick', o.kind === 'class' ? o.id : null)}
          readRadar={() => ({ me: snap.player, entities: [], objectives: (snap.mode?.objectives ?? []).map((o) => ({ ...o, label: o.name })) })}
          way={wayOut('/battlefront')}
          touch={touch}
        />
      )}
    </WorldHost>
  );
}
