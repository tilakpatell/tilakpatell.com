import { useEffect, useRef, useState } from 'react';
import { clockOf } from './missions/chase';

// What's over Blast (missions/blast.js): the choose card (the world's two
// armies), the deploy card (at your side's spawn, now and whenever you're
// down), on the field the game's score bar (each side's kills to a hundred),
// your kills and the clock and the last few things that happened, and at
// the end how it went. `view` is the scene's blastView as the page last
// drew it; `feed` brings the same ten times a second, for the counters.

export default function BlastHud({ view, feed, mission, best, fresh, onSide, onDeploy, onAgain, onBack }) {
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
  }, [card]);
  if (!view) return null;
  const now = live ?? view;
  const kills = now.kills ?? view.kills;
  const { sides } = mission;
  const me = view.you.side;
  const spawn = me ? view.posts.find((p) => p.fixed === me) : null;
  const restart = () => {
    setShut(false);
    onAgain();
  };
  return (
    <>
      <p className="sr-only" aria-live="polite">
        {card === 'choose' ? 'Choose your side' : card === 'deploy' ? 'Deploy' : result ? (result.won ? mission.ends.won : mission.ends.lost) : ''}
      </p>

      {card === 'choose' && (
        <div className="assault-card" role="dialog" aria-label={`${mission.name}: choose your side`}>
          <p className="chase-result-kicker">{mission.name}</p>
          <h2 className="chase-result-title">Choose your side</h2>
          <p className="chase-result-text">{mission.line}</p>
          <div className="assault-sides">
            {['attack', 'defend'].map((side, i) => (
              <button key={side} ref={i === 0 ? first : null} type="button" className="assault-side" style={{ '--side': sides[side].colour }} onClick={() => onSide(side)}>
                <b>{sides[side].name}</b>
                <span>To a hundred</span>
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
          <h2 className="chase-result-title">{view.you.deaths ? 'Deploy again' : 'Deploy'}</h2>
          <p className="chase-result-text">
            Kills: <b style={{ color: sides.attack.colour }}>{kills.attack}</b> {sides.attack.short}, <b style={{ color: sides.defend.colour }}>{kills.defend}</b> {sides.defend.short}, first to {view.goal}.
          </p>
          <div className="chase-result-actions">
            <button ref={first} type="button" className="btn btn-primary btn-sm" disabled={!spawn?.can} onClick={() => onDeploy(spawn.id)}>
              Deploy
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
          <div className="blast-score" role="status" aria-label={`${sides.attack.short} ${kills.attack}, ${sides.defend.short} ${kills.defend}, first to ${view.goal}`}>
            {['attack', 'defend'].map((side) => (
              <p key={side} data-side={side} data-mine={side === me || undefined} style={{ '--side': sides[side].colour }}>
                <b>{kills[side]}</b>
                <span>{sides[side].short}</span>
                <em>
                  <i style={{ width: `${Math.min(100, (kills[side] / view.goal) * 100)}%` }} />
                </em>
              </p>
            ))}
            <small>
              First to {view.goal} · {view.you.kills} {view.you.kills === 1 ? 'kill' : 'kills'} yours · {clockOf(now.t)}
            </small>
          </div>
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
            {result.won ? `With ${sides[result.side].name.replace(/^The /, 'the ')}, ${result.score?.[result.side] ?? view.goal} to ${result.score?.[result.side === 'attack' ? 'defend' : 'attack'] ?? 0}, in ${clockOf(result.t)}.` : mission.ends.why.kills} {result.kills} {result.kills === 1 ? 'kill' : 'kills'} yours.
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
