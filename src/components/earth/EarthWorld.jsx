import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Photo from '../Photo';
import { useAchievements } from '../Achievements';
import { audioContext } from '../../lib/audio';
import { use3D } from '../../lib/gpu';
import { device } from '../../lib/device';
import { useMediaQuery } from '../../lib/hooks';
import { capturePointer } from '../../lib/pointer';
import { typing } from '../games/pad';
import { useTravellers } from '../middleearth/towns/useTravellers';
import { HOME_CITY } from '../../data/places';
import { WorldHost, useWorld } from '../../runtime';
import { CLOUD_ALT, HOME_V, KM, STAMPS, aroundWorld, kmBetween } from './rules';
import { stampDate, useFlown, useStamps } from './stamps';
import earthModule, { KEYS } from './module';
import './earth.css';
import GuideCue from '../guide/GuideCue';

// Earth, the world: it opens in orbit, over the globe as it is right now
// (the sun where it really is), and flies you down onto it, into the seat
// behind a little plane over Syracuse. Fly it (or let the autopilot) to the
// places I've been: each one is a stamp in your passport and a postcard.
// The flight log keeps the trail flown and the distance, over every visit,
// and the way round the world adds up to an achievement. Drag while flying
// to look round the plane (it settles back behind), and V swaps the chase
// camera for the cockpit. Everyone else online flying the Earth shows as a
// pale plane with their name (the Middle-earth towns' travellers, in a room
// of its own): nothing passes between you but where each of you is.
// The rules are in ./rules.js, the drawing in ./scene.js, and the flight
// itself is ./module.js, a world module on the world runtime (src/runtime):
// this is the HUD, the dialogs and the touch controls over it, kept up by
// the module's events. Without 3D, the passport is a page of postcards.

const fmt = new Intl.NumberFormat('en-US');
const km = (n) => `${fmt.format(Math.round(n / 10) * 10)} km`;
const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const compass = (deg) => COMPASS[Math.round(deg / 45) % 8];
const CLOUD_KM = Math.round(CLOUD_ALT * KM); // the cloud deck, in km up
const BOUND = new Set(Object.values(KEYS).flat());

export default function EarthWorld() {
  const three = use3D();
  const [gl, setGl] = useState('loading');
  const [attempt, setAttempt] = useState(0);
  const world = three.on && gl !== 'failed' && gl !== 'lost';
  return (
    <section className="earth-world" aria-labelledby="earth-title">
      {world ? (
        <World attempt={attempt} onStatus={setGl} />
      ) : (
        <Cards
          three={three}
          gl={gl}
          retry={() => {
            setGl('loading');
            setAttempt((n) => n + 1);
          }}
        />
      )}
    </section>
  );
}

function World({ attempt, onStatus }) {
  const touch = useMediaQuery('(hover: none) and (pointer: coarse)');
  const { unlock } = useAchievements();
  const labels = useRef({});
  const arrow = useRef(null);
  const [mode, setMode] = useState('orbit');
  const [sunMode, setSunMode] = useState('day');
  const [cockpit, setCockpit] = useState(false);
  const [hud, setHud] = useState({ over: '', heading: 0, next: null, target: null, night: false, km: 0, alt: 0 });
  const [postcard, setPostcard] = useState(null);
  const [passport, setPassport] = useState(false);
  const stamps = useStamps();
  const flown = useFlown();
  const [props] = useState(() => ({ small: device().tier !== 'high', labels: labels.current, arrow, travellers: { current: null } }));

  const onEvent = useCallback(
    (e) => {
      if (e.type === 'mode') setMode(e.mode);
      else if (e.type === 'hud') setHud({ over: e.over, heading: e.heading, next: e.next, target: e.target, night: e.night, km: e.km, alt: e.alt });
      else if (e.type === 'postcard') setPostcard({ id: e.id, date: e.date });
      else if (e.type === 'passport') setPassport((v) => !v);
      else if (e.type === 'sun') setSunMode(e.mode);
      else if (e.type === 'cam') setCockpit(e.cockpit);
      else if (e.type === 'achievement') unlock(e.id);
    },
    [unlock],
  );
  const { host, status, rt } = useWorld(earthModule, { props, attempt, onEvent });
  const api = () => (rt?.current?.module === earthModule ? rt.current.world : null);
  const on = status === 'on';

  // the status the page shows (the cards take over when the 3D can't)
  useEffect(() => {
    if (status === 'failed' || status === 'lost') onStatus(status);
  }, [status, onStatus]);

  // the module's own settings, once it's up
  useEffect(() => {
    const w = api();
    if (!w) return;
    setSunMode(w.sim.sunMode);
    setCockpit(w.sim.cockpit);
    setMode(w.sim.mode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  // the other pilots online (middleearth/towns/useTravellers), longitude and latitude for x and z
  const trav = useTravellers('earth', on, { bound: 200, motion: true });
  props.travellers.current = trav.ref.current;
  useEffect(() => {
    const id = setInterval(() => {
      props.travellers.current = trav.ref.current;
    }, 500);
    return () => clearInterval(id);
  }, [props, trav.ref]);

  // a dialog up: the flight waits
  useEffect(() => {
    api()?.setPaused(Boolean(postcard) || passport);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postcard, passport, status]);

  const dive = useCallback(() => api()?.dive(), []); // eslint-disable-line react-hooks/exhaustive-deps
  const rise = useCallback(() => api()?.rise(), []); // eslint-disable-line react-hooks/exhaustive-deps
  const toggleSun = useCallback(() => api()?.toggleSun(), []); // eslint-disable-line react-hooks/exhaustive-deps
  const toggleCam = useCallback(() => api()?.toggleCam(), []); // eslint-disable-line react-hooks/exhaustive-deps
  const goTo = useCallback((id) => {
    setPassport(false);
    api()?.goTo(id);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const closePostcard = useCallback(() => setPostcard(null), []);

  // the dialogs' keys (the flight's are the module's, through the runtime's
  // input), and the sound woken in the key's own event, as iOS wants
  useEffect(() => {
    const down = (e) => {
      if (typing(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      const onButton = e.target instanceof HTMLButtonElement || e.target instanceof HTMLAnchorElement;
      if (e.key === 'Escape') {
        if (postcard) closePostcard();
        else if (passport) setPassport(false);
        else api()?.clearTarget();
        return;
      }
      if (postcard) {
        if ((e.key === 'Enter' || e.key === ' ') && !onButton) {
          e.preventDefault();
          closePostcard();
        }
        return;
      }
      if (BOUND.has(e.code) || e.key === 'Enter') audioContext();
    };
    window.addEventListener('keydown', down);
    return () => window.removeEventListener('keydown', down);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postcard, passport, closePostcard]);

  // the touch stick: turn and climb
  const stickRef = useRef(null);
  const onStick = (e) => {
    const el = stickRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
    const y = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
    const m = Math.hypot(x, y);
    const k = m > 1 ? 1 / m : 1;
    rt?.input.setStick(x * k, y * k);
    el.style.setProperty('--sx', (x * k).toFixed(2));
    el.style.setProperty('--sy', (y * k).toFixed(2));
  };
  const stickUp = () => {
    rt?.input.setStick(0, 0);
    stickRef.current?.style.setProperty('--sx', 0);
    stickRef.current?.style.setProperty('--sy', 0);
  };

  const count = Object.keys(stamps).length;
  const card = postcard && postcard.id !== 'home' ? STAMPS.find((x) => x.id === postcard.id) : null;
  const flyingNow = mode === 'fly' || mode === 'dive';
  // the distance flown over every visit, with this flight's since it was last written down
  const kmSaved = api()?.sim.kmSaved ?? 0;
  const flownAll = flown + Math.max(0, hud.km - Math.round(kmSaved / 10) * 10);

  return (
    <div>
      <WorldHost world={{ host }} className="earth-stage" data-mode={mode}>
        {!on && <p className="earth-loading">Coming in from orbit…</p>}

        <div className="earth-labels" aria-hidden={mode !== 'orbit' || undefined}>
          {[...STAMPS, { id: 'home', name: HOME_CITY }].map((st) => (
            <button key={st.id} type="button" ref={(el) => (labels.current[st.id] = el)} className="earth-label" data-home={st.id === 'home' || undefined} onClick={() => goTo(st.id)} tabIndex={-1}>
              {st.name}
            </button>
          ))}
        </div>

        <div className="earth-hud earth-hud-top">
          <div className="earth-brand">
            <h1 id="earth-title" className="earth-title">
              Earth
            </h1>
            <p className="earth-sub">
              {flyingNow ? (
                <>
                  Over {hud.over || '…'}
                  {hud.night ? ' · night' : ''}
                </>
              ) : (
                'Every trip, from Syracuse'
              )}
            </p>
          </div>
          <div className="earth-chips">
            <button type="button" className="earth-chip" onClick={() => setPassport((v) => !v)} aria-expanded={passport}>
              Passport <b>{count}/{STAMPS.length}</b> <kbd>P</kbd>
            </button>
            <button type="button" className="earth-chip" onClick={flyingNow ? rise : dive}>
              {flyingNow ? 'Orbit' : 'Fly down'} <kbd>M</kbd>
            </button>
            <button type="button" className="earth-chip" onClick={toggleSun} aria-pressed={sunMode === 'day'} title="The sun where it really is now, or always over your shoulder">
              {sunMode === 'day' ? 'Always day' : 'Sun: now'} <kbd>N</kbd>
            </button>
            {flyingNow && (
              <button type="button" className="earth-chip" onClick={toggleCam} aria-pressed={cockpit} title="The chase camera, or the view from the cockpit">
                {cockpit ? 'Cockpit' : 'Chase'} <kbd>V</kbd>
              </button>
            )}
            {trav.available &&
              (trav.on ? (
                <span className="earth-chip earth-chip-online" data-on="" title="Everyone else online flying the Earth shows as a pale plane from another world: nothing passes between you but where each of you is">
                  <b>{trav.count}</b> {trav.count === 1 ? 'player' : 'players'} here
                </span>
              ) : (
                <button type="button" className="earth-chip earth-chip-online" onClick={trav.join} title="Go online, and see everyone else flying the Earth as a pale plane from another world">
                  See other players
                </button>
              ))}
          </div>
        </div>

        {mode === 'orbit' && on && !postcard && (
          <div className="earth-orbit-card">
            <p>The Earth right now, the sun where it really is. Drag to turn it; pick a place to fly there.</p>
            <button type="button" className="btn btn-primary btn-sm" onClick={dive}>
              Fly down onto the globe
            </button>
          </div>
        )}

        {flyingNow && on && (
          <div className="earth-instruments" aria-live="off">
            <span className="earth-heading">
              {compass(hud.heading)} <b>{String(hud.heading).padStart(3, '0')}°</b>
            </span>
            {hud.next && (
              <span className="earth-next">
                <svg ref={arrow} viewBox="0 0 24 24" className="earth-arrow" aria-hidden="true">
                  <path d="M12 3l6 14-6-4-6 4z" />
                </svg>
                {hud.target ? 'Autopilot to ' : 'Next: '}
                <b>{hud.next.name}</b> · {km(hud.next.km)}
              </span>
            )}
            <span className="earth-flown" title="Flown this flight, and how high">
              {km(hud.km)} flown · {hud.alt} km up{hud.alt * 1 < CLOUD_KM ? ', under the clouds' : ''}
            </span>
            {hud.target && (
              <button type="button" className="earth-chip earth-chip-sm" onClick={() => api()?.clearTarget()}>
                Take the controls <kbd>Esc</kbd>
              </button>
            )}
          </div>
        )}
        {flyingNow && on && !touch && !hud.target && <p className="earth-hint">← → turn · ↑ ↓ climb and descend · Shift faster · R barrel roll · drag to look round · V cockpit · P passport<GuideCue /></p>}

        {touch && flyingNow && on && (
          <div className="earth-touch">
            <div
              ref={stickRef}
              className="earth-stick"
              onPointerDown={(e) => {
                e.stopPropagation();
                capturePointer(e);
                onStick(e);
              }}
              onPointerMove={onStick}
              onPointerUp={stickUp}
              onPointerCancel={stickUp}
              onLostPointerCapture={stickUp}
              aria-hidden="true"
            >
              <span />
            </div>
            <button
              type="button"
              className="earth-boost"
              onPointerDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                capturePointer(e);
                api()?.setBoost(true);
              }}
              onPointerUp={() => api()?.setBoost(false)}
              onPointerCancel={() => api()?.setBoost(false)}
              onLostPointerCapture={() => api()?.setBoost(false)}
            >
              Faster
            </button>
            <button
              type="button"
              className="earth-roll"
              onPointerDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                api()?.roll();
              }}
            >
              Roll
            </button>
          </div>
        )}

        {passport && (
          <div className="earth-passport" role="dialog" aria-label="Passport">
            <div className="earth-passport-head">
              <p>
                Passport <b>{count}/{STAMPS.length}</b>
              </p>
              <button type="button" className="earth-x" onClick={() => setPassport(false)} aria-label="Close the passport">
                ×
              </button>
            </div>
            <p className="earth-log">
              <span>
                <b>{km(flownAll)}</b> flown over every flight
              </span>
              <span className="earth-log-bar" aria-hidden="true">
                <i style={{ width: `${(aroundWorld(flownAll) * 100).toFixed(1)}%` }} />
              </span>
              <span>{aroundWorld(flownAll) >= 1 ? 'Round the world' : `${Math.round(aroundWorld(flownAll) * 100)}% of the way round the world`}</span>
            </p>
            <ol className="earth-pages">
              {STAMPS.map((st) => (
                <li key={st.id} data-got={stamps[st.id] ? '' : undefined}>
                  <span className="earth-pname">{st.name}</span>
                  {stamps[st.id] ? (
                    <span className="earth-pdate">{stampDate(stamps[st.id])}</span>
                  ) : (
                    <span className="earth-pkm">{km(kmBetween(HOME_V, st.v))}</span>
                  )}
                  <button type="button" className="earth-fly" onClick={() => goTo(st.id)}>
                    Fly here
                  </button>
                </li>
              ))}
              <li data-home="">
                <span className="earth-pname">{HOME_CITY}</span>
                <span className="earth-pkm">Home</span>
                <button type="button" className="earth-fly" onClick={() => goTo('home')}>
                  Fly home
                </button>
              </li>
            </ol>
          </div>
        )}

        {postcard && (
          <div className="earth-postcard" role="dialog" aria-modal="false" aria-labelledby="earth-card-title">
            {card ? (
              <>
                <div className="earth-postcard-photo">
                  <Photo id={card.id} sizes="(min-width: 768px) 420px, 90vw" className="h-full w-full object-cover" />
                  <span className="earth-stamp" aria-hidden="true">
                    <b>{card.name}</b>
                    <i>{stampDate(postcard.date)}</i>
                  </span>
                </div>
                <div className="earth-postcard-text">
                  <p className="earth-postcard-kicker">
                    Stamp {Object.keys(stamps).length} of {STAMPS.length}
                  </p>
                  <h2 id="earth-card-title">{card.name}</h2>
                  <p>{card.photo}</p>
                  <p className="earth-postcard-km">
                    {km(kmBetween(HOME_V, card.v))} from {HOME_CITY}
                  </p>
                  <div className="earth-postcard-actions">
                    <button type="button" className="btn btn-primary btn-sm" onClick={closePostcard} autoFocus>
                      Keep flying
                    </button>
                    <Link to={`/travel?place=${card.id}`} className="btn btn-ghost btn-sm">
                      On the travel page
                    </Link>
                  </div>
                </div>
              </>
            ) : (
              <div className="earth-postcard-text">
                <h2 id="earth-card-title">Home</h2>
                <p>{HOME_CITY}, New York. Every route on the globe starts here.</p>
                <div className="earth-postcard-actions">
                  <button type="button" className="btn btn-primary btn-sm" onClick={closePostcard} autoFocus>
                    Keep flying
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </WorldHost>
    </div>
  );
}

function Cards({ three, gl, retry }) {
  const stamps = useStamps();
  return (
    <div className="shell earth-cards-wrap">
      <h1 id="earth-title" className="title">
        Earth
      </h1>
      <p className="lead mt-4 max-w-[60ch]">The globe in 3D, from orbit down to a little plane you fly to every place I’ve been. Each one is a stamp in your passport.</p>
      {three.can && (
        <p className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted">
          {gl === 'lost' ? 'The graphics chip reset, so here’s the passport instead.' : gl === 'failed' ? 'The 3D globe couldn’t start here, so here’s the passport instead.' : three.held ? 'The 3D globe isn’t loaded yet, so here’s the passport.' : '3D is switched off, so here’s the passport.'}
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => {
              if (!three.on) three.set('auto');
              retry();
            }}
          >
            {three.on ? 'Try 3D again' : three.held ? 'Load the 3D' : 'Turn 3D on'}
          </button>
        </p>
      )}
      <ul className="earth-cards">
        {STAMPS.map((st) => (
          <li key={st.id} data-got={stamps[st.id] ? '' : undefined}>
            <Link to={`/travel?place=${st.id}`}>
              <Photo id={st.id} sizes="(min-width: 768px) 280px, 50vw" className="aspect-[4/3] w-full object-cover" />
              <span className="earth-cards-name">{st.name}</span>
              <span className="earth-cards-km">{km(kmBetween(HOME_V, st.v))} from {HOME_CITY}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
