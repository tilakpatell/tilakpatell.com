import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { WorldHost, useWorld } from '../../runtime';
import { loadRulebook, stringOf } from '../../lib/battlefront/rulebook.js';
import { useMediaQuery } from '../../lib/hooks';
import { wayOut } from '../worlds/worlds';
import BattlefrontHud from './hud/BattlefrontHud.jsx';
import battlefrontModule from './module.js';
import { useGameScreens, wantsMenu } from './useGameScreens.js';
import { offerNameOf } from './hud/widgets.js';
import { sendTo } from './send.js';
import { startLoadingMusic } from './sound/loading.js';
import { deploysThrough, latch, phaseFor, playWay, standing } from './stage.js';
import Wipe from './Wipe.jsx';
import { HUD_QUIET, WIPE, loadLine, pickVariant, readiness } from './waiting.js';
import { device } from '../../lib/device.js';
import '../../lib/bf2017/fonts.css';
import './hud/battlefront.css';

// The Battlefront world's page body: the module on the runtime, the game's
// HUD over it from the module's snapshots ('hud' events, a few a second),
// the deploy screen's choices sent back through world.do. The way in is
// the game's own (stage.js says what stands over the world; the design is
// docs/superpowers/specs/2026-10-13-hoth-landing-game-menu-design.md):
// with `menu`, the game's front end on its main menu while the level
// streams and its shaders build behind it; then the game's loading screen
// until nothing is left to build (waiting.js's readiness), its spawn
// screen for the first life, and on Deploy its wipe (waiting.js's WIPE:
// black in, the world's deploy at the swap, black out). The day is the
// game's coin, rolled once and sent to the world at mount so its chain is
// built once. After the first life the same screens stand as they did:
// the spawn screen, the in-game menu on Escape, the kill screen when the
// player is down, the end of round. Their code comes apart from the
// world's (./screens/, lazily): until it has come the parked camera's view
// is covered in black, and if it never comes lane 5's deploy screen and
// end of round stand in.
const rb = loadRulebook();
// the game's word for an offer (hud/widgets.js's offerNameOf: its strings, in its capitals)
const offerName = (o) => offerNameOf(rb, o);
// (the stage's name at the top left follows the round's mode)
const MODES_SAID = { galacticAssault: 'Galactic Assault', supremacy: 'Supremacy', strike: 'Strike', extraction: 'Extraction', ewokHunt: 'Ewok Hunt', hvv: 'Heroes vs Villains', blast: 'Blast' };
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

// (the HUD's deploy slot while the menu or the loading screen stands: nothing)
const Nothing = () => null;

export default function BattlefrontWorld({ level = 'hoth', mode = 'galacticAssault', back = null, menu: startInMenu = false, playable = () => true, onOther = null, round: startRound = null }) {
  const touch = useMediaQuery('(hover: none) and (pointer: coarse)');
  const navigate = useNavigate();
  const screens = useGameScreens();
  const [snap, setSnap] = useState(null);
  // the game's front end over the world: the way in when the address names no mode (the level loads behind it)
  const [inMenu, setInMenu] = useState(startInMenu && !startRound);
  // a round asked for at Instant Action's setup screen: begun in the world that is there (its `round`) once the
  // level is in, the loading screen standing until it has; then the mode it is
  const [pending, setPending] = useState(startRound);
  const [roundMode, setRoundMode] = useState(null);
  const [menu, setMenu] = useState(false);
  const [board, setBoard] = useState(false);
  // the way in's phase: 'pre' (before the first deploy) | 'down' (the wipe in) | 'up' (the wipe out) | 'in' (the field)
  const [phase, setPhase] = useState('pre');
  // the day: the game's coin, rolled once at mount
  const [day] = useState(() => pickVariant());
  const picked = useRef(null);
  const arrived = useRef(false);
  // the readiness's memory: the most building seen, and how long it has been quiet
  const seen = useRef({ peak: 0, quietSince: null, loadedAt: null });
  const onEvent = useCallback((e) => {
    if (e.type === 'hud') setSnap(e);
  }, []);
  const world = useWorld(battlefrontModule, { props: { level, mode, weather: day }, onEvent, rebuild: `${level}/${mode}` });
  // (the handle's `world` is a ref to the mounted world; send.js)
  const send = (action, arg) => sendTo(world, action, arg);
  const sendRef = useRef(send);
  sendRef.current = send;
  // (the galaxy world that sent the player is the way out; else the view's)
  const way = back ?? wayOut('/battlefront');
  const loading = !snap || !snap.level?.loaded;
  const alive = snap?.player?.state === 'alive';
  const result = snap?.mode?.result ?? null;
  // what the bar shows and whether Deploy takes (waiting.js's readiness, fed by each snapshot)
  const busy = (snap?.shaders?.pending ?? 0) + (snap?.shaders?.held ?? 0) + (snap?.shaders?.building ?? 0);
  if (snap) {
    // (the page's own clock from the level's arrival: the door opens SHADER_WAIT_S after it, waiting.js)
    if (snap.level?.loaded) seen.current.loadedAt ??= performance.now();
    seen.current.peak = Math.max(seen.current.peak, busy);
    if (busy > 0 || !snap.level?.loaded) seen.current.quietSince = null;
    else seen.current.quietSince ??= snap.time;
  }
  const quietFor = snap && seen.current.quietSince != null ? Math.max(0, snap.time - seen.current.quietSince) + HUD_QUIET : 0;
  const waited = seen.current.loadedAt != null ? (performance.now() - seen.current.loadedAt) / 1000 : 0;
  const progress = readiness({ loaded: Boolean(snap?.level?.loaded), progress: snap?.level?.progress ?? 0, pending: snap?.shaders?.pending ?? 0, held: snap?.shaders?.held ?? 0, building: snap?.shaders?.building ?? 0, peak: seen.current.peak, quietFor, waited });
  // (once the spawn screen could stand, the way in stays ready: stage.js's latch)
  arrived.current = latch(arrived.current, { inMenu, phase, ready: progress.ready && !pending });
  const ready = (progress.ready || arrived.current) && !pending;
  // (once, the first time the field could stand: where the way in spent its time, for the owner's laptop to say)
  const told = useRef(false);
  useEffect(() => {
    if (!ready || told.current || !snap) return;
    told.current = true;
    console.info(loadLine({ now: performance.now(), marks: snap.marks, shaders: snap.shaders, machine: snap.machine, detail: device().detail }));
  }, [ready, snap]);
  // what stands over the world (stage.js)
  // (the screens: true once they have come, null until then, false if their import failed)
  const st = standing({ inMenu, phase, ready, loaded: !loading, screens: screens === false ? false : screens ? true : null });
  // the world rests under the menu once it is ready (stage.js's rest): the runtime's loop is told its box is out of
  // sight, so it neither steps nor draws until Play, and the menu has the machine to itself
  const resting = st.rest;
  const rt = world.rt;
  // (the chip lost: the snapshot of the world that went goes with it, and the
  // way in starts over on the one the runtime mounts again on WebGL 2,
  // useWorld's recovery; a loss it cannot come back from, or a world that
  // could not start, says so instead of leaving the last frame's HUD up)
  const status = world.status;
  useEffect(() => {
    if (status !== 'lost') return;
    setSnap(null);
    seen.current = { peak: 0, quietSince: null, loadedAt: null };
    arrived.current = false;
    told.current = false; // (the world mounted again says its own load line)
    setPhase('pre');
  }, [status]);
  const dead = status === 'failed' || (status === 'lost' && !rt?.recoverable);
  useEffect(() => {
    if (!resting) return undefined;
    rt?.setVisible(false);
    return () => rt?.setVisible(true);
  }, [resting, rt]);
  const levelIn = Boolean(snap?.level?.loaded);
  useEffect(() => {
    if (!pending || !levelIn) return undefined;
    let live = true;
    Promise.resolve(sendRef.current('round', pending)).then((r) => {
      if (!live) return;
      // (the world is at its park again with the deploy open: the way in starts over, from the spawn screen)
      if (r?.ok) setRoundMode(r.round?.mode ?? pending.mode ?? null);
      arrived.current = false;
      setPhase('pre');
      setPending(null);
    });
    return () => {
      live = false;
    };
  }, [pending, levelIn]);
  // (a soldier deployed some other way, a check's door on the world, ends the way in: stage.js's phaseFor)
  const parked = snap?.parked;
  useEffect(() => {
    const next = phaseFor(phase, { parked });
    if (next !== phase) setPhase(next);
  }, [phase, parked]);
  // The first life's Deploy: the game's wipe, the world's deploy at its swap
  const deployThrough = (o) => {
    if (phase !== 'pre' || !ready) return;
    picked.current = { kind: o.kind, id: o.id };
    send('pick', { kind: o.kind, id: o.id });
    setPhase('down');
    setTimeout(() => {
      send('deploy', picked.current);
      setPhase('up');
      setTimeout(() => setPhase('in'), WIPE.up * 1000);
    }, (WIPE.delay + WIPE.down) * 1000);
  };
  // Escape on the way in (the loading screen, the first spawn screen): back to the menu it came from, else out to
  // the world that sent the player. After the first life there is the in-game menu.
  const backOut = () => (startInMenu && screens ? setInMenu(true) : navigate(way.to));
  const backRef = useRef(null);
  backRef.current = phase === 'pre' ? backOut : null;
  const SpawnScreen = screens ? screens.Spawn : null;
  // (one component for the HUD's deploy slot, the same from render to render: a new one each time would be mounted again at every snapshot)
  const FirstSpawn = useMemo(() => (SpawnScreen ? (p) => <SpawnScreen {...p} first={Boolean(backRef.current)} onBack={backRef.current ? () => backRef.current?.() : null} /> : null), [SpawnScreen]);
  // the level's loading cue, from the menu's end to the wipe's swap (never under the menu; the world is unheard until then: sound/director.js)
  const cued = !inMenu && (phase === 'pre' || phase === 'down');
  useEffect(() => (cued ? startLoadingMusic(level) : undefined), [cued, level]);
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
  const onPlay = (l, m, options = null) => {
    const how = playWay({ level, mode }, l, m, options);
    if (how === 'other' && onOther) return onOther(l, m);
    if (how === 'round') setPending(options);
    return setInMenu(false);
  };
  const words = { ...WORDS, title: `Hoth · ${MODES_SAID[roundMode ?? mode] ?? ''}` };
  const FrontEnd = screens?.FrontEnd;
  const Loading = screens?.Loading;
  const InGameMenu = screens?.InGameMenu;
  const KillScreen = screens?.KillScreen;
  const EndOfRound = screens?.EndOfRound;
  const Scoreboard = screens?.Scoreboard;
  return (
    <WorldHost world={world} className="bf-stage" data-bf-stage={st.name} data-bf-ready={ready || undefined}>
      {st.cover && <div className="bf-cover" aria-hidden="true" />}
      {st.menu && FrontEnd && <FrontEnd start="menu" playable={playable} level={level} onPlay={onPlay} onExit={() => navigate(way.to)} />}
      <Wipe phase={st.wipe} />
      {st.loading && Loading && <Loading mode={pending?.mode ?? roundMode ?? mode} level={level} waiting={progress.line} onBack={phase === 'pre' ? backOut : null} />}
      {snap && (
        <BattlefrontHud
          view={snap}
          mine={snap.player?.team ?? 2}
          words={words}
          markers={snap.markers ?? []}
          scoreboard={screens ? false : snap.showScoreboard}
          onDeploy={(o) => (deploysThrough(phase) ? deployThrough(o) : send('deploy', { kind: o.kind, id: o.id }))}
          onPick={(o) => send('pick', { kind: o.kind, id: o.id })}
          onSpawn={(c) => send('spawn', c.kind === 'mate' ? c.id : null)}
          readRadar={() => ({ me: snap.player, entities: snap.entities ?? [], objectives: (snap.mode?.objectives ?? []).map((o) => ({ ...o, label: o.name })) })}
          way={way}
          touch={touch}
          {...(st.menu || st.loading ? { deployAs: Nothing } : screens ? { deployAs: FirstSpawn, roundAs: null, reticle: screens.crosshair(snap.player?.cls ?? null) } : {})}
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
      {Scoreboard && !result && st.name === 'field' && (board || snap?.showScoreboard) && <Scoreboard teams={snap?.scoreboard ?? {}} onBack={board ? () => setBoard(false) : null} />}
      {EndOfRound && result && <EndOfRound result={result} mine={snap.player?.team ?? 2} teams={snap.scoreboard ?? {}} words={WORDS.outcome} />}
      {dead && (
        <div className="notice bf-dead" role="alert">
          <p>{status === 'lost' ? 'The graphics chip reset, and the game couldn’t come back on it.' : 'The game couldn’t start its 3D here.'}</p>
          <button type="button" className="btn" onClick={() => window.location.reload()}>
            Reload
          </button>
        </div>
      )}
    </WorldHost>
  );
}
