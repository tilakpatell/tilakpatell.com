import LaneFive from '../hud/Scoreboard.jsx';
import { findBox, percentOf } from './tree';
import { useTree } from './useTree';
import GameScreen from './GameScreen.jsx';

// The scoreboard held open in play: the game's end-of-round scoreboard tree
// (its outline shapes, the two rosters' boxes and their column heads), lane
// 5's rows in the rosters' boxes. `bare`: the tables alone (for the end of
// round's step, which has the tree already).
//
// <Scoreboard teams={{ 1: { name, rows }, 2: … }} bare? onBack? />
export default function Scoreboard({ teams = {}, bare = false, onBack = null }) {
  const tree = useTree('EORScoreboardScreenWidget');
  if (bare || !tree) return <LaneFive teams={teams} bare={bare} />;
  const boxes = [findBox(tree, 'team1_roster'), findBox(tree, 'team2_roster')];
  return (
    <GameScreen tree={tree} label="Scoreboard" keys={onBack ? [['Esc', 'Back']] : false} onBack={onBack} className="bf-scoreboard">
      {Object.entries(teams).map(([t, team], i) =>
        boxes[i] ? (
          <div key={t} className="bf-roster" style={percentOf(tree, boxes[i])}>
            <LaneFive teams={{ [t]: team }} bare />
          </div>
        ) : null,
      )}
    </GameScreen>
  );
}
