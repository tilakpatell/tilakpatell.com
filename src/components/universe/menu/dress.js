// The flight menu's rules (FlightMenu.jsx; the frame is the HUD kit's
// PauseMenu): its six tabs, the map's keys that open it on one, the tab kept
// between visits, and the dress it wears, the crew's (dresses.css). Pure, tested.
// The design: docs/superpowers/specs/2026-11-18-quiet-hud-design.md.

import { crewById } from '../crews';
import { readTab } from '../../../runtime/hud/pause.js';

// (`mark`: the lab's element tile for each, the RV's dress)
export const MENU_TABS = [
  { id: 'ship', label: 'Ship', mark: 'Sh' },
  { id: 'cargo', label: 'Cargo', mark: 'Ca' },
  { id: 'map', label: 'Map', mark: 'Ma' },
  { id: 'settings', label: 'Settings', mark: 'Se' },
  { id: 'help', label: 'Help', mark: 'He' },
  { id: 'site', label: 'Site', mark: 'Si' },
];
const IDS = MENU_TABS.map((t) => t.id);

// I for the cargo (a game's inventory key) and O for the settings (the flight settings' own, as it was); H, M and ? keep their doors
export const MENU_KEYS = { i: 'cargo', o: 'settings' };
export const MENU_TAB_KEY = 'tp-flight-menu-tab'; // (the visitor's own convenience: the tab last open, in this browser)

export const readMenuTab = (raw) => readTab(raw, IDS);

export const DRESSES = ['xwing', 'falcon', 'cruiser', 'rv', 'house'];
export const dressFor = (ship) => (crewById(ship) && DRESSES.includes(ship) ? ship : 'house');
