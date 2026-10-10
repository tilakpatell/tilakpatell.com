import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { WorldHost, useWorld } from '../../runtime';
import { loadRulebook, stringOf } from '../../lib/battlefront/rulebook.js';
import { useMediaQuery } from '../../lib/hooks';
import { wayOut } from '../worlds/worlds';
import BattlefrontHud from './hud/BattlefrontHud.jsx';
import battlefrontModule from './module.js';
import { useGameScreens, wantsMenu } from './useGameScreens.js';
import './hud/battlefront.css';

// The Battlefront world's page body: the module on the runtime, the game's
// HUD over it from the module's snapshots ('hud' events, a few a second),
// the deploy screen's choices sent back through world.do. The game's own
// screens (./screens/, lazily: the loading screen while the level comes in,
// the spawn screen, the in-game menu on Escape, the kill screen when the
// player is down, the end of round) stand over it; if they fail to load,
// lane 5's deploy screen, loading line and end of round stand as before.
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

// the kill log's line for the player's death, if there is one
const killerOf = (snap) => {
  const line = [...(snap?.killLog ?? [])].reverse().find((k) => k.victim === 'You');
  return line ? { name: line.killer, weapon: line.weapon ?? null } : null;
};

export default function BattlefrontWorld({ level = 'hoth', mode = 'galacticAssault' }) {
  const touch = useMediaQuery('(hover: none) and (pointer: coarse)');
  const navigate = useNavigate();
  const screens = useGameScreens();
  const [snap, setSnap] = useState(null);
  const [menu, setMenu] = useState(false);
  const [board, setBoard] = useState(false);
  const onEvent = useCallback((e) => {
    if (e.type === 'hud') setSnap(e);
  }, []);
  const world = useWorld(battlefrontModule, { props: { level, mode }, onEvent, rebuild: `${level}/${mode}` });
  const send = (action, arg) => world.world?.do?.(action, arg);
  const way = wayOut('/battlefront');
  const loading = !snap || !snap.level?.loaded;
  const alive = snap?.player?.state === 'alive';
  const result = snap?.mode?.result ?? null;
  // Escape, or the pointer let go, opens the in-game menu while the player is up (the menu's own Escape resumes)
  useEffect(() => {
    if (!screens || !alive || result) return undefined;
    const on = (e) => wantsMenu(e, document.pointerLockElement) && setMenu(true);
    window.addEventListener('keydown', on);
    document.addEventListener('pointerlockchange', on);
    return () => {
      window.removeEventListener('keydown', on);
      document.removeEventListener('pointerlockchange', on);
    };
  }, [screens, alive, result]);
  const Loading = screens?.Loading;
  const InGameMenu = screens?.InGameMenu;
  const KillScreen = screens?.KillScreen;
  const EndOfRound = screens?.EndOfRound;
  const Scoreboard = screens?.Scoreboard;
  return (
    <WorldHost world={world} className="bf-stage">
      {loading &&
        (Loading ? (
          <Loading mode={mode} level={level} progress={snap?.level?.progress ?? 0} />
        ) : (
          <p className="bf-loading bf-glass" role="status">
            Bringing Hoth in{snap?.level ? ` · ${Math.round((snap.level.progress ?? 0) * 100)} per cent` : ''}
          </p>
        ))}
      {snap && (
        <BattlefrontHud
          view={snap}
          mine={snap.player?.team ?? 2}
          words={WORDS}
          markers={snap.markers ?? []}
          scoreboard={screens ? false : snap.showScoreboard}
          onDeploy={(o) => send('deploy', o.kind === 'class' ? { classId: o.id } : {})}
          onPick={(o) => send('pick', o.kind === 'class' ? o.id : null)}
          readRadar={() => ({ me: snap.player, entities: [], objectives: (snap.mode?.objectives ?? []).map((o) => ({ ...o, label: o.name })) })}
          way={way}
          touch={touch}
          {...(screens ? { deployAs: screens.Spawn, roundAs: null, reticle: screens.reticle } : {})}
        />
      )}
      {KillScreen && !loading && snap?.player?.state === 'down' && !result && <KillScreen killer={killerOf(snap)} earned={snap.player.earned ?? 0} />}
      {InGameMenu && menu && alive && !result && (
        <InGameMenu
          on={{
            RESUME: () => setMenu(false),
            RESPAWN: () => {
              send('die');
              setMenu(false);
            },
            SCOREBOARD: () => {
              setMenu(false);
              setBoard(true);
            },
            QUIT: () => navigate(way.to),
          }}
          onComing={() => setMenu(false)}
        />
      )}
      {Scoreboard && !result && (board || snap?.showScoreboard) && <Scoreboard teams={snap?.scoreboard ?? {}} onBack={board ? () => setBoard(false) : null} />}
      {EndOfRound && result && <EndOfRound result={result} mine={snap.player?.team ?? 2} teams={snap.scoreboard ?? {}} words={WORDS.outcome} />}
    </WorldHost>
  );
}
