# The docs

What each folder under `docs/` holds, and where to start for a question. Every session reads the same pages, so a page is short, says where its numbers come from, and points at the code rather than copying it. A doc that stops being true is fixed or removed; the code and the commit messages are the record.

| where | what it holds | open it when |
| --- | --- | --- |
| `architecture.md` | the site’s pieces, a short paragraph each, shared by every session (edit only your area) | you need to know how a part of the site fits together |
| `stack/` | one page per library, engine or framework, and an index of every package with the files that import it | you are about to use, upgrade or question a dependency |
| `decisions/` | the record of choices made, one dated entry each, never rewritten | you wonder why the site is built the way it is |
| `health/` | the rules of the architecture (`RULES.md`), the budgets the measure holds (`budgets.json`), the backlog of repairs | you split a file, add an import or wonder what may import what |
| `superpowers/specs/` | designs, one per feature or lane, dated | you start on a feature and need the why and the shape |
| `superpowers/plans/` | the task-by-task plans still being carried out; a plan goes once its work is merged | you are carrying one out |
| `superpowers/HANDOFF-*.md` | five hand-offs, one an area (`battlefront`, `galaxy`, `universe`, `worlds`, `runtime`): what landed, what is left, the owner’s rules | you continue work in an area |
| `superpowers/evidence/` | the numbers behind a lane’s claims, a folder a lane, each with a README; data and text only, the screenshots are remade by the scripts | you want the numbers behind a hand-off’s claims |
| `research/` | dated notes on techniques, other sites and audits | a design cites one, or you are about to research the same thing |
| `autopilot/` | the self-improvement loop’s readme, backlog and budget | you run or review the autopilot |
| `assets/` | where third-party asset kits come from, and their licence | you add a model or texture someone else made |
| `asset-manifest.md` | the format of the manifest a world streams its assets from | you add an asset a world streams, or change the loader |
| `gen3d/` | reference pictures for models generated on the owner’s desktop | you request or check on a generated model |
| `readme/` | pictures for the README, nothing to read | never, unless you change the README’s pictures |
| `PICKUP-PROMPT.md` | the prompt that starts a session on a lane | you start a new lane |

## Where to start

- **A library?** `stack/`: its page says how the site holds it, and `stack/README.md` lists every package.
- **Why is it like this?** `decisions/`, then the spec the entry links.
- **A feature?** Its spec in `superpowers/specs/`, then the area’s hand-off.
- **What is left in an area?** The “Left” section of its hand-off, and `autopilot/backlog.md`.
- **What may import what?** `health/RULES.md`; `node scripts/health.mjs` measures it.
- **The site’s pieces?** `architecture.md`.

## What is not here

The site does not reconstruct, port or publish any game engine. The Battlefront II (2017) material is data the site reads (`decisions/2026-10-10-battlefront-2017-assets.md`, `assets/battlefront-2017.md`); the engine is three’s renderers, TSL and Rapier (`decisions/2026-10-10-the-engine-in-place.md`).
