import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { WorldHost, useWorld } from '../../runtime';
import { stepsAt } from '../../runtime/quality.js';
import { loadRulebook, stringOf } from '../../lib/battlefront/rulebook.js';
import { device, quality, setQuality } from '../../lib/device';
import { gpu } from '../../lib/gpu';
import { useMediaQuery } from '../../lib/hooks';
import { wayOut } from '../worlds/worlds';
import BattlefrontHud from './hud/BattlefrontHud.jsx';
import battlefrontModule from './module.js';
import { useGameScreens, wantsMenu } from './useGameScreens.js';
import { offerNameOf } from './hud/widgets.js';
import { sendTo } from './send.js';
import WaitingScreen, { Wipe } from './WaitingScreen.jsx';
import { COIN, HUD_QUIET, WIPE, machineLine, pickVariant, readiness, recommend, recommendationLine } from './waiting.js';
import '../../lib/bf2017/fonts.css';
import './hud/battlefront.css';

// The Battlefront world's page body: the module on the runtime, the game's
// HUD over it from the module's snapshots ('hud' events, a few a second),
// the deploy screen's choices sent back through world.do. First the
// waiting screen (WaitingScreen.jsx: the game's darkroom, no flown
// landing): the day by the game's coin or the player's pick, sent to the
// world at mount so its chain is built once; the class; the bar fed by
// the level's stream and the shader guard's counts; the machine's line
// and the pace's recommendation. Deploy there runs the game's wipe
// (waiting.js's WIPE: black in, the world's deploy at the swap, black
// out). After the first life the game's own screens (./screens/, lazily:
// the spawn screen, the in-game menu on Escape, the kill screen when the
// player is down, the end of round) stand over it; if they fail to load,
// lane 5's deploy screen and end of round stand as before.
const rb = loadRulebook();
// the game's word for an offer (hud/widgets.js's offerNameOf: its strings, in its capitals)
const offerName = (o) => offerNameOf(rb, o);
const WORDS = {
  title: 'Hoth · Galactic Assault',
  deploy: 'Deploy',
  earned: stringOf(rb, 'ID_DEATH_BATTLEPOINTS_EARNED'),
  total: stringOf(rb, 'ID_DEATH_TOTAL_BATTLE_POINTS'),
  offer: offerName,
  outcome: { won: stringOf(rb, 'ID_DOMINATION_GMTEXT_ROUND_WON'), lost: stringOf(rb, 'ID_DOMINATION_GMTEXT_ROUND_LOST'), draw: stringOf(rb, 'ID_MODE6_ROUND_DRAW') },
  // (the kill log's "defeated" is the game's string C998664F, which the site's table keeps under no key)
  kill: { defeated: 'defeated', killed: stringOf(rb, 'ID_HUD_KILLED') },
};

// the kill log's line for the player's death, if there is one
const killerOf = (snap) => {
  const line = [...(snap?.killLog ?? [])].reverse().find((k) => k.victim === 'You');
  return line ? { name: line.killer, weapon: line.weapon ?? null } : null;
};

// (the waiting screen's deploy slot in the HUD while it is up: nothing)
const Nothing = () => null;

export default function BattlefrontWorld({ level = 'hoth', mode = 'galacticAssault', back = null }) {
  const touch = useMediaQuery('(hover: none) and (pointer: coarse)');
  const navigate = useNavigate();
  const screens = useGameScreens();
  const [snap, setSnap] = useState(null);
  const [menu, setMenu] = useState(false);
  const [board, setBoard] = useState(false);
  // the waiting screen's phase: 'waiting' | 'down' (the wipe in) | 'up' (the wipe out) | 'in' (the field)
  const [phase, setPhase] = useState('waiting');
  // the day: the game's coin rolled once at mount, or the player's pick
  const [rolled] = useState(() => pickVariant());
  const [variant, setVariant] = useState(COIN);
  const day = variant === COIN ? rolled : variant;
  const [applied, setApplied] = useState(false);
  const picked = useRef(null);
  // the readiness's memory: the most building seen, and how long it has been quiet
  const seen = useRef({ peak: 0, quietSince: null });
  const onEvent = useCallback((e) => {
    if (e.type === 'hud') setSnap(e);
  }, []);
  const world = useWorld(battlefrontModule, { props: { level, mode, weather: day }, onEvent, rebuild: `${level}/${mode}` });
  // (the handle's `world` is a ref to the mounted world; send.js)
  const send = (action, arg) => sendTo(world, action, arg);
  // (a day picked while the world is up: its chain built again behind the screen, once a pick)
  const sentDay = useRef(null);
  useEffect(() => {
    if (!snap || sentDay.current === day || snap.weather === day) return;
    sentDay.current = day;
    send('weather', day);
  });
  // (the galaxy world that sent the player is the way out; else the view's)
  const way = back ?? wayOut('/battlefront');
  const loading = !snap || !snap.level?.loaded;
  const alive = snap?.player?.state === 'alive';
  const result = snap?.mode?.result ?? null;
  const waiting = phase === 'waiting' || phase === 'down';
  // what the bar shows and whether Deploy takes (waiting.js's readiness, fed by each snapshot)
  const busy = (snap?.shaders?.pending ?? 0) + (snap?.shaders?.held ?? 0) + (snap?.shaders?.building ?? 0);
  if (snap) {
    seen.current.peak = Math.max(seen.current.peak, busy);
    if (busy > 0 || !snap.level?.loaded) seen.current.quietSince = null;
    else seen.current.quietSince ??= snap.time;
  }
  const quietFor = snap && seen.current.quietSince != null ? Math.max(0, snap.time - seen.current.quietSince) + HUD_QUIET : 0;
  const progress = readiness({ loaded: Boolean(snap?.level?.loaded), progress: snap?.level?.progress ?? 0, pending: snap?.shaders?.pending ?? 0, held: snap?.shaders?.held ?? 0, building: snap?.shaders?.building ?? 0, peak: seen.current.peak, quietFor });
  // the machine and the pace's recommendation (waiting.js), from the snapshot's numbers
  const m = snap?.machine ?? null;
  const dev = device();
  const q = quality();
  const machine = machineLine({ detail: dev.detail, tier: m?.tier ?? null, renderer: m?.adapter || gpu().renderer || '', width: typeof window !== 'undefined' ? window.innerWidth : 0, height: typeof window !== 'undefined' ? window.innerHeight : 0, dpr: typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1, backend: m?.backend ?? '' });
  const rec = recommend({ level: dev.detail, gpuMs: m?.gpuMs ?? null, scale: m?.internal ?? 1, steps: stepsAt({ tier: dev.detail, pixels: m?.pixels ?? 0 }) });
  const canApply = !rec.measuring && rec.level !== dev.detail && !q.pinned;
  const onApply = () => {
    if (!canApply) return;
    setQuality(rec.level);
    setApplied(true);
  };
  // Deploy on the waiting screen: the game's wipe, the world's deploy at its swap
  const deployThrough = (o) => {
    if (phase !== 'waiting' || !progress.ready) return;
    picked.current = { kind: o.kind, id: o.id };
    send('pick', { kind: o.kind, id: o.id });
    setPhase('down');
    setTimeout(() => {
      send('deploy', picked.current);
      setPhase('up');
      setTimeout(() => setPhase('in'), WIPE.up * 1000);
    }, (WIPE.delay + WIPE.down) * 1000);
  };
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
      {waiting && (
        <WaitingScreen
          level={level}
          mode={mode}
          progress={progress}
          offers={snap?.deploy?.offers ?? []}
          points={snap?.points ?? 0}
          name={WORDS.offer}
          variant={variant}
          onVariant={setVariant}
          rolled={rolled}
          machine={machine}
          recommendation={recommendationLine(rec)}
          canApply={canApply}
          applied={applied}
          onApply={onApply}
          onPick={(o) => send('pick', { kind: o.kind, id: o.id })}
          onDeploy={deployThrough}
          back={way}
        />
      )}
      <Wipe phase={phase === 'down' || phase === 'up' ? phase : null} />
      {loading &&
        !waiting &&
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
          onDeploy={(o) => send('deploy', { kind: o.kind, id: o.id })}
          onPick={(o) => send('pick', { kind: o.kind, id: o.id })}
          onSpawn={(c) => send('spawn', c.kind === 'mate' ? c.id : null)}
          readRadar={() => ({ me: snap.player, entities: snap.entities ?? [], objectives: (snap.mode?.objectives ?? []).map((o) => ({ ...o, label: o.name })) })}
          way={way}
          touch={touch}
          {...(waiting ? { deployAs: Nothing } : screens ? { deployAs: screens.Spawn, roundAs: null, reticle: screens.crosshair(snap.player?.cls ?? null) } : {})}
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
