import { HeroStage, stageFor } from '../../galaxy/shared/stage';
import { detailLevel } from '../../../lib/detail';

// The figure behind the Collection's lists: the game's hero-select stage
// (the galaxy's, lent through its shared face) with the picked skin's body
// in its front-end idle, an emote or a pose played once on `play`; where the
// level draws no stage, or the skin has no body yet, the character's
// portrait or the card's art in its place.
export default function CollectionStage({ spec, play = null, playKey = 0, still = null, label = '', style = null }) {
  const level = detailLevel();
  const staged = spec && stageFor({ level, hero: spec });
  return (
    <div className="bf-collection-stage" style={style ?? undefined} data-staged={staged ? 'stage' : 'still'}>
      {staged ? <HeroStage spec={spec} level={level} play={play} playKey={playKey} className="bf-collection-stage-canvas" /> : still ? <img className="bf-collection-still" src={still} alt={label} /> : null}
    </div>
  );
}
