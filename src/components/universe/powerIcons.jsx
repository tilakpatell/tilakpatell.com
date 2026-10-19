// Each crew power's mark (shipPowers.js's POWERS), drawn in its tile's own
// colour: the HUD's tiles (PowerBar.jsx) and the Hangar's Powers (through
// universe/shared/hangar.js).
export const POWER_ICONS = {
  // the Force: rings out from the middle
  focus: (
    <>
      <circle cx="12" cy="12" r="2.4" />
      <circle cx="12" cy="12" r="6" opacity="0.75" />
      <circle cx="12" cy="12" r="9.6" opacity="0.45" />
    </>
  ),
  // four torpedoes, away
  salvo: <path d="M5 19V9m0 0l-1.8 2M5 9l1.8 2M10 17V6m0 0L8.2 8M10 6l1.8 2M14 17V6m0 0l-1.8 2M14 6l1.8 2M19 19V9m0 0l-1.8 2M19 9l1.8 2" />,
  // a pair of dice
  odds: (
    <>
      <rect x="2.5" y="8" width="9" height="9" rx="1.8" transform="rotate(-12 7 12.5)" />
      <rect x="12.5" y="6" width="9" height="9" rx="1.8" transform="rotate(10 17 10.5)" />
      <circle cx="7" cy="12.5" r="0.9" fill="currentColor" />
      <circle cx="15" cy="8.5" r="0.9" fill="currentColor" />
      <circle cx="19" cy="12.5" r="0.9" fill="currentColor" />
    </>
  ),
  // the quad guns' sight, all the way round
  quad: (
    <>
      <circle cx="12" cy="12" r="6.5" />
      <path d="M12 2.5v5M12 16.5v5M2.5 12h5M16.5 12h5" />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" />
    </>
  ),
  // a portal's swirl
  portal: <path d="M12 12.5c.9 0 1.4-.8 1.1-1.6-.5-1.3-2.4-1.5-3.4-.5-1.6 1.5-.9 4.2 1 5 2.6 1.1 5.4-.8 5.6-3.6.3-3.6-3-6.3-6.5-5.7-4.2.7-6.6 5.2-5.1 9.1 1.6 4.3 6.6 6.2 10.6 4.3" />,
  // the death ray, out of the nose
  wubba: <path d="M2.5 12h4l2-4 3 8 2.5-6 2 3.5h5.5M20 9.5l2 2.5-2 2.5" />,
  // a horseshoe magnet
  magnets: <path d="M6 4v8a6 6 0 0 0 12 0V4h-3.5v8a2.5 2.5 0 0 1-5 0V4zM6 7.5h3.5M14.5 7.5H18" />,
  // a pork-pie hat
  heisenberg: (
    <>
      <path d="M7 14.5V10c0-1.4 2.2-2.5 5-2.5s5 1.1 5 2.5v4.5" />
      <path d="M7 12.5h10" opacity="0.6" />
      <ellipse cx="12" cy="15" rx="9.5" ry="2.6" />
    </>
  ),
};
