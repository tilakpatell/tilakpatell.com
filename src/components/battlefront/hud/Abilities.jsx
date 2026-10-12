import { icon } from '../../../lib/bf2017/icons.js';
import { shape } from '../../../lib/bf2017/ui/shapes.js';
import { classKind } from './widgets.js';

// The ability cluster (UI/InGame/Hud/Abilities/AbilitiesWidget → Abilities,
// 310 × 207 at the bottom right, 85 in and 48 up): three hexagons
// (AbilityModel on Shared/Hexagon: Hexagon_HUD_bg on glass, Hexagon_HUD_outline
// in palette 34, 116 × 100) the left at the left middle, the middle at the
// top middle, the right at the right middle; each with its ability's icon
// (the trooper ability icons, UI/SVG/…/TrooperAbilityIcons) and its key
// beside it, the recharge sweeping the hexagon's edge (AbilityStateTemplate's
// ProgressRadial from the top) and the charges in the corner (AbilityRecharge's
// ChargesCounterText, Univers 620 Bold 18 px). A slot's `state` is the
// game's (abilities.js: recharge, blocked, ready, activating, active): an
// active one's edge is lit whole, a blocked one's icon dimmed.
//
//   <Abilities slots={[{ slot: 1 | 2 | 3, recharge: 0…1, charges, ready, state }]} cls="assault" keys={['Q', 'E', 'F']} />
const BG = shape('Hexagon_HUD_bg');
const OUTLINE = shape('Hexagon_HUD_outline');
// the classes' three default abilities' icons, left, middle, right
// (abilities.json's DefaultAbility_<class>_* rows, slot by slot)
const CLASS_ABILITY_ICONS = {
  assault: ['TrooperAbilityIcons/MKI_Troopers_12_ThermalDetonator', 'TrooperAbilityIcons/MKI_Troopers_17_Vanguard', 'TrooperAbilityIcons/MKI_Troopers_13_ScanDart'],
  heavy: ['TrooperAbilityIcons/MKI_Trooper_27_ImpactGrenade', 'TrooperAbilityIcons/MKI_Trooper_33_Sentry', 'TrooperAbilityIcons/MKI_Trooper_22_CombatShield'],
  officer: ['TrooperAbilityIcons/MKI_Trooper_49_SplitterGrenade', 'TrooperAbilityIcons/MKI_Trooper_37_BattleCommand', 'TrooperAbilityIcons/MKI_Trooper_38_BlasterTurret'],
  specialist: ['TrooperAbilityIcons/MKI_Trooper_53_ShockGrenade', 'TrooperAbilityIcons/MKI_Trooper_54_Infiltration', 'TrooperAbilityIcons/MKI_Trooper_52_ScoutBinoculars'],
};
const PLACE = ['left', 'middle', 'right'];
export default function Abilities({ slots = [], cls = null, keys = ['Q', 'E', 'F'] }) {
  if (!slots.length) return null;
  const kind = classKind(cls);
  const icons = CLASS_ABILITY_ICONS[kind] ?? null;
  return (
    <div className="bf-abilities" data-class={kind || undefined}>
      {slots.slice(0, 3).map((s, i) => {
        const href = icons ? icon(icons[i])?.href : null;
        const share = s.ready ? 1 : Math.max(0, Math.min(1, s.recharge ?? 0));
        return (
          <div key={s.slot} className="bf-ability" data-at={PLACE[i]} data-ready={s.ready ? '' : undefined} data-state={s.state ?? undefined}>
            <svg viewBox={BG.viewBox} aria-hidden="true">
              <path d={BG.paths[0].d} className="bf-ability-glass" />
              <path d={OUTLINE.paths[0].d} fill="none" stroke="currentColor" strokeWidth="0.8" opacity="0.6" />
              {share < 1 && <path d={OUTLINE.paths[0].d} fill="none" stroke="currentColor" strokeWidth="3" pathLength="1" strokeDasharray={`${share} 1`} />}
              {href && <use href={href} x="29" y="22" width="60" height="60" className="bf-ability-icon" />}
            </svg>
            <span className="bf-ability-key">
              <kbd className="hud-cap">{keys[i] ?? s.slot}</kbd>
            </span>
            {s.charges > 1 && <b className="bf-ability-charges">{s.charges}</b>}
          </div>
        );
      })}
    </div>
  );
}
