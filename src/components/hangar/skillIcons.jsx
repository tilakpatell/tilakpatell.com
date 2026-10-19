// Each skill node's mark on the Hangar's tree (SkillTree.jsx), drawn in a
// 24 px box in the node's own colour (currentColor, stroked). A node that
// lends another crew's powers wears that crew's power's mark instead.
import { POWER_ICONS } from '../universe/shared/hangar';

const shield = 'M12 3l7 3v5c0 5-3 8.2-7 10-4-1.8-7-5-7-10V6z';

export const SKILL_ICONS = {
  // ── Flight ──
  afterburn: <path d="M7 19l5-5 5 5M7 12l5-5 5 5" />,
  trim: <path d="M5 18c0-6.5 4.5-11 11-11M13 4l3.5 3-3.5 3" />,
  deflectors: <path d={`${shield}M9 12.2l2.2 2.2 4-4.2`} />,
  plating: <path d={`${shield}M8 10h8M8 13.5h8`} />,
  slipstream: <path d="M3 8h11M7 12h14M3 16h11" />,
  hotdrive: <path d="M12 3v5M12 16v5M3 12h5M16 12h5M6 6l3 3M15 15l3 3M6 18l3-3M15 9l3-3" />,
  instinct: (
    <>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="2.8" />
    </>
  ),
  kesselrun: <path d="M3 17l6-6 4 4 7.5-7.5M15 7.5h5.5V13" />,
  // ── Guns ──
  trigger: <path d="M6.5 6v12M12 6v12M17.5 6v12" />,
  racks: <path d="M5 8h3.4v10H5zM10.3 8h3.4v10h-3.4zM15.6 8H19v10h-3.4zM5 8l1.7-2.5L8.4 8M10.3 8L12 5.5 13.7 8M15.6 8l1.7-2.5L19 8" />,
  scatter: <path d="M12 20L5 6M12 20l7-14M12 20V4.5" />,
  loader: <path d="M19.5 12a7.5 7.5 0 1 1-2.6-5.7M19.5 4v4.5H15" />,
  longlock: (
    <>
      <circle cx="12" cy="12" r="7" />
      <circle cx="12" cy="12" r="2.2" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
    </>
  ),
  'u-seismic': (
    <>
      <circle cx="12" cy="12" r="2.4" />
      <circle cx="12" cy="12" r="6" opacity="0.7" />
      <circle cx="12" cy="12" r="9.5" opacity="0.4" />
    </>
  ),
  'u-darkmatter': (
    <>
      <path d="M2.5 12h4M17.5 12h4" />
      <circle cx="12" cy="12" r="4.5" />
      <path d="M9.5 9.5l5 5" />
    </>
  ),
  'u-crystal': <path d="M12 2.5l5.5 6.5L12 21.5 6.5 9zM6.5 9h11M12 2.5v19" />,
  'u-energon': <path d="M13.5 2L5 13.5h6L10 22l9-12.5h-6z" />,
  // ── Ground ──
  tough: <path d="M12 20s-7.5-4.6-7.5-10.2A4.2 4.2 0 0 1 12 7.2a4.2 4.2 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z" />,
  steady: (
    <>
      <circle cx="12" cy="12" r="5.5" />
      <path d="M12 2.5v6M12 15.5v6M2.5 12h6M15.5 12h6" />
    </>
  ),
  coolant: <path d="M12 2.5v19M3.8 7.2l16.4 9.6M3.8 16.8l16.4-9.6M9.5 4l2.5 2 2.5-2M9.5 20l2.5-2 2.5 2" />,
  medic: <path d="M4 4h16v16H4zM12 8v8M8 12h8" />,
  hardhit: <path d="M12 2.5l1.9 5.4 5.6-1.9-2.8 5.1 4.8 3.2-5.7.6.6 5.7-4.4-3.6-4.4 3.6.6-5.7-5.7-.6 4.8-3.2-2.8-5.1 5.6 1.9z" />,
  'u-amban': <path d="M2.5 14h13l5-3.5M6.5 14v4M9 10.5h7M11 10.5V8.5" />,
  'u-particle': <path d="M2.5 12h5M10.5 12h11M7.5 8.5v7M10.5 9.5v5" />,
  'u-m60': <path d="M3 14.5h12.5l5-3H8.5M6 14.5v3.5M11 8.5h2.5v3" />,
  'u-gauntlet': <path d="M8 21v-7.5L5.2 10.3M8 13.5V5.5M11 12.5V4M14 12.5V5M17 13.5V8.5M8 21h8.2l.8-7.5" />,
  // ── Powers ──
  quickcharge: <path d="M3 8h15v8H3zM20.5 11v2M11.5 9l-2.5 3h3.5L10 15" />,
  recovery: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7v5l3.5 2" />
    </>
  ),
  overdrive: <path d="M7 3h10M7 21h10M8 3c0 5 8 5.5 8 9s-8 4-8 9M16 3c0 5-8 5.5-8 9s8 4 8 9" />,
  scavenger: <path d="M6 4v8a6 6 0 0 0 12 0V4h-4v8a2 2 0 0 1-4 0V4zM6 7.5h4M14 7.5h4" />,
  overcharge: <path d="M12 2l2.6 6.9H22l-6 4.5 2.3 7.6-6.3-4.6-6.3 4.6L8 13.4 2 8.9h7.4z" />,
  'b-xwing': POWER_ICONS.focus,
  'b-falcon': POWER_ICONS.odds,
  'b-cruiser': POWER_ICONS.portal,
  'b-rv': POWER_ICONS.magnets,
};
