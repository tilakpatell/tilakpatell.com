import Scoreboard from './Scoreboard.jsx';

// The end of the round (UI/InGame/EndOfRound: OutcomeDeclarationHudWidget,
// then the scoreboard): the outcome in the game's words for the player's
// side, then the table.
//
//   <EndOfRound result={{ winner, why }} mine={team} words={{ won, lost, draw }} teams={…} />
export default function EndOfRound({ result, mine, words, teams }) {
  if (!result) return null;
  const text = result.winner == null ? words.draw : result.winner === mine ? words.won : words.lost;
  return (
    <div className="bf-screen" role="dialog" aria-modal="true" aria-label={text}>
      <div className="bf-panel">
        <p className="bf-outcome">{text}</p>
        <Scoreboard teams={teams} bare />
      </div>
    </div>
  );
}
