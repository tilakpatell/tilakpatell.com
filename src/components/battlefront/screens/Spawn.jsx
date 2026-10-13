import { useEffect, useRef, useState } from 'react';
import { GameIcon } from '../../../runtime/hud';
import { cardsFor, characterOfOffer, picksOf, portraitOf } from '../../../lib/bf2017/collection';
import DeployScreen from '../hud/DeployScreen.jsx';
import { offerIcon } from '../hud/icons.js';
import { offerRows } from '../hud/widgets.js';
import { prune } from './tree';
import { figureOf, kept } from './spawnFigure';
import { useTree } from './useTree';
import CollectionStage from './CollectionStage.jsx';
import GameScreen from './GameScreen.jsx';

// The spawn screen, as the running game draws it (its window photographed
// 2026-10-13; the export's SpawnOverlayScreen tree holds only the pre-round
// line, the rest is put together by the game at run time): at the top left
// a panel for the offer in hand (its name, the three star cards the
// Collection keeps for it), along the bottom left one strip, the classes as
// tiles with the game's class icons and then the reinforcements and heroes
// as portraits, hatched while their Battle Points are not earned, with the
// Battle Points over the strip's end; at the foot SELECT, VIEW ABILITIES
// and APPEARANCES; and on the right, in the dark room, the offer in hand
// standing: the body it would wear in the field (spawnFigure.js), on the stage the
// Collection draws its characters on. The arrows move through the
// strip, Enter deploys the one in focus (the page's input hears Enter too,
// as before). With no tree it is lane 5's DeployScreen, which takes the
// same props.
//
// Under the panel, where to deploy (lane 5's squad strip: `deploy.spawns`,
// the side's HQ then each squadmate, one that cannot be spawned on greyed
// with the game's reason); choosing one calls `onSpawn(spawn)` as lane 5's
// does.
//
// <Spawn first deploy={{ open, offers, spawns }} points={n} name={(o) => text} title="Deploy" onDeploy={(o) => …} onPick={(o) => …}
//   onSpawn={(s) => …} onBack={…} />
const PRE_ROUND = /^(PreroundText|Game Starting In: |Players Needed|BreadcrumbList)$/;
const LATER = /^(Game Starting In: |Players Needed|BreadcrumbList)$/;
const NOT_YET = 'Not in this world yet';
const SLOTS = [0, 1, 2];

export default function Spawn({ screen = 'SpawnOverlayScreen', first = false, ...props }) {
  const raw = useTree(screen);
  if (!raw || !props.deploy?.open) return raw ? null : <DeployScreen {...props} />;
  const out = first ? LATER : PRE_ROUND;
  return <SpawnTree tree={prune(raw, (b) => out.test(b.id.split('/').pop()) || /FooterBar|TimeWidget|LoadingSpinner|BreadcrumbWidget/.test(b.id))} {...props} />;
}

// the star cards the Collection keeps for an offer's character, with their art
function cardsOf(offer) {
  const c = characterOfOffer(offer);
  if (!c) return [];
  const store = kept();
  const all = cardsFor(c.id);
  return picksOf(store, c.id, { faction: c.faction }).cards.map((id) => all.find((k) => k.id === id)).filter(Boolean);
}

function SpawnTree({ tree, deploy, points = 0, name = (o) => o.id, title = 'Deploy', onDeploy, onPick, onSpawn, onBack = null }) {
  const spawns = deploy?.spawns ?? [];
  const [at, setAt] = useState('hq');
  const where = spawns.find((c) => c.id === at && !c.blocked) ?? spawns[0] ?? null;
  const rows = offerRows(deploy?.offers ?? [], points);
  const first = rows.find((r) => r.affordable) ?? null;
  const [picked, setPicked] = useState(first?.id ?? null);
  const strip = useRef(null);
  const tell = useRef(null);
  tell.current = () => first && onPick?.(first);
  const firstId = first?.id ?? null;
  // (in braces: onPick answers with the world's reply, which an effect must not return)
  useEffect(() => {
    tell.current();
  }, [firstId]);
  // (the keys go to the strip from the first: Enter deploys the tile in focus, the first that can be afforded)
  useEffect(() => {
    strip.current?.querySelector('button:not([aria-disabled="true"])')?.focus({ preventScroll: true });
  }, []);
  const chosen = rows.find((r) => r.id === picked && r.affordable) ?? first;
  const pick = (o) => {
    if (!o.affordable) return;
    setPicked(o.id);
    onPick?.(o);
  };
  const onKeyDown = (e) => {
    const buttons = [...(strip.current?.querySelectorAll('button') ?? [])];
    const i = buttons.indexOf(document.activeElement);
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (step && i >= 0) {
      e.preventDefault();
      buttons[(i + step + buttons.length) % buttons.length]?.focus();
    }
  };
  const classes = rows.filter((o) => o.kind === 'class');
  const others = rows.filter((o) => o.kind !== 'class');
  const cards = chosen ? cardsOf(chosen) : [];
  const spec = chosen ? figureOf(chosen, deploy?.team ?? 2) : null;
  const tile = (o, portrait = false) => {
    const face = portrait ? portraitOf(characterOfOffer(o)?.id ?? o.id) : null;
    return (
      <li key={`${o.kind}:${o.id}`}>
        <button
          type="button"
          className={`bf-spawn-screen-cell bf-spawn-tile${portrait ? ' bf-spawn-face' : ''}`}
          data-kind={o.kind}
          data-offer={o.id}
          aria-pressed={chosen?.id === o.id}
          aria-disabled={!o.affordable || undefined}
          aria-label={`${name(o)}${o.cost ? `, ${o.cost.toLocaleString('en-GB')} Battle Points` : ''}`}
          onFocus={() => pick(o)}
          onClick={() => (o.affordable ? onDeploy?.(o) : null)}
        >
          {portrait ? face ? <img src={face} alt="" loading="lazy" /> : <img className="bf-spawn-tile-icon" src={offerIcon(o)} alt="" /> : <GameIcon name={`class:${o.cls}`} className="bf-spawn-class-icon" fallback={<img className="bf-spawn-tile-icon" src={offerIcon(o)} alt="" />} />}
          {portrait ? o.cost && !o.affordable ? <span className="bf-num bf-spawn-cost">{o.cost.toLocaleString('en-GB')}</span> : null : <span className="bf-spawn-screen-name">{name(o)}</span>}
        </button>
      </li>
    );
  };
  return (
    <GameScreen tree={tree} label={title} onBack={onBack} keys={false} className="bf-spawn-screen">
      {spec ? (
        <div className="bf-spawn-figure" aria-hidden="true">
          <CollectionStage spec={spec} />
        </div>
      ) : null}
      <section className="bf-spawn-panel" aria-label={chosen ? name(chosen) : title}>
        <p className="bf-spawn-aurebesh" aria-hidden="true">
          {chosen ? name(chosen) : ''}
        </p>
        <h2>{chosen ? name(chosen) : ''}</h2>
        <ul className="bf-spawn-slots" aria-label="Star cards">
          {SLOTS.map((i) => (
            <li key={i} className="bf-spawn-slot">
              {cards[i]?.art ? <img src={cards[i].art} alt={cards[i].name ?? ''} loading="lazy" /> : null}
            </li>
          ))}
        </ul>
        {spawns.length > 1 && (
          <ul className="bf-spawn-screen-where" aria-label="Where to deploy">
            {spawns.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  className="bf-spawn-where"
                  data-spawn={c.kind ?? c.id}
                  aria-pressed={where?.id === c.id}
                  aria-disabled={c.blocked ? true : undefined}
                  onClick={() => {
                    if (c.blocked) return;
                    setAt(c.id);
                    onSpawn?.(c);
                  }}
                >
                  <span className="bf-spawn-screen-name">{c.name}</span>
                  <span className="bf-num">{c.reason ?? ''}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
      <p className="bf-spawn-points">
        <b className="bf-num">{points.toLocaleString('en-GB')}</b>
        <span>BATTLE POINTS</span>
      </p>
      <div ref={strip} className="bf-spawn-strip" onKeyDown={onKeyDown}>
        <ul className="bf-spawn-classes">{classes.map((o) => tile(o))}</ul>
        <ul className="bf-spawn-faces">{others.map((o) => tile(o, true))}</ul>
      </div>
      <p className="bf-spawn-foot">
        <button type="button" data-foot="select" disabled={!chosen} onClick={() => chosen && onDeploy?.(chosen)}>
          SELECT
        </button>
        <button type="button" data-foot="abilities" aria-disabled="true" title={NOT_YET}>
          VIEW ABILITIES
        </button>
        <button type="button" data-foot="appearances" aria-disabled="true" title={NOT_YET}>
          APPEARANCES
        </button>
      </p>
    </GameScreen>
  );
}
