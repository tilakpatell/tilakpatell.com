import { Hud, Menu, Reticle, Toast } from '../../../runtime/hud';
import { HIT_MS } from '../../../runtime/hud/reticle.js';
import { hitMarker, killMarker } from '../../../lib/bf2017/ui/shapes.js';
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
import SquadList from './SquadList.jsx';
import '../../../lib/bf2017/fonts.css';
import './battlefront.css';

// The game's HUD on the kit (the game design's decision 14): what the sim's
// view says, drawn by the parts beside this file in the game's faces and
// words, laid out as UI/InGame/Hud/Soldier/Screens/DefaultSoldierHudWidget
// lays them (the radar and the squad list at the bottom left, the health
// at the bottom middle, the abilities at the bottom right, the kill log at
// the top right, the mode's bar at the top middle). While the deploy
// screen is open nothing else of the soldier shows; the end of round covers
// everything. One Menu, the kit's, is the way out.
//
//   <BattlefrontHud view={snapshot} mine={team} words={…} markers={[…]} scoreboard={bool}
//     onDeploy={(offer) => …} onSpawn={(spawn) => …} readRadar={() => …} way={{ label, to }} touch={bool} />
// The game's own screens (../screens/, lane screens) come in as parts:
// `deployAs` (the spawn screen in place of DeployScreen, same props),
// `roundAs` (null when the page draws the end of round itself), `reticle`
// (the weapon's crosshair, one of the game's shapes, for the kit's Reticle).
// A hit the player lands (view.player.hitAt, the sim's clock) flashes the
// game's hit marker for the kit's HIT_MS; a kill (killAt) its kill marker.
const HIT = hitMarker();
const KILL = killMarker();
export default function BattlefrontHud({ view, mine = 2, words, markers = [], scoreboard = false, onDeploy, onPick, onSpawn, readRadar, way = null, toast = null, touch = false, deployAs: Deploy = DeployScreen, roundAs: Round = EndOfRound, reticle = null }) {
  const p = view?.player ?? null;
  const deploying = Boolean(view?.deploy?.open);
  const mode = view?.mode ?? null;
  const now = view?.time ?? Infinity;
  const hitAgo = p?.hitAt != null ? (now - p.hitAt) * 1000 : null;
  const killAgo = p?.killAt != null ? (now - p.killAt) * 1000 : null;
  const marker = killAgo != null && killAgo < HIT_MS * 2 ? KILL : hitAgo != null && hitAgo < HIT_MS * 2 ? HIT : null;
  return (
    <Hud className="bf-hud" touch={touch} tools={<Menu way={way} />} brand={<span className="bf-glass">{words.title}</span>}>
      <Toast toast={toast} />
      {mode && <ObjectiveBar stage={mode.stageName} objectives={mode.objectives ?? []} tickets={mode.tickets} />}
      {!deploying && !mode?.result && p && p.state === 'alive' && (
        <>
          <Markers markers={markers} />
          {reticle && <Reticle state={{ shown: true, hit: marker ? 0 : null }} shape={reticle} />}
          {marker && <Reticle state={{ shown: true }} shape={marker} className="bf-hitmarker" />}
          <Heat heat={p.heat ?? 0} warning={p.warning ?? 0.75} overheated={Boolean(p.overheated)} window={p.coolWindow ?? null} />
          <Health hp={p.hp} hpMax={p.hpMax} evade={p.evade ?? null} />
          <Abilities slots={p.abilities ?? []} cls={p.cls ?? null} />
          <div className="bf-soldier">
            <SquadList squad={view?.squad ?? null} />
          </div>
          <DamageIndicator hits={p.hits ?? []} />
          {readRadar && <Radar read={readRadar} />}
        </>
      )}
      <KillLog entries={view?.killLog ?? []} mine={mine} now={now} words={words.kill} />
      {p && p.state !== 'alive' && !deploying && <DeathPoints earned={p.earned ?? 0} total={view?.points ?? 0} label={words.earned} totalLabel={words.total} />}
      {deploying && <Deploy deploy={view.deploy} points={view.points ?? 0} name={words.offer} title={words.deploy} onDeploy={onDeploy} onPick={onPick} onSpawn={onSpawn} />}
      {scoreboard && !mode?.result && <Scoreboard teams={view?.scoreboard ?? {}} />}
      {mode?.result && Round && <Round result={mode.result} mine={mine} words={words.outcome} teams={view?.scoreboard ?? {}} />}
    </Hud>
  );
}
