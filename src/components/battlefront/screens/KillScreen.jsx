import { word } from '../../../lib/bf2017/ui/screens';
import { GameIcon } from '../../../runtime/hud';
import { useTree } from './useTree';
import GameScreen from './GameScreen.jsx';

// The kill screen (the game's kill card, UI/InGame/Death/KillCardWidget):
// YOU WERE ELIMINATED, who did it, with what (its icon, one of the game's),
// and from where (the direction and the distance), until the deploy screen
// comes back. `killer`: the kill log's line for the player, if there is one.
//
// <KillScreen killer={{ name, weapon, dist, bearing }} earned={n} />
export default function KillScreen({ killer = null, earned = 0 }) {
  const tree = useTree('KillCardWidget');
  return (
    <GameScreen tree={tree} label={word('#73CD3EA7')} keys={false} className="bf-kill-screen">
      <div className="bf-kill-card" role="status">
        <p className="bf-kill-head">{word('#73CD3EA7')}</p>
        {killer ? (
          <p className="bf-kill-by">
            {killer.weapon ? <GameIcon name={killer.weapon} className="bf-kill-icon" /> : null}
            <span className="bf-kill-name">{killer.name}</span>
            {killer.dist != null ? <span className="bf-num">{Math.round(killer.dist)} m</span> : null}
          </p>
        ) : null}
        {earned ? (
          <p className="bf-kill-points">
            +<span className="bf-num">{earned}</span>
          </p>
        ) : null}
      </div>
    </GameScreen>
  );
}
