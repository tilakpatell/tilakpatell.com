# Lightsaber forms from mirrored and layered library clips, not new motion

Date: 2026-10-09. The long version: `docs/superpowers/specs/2026-10-09-saber-forms-force-dismemberment-design.md` (§1–3).

## Context

The owner asked for the double blade and the dual wield to fight like a staff and a pair. Today (`combatRules.js`, `saber.js`) all three stances play the same five one-sword clips from UAL2 at different speeds; the staff is a second blade cloned onto a 0.28 m hilt, the pair a second hilt whose left arm follows the one-sword clip’s off-hand. What was looked for in the session: UAL1, UAL2 and Meshy’s action set hold no staff, pair, spear, polearm or katana motion (the research audit’s inventories); the text-to-motion spike (`docs/research/2026-10-08-motion-spike.md`) can make a stroke from words on the desktop, but HY-Motion’s licence forbids displaying its output in the EU and the UK, so nothing it makes can ship on a public site; the alternatives (MoMask, GVHMR from film) are lower quality or need a filmed reference.

The ways to a staff and a pair:

| way | cost | what it gives |
| --- | --- | --- |
| motion from words or video on the desktop | a licence that does not fit, or a lower model, or filming | real two-blade motion, when it works |
| hand-keyed clips | days of animation work nobody here does well | real motion |
| mirror the library’s sword clips across the body (left for right) and lay a stroke’s arms by hand, with the other arm held at guard; turn the hilt in the hand by a planned angle inside the contact window for a staff | one bake option, one small module, no new assets, the same contact-window pipeline | a pair that alternates and cross-cuts; a staff whose both blades sweep; every stance a special from clips already baked (`sword.dash`, `sword.pound`, `sword.aerial.a`) |

## Decision

Forms are data on the library’s clips. `scripts/ual-bake.mjs` gains a `--mirror` bake that reflects a sword clip across the sagittal plane and measures its contact window on the left fist; `saberForms.js` lays each stroke’s arms from the clip the stroke names for that hand, holds the other hand at its guard, and turns the hilt in the hand by a planned spin inside the window; the stance table carries the hand, the overlay and a special per stance. No motion-capture output ships.

## Consequences

- A pair and a staff read as such at the camera’s distance, on every figure, with the body motion the library already has and the contact-window pipeline unchanged.
- The spin is a turn of the hilt in the hand, not a wrist the animator drew: the forearm follows by IK, and at close range a connoisseur can tell. The rigging lane’s twist bone will make the wrist look better when it lands.
- A cross-cut lays two clips at once; a clip pair that was not made together can pop at the shoulders. The scenario test and the sheet are the judge; a pair that pops is replaced by another.
- The motion pipeline stays for a licence that fits; a real staff clip then becomes a row in the same table.

## Revisit when

- A text-to-motion or video-to-motion model with a licence that allows a public site reads as a strike on the sheet (the spike’s six checks): then the specials and the staff’s whirl take real clips.
- The sheet shows the mirrored strokes crossing the body or popping on more than a stroke or two.
