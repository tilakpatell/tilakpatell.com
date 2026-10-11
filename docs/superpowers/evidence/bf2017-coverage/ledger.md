# The Battlefront II (2017) drop: the coverage ledger

Written 2026-10-11 03:17 UTC from the bucket (113,686 objects listed) by `scripts/bf2017-coverage.mjs`. One row per object (a model with all its LOD files; a map and each of its five extras kinds; `data/` by top folder and record type), each in one state: used, owned, excluded, not-uploaded, unowned. `npm run coverage:bf2017` fails while any row is unowned, or owned by a lane that has merged.

**Rows:** 80,837 · used 20,926 · owned 42,054 · excluded 13,727 · not-uploaded 4,130 · unowned 0

## By part

| part | rows | objects | MB | used | owned | excluded | not-uploaded | unowned |
| --- | --: | --: | --: | --: | --: | --: | --: | --: |
| models | 14,471 | 14,471 | 2,563 | 9,504 | 2,068 | 2,899 | 0 | 0 |
| collision | 12,941 | 12,941 | 151 | 0 | 10,297 | 2,644 | 0 | 0 |
| anims | 10,270 | 10,270 | 1,110 | 734 | 8,981 | 555 | 0 | 0 |
| textures | 29,836 | 29,836 | 22,103 | 6,822 | 13,757 | 5,127 | 4,130 | 0 |
| physics | 10,530 | 10,530 | 125 | 2,953 | 5,334 | 2,243 | 0 | 0 |
| terrain | 39 | 39 | 311 | 4 | 25 | 10 | 0 | 0 |
| maps | 76 | 76 | 42 | 12 | 50 | 14 | 0 | 0 |
| maps.lights | 74 | 74 | 0 | 5 | 56 | 13 | 0 | 0 |
| maps.decals | 74 | 74 | 0 | 5 | 56 | 13 | 0 | 0 |
| maps.actors | 74 | 74 | 0 | 5 | 56 | 13 | 0 | 0 |
| maps.vehicles | 74 | 74 | 0 | 5 | 56 | 13 | 0 | 0 |
| maps.effects | 74 | 74 | 39 | 6 | 55 | 13 | 0 | 0 |
| scatter | 40 | 40 | 10 | 0 | 30 | 10 | 0 | 0 |
| animtracks | 61 | 61 | 0 | 3 | 49 | 9 | 0 | 0 |
| movies | 116 | 116 | 5,725 | 83 | 2 | 31 | 0 | 0 |
| fonts | 23 | 23 | 36 | 7 | 0 | 16 | 0 | 0 |
| svg | 702 | 702 | 4 | 626 | 17 | 59 | 0 | 0 |
| strings | 2 | 2 | 1 | 2 | 0 | 0 | 0 | 0 |
| data | 1,307 | 83,983 | 2,078 | 113 | 1,164 | 30 | 0 | 0 |
| index | 12 | 12 | 97 | 7 | 1 | 4 | 0 | 0 |
| test | 41 | 41 | 42 | 30 | 0 | 11 | 0 | 0 |

## Owned, by lane

Of each lane’s rows, those its plan did not name are the fifth design’s first finding (`finding: true` in the owners table), given to it when the ledger was first written.

| lane | design | owned rows | of them, the first finding |
| --- | --- | --: | --: |
| E | #848 | 25,891 | 10,082 |
| A | #848 | 8,634 | 51 |
| T | #839 | 1,734 | 1,734 |
| surfaces-Q6 | #844 | 1,394 | 0 |
| O | #848 | 918 | 448 |
| 5 | #812 | 651 | 651 |
| M | #848 | 590 | 537 |
| 4 | #812 | 490 | 490 |
| space | #848 | 414 | 145 |
| X | #836 | 369 | 314 |
| Y | #839 | 310 | 0 |
| B | #839 | 171 | 0 |
| 6 | #812 | 135 | 135 |
| surfaces-Q4 | #844 | 119 | 0 |
| 7 | #812 | 80 | 80 |
| surfaces-Q3 | #844 | 65 | 0 |
| N | #836 | 30 | 0 |
| D | #839 | 27 | 0 |
| surfaces-Q1 | #844 | 22 | 0 |
| W | #839 | 10 | 0 |

## Excluded, by rule

| rule | rows |
| --- | --: |
| era | 11,610 |
| scaffolding | 2,101 |
| licence-pending | 16 |
