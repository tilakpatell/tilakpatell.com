import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import HQBackdrop from '../components/avengers/HQBackdrop';
import CompoundWorld from '../components/avengers/world/CompoundWorld';
import Titan from '../components/avengers/titan/Titan';
import { SOUL_HALVES, hasEarned, heistRecord, useStones } from '../components/avengers/hq/stones';
import { heistSummary } from '../components/avengers/hq/heist';
import { HEIST_ROWS, snapGate } from '../components/avengers/titan/gate';
import HeistSummary from '../components/avengers/titan/HeistSummary';
import { readBest } from '../components/avengers/board/records';
import { hqState } from '../components/avengers/world/links';
import { useAchievements } from '../components/Achievements';
import ModelCredits from '../components/ModelCredits';
import Gauntlet from '../components/interests/Gauntlet';
import { STONES } from '../components/interests/stones';
import WorldSwitcher from '../components/worlds/WorldSwitcher';
import ClipBoard from '../components/worlds/ClipBoard';
import WorldPhotos from '../components/worlds/WorldPhotos';
import Scenes from '../components/worlds/Scenes';
import { hasPhotos, hasScenes } from '../components/worlds/media';
import { audioContext } from '../lib/audio';
import { jumpTo } from '../lib/anchors';
import { prefersReducedMotion, useDocumentTitle } from '../lib/hooks';
import { localSaves } from '../runtime/local';
import '../styles/lazy/avengers.css';

const sfx = () => import('../lib/sfx');

// Where each stone turned up before Thanos came for it.
const WHERE = {
  space: 'The Tesseract. Captain America: The First Avenger, then The Avengers.',
  mind: 'In Loki’s scepter, then in Vision. The Avengers, Age of Ultron.',
  reality: 'The Aether. Thor: The Dark World.',
  power: 'The Orb, found on Morag. Guardians of the Galaxy.',
  time: 'Inside the Eye of Agamotto. Doctor Strange.',
  soul: 'On Vormir, for a price. Avengers: Infinity War.',
};

// the soundboard: the films' lines, then the sounds
const BOARD = [
  'avengersAssemble',
  'ironMan',
  'canDoThisAllDay',
  'iAmGroot',
  'wakandaForever',
  'hulkSmash',
  'punyGod',
  'weHaveAHulk',
  'heIsAdopted',
  'mrStark',
  'iAmInevitable',
  'salvation',
  'doItMyself',
  ['hulkRoar', 'The Hulk roars'],
  ['snap', 'The snap'],
  ['marvel', 'The Marvel Studios opening'],
];

const ON_DISPLAY = [
  { id: 'marvel-ironman', title: 'Iron Man armor', note: 'From the cave-built Mark I to the suits that followed, under glass.' },
  { id: 'marvel-shield', title: 'Captain America’s shield', note: 'Vibranium, and it shows every dent.' },
  { id: 'marvel-campus', title: 'Avengers Campus', note: 'A Quinjet parked on the roof of the Avengers’ headquarters, at Disney California Adventure.' },
  { id: 'marvel-gauntlet', title: 'The Infinity Gauntlet', note: 'A replica, all six stones set. Snap responsibly.' },
];
const SCENES = ['marvelAssemble', 'marvelGroot', 'snap'];

// Avengers HQ: the compound to walk about in 3D (components/avengers/world),
// each building's game behind its door and an Infinity Stone won back from
// each, with the ops board under it (components/avengers/board); then the
// worlds, Titan through the portal (the Tesseract opens it), and last the
// Archive and the credits.
export default function Avengers() {
  useDocumentTitle('Avengers HQ');
  const { unlock, notify } = useAchievements();
  const earned = useStones();
  const titan = useRef(null);
  const [portal, setPortal] = useState(false);
  const [arrived, setArrived] = useState(false);
  const [summary, setSummary] = useState(null); // the heist's, raised by Tony's snap
  const timers = useRef([]);
  // the page's own look (styles/extras.css), while the Stark theme is on
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.dataset.world = 'avengers';
    return () => delete root.dataset.world;
  }, []);
  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout);
    },
    [],
  );

  // The Space Stone opens the portal over the helipad; on the other side, Thanos.
  const openPortal = () => {
    if (portal) return;
    audioContext();
    sfx().then((s) => s.hyperspace());
    setPortal(true);
    const still = prefersReducedMotion();
    timers.current.push(
      setTimeout(
        () => {
          setArrived(true);
          jumpTo(null, 'thanos');
        },
        still ? 200 : 1300,
      ),
      setTimeout(() => setPortal(false), still ? 400 : 2600),
    );
  };

  // The snap is earned: the gauntlet holds the stones won in play, and opens
  // with all six. (A half of the Soul Stone sends no event, but every route
  // change re-renders the page, so Back from a game reads the halves again.)
  const held = [...earned, ...SOUL_HALVES.filter(hasEarned)];
  const gate = snapGate(held);
  const all = gate.ready;
  const doSnap = () => {
    if (!gate.ready) return;
    audioContext();
    import('../lib/clips').then((c) => c.playClip('ironMan'));
    const after = () => {
      sfx().then((s) => s.thunder());
      unlock('whatever');
      notify('I am Iron Man.', 'Every stone, won back on the compound. Thanos is dust; this page is not.', 'note', 'whatever');
      // (the column is headed Best, so a best's own "Best " goes)
      setSummary(heistSummary(heistRecord(), { games: HEIST_ROWS, bests: Object.fromEntries(HEIST_ROWS.map((r) => [r.id, readBest(r.id, localSaves().get)?.text.replace(/^Best /, '')])) }));
    };
    if (titan.current?.snap(true, after)) return;
    after();
  };
  return (
    <div className="hq-page relative">
      <HQBackdrop />
      <CompoundWorld onPortal={openPortal} />

      <section className="shell relative z-10 pb-2">
        <WorldSwitcher />
      </section>

      {portal && <div className="portal-flash" aria-hidden="true" />}

      <section id="thanos" className="space-scope relative z-10 py-20 md:py-28" data-arrived={arrived || undefined} aria-labelledby="gauntlet-title">
        <div className="ds-stars pointer-events-none absolute inset-0" aria-hidden="true" />
        <div className="shell relative grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-16">
          <div className="stones-panel gauntlet-stage" data-all={all || undefined}>
            <Titan
              ref={titan}
              have={earned}
              fallback={
                <div className="gauntlet-wrap">
                  <Gauntlet have={earned} all={all} />
                </div>
              }
            />
            {summary && <HeistSummary summary={summary} onClose={() => setSummary(null)} />}
          </div>
          <div>
            <p className="eyebrow">Titan · beyond the portal</p>
            <h2 id="gauntlet-title" className="title mt-4">
              Thanos
            </h2>
            <p className="lead mt-4 max-w-[46ch]">{gate.ready ? 'You took every stone back from the compound. Snap, and this time it’s Tony’s: Thanos turns to dust, and the page stays.' : 'He has the gauntlet. Win the six stones back on the compound, one building at a time, and the snap is Tony’s.'}</p>
            <ul className="stone-list mt-6" aria-label="The stones">
              {STONES.map((s) => {
                const on = earned.includes(s.id);
                return (
                  <li key={s.id} data-on={on || undefined} style={{ '--glow': s.color }}>
                    <div className="stone-pick">
                      <span className="stone-dot" aria-hidden="true" />
                      <span>
                        <span className="font-semibold text-ink">{s.name}</span>
                        <span className="block text-sm text-body">{WHERE[s.id]}</span>
                      </span>
                      <span className="stone-pick-state">{on ? 'Won' : 'Not yet'}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className="mt-7 flex flex-wrap gap-3">
              <button type="button" className="btn btn-primary" disabled={!gate.ready} aria-describedby={gate.ready ? undefined : 'snap-left'} onClick={doSnap}>
                {gate.ready ? 'Snap: I am Iron Man' : 'Snap'}
              </button>
              {gate.next && (
                <Link to={gate.next.to} state={hqState} className="btn btn-ghost">
                  Next: {gate.next.name}
                </Link>
              )}
              <a href="#hq-world" className="btn btn-ghost" onClick={(e) => jumpTo(e, 'hq-world')}>
                Back through the portal
              </a>
            </div>
            {!gate.ready && (
              <p id="snap-left" className="mt-3 text-sm text-muted">
                {gate.label}
              </p>
            )}
          </div>
        </div>
      </section>

      <details className="hq-archive shell relative z-10 py-14 md:py-20">
        <summary>
          <h2 id="av-archive-title" className="title">
            Archive
          </h2>
          <span className="text-sm text-muted">The soundboard, scenes from the films and the props on display</span>
        </summary>
        <section className="mt-10" aria-labelledby="av-board-title">
          <h3 id="av-board-title" className="title">
            Soundboard
          </h3>
          <p className="lead mt-4 max-w-[54ch]">From the films, a line at a time.</p>
          <ClipBoard className="mt-8" clips={BOARD} />
        </section>
        {hasScenes(SCENES) && (
          <section className="mt-14" aria-labelledby="av-scenes-title">
            <h3 id="av-scenes-title" className="title">
              From the films
            </h3>
            <div className="mt-8">
              <Scenes names={SCENES} />
            </div>
          </section>
        )}
        {hasPhotos(ON_DISPLAY) && (
          <section className="mt-14" aria-labelledby="av-display-title">
            <h3 id="av-display-title" className="title">
              On display
            </h3>
            <p className="lead mt-4 max-w-[54ch]">Props, replicas and a theme park, out in the real world.</p>
            <div className="mt-8">
              <WorldPhotos items={ON_DISPLAY} />
            </div>
          </section>
        )}
      </details>

      <section id="av-credits" className="shell relative z-10 section-last pt-4">
        <ModelCredits where="avengers" line className="text-xs text-muted" />
      </section>
    </div>
  );
}
