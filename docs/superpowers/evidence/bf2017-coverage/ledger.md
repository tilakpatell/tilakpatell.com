# The Battlefront II (2017) drop: the coverage ledger

Written 2026-10-10 23:58 UTC from the bucket (113,520 objects listed) by `scripts/bf2017-coverage.mjs`. One row per object (a model with all its LOD files; a map and each of its five extras kinds; `data/` by top folder and record type), each in one state: used, owned, excluded, not-uploaded, unowned. `npm run coverage:bf2017` fails while any row is unowned, or owned by a lane that has merged.

**Rows:** 80,837 · used 17,820 · owned 44,203 · excluded 14,703 · not-uploaded 4,111 · unowned 0

## By part

| part | rows | objects | MB | used | owned | excluded | not-uploaded | unowned |
| --- | --: | --: | --: | --: | --: | --: | --: | --: |
| models | 14,471 | 14,471 | 2,563 | 9,481 | 1,797 | 3,193 | 0 | 0 |
| collision | 12,941 | 12,941 | 151 | 0 | 10,108 | 2,833 | 0 | 0 |
| anims | 10,270 | 10,270 | 1,110 | 734 | 8,981 | 555 | 0 | 0 |
| textures | 29,836 | 29,836 | 21,892 | 6,745 | 13,610 | 5,370 | 4,111 | 0 |
| physics | 10,530 | 10,530 | 125 | 0 | 8,038 | 2,492 | 0 | 0 |
| terrain | 39 | 39 | 311 | 1 | 28 | 10 | 0 | 0 |
| maps | 76 | 76 | 39 | 6 | 56 | 14 | 0 | 0 |
| maps.lights | 74 | 74 | 0 | 0 | 61 | 13 | 0 | 0 |
| maps.decals | 74 | 74 | 0 | 0 | 61 | 13 | 0 | 0 |
| maps.actors | 74 | 74 | 0 | 0 | 61 | 13 | 0 | 0 |
| maps.vehicles | 74 | 74 | 0 | 0 | 61 | 13 | 0 | 0 |
| maps.effects | 74 | 74 | 39 | 1 | 60 | 13 | 0 | 0 |
| scatter | 40 | 40 | 10 | 0 | 30 | 10 | 0 | 0 |
| animtracks | 61 | 61 | 0 | 3 | 49 | 9 | 0 | 0 |
| movies | 116 | 116 | 5,725 | 83 | 2 | 31 | 0 | 0 |
| fonts | 23 | 23 | 36 | 7 | 0 | 16 | 0 | 0 |
| svg | 702 | 702 | 4 | 626 | 17 | 59 | 0 | 0 |
| strings | 2 | 2 | 1 | 2 | 0 | 0 | 0 | 0 |
| data | 1,307 | 83,983 | 2,078 | 94 | 1,182 | 31 | 0 | 0 |
| index | 12 | 12 | 97 | 7 | 1 | 4 | 0 | 0 |
| test | 41 | 41 | 42 | 30 | 0 | 11 | 0 | 0 |

## Owned, by lane

Of each lane’s rows, those its plan did not name are the fifth design’s first finding (`finding: true` in the owners table), given to it when the ledger was first written.

| lane | design | owned rows | of them, the first finding |
| --- | --- | --: | --: |
| E | #848 | 29,042 | 2,983 |
| A | #848 | 8,636 | 51 |
| T | #839 | 1,742 | 1,742 |
| surfaces-Q6 | #844 | 1,394 | 0 |
| 5 | #812 | 659 | 659 |
| 4 | #812 | 435 | 434 |
| space | #848 | 432 | 123 |
| X | #836 | 368 | 305 |
| Y | #839 | 310 | 0 |
| surfaces-Q1 | #844 | 270 | 0 |
| B | #839 | 172 | 0 |
| 6 | #812 | 141 | 137 |
| M | #848 | 135 | 82 |
| surfaces-Q4 | #844 | 126 | 0 |
| surfaces-Q2 | #844 | 126 | 0 |
| 7 | #812 | 80 | 80 |
| surfaces-Q3 | #844 | 68 | 0 |
| N | #836 | 30 | 0 |
| D | #839 | 27 | 0 |
| W | #839 | 10 | 0 |

## Excluded, by rule

| rule | rows |
| --- | --: |
| era | 12,393 |
| scaffolding | 2,234 |
| helper | 60 |
| licence-pending | 16 |
