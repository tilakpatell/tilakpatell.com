import { useEffect, useState } from 'react';
import { word } from '../../../lib/bf2017/ui/screens';
import { skipTo, stepAt } from './tree';
import { useTree } from './useTree';
import GameScreen from './GameScreen.jsx';
import Scoreboard from './Scoreboard.jsx';

// The end of the round, step by step as the game shows it: the outcome
// declared (VICTORY or DEFEAT in the game's words, on its outcome widget),
// the scoreboard (EORScoreboardScreenWidget, over lane 5's rows), the top
// players (the game's MVP line). The steps run on the clock, never on frames
// (`stepAt` reads the time gone), so a tab in the background moves on too.
// Enter skips to the next.
//
// <EndOfRound result={{ winner }} mine={team} teams={…} words={{ won, lost, draw }} now={() => ms} />
export default function EndOfRound({ result, mine, teams = {}, words = {}, now = () => Date.now() }) {
  const [start] = useState(now);
  const [offset, setOffset] = useState(0);
  const [, tick] = useState(0);
  const gone = (now() - start) / 1000 + offset;
  const at = stepAt(gone);
  const done = Boolean(at.done);
  useEffect(() => {
    if (done) return undefined;
    const id = setInterval(() => tick((n) => n + 1), 250);
    return () => clearInterval(id);
  }, [done]);
  const outcome = result?.winner == null ? (words.draw ?? '') : result.winner === mine ? word('#36B45EAB') : word('#48A7E354');
  const tree = useTree(at.step.screen ?? 'RoundOutcomeDeclarationScreenWidget');
  if (!result) return null;
  const rows = Object.values(teams).flatMap((t) => t.rows.map((r) => ({ ...r, side: t.name })));
  const top = [...rows].sort((a, b) => b.points - a.points || b.kills - a.kills).slice(0, 3);
  return (
    <GameScreen tree={tree} label={outcome} keys={[['Enter', 'Next']]} className={`bf-eor bf-eor-${at.step.id}`}>
      <div className="bf-eor-step" data-step={at.step.id}>
        {at.step.id === 'outcome' && (
          <p className="bf-outcome" data-won={result.winner === mine || undefined}>
            {outcome}
          </p>
        )}
        {at.step.id === 'scoreboard' && <Scoreboard teams={teams} bare />}
        {at.step.id === 'top' && (
          <ol className="bf-top-players" aria-label={word('#05A0B377')}>
            {top.map((r, i) => (
              <li key={r.id}>
                <span className="bf-top-rank">{i === 0 ? word('#05A0B377') : i + 1}</span>
                <span>{r.name}</span>
                <span className="bf-num">{r.points}</span>
              </li>
            ))}
          </ol>
        )}
        <button type="button" className="bf-eor-next" onClick={() => setOffset((o) => o + skipTo(gone))}>
          Next
        </button>
      </div>
    </GameScreen>
  );
}
