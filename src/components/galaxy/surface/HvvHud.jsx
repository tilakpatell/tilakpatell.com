import { useEffect, useRef, useState } from 'react';
import { clockOf } from './missions/chase';
import { heroById } from '../heroes';

// What's over Heroes vs Villains (missions/hvv.js): first the choose card
// (heroes or villains, you as the hero you're playing), then the deploy
// card (now, and whenever you're down: the respawn count, then Deploy); on
// the field, the game's score bar (the two sides' points to ten), each
// side's target with its health, your kills, the out-of-bounds count when
// you're past the arena's edge, the last few things that happened; at the
// end, how it went. `view` is the scene's hvvView as the page last drew
// it; `feed` brings the same ten times a second, for the targets' health
// and the clock alone.

export default function HvvHud({ view, feed, mission, best, fresh, hero, onSide, onDeploy, onAgain, onBack }) {
  const [shut, setShut] = useState(false);
  const [live, setLive] = useState(null);
  const first = useRef(null);
  useEffect(() => {
    const set = feed?.current;
    if (!set) return undefined;
    set.add(setLive);
    return () => set.delete(setLive);
  }, [feed]);
  const result = view?.result ?? null;
  const card = view ? (view.phase === 'choose' ? 'choose' : result && !shut ? 'end' : view.phase === 'run' && !view.you.up ? 'deploy' : null) : null;
  useEffect(() => {
    if (card) first.current?.focus({ preventScroll: true });
  }, [card, view?.you.can]);
  if (!view) return null;
  const now = live ?? view;
  const { sides } = mission;
  const me = view.you.side;
  const foe = me === 'light' ? 'dark' : 'light';
  const you = heroById(hero)?.name ?? 'You';
  const restart = () => {
    setShut(false);
    onAgain();
  };
  const target = (side) => {
    const t = now.targets[side];
    if (!t) return null;
    return (
      <p className="hvv-target" data-side={side} data-mine={side === me || undefined} style={{ '--side': sides[side].colour }}>
        <i aria-hidden="true" />
        <span>{side === me ? 'Protect' : 'Bring down'}</span>
        <b>{t.you ? 'You' : t.name}</b>
        <em aria-label={`${t.hp}% health`}>
          <i style={{ width: `${t.up ? t.hp : 0}%` }} />
        </em>
      </p>
    );
  };
  return (
    <>
      <p className="sr-only" aria-live="polite">
        {card === 'choose' ? 'Choose your side' : card === 'deploy' ? (view.you.can ? 'Deploy' : `Back in ${view.you.wait} seconds`) : result ? (result.won ? mission.ends.won : mission.ends.lost) : view.you.out ? `Out of the arena: ${view.you.out} seconds` : ''}
      </p>

      {card === 'choose' && (
        <div className="assault-card" role="dialog" aria-label={`${mission.name}: choose your side`}>
          <p className="chase-result-kicker">{mission.name}</p>
          <h2 className="chase-result-title">Choose your side</h2>
          <p className="chase-result-text">{mission.line}</p>
          <div className="assault-sides">
            {['light', 'dark'].map((side, i) => (
              <button key={side} ref={(heroById(hero)?.lean ? heroById(hero).lean === side : i === 0) ? first : null} type="button" className="assault-side" style={{ '--side': sides[side].colour }} onClick={() => onSide(side)}>
                <b>{sides[side].name}</b>
                <span>{heroById(hero)?.lean === side ? `${you} · their own side` : `${you} with them`}</span>
              </button>
            ))}
          </div>
          <div className="chase-result-actions">
            <button type="button" className="btn btn-ghost btn-sm" onClick={onBack}>
              Back to the system
            </button>
          </div>
        </div>
      )}

      {card === 'deploy' && (
        <div className="assault-card" role="dialog" aria-label="Deploy">
          <p className="chase-result-kicker" style={{ color: sides[me].colour }}>
            {sides[me].name}
          </p>
          <h2 className="chase-result-title">{view.you.deaths ? 'Down' : 'Deploy'}</h2>
          <p className="chase-result-text">
            Points: <b style={{ color: sides.light.colour }}>{now.score.light}</b> {sides.light.short}, <b style={{ color: sides.dark.colour }}>{now.score.dark}</b> {sides.dark.short}, first to {view.points}.
          </p>
          <div className="chase-result-actions">
            <button ref={first} type="button" className="btn btn-primary btn-sm" disabled={!view.you.can} onClick={onDeploy}>
              {view.you.can ? `Deploy as ${you}` : `Back in ${view.you.wait} s`}
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={restart}>
              Start over
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={onBack}>
              Back to the system
            </button>
          </div>
        </div>
      )}

      {view.phase === 'run' && !result && (
        <>
          <div className="hvv-score" role="status" aria-label={`${sides.light.short} ${now.score.light}, ${sides.dark.short} ${now.score.dark}, first to ${view.points}`}>
            {['light', 'dark'].map((side) => (
              <p key={side} data-side={side} data-mine={side === me || undefined} style={{ '--side': sides[side].colour }}>
                <b>{now.score[side]}</b>
                <span>{sides[side].short}</span>
                <em>
                  <i style={{ width: `${(now.score[side] / view.points) * 100}%` }} />
                </em>
              </p>
            ))}
            <small>
              First to {view.points} · {clockOf(now.t)}
            </small>
          </div>
          <div className="hvv-targets" aria-label="Targets">
            {target(me)}
            {target(foe)}
            {view.you.target && view.you.up && <p className="hvv-you-target">You’re your side’s target</p>}
            <p className="assault-score">
              <b>{view.you.kills}</b>
              <span>{view.you.kills === 1 ? 'kill' : 'kills'}</span>
            </p>
          </div>
          {view.you.up && view.you.out != null && (
            <div className="hvv-out" role="alert">
              <p>Back into the arena</p>
              <b>{now.you.out ?? view.you.out}</b>
            </div>
          )}
          {view.feed.length > 0 && (
            <ul className="assault-feed" aria-live="polite">
              {view.feed.slice(-3).map((f, i) => (
                <li key={`${f.t}-${i}`} data-kind={f.kind}>
                  {f.text}
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {card === 'end' && (
        <div className="chase-result" role="dialog" aria-label={`${mission.name}: ${result.won ? 'won' : 'lost'}`} data-won={result.won || undefined}>
          <p className="chase-result-kicker">{mission.name}</p>
          <h2 className="chase-result-title">{result.won ? mission.ends.won : mission.ends.lost}</h2>
          {result.won && (
            <p className="chase-stars" role="img" aria-label={`${result.stars} of 3 stars`}>
              {[0, 1, 2].map((i) => (
                <b key={i} data-on={i < result.stars || undefined}>
                  ★
                </b>
              ))}
            </p>
          )}
          <p className="chase-result-text">
            {result.won ? `With ${sides[result.side].name.replace(/^The /, 'the ')}, ${result.score[result.side]} to ${result.score[result.side === 'light' ? 'dark' : 'light']}, in ${clockOf(result.t)}.` : mission.ends.why[result.why ?? 'points']} {result.kills} {result.kills === 1 ? 'hero' : 'heroes'} down by your hand.
            {result.won ? ` ${fresh ? 'Your best yet.' : best ? `Your best: ${clockOf(best.t)}.` : ''}` : best ? ` Your best: ${clockOf(best.t)}.` : ''}
          </p>
          <div className="chase-result-actions">
            <button ref={first} type="button" className="btn btn-primary btn-sm" onClick={restart}>
              Again
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShut(true)}>
              Look round on foot
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={onBack}>
              Back to the system
            </button>
          </div>
        </div>
      )}
    </>
  );
}
