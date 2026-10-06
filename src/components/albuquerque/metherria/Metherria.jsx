import { useCallback, useEffect, useRef, useState } from 'react';
import { useAchievements } from '../../Achievements';
import { audioContext } from '../../../lib/audio';
import { use3D } from '../../../lib/gpu';
import { local, useFrameLoop, useInView, useMediaQuery, useReducedMotion } from '../../../lib/hooks';
import {
  CUSTOMERS,
  UPGRADES,
  breakScore,
  buildScore,
  buy,
  cookScore,
  grade,
  newAt,
  newCareer,
  newDay,
  packScore,
  payFor,
  pointsFor,
  rankFor,
  unlocked,
  waitScore,
} from './rules';
import Face from './Face';
import Ticket from './Ticket';
import View3D from './View3D';
import { BreakStation, BuildStation, CookStation, PackStation } from './Stations';
import { buzz, useKeys } from './keys';
import '../../../styles/lazy/albuquerque.css';

// Walt's Metherria: a Papa's Freezeria for the show's blue, in 3D. Customers
// come to the hatch through the shift with an order each. Take it, then
// build it, cook it, break it and pack it the way the ticket says, and hand
// it over. Every station is scored against the ticket, and the wait too;
// the customer reacts, tips go in the jar, and the pay buys upgrades
// between shifts. Points raise your title, and titles unlock mix-ins, a
// finer cut and stickers. The career is kept between visits.

const sfx = () => import('../../../lib/sfx');
const clip = (id, opts) => import('../../../lib/clips').then((c) => c.playClip(id, opts));
// what some of them say as they come to the hatch (once a shift)
const HELLO = { jesse: 'jesseRing', saul: 'saulHi', gus: 'gusHello' };
const STORE = 'tp-metherria';
const STATIONS = [
  ['order', 'Order'],
  ['build', 'Build'],
  ['cook', 'Cook'],
  ['break', 'Break'],
  ['pack', 'Pack'],
];
const NEXT = { build: 'cook', cook: 'break', break: 'pack', pack: 'serve' };
const SCORE_NAMES = { build: 'Build', cook: 'Cook', break: 'Break', pack: 'Pack', wait: 'Wait' };
const RAID_FROM = 3; // Hank starts dropping by on day three
const RAID_SECONDS = 3.2;

const moodFor = (waited, id, upgrades) => {
  const w = waitScore(waited, id, upgrades);
  return w >= 100 ? 'wait' : w > 70 ? 'restless' : 'bad';
};
const patienceLeft = (waited, id, upgrades) => {
  const w = waitScore(waited, id, upgrades);
  return w >= 100 ? 1 - waited / (85 * (CUSTOMERS[id]?.patience ?? 1) * (upgrades.includes('huell') ? 1.33 : 1)) : 0;
};
const stationOf = (stage) => (stage === 'serve' ? 'order' : stage);

// `at`: 'rv' or 'superlab' to cook in that room (the world's places); without
// it, the superlab once it's bought, else the RV.
export default function Metherria({ at } = {}) {
  const { unlock } = useAchievements();
  const reduced = useReducedMotion();
  const wide = useMediaQuery('(min-width: 720px)');
  const three = use3D();
  const [viewRef, inView] = useInView({ rootMargin: '0px' });
  const [career, setCareer] = useState(() => newCareer(local.get(STORE, null) ?? local.get('tp-lab', null)));
  const [phase, setPhase] = useState('intro'); // intro | shift | summary
  const [shop, setShop] = useState(false);
  const [station, setStationState] = useState('order');
  const stationRef = useRef('order');
  const setStation = (s) => {
    stationRef.current = s;
    setStationState(s);
  };
  const shift = useRef(null);
  const [, setTick] = useState(0);
  const refresh = useCallback(() => setTick((n) => n + 1), []);
  const [activeId, setActiveId] = useState(null);
  const [fresh, setFresh] = useState(null); // the ticket just taken, shown big
  const [result, setResult] = useState(null);
  const [raid, setRaid] = useState(null); // { left, ticket } while Hank is at the door
  const [rankUp, setRankUp] = useState(null);
  const [slip, setSlip] = useState(null); // the pinned ticket: open on wide screens unless closed
  const [moving, setMoving] = useState(false); // a station just finished: on to the next
  const [glState, setGlState] = useState('loading');
  const [glKey, setGlKey] = useState(0);
  const [call, setCall] = useState(null);
  const live = useRef({ place: 'rv', station: 'idle', mixins: ['blue', 'chili'], lobby: [], jar: 0 });
  const tapRef = useRef(null);
  const labels = useRef([]);
  const box = useRef(null);
  const timers = useRef([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const later = (fn, ms) => timers.current.push(setTimeout(fn, ms));

  const save = (c) => {
    setCareer(c);
    local.set(STORE, c);
  };
  const upgrades = career.upgrades;
  const rank = rankFor(career.points);
  const superlab = at ? at === 'superlab' : upgrades.includes('superlab');
  const s = shift.current;
  const running = phase === 'shift' && inView;
  const playable = three.on && glState !== 'failed' && glState !== 'lost';

  // a word over the scene, and a shake for a near-perfect one
  const callN = useRef(0);
  const say = useCallback(
    (text, tone = 'good') => {
      callN.current += 1;
      setCall({ text, tone, n: callN.current });
      if (tone === 'great' && !reduced) {
        box.current?.animate?.(
          [{ transform: 'translate(0,0)' }, { transform: 'translate(-3px,1px)' }, { transform: 'translate(3px,-1px)' }, { transform: 'translate(-2px,0)' }, { transform: 'translate(0,0)' }],
          { duration: 240, easing: 'ease-out' },
        );
      }
    },
    [reduced],
  );
  useEffect(() => {
    if (!call) return undefined;
    const t = setTimeout(() => setCall((c) => (c?.n === call.n ? null : c)), 1300);
    return () => clearTimeout(t);
  }, [call]);

  // which ticket the current station works: the one picked, if it's here
  const tickets = s?.tickets ?? [];
  const here = (k) => tickets.filter((t) => stationOf(t.stage) === k);
  const worked = tickets.find((t) => t.id === activeId && stationOf(t.stage) === station) ?? here(station)[0] ?? null;
  const ready = here('order')[0] ?? null;
  const pinned = worked ?? tickets.find((t) => t.id === activeId) ?? null;

  // the scene's side of things, every render
  const L = live.current;
  L.place = superlab ? 'superlab' : 'rv';
  L.station = phase === 'shift' ? station : 'idle';
  L.order = pinned?.order ?? null;
  L.made = pinned?.made ?? null;
  L.mixins = unlocked(rank.index).mixins;
  if (phase !== 'shift' || !s) {
    L.serving = null;
    L.lobby =
      phase === 'intro'
        ? Object.keys(CUSTOMERS)
            .filter((id) => CUSTOMERS[id].from <= career.day)
            .slice(-5)
            .map((id) => ({ customer: id, mood: CUSTOMERS[id].from === career.day && career.day > 1 ? 'great' : 'wait' }))
        : [];
  } else {
    // at the front: who's reacting, whose order is being taken, or whose is ready
    const freshT = fresh ? tickets.find((t) => t.id === fresh) : null;
    const frontT = result ? null : (freshT ?? ready);
    L.serving = result
      ? { customer: result.order.customer, mood: result.mood }
      : frontT
        ? { customer: frontT.order.customer, mood: freshT ? 'good' : moodFor(s.clock - frontT.arrive, frontT.order.customer, upgrades) }
        : null;
    L.lobby = [
      ...s.lobby.map((e) => ({ customer: e.customer, mood: moodFor(s.clock - e.arrive, e.customer, upgrades), id: e.id })),
      ...tickets.filter((t) => t !== frontT).map((t) => ({ customer: t.order.customer, mood: moodFor(s.clock - t.arrive, t.order.customer, upgrades), id: t.id })),
    ];
  }
  const crowd = [...(L.serving ? [{ ...L.serving, front: true }] : []), ...L.lobby].slice(0, 6);
  if (import.meta.env.DEV) window.__METH__ = { shift: s, live: L, station, activeId };

  // name tags over the customers, placed every frame from the 3D view
  const placeLabels = (api) => {
    const show = phase !== 'shift' || station === 'order';
    const anchors = show ? api.standeeAnchors() : [];
    labels.current.forEach((el, i) => {
      if (!el) return;
      const a = anchors[i];
      if (!a || !a[2]) {
        el.style.opacity = '0';
        return;
      }
      el.style.opacity = '1';
      el.style.transform = `translate(${a[0].toFixed(1)}px, ${a[1].toFixed(1)}px) translate(-50%, -100%)`;
    });
  };

  // the shift clock: it only runs while the game is on screen
  const lastRefresh = useRef(0);
  useFrameLoop((ms) => {
    const sh = shift.current;
    if (!sh || raid) return;
    sh.clock += ms / 1000;
    // nothing to do and someone's due: open the hatch for them now
    const idle = !sh.lobby.length && !sh.tickets.length && sh.next < sh.day.queue.length;
    if (idle) sh.clock = Math.max(sh.clock, sh.day.queue[sh.next].arrive);
    let changed = false;
    let said = false;
    while (sh.next < sh.day.queue.length && sh.day.queue[sh.next].arrive <= sh.clock) {
      const who = sh.day.queue[sh.next].customer;
      sh.lobby.push(sh.day.queue[sh.next]);
      sh.next += 1;
      changed = true;
      sfx().then((x) => x.knock(undefined, undefined, 0.02));
      sh.heard ??= {};
      if (HELLO[who] && !sh.heard[who] && !said) {
        sh.heard[who] = said = true;
        clip(HELLO[who], { when: 0.5 });
      }
    }
    // Hank, once a shift from day three, while something's cooking
    if (sh.raidAt != null && sh.clock >= sh.raidAt && stationRef.current !== 'order' && sh.tickets.some((t) => stationOf(t.stage) === stationRef.current)) {
      sh.raidAt = null;
      const t = sh.tickets.find((x) => stationOf(x.stage) === stationRef.current);
      setRaid({ left: RAID_SECONDS, ticket: t.id });
      clip('hankRing').then((h) => !h && sfx().then((x) => x.alarm()));
      buzz(120);
    }
    if (changed || sh.clock - lastRefresh.current > 0.5) {
      lastRefresh.current = sh.clock;
      refresh();
    }
  }, running && playable);

  // Hank's countdown
  useFrameLoop((ms) => {
    setRaid((r) => (r && !r.done ? { ...r, left: r.left - ms / 1000 } : r));
  }, running && !!raid && !raid.done && raid.left > 0);
  useEffect(() => {
    if (!raid || raid.left > 0 || raid.done) return;
    // too slow: you dump the batch to be safe, and that order starts over
    const t = shift.current?.tickets.find((x) => x.id === raid.ticket);
    if (t) {
      t.stage = 'build';
      t.scores = {};
      t.made = {};
      t.tries = (t.tries ?? 0) + 1;
    }
    setRaid({ ...raid, done: 'caught' });
    sfx().then((x) => x.buzz());
  }, [raid]);
  const hide = () => {
    if (!raid || raid.done) return;
    setRaid({ ...raid, done: 'hidden' });
    sfx().then((x) => x.zip());
    buzz(30);
  };
  const afterRaid = () => {
    const caught = raid?.done === 'caught';
    setRaid(null);
    if (caught) setStation('build');
    refresh();
  };

  const startShift = () => {
    audioContext(); // in the click, so the shift can be heard
    const day = newDay(career);
    const raidAt = career.day >= RAID_FROM && Math.random() < 0.7 ? 30 + Math.random() * 45 : null;
    shift.current = { day, clock: 0, next: 0, lobby: [], tickets: [], served: [], earned: 0, raidAt };
    setActiveId(null);
    setFresh(null);
    setResult(null);
    setRaid(null);
    setShop(false);
    setStation('order');
    setPhase('shift');
    box.current?.focus({ preventScroll: true });
  };

  const take = (entry) => {
    const sh = shift.current;
    if (!sh) return;
    audioContext();
    sh.lobby = sh.lobby.filter((e) => e.id !== entry.id);
    const ticket = { ...entry, takenAt: sh.clock, stage: 'build', scores: {}, made: {} };
    sh.tickets.push(ticket);
    setActiveId(ticket.id);
    setFresh(ticket.id);
    sfx().then((x) => x.ding());
    refresh();
  };
  const goTo = (k, id) => {
    setFresh(null);
    setMoving(false);
    setStation(k);
    const t = (id && tickets.find((x) => x.id === id)) || here(k)[0];
    if (t) setActiveId(t.id);
  };

  // a station's done: score it, keep what was made, and move the order on
  const advance = (ticket, key, score, made) => {
    ticket.scores[key] = score;
    ticket.made = { ...ticket.made, [key]: made };
    ticket.stage = NEXT[key];
    sfx().then((x) => (score >= 90 ? x.ding() : x.knock(undefined, undefined, 0.03)));
    say(`${SCORE_NAMES[key]}: ${score}`, score >= 95 ? 'great' : score >= 75 ? 'good' : score >= 55 ? 'okay' : 'bad');
    setMoving(true);
    refresh();
    const from = key;
    later(() => {
      setMoving(false);
      if (stationRef.current !== from) return;
      setStation(stationOf(ticket.stage));
      setActiveId(ticket.id);
    }, 750);
  };

  const serve = (ticket) => {
    const sh = shift.current;
    if (!sh || result) return;
    ticket.scores.wait = waitScore(sh.clock - ticket.arrive, ticket.order.customer, upgrades);
    const { total, mood } = grade(ticket.scores);
    const pay = payFor(ticket.order, total, upgrades);
    sh.tickets = sh.tickets.filter((t) => t.id !== ticket.id);
    const done = { ...ticket, total, mood, pay };
    sh.served.push(done);
    sh.earned += pay;
    live.current.jar = (live.current.jar ?? 0) + pay;
    live.current.tip = { at: performance.now(), amount: pay };
    live.current.reaction = { mood, at: performance.now() }; // Jesse, in the room, reacts
    const before = rankFor(career.points);
    const c = { ...career, money: career.money + pay, points: career.points + pointsFor(total), served: career.served + 1, bestOrder: Math.max(career.bestOrder, total) };
    const after = rankFor(c.points);
    save(c);
    if (after.index > before.index) {
      setRankUp({ title: after.title, brings: newAt(after.index) });
      sfx().then((x) => x.victory());
      if (after.title === 'Heisenberg') clip('sayMyName');
    } else setRankUp(null);
    if (total >= 95) unlock('bluesky');
    sfx().then((x) => (mood === 'great' ? x.applause() : mood === 'bad' ? x.buzz() : x.coin()));
    if (ticket.order.customer === 'tuco' && (mood === 'great' || mood === 'good')) clip('tight', { when: 0.3 });
    buzz(mood === 'great' ? 40 : 20);
    setResult(done);
    setActiveId(sh.tickets[0]?.id ?? null);
    refresh();
  };

  const shiftOver = () => {
    const sh = shift.current;
    return !!sh && sh.next >= sh.day.queue.length && !sh.lobby.length && !sh.tickets.length;
  };
  const afterResult = () => {
    setResult(null);
    setRankUp(null);
    if (shiftOver()) {
      const sh = shift.current;
      save({ ...career, bestDay: Math.max(career.bestDay, sh.earned) });
      setPhase('summary');
      return;
    }
    const sh = shift.current;
    if (!sh.lobby.length && sh.tickets.length) goTo(stationOf(sh.tickets[0].stage), sh.tickets[0].id);
  };
  const nextDay = () => {
    save({ ...career, day: career.day + 1 });
    live.current.jar = 0;
    setPhase('intro');
    setShop(false);
  };
  const purchase = (id) => {
    const c = buy(career, id);
    if (c !== career) {
      save(c);
      sfx().then((x) => x.coin());
      if (id === 'billboard') clip('callSaul', { when: 0.25 });
    }
  };

  // Enter moves things along at the hatch and on the cards
  const cardUp = !!result || !!fresh || !!raid;
  useKeys(running && playable && !raid && (station === 'order' || cardUp), (k) => {
    if (k !== 'Enter') return false;
    const sh = shift.current;
    if (result) afterResult();
    else if (fresh) goTo('build', fresh);
    else if (ready) serve(ready);
    else if (sh?.lobby.length) take(sh.lobby[0]);
    else if (sh?.tickets.length) goTo(stationOf(sh.tickets[0].stage), sh.tickets[0].id);
    else return false;
    return true;
  });
  useKeys(running && !!raid && !raid.done, (k) => {
    if (k === 'h' || k === 'H' || k === 'Enter') {
      hide();
      return true;
    }
    return false;
  });
  useKeys(running && !!raid?.done, (k) => {
    if (k === 'Enter') {
      afterRaid();
      return true;
    }
    return false;
  });

  const toNext = rank.next == null ? 1 : (career.points - rank.from) / (rank.next - rank.from);
  const working = running && playable && !raid && !result && !fresh;

  const stationPanel = () => {
    if (station === 'order') {
      if (fresh) {
        const t = tickets.find((x) => x.id === fresh);
        return (
          <div className="wm-station">
            <div className="wm-row wm-row-end">
              {s.lobby.length > 0 && (
                <button type="button" className="btn btn-ghost" onClick={() => setFresh(null)}>
                  Take another order first
                </button>
              )}
              <button type="button" className="btn btn-primary wm-big" onClick={() => goTo('build', fresh)}>
                Start {t ? `${CUSTOMERS[t.order.customer].name}’s` : 'the'} build <kbd>⏎</kbd>
              </button>
            </div>
          </div>
        );
      }
      return (
        <div className="wm-station">
          <div className="wm-row">
            {ready && (
              <button type="button" className="btn btn-primary wm-big" onClick={() => serve(ready)} disabled={!!result}>
                Hand {CUSTOMERS[ready.order.customer].name} the order <kbd>⏎</kbd>
              </button>
            )}
            {s.lobby.map((e, i) => (
              <button key={e.id} type="button" className={`btn ${!ready && i === 0 ? 'btn-primary wm-big' : 'btn-ghost'}`} onClick={() => take(e)} disabled={!!result}>
                Take {CUSTOMERS[e.customer].name}’s order
                {!ready && i === 0 && <kbd>⏎</kbd>}
              </button>
            ))}
          </div>
          <p className="wm-hint">
            {ready
              ? `${CUSTOMERS[ready.order.customer].name}’s order is packed and ready.`
              : s.lobby.length
                ? `${s.lobby.length === 1 ? 'Someone is' : `${s.lobby.length} people are`} at the hatch.`
                : tickets.length
                  ? 'Nobody at the hatch. Back to the orders on the rail.'
                  : 'Waiting on the next knock.'}
          </p>
        </div>
      );
    }
    if (!worked) {
      const somewhere = tickets[0];
      return (
        <div className="wm-station">
          <p className="wm-hint">
            No order at the {station} station.{' '}
            {somewhere ? `${CUSTOMERS[somewhere.order.customer].name}’s is at the ${stationOf(somewhere.stage) === 'order' ? 'hatch' : stationOf(somewhere.stage)} station.` : 'Take one at the hatch.'}
          </p>
          <div className="wm-row">
            <button type="button" className="btn btn-ghost" onClick={() => goTo(somewhere ? stationOf(somewhere.stage) : 'order', somewhere?.id)}>
              Go there
            </button>
          </div>
        </div>
      );
    }
    if (moving) {
      return (
        <div className="wm-station">
          <p className="wm-hint">On to the next station…</p>
        </div>
      );
    }
    const key = `${worked.id}-${worked.stage}-${worked.tries ?? 0}`;
    const props = { order: worked.order, upgrades, rank: rank.index, active: working, live, say };
    if (worked.stage === 'build') return <BuildStation key={key} {...props} onDone={(m) => advance(worked, 'build', buildScore(worked.order, m, upgrades), m)} />;
    if (worked.stage === 'cook') return <CookStation key={key} {...props} onDone={(purity) => advance(worked, 'cook', cookScore(worked.order, purity), { purity })} />;
    if (worked.stage === 'break') return <BreakStation key={key} {...props} tapRef={tapRef} onDone={(r) => advance(worked, 'break', breakScore(r.hits, r.cracks, r.wild), r.made)} />;
    return <PackStation key={key} {...props} onDone={(m) => advance(worked, 'pack', packScore(worked.order, m, upgrades), { ...m, w: 0, bags: m.weights })} />;
  };

  const notice = !three.can ? (
    <div className="wm-card" role="note">
      <p className="wm-card-title">No WebGL here, sorry.</p>
      <p className="wm-card-text">Walt’s Metherria is drawn in 3D, and this browser can’t draw 3D. Try it in a recent Chrome, Edge, Firefox or Safari.</p>
    </div>
  ) : !three.on ? (
    <div className="wm-card" role="note">
      <p className="wm-card-title">{three.held ? 'The 3D isn’t loaded yet.' : '3D is switched off.'}</p>
      <p className="wm-card-text">{three.held ? `Walt’s Metherria only comes in 3D: about ${three.hold.mb} MB. Load it to play.` : 'Walt’s Metherria only comes in 3D. Turn it on to play.'}</p>
      <div className="wm-row">
        <button type="button" className="btn btn-primary" onClick={() => three.set('auto')}>
          {three.held ? 'Load the 3D' : 'Turn 3D on'}
        </button>
      </div>
    </div>
  ) : glState === 'failed' || glState === 'lost' ? (
    <div className="wm-card" role="alert">
      <p className="wm-card-title">{glState === 'lost' ? 'The graphics chip reset.' : 'The 3D lab couldn’t start here, sorry.'}</p>
      <p className="wm-card-text">{glState === 'lost' ? 'Your career is saved. Start the 3D view again to carry on.' : 'Your career is saved. You can try again, or come back on another device.'}</p>
      <div className="wm-row">
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            setGlState('loading');
            setGlKey((n) => n + 1);
          }}
        >
          Try again
        </button>
      </div>
    </div>
  ) : null;

  return (
    <div ref={viewRef}>
      <div ref={box} className="wm" data-place={superlab ? 'superlab' : 'rv'} tabIndex={-1}>
        <header className="wm-bar">
          <span className="wm-day">Day {career.day}</span>
          <span className="wm-cash">${career.money}</span>
          <span className="wm-rank" title={rank.next == null ? 'The top' : `${rank.next - career.points} points to the next title`}>
            {rank.title}
            <span className="wm-rank-bar" aria-hidden="true">
              <span style={{ transform: `scaleX(${Math.min(1, toNext)})` }} />
            </span>
          </span>
          <span className="wm-place">{superlab ? 'The superlab' : 'The RV'}</span>
        </header>

        {phase === 'shift' && s && (
          <div className="wm-rail" role="group" aria-label="Orders on the rail">
            {tickets.map((t) => (
              <button key={t.id} type="button" className="wm-rail-ticket" data-on={(pinned && t.id === pinned.id) || undefined} onClick={() => goTo(stationOf(t.stage), t.id)}>
                <Face who={t.order.customer} mood={moodFor(s.clock - t.arrive, t.order.customer, upgrades)} />
                <span>
                  {CUSTOMERS[t.order.customer].name}
                  <small>{t.stage === 'serve' ? 'Ready' : STATIONS.find(([k]) => k === t.stage)?.[1]}</small>
                </span>
              </button>
            ))}
            {!tickets.length && <span className="wm-rail-empty">No orders yet</span>}
            <span className="wm-rail-left">{s.day.queue.length - s.served.length} left today</span>
          </div>
        )}

        <div
          className="wm-stage"
          data-station={phase === 'shift' ? station : 'idle'}
          onPointerDown={(e) => {
            if (e.target === e.currentTarget || e.target.classList?.contains('wm-canvas')) tapRef.current?.();
          }}
        >
          {three.on && glState !== 'failed' && glState !== 'lost' && <View3D key={glKey} live={live} active={inView} onState={setGlState} onFrame={placeLabels} />}
          {notice}
          {three.on && glState === 'loading' && <p className="wm-loading">Setting up the lab…</p>}

          {playable && glState !== 'loading' && (
            <>
              <div className="wm-tags" aria-hidden="true">
                {crowd.map((c, i) => {
                  const waited = phase === 'shift' && s ? s.clock - ([...s.lobby, ...tickets].find((x) => x.id === c.id)?.arrive ?? s.clock) : 0;
                  return (
                    <span key={c.id ?? `${c.customer}-${i}`} ref={(el) => (labels.current[i] = el)} className="wm-tag" data-front={c.front || undefined}>
                      {CUSTOMERS[c.customer].name}
                      {phase === 'shift' && !c.front && c.id && (
                        <span className="wm-tag-bar">
                          <span style={{ transform: `scaleX(${Math.max(0.04, patienceLeft(waited, c.customer, upgrades))})` }} />
                        </span>
                      )}
                    </span>
                  );
                })}
              </div>

              {call && (
                <span key={call.n} className="wm-callout" data-tone={call.tone} role="status">
                  {call.text}
                </span>
              )}

              {phase === 'shift' && pinned && station !== 'order' && !result && (
                <div className="wm-pin" data-open={(slip ?? wide) || undefined}>
                  <button type="button" className="wm-pin-toggle" aria-expanded={slip ?? wide} onClick={() => setSlip(!(slip ?? wide))}>
                    {(slip ?? wide) ? 'Hide ticket' : 'Ticket'}
                  </button>
                  {(slip ?? wide) && <Ticket entry={pinned} scores={pinned.scores} />}
                </div>
              )}

              {phase === 'intro' && !shop && (
                <div className="wm-card">
                  <p className="wm-card-title">{career.served ? `Day ${career.day}. Back to work.` : 'Walt’s Metherria'}</p>
                  <p className="wm-card-text">
                    Customers come to the hatch all shift. Take each order, then build, cook, break and pack it the way the ticket says. Every station is scored, and so is the wait. Good work pays, and pay buys upgrades.
                  </p>
                  <div className="wm-row">
                    <button type="button" className="btn btn-primary wm-big" onClick={startShift}>
                      Open the hatch
                    </button>
                    <button type="button" className="btn btn-ghost" onClick={() => setShop(true)}>
                      Upgrades
                    </button>
                  </div>
                  {career.bestOrder > 0 && (
                    <p className="wm-small-print">
                      Served {career.served}. Best order {career.bestOrder}%. Best day ${career.bestDay}.
                    </p>
                  )}
                </div>
              )}

              {shop && (
                <div className="wm-card wm-card-scroll">
                  <p className="wm-card-title">Upgrades</p>
                  <ul className="wm-shop">
                    {UPGRADES.map((u) => {
                      const owned = upgrades.includes(u.id);
                      return (
                        <li key={u.id} data-owned={owned || undefined}>
                          <div>
                            <p className="wm-shop-name">{u.name}</p>
                            <p className="wm-shop-text">{u.text}</p>
                          </div>
                          <button type="button" className="btn btn-ghost btn-sm" disabled={owned || career.money < u.cost} onClick={() => purchase(u.id)}>
                            {owned ? 'Yours' : `$${u.cost}`}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                  <div className="wm-row">
                    <button type="button" className="btn btn-primary" onClick={() => (phase === 'summary' ? nextDay() : setShop(false))}>
                      {phase === 'summary' ? `Open for day ${career.day + 1}` : 'Back'}
                    </button>
                  </div>
                </div>
              )}

              {phase === 'shift' && fresh && tickets.find((t) => t.id === fresh) && (
                <div className="wm-card wm-card-ticket">
                  <Face who={tickets.find((t) => t.id === fresh).order.customer} mood="good" className="wm-face-big" />
                  <Ticket entry={tickets.find((t) => t.id === fresh)} big />
                </div>
              )}

              {phase === 'shift' && result && (
                <div className="wm-card wm-result" data-mood={result.mood}>
                  <Face who={result.order.customer} mood={result.mood} className="wm-face-big" />
                  <div>
                    <p className="wm-quote">“{CUSTOMERS[result.order.customer].lines[result.mood]}”</p>
                    <p className="wm-who">{CUSTOMERS[result.order.customer].name}</p>
                    <ul className="wm-scores">
                      {Object.keys(SCORE_NAMES).map((k) => (
                        <li key={k} data-tone={result.scores[k] >= 90 ? 'great' : result.scores[k] < 55 ? 'bad' : undefined}>
                          <span>{SCORE_NAMES[k]}</span>
                          <b>{result.scores[k]}</b>
                        </li>
                      ))}
                    </ul>
                    <p className="wm-total">
                      {result.total}% <span className="wm-pay">+${result.pay}</span>
                    </p>
                    {rankUp && (
                      <p className="wm-rankup">
                        {rankUp.title === 'Heisenberg' ? 'You’re Heisenberg now. Say my name.' : `You’re ${rankUp.title} now.`}
                        {rankUp.brings.length > 0 && ` New: ${rankUp.brings.join(', ')}.`}
                      </p>
                    )}
                    <div className="wm-row">
                      <button type="button" className="btn btn-primary" onClick={afterResult} autoFocus>
                        {shiftOver() ? 'Close up for the day' : 'Next'} <kbd>⏎</kbd>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {raid && (
                <div className="wm-card wm-raid" role="alertdialog" aria-label="Hank is here">
                  {!raid.done ? (
                    <>
                      <p className="wm-card-title">Hank’s in the laundry.</p>
                      <p className="wm-card-text">“Mind if I take a look around?” Hide the batch.</p>
                      <span className="wm-raid-clock">{Math.max(0, raid.left).toFixed(1)}</span>
                      <button type="button" className="btn btn-primary wm-big" onClick={hide} autoFocus>
                        Hide the batch <kbd>H</kbd>
                      </button>
                    </>
                  ) : (
                    <>
                      <p className="wm-card-title">{raid.done === 'hidden' ? 'He finds a lot of laundry.' : 'You dumped the batch to be safe.'}</p>
                      <p className="wm-card-text">{raid.done === 'hidden' ? '“Huh. Smells like… soap.” He heads out.' : 'That order starts again at the build.'}</p>
                      <button type="button" className="btn btn-primary" onClick={afterRaid} autoFocus>
                        Back to work <kbd>⏎</kbd>
                      </button>
                    </>
                  )}
                </div>
              )}

              {phase === 'summary' && !shop && s && (
                <div className="wm-card wm-card-scroll">
                  <p className="wm-card-title">
                    Day {career.day}, done. ${s.earned} today.
                  </p>
                  <ul className="wm-day-list">
                    {s.served.map((t) => (
                      <li key={t.id}>
                        <Face who={t.order.customer} mood={t.mood} />
                        <span>{CUSTOMERS[t.order.customer].name}</span>
                        <span>{t.total}%</span>
                        <span>${t.pay}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="wm-card-text">{rank.next == null ? `${rank.title}. There is nowhere higher.` : `${rank.title}. ${rank.next - career.points} points to the next title.`}</p>
                  <div className="wm-row">
                    <button type="button" className="btn btn-primary" onClick={nextDay}>
                      Open for day {career.day + 1}
                    </button>
                    <button type="button" className="btn btn-ghost" onClick={() => setShop(true)}>
                      Upgrades
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {phase === 'shift' && s && playable && <div className="wm-panel">{stationPanel()}</div>}

        {phase === 'shift' && s && playable && (
          <nav className="wm-tabs" aria-label="Stations">
            {STATIONS.map(([k, label]) => {
              const n = k === 'order' ? s.lobby.length + here('order').length : here(k).length;
              return (
                <button key={k} type="button" aria-current={station === k ? 'true' : undefined} onClick={() => goTo(k)} disabled={!!raid}>
                  {label}
                  {n > 0 && <b>{n}</b>}
                </button>
              );
            })}
          </nav>
        )}
      </div>
      <p className="mt-3 text-xs text-muted">
        Enter takes orders, moves on and hands them over. At the stations: 1 2 3 for the size, Space to pour, heat, strike and fill, B C S P for mix-ins, arrows and Space for stickers.
      </p>
    </div>
  );
}
