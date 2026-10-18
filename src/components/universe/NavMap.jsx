import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { RiArrowLeftLine, RiArrowRightLine, RiCloseLine, RiEyeLine, RiFlashlightFill, RiLinkM, RiRocket2Fill, RiRouteLine, RiSearchLine, RiSpeedUpFill } from 'react-icons/ri';
import { CHART_VIEWS, DESTINATIONS, DRIVES, KINDS, destinationById, distanceTo, driveById, findDestinations, formatDistance, formatTime, goalOf, legOf, speedWord, tripTime } from './nav';
import { mapSectorOf } from './layout';
import { LENGTH } from './scale';
import { sectorAt } from '../../lib/space/address';
import { CHART_WORDS, FLY_PAST, JAMMED, NAV, PICK_A_SHIP, jumpState } from './words';
import NavChart from './chart/NavChart';
import { chartKey } from './chart/input';
import { HAND_MARKS, liveMarks, markById, openView, presetOf, presetView } from './chart/marks';
import { FRAMES, track } from './chart/projection';
import { useChartView } from './chart/useChartView';
import './navmap.css';

// The nav map: the universe on the chart (chart/NavChart.jsx), centred on
// the ship, the way the galaxy's holotable shows the galaxy
// (galaxy/HoloMap.jsx). Every station, world and wonder, each on a stem up or
// down from the ship's level, where you are and which way you're pointing,
// your sector and height, the other pilots online, and the course to
// wherever's picked. Scroll, pinch or + − to zoom (from a system out to the
// universe), drag to pan, Shift-drag or two fingers to tilt and turn, 0 to
// come back to the ship. Pick a place (on the chart, or from the list: filter
// it, or search it by name), then a drive, each with how long it'd take from
// here, run on the ship's own physics (nav.js):
//   Hyperspeed   a jump to lightspeed, out parked at it
//   Super speed  the autopilot on 3× the pulse drive
//   Cruise       the pulse drive as it comes
// and go. The drive picked is kept, and it's how picking a place anywhere
// on the map goes too. A world or a station can be gone straight into, too.
// With no ship, the camera takes you to a station or a world (the trip
// times need a ship), and the chart opens on the whole universe. The chips
// jump to the universe, the home system or the Rick and Morty sector. A place
// in the other sector is gone to through the portal between them, and its
// course is drawn to that portal.
//
// Drawn into <body> over everything, as a dialog. `where()` is the scene's
// (scene.js), read a few times a second while it's open.

const ICONS = { hyper: RiFlashlightFill, super: RiSpeedUpFill, cruise: RiRocket2Fill };
const WHY = { interdicted: JAMMED.short, charging: 'Charging' };

// where the ship is, as the chart's bar says it: its sector, and how far
// above or below the disc
function readoutOf(ship) {
  if (!ship) return null;
  const y = ship.y ?? 0;
  return `${CHART_WORDS.sector(sectorAt(ship.x, y, ship.z))} · ${CHART_WORDS.height(formatDistance(Math.abs(y)), Math.abs(y) < LENGTH ? 0 : Math.sign(y))}`;
}

export default function NavMap({ where, drive, onDrive, selected = null, live = false, onTravel, onEnter, onWhole, onTour, onClose }) {
  const [now, setNow] = useState(() => where?.() ?? null);
  const box = useRef(null);
  const [open] = useState(() => openView(now?.ship)); // (read once, on mount)
  const chart = useChartView(box, { open, ship: now?.ship ?? null, frame: FRAMES.nav });
  // (the view as it is with the ship where it is now: the hook's own track comes a
  // commit later, and drawn meanwhile a followed ship would sit off the middle)
  const view = useMemo(() => (now?.ship ? track(chart.view, now.ship) : chart.view), [chart.view, now?.ship]);
  const [kind, setKind] = useState('all');
  const [query, setQuery] = useState('');
  // (what the page has picked, unless that's where the ship is already)
  const [pick, setPick] = useState(() => (selected && destinationById(selected) && selected !== now?.at ? selected : null));
  const [times, setTimes] = useState({});
  const [copied, setCopied] = useState(null); // the place whose link was just copied
  const close = useRef(null);
  const search = useRef(null);
  // which sector of the map the ship's in (the main map's, with no ship, and out in the Expanse)
  const shipSector = now?.ship ? mapSectorOf(now.ship.x, now.ship.y ?? 0, now.ship.z) : 'main';
  const picked = pick ? destinationById(pick) : null;
  const flying = Boolean(now?.ship);
  const shown = useMemo(() => new Set(findDestinations(kind, query).map((d) => d.id)), [kind, query]);
  const list = useMemo(() => findDestinations(kind, query), [kind, query]);
  // the chart's places, and the ones the filter and the search leave out
  const marks = useMemo(() => [...HAND_MARKS, ...liveMarks(now)], [now]);
  const dim = useMemo(() => new Set(HAND_MARKS.filter((m) => m.pickable && !shown.has(m.id)).map((m) => m.id)), [shown]);
  // a place picked from the list or the search: the chart zooms and moves till it's on it
  const showOnChart = (d) => {
    const m = markById(d.via ?? d.id);
    if (m) chart.show(m);
  };

  // the focus in, and back where it was on the way out; Escape closes; + − 0 zoom and come back to the ship
  useEffect(() => {
    const was = document.activeElement;
    close.current?.focus();
    return () => {
      if (was instanceof HTMLElement && document.contains(was)) was.focus();
    };
  }, []);
  const hands = useRef(chart);
  hands.current = chart;
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
        return;
      }
      // (typing in the search, + − and 0 are its own)
      const typing = e.target instanceof Element && e.target.matches('input, textarea, [contenteditable="true"]');
      const act = chartKey({ key: e.key, meta: e.metaKey, ctrl: e.ctrlKey, alt: e.altKey }, { typing });
      if (!act) return;
      e.preventDefault();
      hands.current[act]();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);
  // the ship, a few times a second
  useEffect(() => {
    if (!where) return undefined;
    const t = setInterval(() => setNow(where()), 250);
    return () => clearInterval(t);
  }, [where]);

  // how long each drive takes to the place picked, from where the ship is
  // now (run on its physics: a few milliseconds each), and again every
  // couple of seconds as it moves
  const shipRef = useRef(null);
  shipRef.current = now?.ship ?? null;
  useEffect(() => {
    if (!pick) return undefined;
    const time = () => {
      const s = shipRef.current;
      setTimes(s ? Object.fromEntries(DRIVES.map((d) => [d.id, tripTime(s, pick, d.id)])) : {});
    };
    time();
    const t = setInterval(time, 2000);
    return () => clearInterval(t);
  }, [pick, flying]);

  // where you are: at a place (within a little of its edge), or nearest one
  const here = useMemo(() => {
    const s = now?.ship;
    if (!s) return null;
    let best = null;
    for (const d of DESTINATIONS) {
      const gap = distanceTo(s, d.id);
      if (!best || gap < best.gap) best = { d, gap };
    }
    return best;
  }, [now?.ship]);
  const atId = now?.at ?? (here && here.gap < 40 ? here.d.id : null);

  const choose = (id) => {
    if (pick === id) go(id);
    else setPick(id);
  };
  const hyper = now?.hyper ?? { ready: true, wait: 0, why: null };
  const fallsBack = drive === 'hyper' && !hyper.ready;
  const canFly = flying && !now?.foot && !now?.crashed;
  const at = (id) => goalOf(id) === atId; // (a star system: at its gate)
  // can the place picked be gone to, and how (with a ship, by its drive;
  // without one, the camera goes to a station or a world; a system at whose
  // gate you already are goes straight in)
  const goable = (d) => d && !(at(d.id) && !d.via) && (canFly || (!flying && d.kind !== 'wonder'));
  const go = (id = pick) => {
    const d = destinationById(id);
    if (!goable(d)) return;
    if (d.via && at(d.id)) {
      onEnter?.(d.id);
      return;
    }
    onTravel(id, drive);
  };

  const goingTo = now?.going ? destinationById(now.going.id) : null;
  const course = picked && !at(picked.id) ? picked : goingTo;
  // the course is drawn to where the trip goes first: the place (its gate, for a star system), or the portal on the way
  const courseTo = course && now?.ship ? destinationById(legOf(now.ship, course.id))?.at : null;
  const preset = presetOf(view);
  const toAll = () => chart.setView(presetView('all', now?.ship));
  // the way back out of the home system or the Curve (in the Curve with a ship: back through the portal)
  const homeward = canFly && shipSector === 'rickmorty';
  const out = preset === 'home' ? { label: NAV.out, onClick: toAll } : preset === 'rickmorty' ? (homeward ? { label: 'Back through the portal', onClick: () => onTravel('rmportal-back', drive) } : { label: NAV.out, onClick: toAll }) : null;
  const pitched = view.pitch > 0 || view.yaw !== 0;

  const verb = (d) => {
    if (!d) return '';
    if (!flying) return d.kind === 'wonder' ? PICK_A_SHIP.replace(/\.$/, '') : d.via ? `Show me the gate` : `Show me ${d.name}`;
    if (now?.foot) return 'Back in the ship first (G)';
    if (at(d.id)) return d.via ? `Through the gate to ${d.name}` : `You’re at ${d.name}`;
    if (d.sector !== shipSector) return `${driveById(fallsBack ? 'super' : drive).verb} through the portal to ${d.name}`;
    return d.via ? `${driveById(fallsBack ? 'super' : drive).verb} to the gate, then ${d.name}` : `${driveById(fallsBack ? 'super' : drive).verb} to ${d.name}`;
  };
  // a link to a place (a universe, a wonder) that opens the map there
  const linkTo = (d) => (d.via ? null : `${window.location.origin}${window.location.pathname}#/universe/${d.id}`);
  const copy = (d) => {
    const url = linkTo(d);
    if (!url) return;
    const fail = () => setCopied(`fail:${d.id}`); // (no clipboard here, or no leave to use it: the link shows instead)
    if (!navigator.clipboard?.writeText) return fail();
    navigator.clipboard.writeText(url).then(() => {
      setCopied(d.id);
      setTimeout(() => setCopied(null), 1800);
    }, fail);
  };

  return createPortal(
    <div className="navmap dark-scope" role="dialog" aria-modal="true" aria-labelledby="navmap-title" style={{ '--pick': picked?.color ?? '#9fd8ff' }}>
      <div className="navmap-frame">
        <header className="navmap-head">
          <div>
            <p className="navmap-kicker">{NAV.kicker}</p>
            <h2 id="navmap-title" className="navmap-title">
              Where to?
            </h2>
          </div>
          <div className="navmap-head-tools">
            <div className="navmap-views" role="group" aria-label={NAV.view}>
              {Object.values(CHART_VIEWS).map((c) => (
                <button key={c.id} type="button" aria-pressed={preset === c.id} onClick={() => chart.setView(presetView(c.id, now?.ship))}>
                  {c.name}
                </button>
              ))}
            </div>
            {live && flying && onWhole && (
              <button type="button" className="navmap-tool" onClick={onWhole} title="Pull back over the map in 3D">
                <RiEyeLine className="h-4 w-4" aria-hidden="true" /> <span>{NAV.back}</span>
              </button>
            )}
            {live && canFly && onTour && (
              <button type="button" className="navmap-tool" onClick={onTour} title={FLY_PAST.title} aria-label={FLY_PAST.name}>
                <RiRouteLine className="h-4 w-4" aria-hidden="true" /> <span>{FLY_PAST.short}</span>
              </button>
            )}
            <button ref={close} type="button" className="navmap-close" onClick={onClose} aria-label="Close the nav map">
              <RiCloseLine className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </header>

        <div className="navmap-filters">
          <div className="navmap-kinds" role="group" aria-label="Show">
            {KINDS.map((k) => (
              <button key={k.id} type="button" aria-pressed={kind === k.id} onClick={() => setKind(k.id)}>
                {k.name}
              </button>
            ))}
          </div>
          <label className="navmap-search">
            <RiSearchLine className="h-4 w-4" aria-hidden="true" />
            <span className="sr-only">Find a place</span>
            <input
              ref={search}
              type="search"
              value={query}
              placeholder="Find a place…"
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && list[0]) {
                  e.preventDefault();
                  setPick(list[0].id);
                  showOnChart(list[0]);
                }
              }}
            />
          </label>
        </div>

        <div className="navmap-body">
          <NavChart
            view={view}
            marks={marks}
            ship={now?.ship ?? null}
            course={courseTo ? { to: courseTo, drive: goingTo && course === goingTo ? now.going.drive : 'plot' } : null}
            front={now?.front ?? null}
            onFront={() => onTravel('front', drive)}
            frontOff={!canFly}
            frontTitle={canFly ? `${driveById(fallsBack ? 'super' : drive).verb} to the front` : 'Pick a ship to fly to the front'}
            pick={pick}
            here={atId}
            dim={dim}
            onChoose={choose}
            onGo={go}
            onRegion={(id) => chart.setView(presetView(id, now?.ship))}
            out={out}
            tools={{ onZoomIn: chart.zoomIn, onZoomOut: chart.zoomOut, onShip: flying ? chart.back : null, atShip: view.follow, onFlat: chart.flatten, flat: !pitched }}
            readout={readoutOf(now?.ship)}
            handlers={chart.handlers}
            boxRef={box}
          />

          <aside className="navmap-side" aria-live="polite">
            {/* the ship */}
            <div className="navmap-status">
              {flying ? (
                <>
                  <p className="navmap-kicker">Your ship</p>
                  <p className="navmap-where">{atId ? `At ${destinationById(atId).name}` : here ? `${formatDistance(here.gap)} from ${here.d.name}` : 'Deep space'}</p>
                  <p className="navmap-meta">
                    {now.foot ? 'You’re out on foot' : speedWord(now.ship.speed)}
                    {goingTo && !now.foot ? `, ${now.going.drive === 'hyper' ? 'jumping' : 'on the way'} to ${goingTo.name}` : ''}
                  </p>
                  <p className="navmap-meta" data-warn={!hyper.ready || undefined}>
                    {hyper.ready || hyper.why === 'charging' ? jumpState(hyper.ready, hyper.wait) : WHY[hyper.why]}
                  </p>
                </>
              ) : (
                <>
                  <p className="navmap-kicker">No ship</p>
                  <p className="navmap-meta">The camera takes you to a station or a world. Pick a ship in the panel to fly yourself, anywhere, by any drive.</p>
                </>
              )}
            </div>

            {/* the drives */}
            <div className="navmap-drives" role="radiogroup" aria-label="Drive">
              {DRIVES.map((d) => {
                const Icon = ICONS[d.id];
                const t = picked && flying && !at(picked.id) ? times[d.id] : undefined;
                return (
                  <button key={d.id} type="button" role="radio" aria-checked={drive === d.id} className="navmap-drive" data-drive={d.id} onClick={() => onDrive(d.id)} title={d.about}>
                    <Icon className="navmap-drive-icon" aria-hidden="true" />
                    <span className="navmap-drive-name">{d.name}</span>
                    <span className="navmap-drive-time">{t === undefined ? (d.id === 'hyper' ? 'instant' : d.id === 'super' ? '3×' : '1×') : t === null ? '—' : formatTime(t)}</span>
                  </button>
                );
              })}
            </div>
            <p className="navmap-drive-about">{driveById(drive).about}</p>
            {fallsBack && flying && <p className="navmap-note">{hyper.why === 'charging' ? `The jump is charging (${Math.ceil(hyper.wait)} s)` : JAMMED.long.replace(/\.[^.]*\.$/, '')}: till it’s ready, you’ll go at super speed.</p>}

            {picked ? (
              <div className="navmap-pick">
                <button type="button" className="navmap-back" onClick={() => setPick(null)}>
                  <RiArrowLeftLine className="h-3.5 w-3.5" aria-hidden="true" /> All places
                </button>
                <p className="navmap-kicker">{picked.type}</p>
                <h3 className="navmap-place-name" style={{ color: picked.color }}>
                  {picked.name}
                </h3>
                <p className="navmap-about">{picked.about}</p>
                {flying && (
                  <dl className="navmap-stats">
                    <div>
                      <dt>Distance</dt>
                      <dd>{formatDistance(distanceTo(now.ship, picked.id))}</dd>
                    </div>
                    <div>
                      <dt>By {driveById(fallsBack ? 'super' : drive).name.toLowerCase()}</dt>
                      <dd>{at(picked.id) ? 'You’re here' : formatTime(times[fallsBack ? 'super' : drive])}</dd>
                    </div>
                  </dl>
                )}
                <button type="button" className="btn btn-primary navmap-go" onClick={() => go()} disabled={!goable(picked)}>
                  {verb(picked)} {goable(picked) && <RiArrowRightLine className="h-4 w-4" aria-hidden="true" />}
                </button>
                {picked.to && onEnter && (
                  <button type="button" className="btn btn-ghost navmap-enter" onClick={() => onEnter(picked.id)}>
                    {picked.via ? `Jump straight to ${picked.name}` : at(picked.id) ? 'Go in' : 'Skip the trip: straight in'}
                  </button>
                )}
                {linkTo(picked) && (
                  <button type="button" className="navmap-copy" onClick={() => copy(picked)} title={linkTo(picked)}>
                    <RiLinkM className="h-3.5 w-3.5" aria-hidden="true" /> {copied === picked.id ? 'Link copied' : copied === `fail:${picked.id}` ? `Couldn’t copy: ${linkTo(picked)}` : 'Copy a link here'}
                  </button>
                )}
              </div>
            ) : (
              <div className="navmap-list-box">
                <p className="navmap-kicker">{list.length === DESTINATIONS.length ? 'Every place' : `${list.length} ${list.length === 1 ? 'place' : 'places'}`}</p>
                {list.length ? (
                  <ul className="navmap-list">
                    {list.map((d) => (
                      <li key={d.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setPick(d.id);
                            showOnChart(d);
                          }}
                          style={{ '--c': d.color }}
                          aria-current={at(d.id) ? 'location' : undefined}
                        >
                          <span className="navmap-dot" aria-hidden="true" />
                          <span className="navmap-list-name">{d.name}</span>
                          <span className="navmap-list-meta">{at(d.id) ? 'Here' : flying ? formatDistance(distanceTo(now.ship, d.id)) : d.type}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="navmap-meta">Nothing by that name. Try a world (Marvel), a page (Projects) or a kind of thing (nebula).</p>
                )}
              </div>
            )}
            <p className="navmap-keys">
              <kbd>M</kbd> opens and closes the nav map. Flying, <kbd>J</kbd> jumps to the place picked. <kbd>+</kbd> <kbd>−</kbd> {CHART_WORDS.keys.zoom}, <kbd>0</kbd> {CHART_WORDS.keys.back}
            </p>
          </aside>
        </div>
      </div>
    </div>,
    document.body,
  );
}

