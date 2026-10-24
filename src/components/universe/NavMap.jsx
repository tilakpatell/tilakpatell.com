import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { RiArrowLeftLine, RiArrowRightLine, RiCloseLine, RiEyeLine, RiFlashlightFill, RiLinkM, RiListUnordered, RiRadarLine, RiRocket2Fill, RiRouteLine, RiSearchLine, RiSpeedUpFill } from 'react-icons/ri';
import { CHART_VIEWS, DESTINATIONS, DRIVES, KINDS, destinationById, distanceTo, driveById, findDestinations, formatDistance, formatTime, goalOf, legOf, speedWord, tripTime } from './nav';
import { mapSectorOf } from './layout';
import { LENGTH } from './scale';
import { sectorAt } from '../../lib/space/address';
import NavChart from './chart/NavChart';
import { FRAMES } from './chart/projection';
import { HAND_MARKS, liveMarks, markById, openView, presetOf, presetView } from './chart/marks';
import { chartKey } from './chart/input';
import { useChartView } from './chart/useChartView';
import { CHART_WORDS, FLY_PAST, JAMMED, NAV, PICK_A_SHIP, jumpState } from './words';
import './navmap.css';

// The nav map: the whole universe from straight above, the way the galaxy's
// holotable shows the galaxy (galaxy/HoloMap.jsx). Every station, world and
// wonder, where you are and which way you're pointing, the other pilots
// online, and the course to wherever's picked. Pick a place (on the chart,
// or from the list: filter it, or search it by name), then a drive, each
// with how long it'd take from here, run on the ship's own physics (nav.js):
//   Hyperspeed   a jump to lightspeed, out parked at it
//   Super speed  the autopilot on 3× the pulse drive
//   Cruise       the pulse drive as it comes
// and go. The drive picked is kept, and it's how picking a place anywhere
// on the map goes too. A world or a station can be gone straight into, too.
// With no ship, the camera takes you to a station or a world (the trip
// times need a ship). The chart (chart/NavChart.jsx) is centred on the ship
// and drawn on chart/projection.js's root scale, so the near places and the
// far ones share it: the wheel, a pinch or + and − zoom it from a star system
// out to the universe, a drag moves it, a Shift-drag or two fingers tilt and
// turn it, and 0 brings it back to the ship. Every place stands on a stem
// that says how far above or below the ship it is, and the bar under it says
// the ship's sector and height. The chips take it to the universe, the home
// system or the Rick and Morty sector; a place in the other sector is gone to
// through the portal between them, and its course is drawn to that portal.
//
// Drawn into <body> over everything, as a dialog: the chart, its places as
// buttons (Tab through, Enter to pick, Enter again to go), each name on a
// clear side of its dot or shown on a hover or a pick (chart/place.js), and
// the side panel. `where()` is the scene's (scene.js), read a few times a
// second while it's open.
// On a phone it opens on the list, the places by kind, with the chart a tap
// away: a chart a phone wide has no room for every name or every finger.

const ICONS = { hyper: RiFlashlightFill, super: RiSpeedUpFill, cruise: RiRocket2Fill };
// a phone's width (the stylesheet's own): the list first, the chart a tap away
const NARROW = '(max-width: 820px)';
const narrowNow = () => typeof window !== 'undefined' && Boolean(window.matchMedia?.(NARROW).matches);
const WHY = { interdicted: JAMMED.short, charging: 'Charging' };

export default function NavMap({ where, drive, onDrive, selected = null, live = false, onTravel, onEnter, onWhole, onTour, onClose }) {
  const [now, setNow] = useState(() => where?.() ?? null);
  // the chart's view: on the ship (or the whole universe with none), moved by hand from there
  const box = useRef(null);
  const { view, setView, zoomIn, zoomOut, back, flatten, show, handlers } = useChartView(box, { open: openView(now?.ship), ship: now?.ship, frame: FRAMES.nav });
  const [kind, setKind] = useState('all');
  const [query, setQuery] = useState('');
  // (what the page has picked, unless that's where the ship is already)
  const [pick, setPick] = useState(() => (selected && destinationById(selected) && selected !== now?.at ? selected : null));
  const [times, setTimes] = useState({});
  const [copied, setCopied] = useState(null); // the place whose link was just copied
  const [mode, setMode] = useState(() => (narrowNow() ? 'list' : 'chart')); // (a phone shows one: the list or the chart)
  const [hover, setHover] = useState(null); // the place whose row in the list is under the pointer, lit on the chart
  const side = useRef(null);
  const close = useRef(null);
  const search = useRef(null);
  const preset = presetOf(view); // (which chip reads as pressed: the part of space the chart is on)
  // which sector the ship's in (the main map's, with no ship, and out in the Expanse)
  const shipSector = now?.ship ? mapSectorOf(now.ship.x, now.ship.y ?? 0, now.ship.z) : 'main';
  const picked = pick ? destinationById(pick) : null;
  const flying = Boolean(now?.ship);
  const shown = useMemo(() => new Set(findDestinations(kind, query).map((d) => d.id)), [kind, query]);
  const list = useMemo(() => findDestinations(kind, query), [kind, query]);
  // what the chart draws: the places, and the pilots and far fights where() has; the filter dims the rest
  const marks = useMemo(() => [...HAND_MARKS, ...liveMarks(now)], [now]);
  const dim = useMemo(() => new Set(HAND_MARKS.filter((m) => m.pickable && !shown.has(m.id)).map((m) => m.id)), [shown]);

  // a place picked: its card is at the top of the side panel, wherever the list was scrolled to
  useEffect(() => {
    side.current?.scrollTo?.({ top: 0 });
  }, [pick]);
  // the focus in, and back where it was on the way out
  useEffect(() => {
    const was = document.activeElement;
    close.current?.focus();
    return () => {
      if (was instanceof HTMLElement && document.contains(was)) was.focus();
    };
  }, []);
  // Escape closes, and the chart's keys: + and − zoom, 0 goes back to the
  // ship (none while typing in the search: a minus is the field's)
  useEffect(() => {
    const keys = { zoomIn, zoomOut, back };
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
        return;
      }
      const act = chartKey(e, { typing: Boolean(e.target?.matches?.('input, textarea')) });
      if (!act) return;
      e.preventDefault();
      keys[act]();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose, zoomIn, zoomOut, back]);
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
  const toward = picked && !at(picked.id) ? picked : goingTo;
  // the course: from the ship to where it's going, or to the place picked, or the portal on the way to either
  const course = now?.ship && toward ? { to: destinationById(legOf(now.ship, toward.id))?.at ?? toward.at, drive: goingTo && toward === goingTo ? now.going.drive : 'plot' } : null;
  // where the ship is, under the chart: its sector and how far above or below the disc
  const ship = now?.ship;
  const readout =
    ship && [ship.x, ship.y, ship.z].every(Number.isFinite) ? `${CHART_WORDS.sector(sectorAt(ship.x, ship.y, ship.z))} · ${CHART_WORDS.height(formatDistance(Math.abs(ship.y)), Math.abs(ship.y) < LENGTH ? 0 : Math.sign(ship.y))}` : null;
  const pitched = view.pitch > 0 || view.yaw !== 0;
  const outward = { label: NAV.out, onClick: () => setView(presetView('all', now?.ship)) };
  // from a star system or the Curve, the way out; in the Curve, flying, the way home through its portal
  const out = preset === 'home' ? outward : preset === 'rickmorty' ? (canFly && shipSector === 'rickmorty' ? { label: 'Back through the portal', onClick: () => onTravel('rmportal-back', drive) } : outward) : null;

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

  // the charts to pick from: in the header, and on a phone over its chart
  const viewChips = (
    <div className="navmap-views" role="group" aria-label={NAV.view}>
      {Object.values(CHART_VIEWS).map((c) => (
        <button key={c.id} type="button" aria-pressed={preset === c.id} onClick={() => setView(presetView(c.id, now?.ship))}>
          {c.name}
        </button>
      ))}
    </div>
  );
  // the list, a group a kind (headed when there's more than one)
  const groups = KINDS.filter((g) => g.id !== 'all')
    .map((g) => ({ ...g, places: list.filter((d) => d.kind === g.id) }))
    .filter((g) => g.places.length);

  return createPortal(
    <div className="navmap dark-scope" role="dialog" aria-modal="true" aria-labelledby="navmap-title" data-mode={mode} style={{ '--pick': picked?.color ?? '#9fd8ff' }}>
      <div className="navmap-frame dialog">
        <header className="navmap-head">
          <div>
            <p className="navmap-kicker">{NAV.kicker}</p>
            <h2 id="navmap-title" className="navmap-title">
              Where to?
            </h2>
          </div>
          <div className="navmap-head-tools">
            {viewChips}
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
          <div className="navmap-modes" role="group" aria-label={NAV.mode}>
            <button type="button" aria-pressed={mode === 'list'} onClick={() => setMode('list')}>
              <RiListUnordered className="h-4 w-4" aria-hidden="true" /> {NAV.list}
            </button>
            <button type="button" aria-pressed={mode === 'chart'} onClick={() => setMode('chart')}>
              <RiRadarLine className="h-4 w-4" aria-hidden="true" /> {NAV.chart}
            </button>
          </div>
          {viewChips}
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
                  show(markById(list[0].via ?? list[0].id));
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
            course={course}
            front={now?.front ?? null}
            onFront={() => onTravel('front', drive)}
            frontTitle={canFly ? `${driveById(fallsBack ? 'super' : drive).verb} to the front` : 'Pick a ship to fly to the front'}
            frontOff={!canFly}
            pick={pick}
            here={atId}
            hover={hover}
            dim={dim}
            onChoose={choose}
            onGo={go}
            onRegion={(id) => setView(presetView(id, now?.ship))}
            out={out}
            tools={{ onZoomIn: zoomIn, onZoomOut: zoomOut, onShip: now?.ship ? back : null, atShip: view.follow, onFlat: flatten, flat: !pitched }}
            readout={readout}
            handlers={handlers}
            boxRef={box}
          />

          <aside ref={side} className="navmap-side" aria-live="polite">
            {/* the ship */}
            <div className="navmap-status" data-flying={flying || undefined}>
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
                <p className="navmap-tap">{NAV.tap}</p>
                {list.length !== DESTINATIONS.length && <p className="navmap-kicker">{`${list.length} ${list.length === 1 ? 'place' : 'places'}`}</p>}
                {list.length ? (
                  groups.map((g) => (
                    <section key={g.id} className="navmap-group" aria-label={groups.length > 1 ? g.name : undefined}>
                      {groups.length > 1 && (
                        <h3 className="navmap-group-name">
                          {g.name} <span>{g.places.length}</span>
                        </h3>
                      )}
                      <ul className="navmap-list">
                        {g.places.map((d) => (
                          <li key={d.id}>
                            <button
                              type="button"
                              onClick={() => {
                                setPick(d.id);
                                setHover(null);
                                show(markById(d.via ?? d.id));
                              }}
                              onPointerEnter={() => setHover(d.id)}
                              onPointerLeave={() => setHover(null)}
                              style={{ '--c': d.color }}
                              aria-current={at(d.id) ? 'location' : undefined}
                            >
                              <span className="navmap-dot" aria-hidden="true" />
                              <span className="navmap-list-name">
                                {d.name}
                                {flying && <span className="navmap-list-type">{d.type}</span>}
                              </span>
                              <span className="navmap-list-meta">{at(d.id) ? 'Here' : flying ? formatDistance(distanceTo(now.ship, d.id)) : d.type}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </section>
                  ))
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

