import { createContext } from 'react';

// What a building hands its game (hq/HQGame.jsx): { id, name, blurb, accent,
// stone: { id, name, color, half } | null, onBack(), next() → { id, label,
// to, state } | null }. Null outside a building.
export const GameScreen = createContext(null);
