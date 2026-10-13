import { createPortal } from 'react-dom';
import './wipe.css';

// The game's wipe between the spawn screen's dark room and the field
// (waiting.js's WIPE, from PF_SpawnWipeLogic): black over everything, in
// over 0.3 s after 0.05 s, out over 0.4 s; `phase` 'down' | 'up' | null.
// Put at the body's end, over the game's screens and the HUD.
export default function Wipe({ phase = null }) {
  if (!phase) return null;
  const node = <div className="bf-wipe" data-wipe={phase} aria-hidden="true" />;
  return typeof document === 'undefined' ? node : createPortal(node, document.body);
}
