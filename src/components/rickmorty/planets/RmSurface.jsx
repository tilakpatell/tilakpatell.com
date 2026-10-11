import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import SurfaceView from '../../galaxy/surface/SurfaceView';
import ChaseHud from '../../galaxy/surface/ChaseHud';
import AssaultHud from '../../galaxy/surface/AssaultHud';
import { voiceFor } from '../../galaxy/surface/voicelines';
import { useOnline } from '../../universe/online/useOnline';
import { wayOut } from '../../worlds/worlds';
import { toggleGuide } from '../../../lib/palette';
import { Bubble, Exit, Hud, Menu, Objective, Prompt, QuestList, Toast, othersText } from '../../../runtime/hud';
import { ACCENT, planetMission, planetSite } from '.';
import { readBests, readDone, readFound, writeBest, writeDone, writeFound } from './saves';
import { RIDES } from '../../galaxy/surface/rides';
import { PROPS as GALAXY_PROPS, SCATTER as GALAXY_SCATTER } from '../../galaxy/surface/props';
import { RM_MODELS } from './catalog';
import { createRmFigures } from './cast';
import { PROPS as RM_PROPS, SCATTER as RM_SCATTER } from './props';
import { RM_RIDES } from './rides';
import '../../galaxy/surface/surface.css';
import './planets.css';

// The planets' kit laid over the galaxy's books (the scene keeps the
// galaxy's rocks and lamps, and the planets' own come first where both
// have a kind), and their people made by the scene's own Meshy cast
// (./cast.js): one set of books for the page's life.
const KIT = {
  models: RM_MODELS,
  rides: { ...RIDES, ...RM_RIDES },
  props: { ...GALAXY_PROPS, ...RM_PROPS },
  scatter: { ...GALAXY_SCATTER, ...RM_SCATTER },
  figures: (cast) => createRmFigures(cast).figure,
};

const CLIMB = 700; // ms after the cruiser's away before the page goes back to space (the end of the climb, as the galaxy's)

// A big planet of the Rick and Morty sector, landed on (#/c-137/<id>,
// pages/RmPlanet.jsx): the galaxy's surface engine on the planet's own site,
// the cruiser coming down and Rick and Morty climbing out, and over it the
// HUD kit's parts: the compass with the places to find, the objective, what
// E does, who's talking, the things to do on M, the mission's own HUD and
// the way back to space. None of the galaxy's war: no heroes, sides or
// ranks. Saves are the planets' own (./saves.js).
export default function RmSurface({ id, onLeave }) {
  const { pathname } = useLocation();
  const [params] = useSearchParams();
  const site = useMemo(() => planetSite(id), [id]);
  // a mission played here (?mission=<id>): the planet's, when it has one by that name
  const mission = useMemo(() => {
    const m = planetMission(id);
    return m && m.id === params.get('mission') ? m : null;
  }, [id, params]);
  const online = useOnline();
  const [found, setFound] = useState(() => readFound()[id] ?? []);
  const [done, setDone] = useState(() => readDone()[id] ?? []);
  // (what's saved as it happens, apart from what's drawn: an event's write
  // never waits on a render)
  const foundNow = useRef(found);
  const doneNow = useRef(done);
  const [phase, setPhase] = useState('landing');
  const [prompt, setPrompt] = useState(null);
  const [here, setHere] = useState(null);
  const [zone, setZone] = useState(null);
  const [talk, setTalk] = useState(null); // { who, text, voice, n }
  const [toast, setToast] = useState(null); // { key, text, bad }
  const [quest, setQuest] = useState(null); // { id, name, text, left }
  const [list, setList] = useState(false);
  const [chase, setChase] = useState(null); // the mission's view, when it changes
  const chaseFeed = useRef(new Set());
  const [best, setBest] = useState(() => readBests()[id] ?? null);
  const [fresh, setFresh] = useState(false);
  const view = useRef({ live: false });
  const compass = useRef(null);
  const left = useRef(false);
  const lines = useRef([]);
  const timers = useRef({});
  useEffect(() => () => Object.values(timers.current).forEach(clearTimeout), []);
  const later = useCallback((key, ms, fn) => {
    clearTimeout(timers.current[key]);
    timers.current[key] = setTimeout(fn, ms);
  }, []);
  const [coarse] = useState(() => (typeof window !== 'undefined' ? (window.matchMedia?.('(pointer: coarse)').matches ?? false) : false));

  // back to space, once: from the end of the cruiser's climb, or at once
  // when there's no 3D to climb in
  const leave = useCallback(
    (wait = CLIMB) => {
      if (left.current) return;
      left.current = true;
      if (wait) later('leave', wait, () => onLeave?.());
      else onLeave?.();
    },
    [onLeave, later],
  );
  const takeOff = useCallback(() => {
    if (left.current) return;
    if (!(view.current.live && view.current.takeOff?.())) leave(0);
  }, [leave]);
  const say = useCallback(
    (text, bad = false) => {
      setToast({ key: Date.now(), text, bad });
      later('toast', 5000, () => setToast(null));
    },
    [later],
  );

  const onEvent = useCallback(
    (e) => {
      if (e.type === 'phase') setPhase(e.phase);
      else if (e.type === 'prompt') setPrompt(e.text);
      else if (e.type === 'here') setHere(e.id);
      else if (e.type === 'zone') setZone(e.id ? { id: e.id, name: e.name } : null);
      else if (e.type === 'talk') {
        setTalk((t) => ({ who: e.who, text: e.text, voice: e.voice ?? null, n: (t?.n ?? 0) + 1 }));
        later('talk', 3500 + e.text.length * 45, () => setTalk(null));
      } else if (e.type === 'say') {
        // lines in turn, each up long enough to read
        const wasEmpty = !lines.current.length;
        lines.current.push(...e.lines);
        const next = () => {
          const l = lines.current.shift();
          if (!l) return setTalk(null);
          setTalk((t) => ({ who: l.who, text: l.text, voice: null, n: (t?.n ?? 0) + 1 }));
          later('talk', 2600 + l.text.length * 42, next);
        };
        if (wasEmpty) next();
      } else if (e.type === 'found') {
        const place = site?.places.find((p) => p.id === e.id);
        if (!place || foundNow.current.includes(e.id)) return;
        foundNow.current = [...foundNow.current, e.id];
        writeFound(id, foundNow.current);
        setFound(foundNow.current);
        say(`${place.name}. ${place.about}`);
      } else if (e.type === 'quest') setQuest(e.id ? e : null);
      else if (e.type === 'questDone' && e.id !== mission?.quest?.id) {
        const q = site?.quests.find((x) => x.id === e.id);
        if (!doneNow.current.includes(e.id)) {
          doneNow.current = [...doneNow.current, e.id];
          writeDone(id, doneNow.current);
          setDone(doneNow.current);
        }
        say(q?.reward ?? `${q?.name ?? 'Done'}.`);
      } else if (e.type === 'questFail' && e.id !== mission?.quest?.id) say(e.why === 'time' ? 'Out of time. Back to the start of it: try again.' : 'Try that again.', true);
      else if (e.type === 'fell') say('Long way down. Back to the cruiser.', true);
      else if (e.type === 'edge') say(site?.edge ?? 'Nothing out there but more of it. Turn back.');
      else if (e.type === 'mission') {
        for (const f of chaseFeed.current) f(e.view);
        setChase(e.view);
        if (e.event?.type === 'won' && e.view?.result) {
          const run = { t: e.view.result.t, stars: e.view.result.stars };
          const kept = writeBest(id, run);
          setFresh(kept);
          if (kept) setBest(run);
        }
      } else if (e.type === 'leave') leave();
    },
    [site, id, mission, leave, later, say],
  );

  // M for the things to do, H for the controls (the site's guide), Esc to
  // shut the list, or else back to the cruiser and up
  useEffect(() => {
    const onKey = (e) => {
      const tag = e.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'm' || e.key === 'M') setList((l) => !l);
      else if (e.key === 'h' || e.key === 'H') toggleGuide();
      else if (e.key === 'Escape') {
        if (list) setList(false);
        else takeOff();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [list, takeOff]);

  if (!site) return null;
  const place = site.places.find((p) => p.id === here);
  const unfound = site.places.filter((p) => !found.includes(p.id)).length;
  const objective = quest ? `${quest.name}: ${quest.text}${quest.left != null ? ` · ${quest.left}s` : ''}` : unfound ? `${site.places.length - unfound} of ${site.places.length} places found` : `All ${site.places.length} places found`;
  const others = online?.on ? online.room.peers.filter((p) => !p.blocked && p.where === online.where).length : 0;
  const fighting = (mission?.kind === 'chase' || mission?.kind === 'assault') && chase && !chase.result;
  const accent = { '--accent': ACCENT, '--accent-text': ACCENT, '--btn-bg': ACCENT, '--btn-ink': '#03040a' };
  return (
    <div className="dark-scope surface-page rm-surface" style={accent} data-phase={phase}>
      <h1 className="sr-only">
        {site.name}: {site.place}
      </h1>
      <SurfaceView site={site} missionSpec={mission} {...KIT} ship="cruiser" loadout={null} found={found} done={done} compass={compass} net={online?.client ?? null} handle={view} onEvent={onEvent} />

      {/* the compass: the way to each place, the quest and the cruiser (the scene slides each mark by its data-id) */}
      <div className="surface-compass" ref={compass} aria-hidden="true">
        {['n', 'e', 's', 'w'].map((d) => (
          <span key={d} data-id={d} className="surface-mark surface-mark-dir">
            {d.toUpperCase()}
          </span>
        ))}
        <span data-id="quest" className="surface-mark surface-mark-quest">
          <i />
          <b>{quest ? '◆' : '!'}</b>
          <em className="d" />
        </span>
        <span data-id="ship" className="surface-mark surface-mark-ship">
          <i />
          <b>Cruiser</b>
          <em className="d" />
        </span>
        {site.places.map((p) => (
          <span key={p.id} data-id={p.id} className="surface-mark" data-found={found.includes(p.id) ? '' : undefined}>
            <i />
            <b>{found.includes(p.id) ? p.name : '?'}</b>
            <em className="d" />
          </span>
        ))}
      </div>

      <Hud
        className="rm-hud"
        brand={
          <>
            <p className="rm-hud-world">{site.name}</p>
            <p className="rm-hud-place">{zone?.name ?? place?.name ?? site.place}</p>
            {phase !== 'landing' && !fighting && <Objective className="rm-objective" text={objective} />}
          </>
        }
        tools={
          <>
            <Exit label="Back to space" onLeave={takeOff} className="btn btn-ghost btn-sm rm-exit" />
            <Menu className="rm-menu" todo={site.quests.length ? { onOpen: () => setList(true), done: done.length, total: site.quests.length } : null} players={online ? { available: true, on: Boolean(online.on), count: others, onJoin: null } : null} way={wayOut(pathname)} />
          </>
        }
        foot={prompt && phase !== 'landing' && phase !== 'leaving' ? <Prompt verb={prompt} className="rm-prompt" /> : null}
      >
        <Toast toast={toast} className="rm-toast" />
        {talk && <Bubble key={talk.n} className="rm-talk" name={talk.who} line={talk.text} voice={talk.voice ?? voiceFor(talk.who)} />}
        {list && <QuestList className="rm-list" title={`Things to do on ${site.name}`} quests={site.quests.map((q) => ({ id: q.id, name: q.name, done: done.includes(q.id), open: true, blurb: q.about }))} next={quest?.id} onClose={() => setList(false)} onGo={(q) => (view.current?.input?.('track', q.id), setList(false))} canGo={(q) => !q.done} />}
        {others > 0 && <p className="rm-others">{othersText(others)}</p>}
      </Hud>

      {mission && mission.kind !== 'assault' && <ChaseHud view={chase} feed={chaseFeed} mission={mission} best={best} fresh={fresh} onAgain={() => view.current?.input?.('restart')} onBack={takeOff} />}
      {mission?.kind === 'assault' && <AssaultHud view={chase} feed={chaseFeed} mission={mission} best={best} fresh={fresh} onSide={(k) => view.current?.input?.('side', k)} sworn={null} onDeploy={(p) => view.current?.input?.('deploy', p)} onAgain={() => view.current?.input?.('restart')} onBack={takeOff} />}

      {phase === 'landing' && (
        <div className="surface-title" aria-hidden="true">
          <p className="surface-title-world">{site.name}</p>
          <p className="surface-title-place">{site.place}</p>
          <p className="surface-title-line">{site.line}</p>
          <p className="surface-title-skip">{coarse ? 'Tap to skip' : 'Any key to skip'}</p>
        </div>
      )}
    </div>
  );
}
