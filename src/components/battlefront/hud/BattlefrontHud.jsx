import { Hud, Menu, Toast } from '../../../runtime/hud';
import Abilities from './Abilities.jsx';
import DamageIndicator from './DamageIndicator.jsx';
import DeathPoints from './DeathPoints.jsx';
import DeployScreen from './DeployScreen.jsx';
import EndOfRound from './EndOfRound.jsx';
import Health from './Health.jsx';
import Heat from './Heat.jsx';
import KillLog from './KillLog.jsx';
import Markers from './Markers.jsx';
import ObjectiveBar from './ObjectiveBar.jsx';
import Radar from './Radar.jsx';
import Scoreboard from './Scoreboard.jsx';
import './battlefront.css';

// The game's HUD on the kit (the game design's decision 14): what the sim's
// view says, drawn by the parts beside this file in the game's faces and
// words. While the deploy screen is open nothing else of the soldier shows;
// the end of round covers everything. One Menu, the kit's, is the way out.
//
//   <BattlefrontHud view={snapshot} mine={team} words={…} markers={[…]} scoreboard={bool}
//     onDeploy={(offer) => …} readRadar={() => …} way={{ label, to }} touch={bool} />
export default function BattlefrontHud({ view, mine = 2, words, markers = [], scoreboard = false, onDeploy, onPick, readRadar, way = null, toast = null, touch = false }) {
  const p = view?.player ?? null;
  const deploying = Boolean(view?.deploy?.open);
  const mode = view?.mode ?? null;
  return (
    <Hud className="bf-hud" touch={touch} tools={<Menu way={way} />} brand={<span className="bf-glass">{words.title}</span>}>
      <Toast toast={toast} />
      {mode && <ObjectiveBar stage={mode.stageName} objectives={mode.objectives ?? []} tickets={mode.tickets} />}
      {!deploying && !mode?.result && p && p.state === 'alive' && (
        <>
          <Markers markers={markers} />
          <Heat heat={p.heat ?? 0} warning={p.warning ?? 0.75} overheated={Boolean(p.overheated)} window={p.coolWindow ?? null} />
          <div className="bf-soldier">
            <Health hp={p.hp} hpMax={p.hpMax} />
            <Abilities slots={p.abilities ?? []} />
          </div>
          <DamageIndicator hits={p.hits ?? []} />
          {readRadar && <Radar read={readRadar} />}
        </>
      )}
      <KillLog entries={view?.killLog ?? []} mine={mine} />
      {p && p.state !== 'alive' && !deploying && <DeathPoints earned={p.earned ?? 0} total={view?.points ?? 0} label={words.earned} totalLabel={words.total} />}
      {deploying && <DeployScreen deploy={view.deploy} points={view.points ?? 0} name={words.offer} title={words.deploy} onDeploy={onDeploy} onPick={onPick} />}
      {scoreboard && !mode?.result && <Scoreboard teams={view?.scoreboard ?? {}} />}
      {mode?.result && <EndOfRound result={mode.result} mine={mine} words={words.outcome} teams={view?.scoreboard ?? {}} />}
    </Hud>
  );
}
