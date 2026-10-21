import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAchievements } from '../../Achievements';
import { useMediaQuery } from '../../../lib/hooks';
import { WorldHost, useWorld } from '../../../runtime';
import { useTravellers } from '../../middleearth/shared/travellers';
import module from './module';
import Hud, { Pause } from './ui/Hud';
import End from './ui/End';
import MapPanel from './ui/Map';
import Marker from './ui/Marker';
import { placeMarker } from './ui/waymark';
import Start from './ui/Start';
import Touch from './ui/Touch';
import { fromSearch, layers } from './ui/state';
import './inside.css';

// The page’s side of Aboard the Death Star (pages/DeathStarInside.jsx shows
// it): the world module (./module.js) in its box, and over it the start
// screen, the HUD, the map, the pause menu and, on a phone, the touch
// controls. The page holds no game: it shows what the world tells it and
// sends it what you do. A deep link’s choices (`?station=ds1&side=rebel&
// mode=roam&at=bay327`) go to the world as its props, so it can begin at
// once. On a desktop the pointer is held while you play: its moves turn
// your head, the left button fires and the right aims, and letting it go
// (Esc) pauses.
//
//   <Inside mode="page" onExit={fn} />   onExit: leave for the Death Star page
//
// What the world tells the page (its events):
//   'ui'  { mode: 'loading' | 'start' | 'play' | 'pause', station, side, hero, play: 'story' | 'roam',
//           objective, prompt: null | { text, use }, talk: null | { who, line, choices: [text] },
//           map: { open, seen: [roomId] }, settings: { view, sound, subtitles },
//           saved: { [station]: { rebel, imperial } } }
//     prompt: what E does here (‘call the lift’), or with `use: false` a notice with no key (a
//     door won’t open: doors open on their own, so E is for lifts, consoles, people and coded hatches)
//   'hud' { hp, hpMax, heat, venting, gun, blade, alert, doubt, section, room, roomName,
//           at?: { x, z, yaw }, aim? }
//     alert: the security of the section you are in; doubt: 0…1, how far the garrison doubts a
//     Rebel in armour (null without a disguise)
//   'say' { who, text, seconds? }   a subtitle (shown while subtitles are on)
//   'hurt' { amount, angle }   a hit on you; angle: the turn from where you face to where it came from
//   'hit' { target }   a hit you landed
//   'story' { id, done }   the story ran to its end
//   'achievement' { id }
//   'marker' { x, y, off, angle, kind, metres, goal } | null   each frame: where on the screen the way
//     to the story's target goes next (ui/Marker.jsx); null when there is none to show
// What the page asks of the world:
//   start({ station, side, hero, mode, fresh }), pause(on), set({ view | sound | subtitles }),
//   quit() (back to the start screen), map(open), choose(i), look(dx, dy) (pixels),
//   stick(x, y) (−1…1, y forward), press(name, down): fire, aim, use, jump, crouch

const SAY = 4; // seconds a subtitle stays when the world doesn’t say
const ROOM = { motion: true }; // (the others online: rules/online.js)

export default function Inside({ mode = 'page', onExit }) {
  const touch = useMediaQuery('(hover: none) and (pointer: coarse)');
  const { search } = useLocation();
  const asked = useMemo(() => fromSearch(search), [search]);
  const { unlock } = useAchievements();
  // a deep link that names a side starts the world at once: no start screen to flash first
  const [ui, setUi] = useState(() => ({ mode: asked.side ? 'loading' : 'start' }));
  const [hud, setHud] = useState(null);
  const [say, setSay] = useState(null);
  const sayTimer = useRef(null);
  const [hurt, setHurt] = useState(null);
  const [hit, setHit] = useState(0);
  const hurts = useRef(0);
  const props = useMemo(() => ({ ...asked, small: touch }), [asked, touch]);

  const markerRef = useRef(null);
  // a story run to its end: its id, for the card, until you walk on or go
  const [ended, setEnded] = useState(null);
  const onEvent = useCallback(
    (e) => {
      // (every frame: straight onto the element, no render)
      if (e.type === 'marker') placeMarker(markerRef.current, e.x === undefined ? null : e);
      else if (e.type === 'ui') setUi(e);
      else if (e.type === 'hud') setHud(e);
      else if (e.type === 'achievement') unlock(e.id);
      else if (e.type === 'hurt') setHurt({ angle: e.angle ?? null, key: (hurts.current += 1) });
      else if (e.type === 'hit') setHit((n) => n + 1);
      else if (e.type === 'story' && e.done) setEnded(e.id ?? null);
      else if (e.type === 'say') {
        setSay({ who: e.who ?? null, text: e.text });
        clearTimeout(sayTimer.current);
        sayTimer.current = setTimeout(() => setSay(null), (e.seconds ?? SAY) * 1000);
      }
    },
    [unlock],
  );
  useEffect(() => () => clearTimeout(sayTimer.current), []);
  const { host, status, rt } = useWorld(module, { props, onEvent });
  // (every call into the world is optional: one it lacks is left alone, not the page failing on it)
  const api = useCallback(() => (rt?.current?.module === module ? rt.current.world : null), [rt]);
  // the others online aboard (middleearth/towns/useTravellers), in the room
  // you're in: the world sends where you are and draws them (rules/online.js),
  // through the link it's handed (people jump and climb: their height goes
  // too); while the station's up the page draws no pointers
  const trav = useTravellers('deathstar', status === 'on', ROOM);
  const travRef = trav.ref;
  useEffect(() => {
    if (status === 'on') api()?.online?.(() => travRef.current);
  }, [status, api, travRef]);

  // (only while the world is on: after a lost context the last 'ui' event still says play, map open)
  const shown = layers(status, ui);
  const { playing, paused, mapOpen } = shown;
  // (the story's end card frees the pointer too)
  const free = shown.free || Boolean(ended);
  const freeRef = useRef(free);
  freeRef.current = free;

  // ── the pointer, held while playing: its moves turn the head ──
  const lock = useCallback(() => {
    const el = host.current;
    if (!touch && el && document.pointerLockElement !== el) el.requestPointerLock?.()?.catch?.(() => {});
  }, [touch, host]);
  useEffect(() => {
    const el = host.current;
    const held = () => el !== null && document.pointerLockElement === el;
    const onMove = (e) => {
      if (held()) api()?.look?.(e.movementX, e.movementY);
    };
    const letGo = () => {
      api()?.press?.('fire', false);
      api()?.press?.('aim', false);
    };
    // the browser lets go of the pointer on Esc: that is the pause, unless the page let it go itself
    const onChange = () => {
      if (document.pointerLockElement) return;
      letGo();
      if (!freeRef.current) api()?.pause?.(true);
    };
    const button = (down) => (e) => {
      if (!held()) return;
      const name = e.button === 0 ? 'fire' : e.button === 2 ? 'aim' : null;
      if (name) api()?.press?.(name, down);
    };
    const onDown = button(true);
    const onUp = button(false);
    document.addEventListener('mousemove', onMove);
    document.addEventListener('pointerlockchange', onChange);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('pointerlockchange', onChange);
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('mouseup', onUp);
      if (el && document.pointerLockElement === el) document.exitPointerLock?.();
    };
  }, [api, host]);

  // a menu, a conversation or the map frees the pointer (and lets go of the gun)
  useEffect(() => {
    if (!free || !document.pointerLockElement) return;
    api()?.press?.('fire', false);
    api()?.press?.('aim', false);
    document.exitPointerLock?.();
  }, [free, api]);

  // Esc on the start screen leaves; in play the world’s own pause key has it
  useEffect(() => {
    const onKey = (e) => {
      if (e.code === 'Escape' && ui.mode === 'start' && onExit) onExit();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [ui.mode, onExit]);

  const begin = (choice) => {
    api()?.start?.(choice);
    lock();
  };
  const resume = () => {
    api()?.pause?.(false);
    lock();
  };
  const closeMap = () => {
    api()?.map?.(false);
    lock();
  };

  // a click on the station takes the pointer; one on the HUD’s buttons is theirs
  const onStage = (e) => {
    if (playing && !free && !e.target.closest?.('button, a, [role="dialog"]')) lock();
  };

  const showing = status === 'on';
  const subtitle = ui.settings?.subtitles === false ? null : say;
  return (
    <div className="ds" data-mode={mode}>
      <WorldHost world={{ host }} className="ds-stage" onClick={onStage} onContextMenu={(e) => e.preventDefault()}>
        {status !== 'on' && status !== 'failed' && status !== 'lost' && (
          <div className="ds-cover" role="status">
            <p className="ds-kicker">Aboard the Death Star</p>
            <p>Docking…</p>
          </div>
        )}
        {(status === 'failed' || status === 'lost') && (
          <div className="ds-cover" role="alert">
            <p className="ds-kicker">Aboard the Death Star</p>
            <p>{status === 'lost' ? 'The graphics chip reset.' : 'The station couldn’t start its 3D here.'}</p>
            {onExit && (
              <button type="button" className="ds-btn" onClick={onExit}>
                Back to the Death Star
              </button>
            )}
          </div>
        )}
        {showing && ui.mode === 'loading' && (
          <div className="ds-cover" role="status">
            <p className="ds-kicker">Aboard the Death Star</p>
            <p>Docking…</p>
          </div>
        )}

        {showing && playing && <Marker markerRef={markerRef} />}
        {/* (up from the first moment, over the docking cover, so the tour's marks are there whenever it comes) */}
        {status !== 'failed' && status !== 'lost' && (
          <Hud
            ui={ui}
            hud={hud}
            say={playing ? subtitle : null}
            hurt={hurt}
            hit={hit}
            touch={touch}
            playing={playing}
            players={{ available: trav.available, on: trav.on, count: trav.count, allies: trav.allies, onJoin: trav.join }}
            onMap={() => api()?.map?.(true)}
            onPause={() => api()?.pause?.(true)}
            onChoose={(i) => api()?.choose?.(i)}
            onSet={(set) => api()?.set?.(set)}
          />
        )}
        {showing && ui.mode === 'start' && <Start ui={ui} initial={startFrom(asked, ui)} onStart={begin} onExit={onExit} touch={touch} />}
        {showing && paused && <Pause ui={ui} touch={touch} onResume={resume} onSet={(s) => api()?.set?.(s)} onQuit={() => api()?.quit?.()} onExit={onExit} />}
        {mapOpen && <MapPanel station={ui.station ?? 'ds1'} seen={ui.map?.seen ?? []} here={hud?.room} at={hud?.at} route={hud?.route} onClose={closeMap} />}
        {showing && touch && playing && !mapOpen && !ui.talk && !ended && <Touch api={api} />}
        {showing && ended && playing && (
          <End
            id={ended}
            onWalk={() => {
              setEnded(null);
              lock();
            }}
            onAnother={() => {
              setEnded(null);
              api()?.quit?.();
            }}
            onExit={onExit}
          />
        )}
      </WorldHost>
    </div>
  );
}

// what the start screen begins from: the address’s choices, and the last
// game’s where the address names none
function startFrom(asked, ui) {
  const last = { station: ui.station, side: ui.side, hero: ui.hero, mode: ui.play };
  const out = {};
  for (const k of ['station', 'side', 'hero', 'mode']) out[k] = asked[k] ?? last[k] ?? null;
  return out;
}
