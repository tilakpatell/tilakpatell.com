// The crew's figures on the node renderer: universe/footFigures.js's
// loading, bound once with the node wardrobe (rickmorty/wardrobe/wearNodes),
// as footScene.js binds it with the classic one. The same names the
// surface took from footScene.
//
//   PARTY, loadPartyFigure(id, opts), loadSharedFigure(...)

import { PARTY, figuresWith, loadSharedFigure } from '../../../universe/footFigures';
import { bodyAsset, bodyKind, dress } from '../../../rickmorty/wardrobe/wearNodes';

export const { loadParty: loadPartyFigure } = figuresWith({ bodyAsset, bodyKind, dress });
export { PARTY, loadSharedFigure };
