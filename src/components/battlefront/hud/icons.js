// The game's own SVGs (lane 0 copied them under public/battlefront/icons/
// with their export paths), named for the parts that draw them.

export const ICON_BASE = '/battlefront/icons/';
export const iconSrc = (path) => `${ICON_BASE}${path}`;

export const CLASS_ICON = {
  assault: 'UI/SVG/Classes/Class_Troopers_Assault_01.svg',
  heavy: 'UI/SVG/Classes/Class_Troopers_Heavy_01.svg',
  officer: 'UI/SVG/Classes/Class_Troopers_Officer_01.svg',
  specialist: 'UI/SVG/Classes/Class_Troopers_Specialist_01.svg',
  enforcer: 'UI/SVG/Classes/Class_Enforcer.svg',
  infiltrator: 'UI/SVG/Classes/Class_Infiltrator.svg',
  aerial: 'UI/SVG/Classes/Class_JumpTrooper.svg',
  hero: 'UI/SVG/Classes/Hero_Icon_01.svg',
};

// an offer's icon: its class, its reinforcement's kind, else the hero mark
export function offerIcon(offer) {
  if (offer.kind === 'hero') return iconSrc(CLASS_ICON.hero);
  const key = offer.cls ?? offer.reinforcementKind ?? String(offer.id).split('-').pop();
  return iconSrc(CLASS_ICON[key] ?? CLASS_ICON.assault);
}
