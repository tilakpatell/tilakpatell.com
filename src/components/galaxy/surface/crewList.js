// Who the crew are: each figure kind's model file and height, which crew.js
// loads and walks. Plain data, apart from the scene, so a page can name the
// files (the surface page's model credits) without loading three.js.
// The rows live in the site’s one cast table (src/lib/cast/bodies.js), below
// the worlds, so every world names the same body for the same kind; this is
// the galaxy’s reader of it, with the names and the shape it always had.
// (Its imports keep their extension: scripts read this file in plain Node.)
import { BODIES } from '../../../lib/cast/bodies.js';

export { cutsOf, faceOf, figureLoaderFor, fileOf, filesOf } from '../../../lib/cast/bodies.js';

// the table’s own notes, whose body a kind is and what could replace it, are
// for the audit and the other worlds; the galaxy’s rows keep the fields its
// loaders and tests have always read
const NOTES = new Set(['source', 'could']);
const galaxyRow = (row) => Object.fromEntries(Object.entries(row).filter(([k]) => !NOTES.has(k)));

// kind → { model's name or file, how tall, still (not rigged) }
export const CREW = Object.fromEntries(Object.entries(BODIES).map(([kind, row]) => [kind, galaxyRow(row)]));
