# The Battlefront II (2017) drop: the coverage ledger

Written 2026-10-11 04:00 UTC from the bucket (113,686 objects listed) by `scripts/bf2017-coverage.mjs`. One row per object (a model with all its LOD files; a map and each of its five extras kinds; `data/` by top folder and record type), each in one state: used, owned, excluded, not-uploaded, unowned. `npm run coverage:bf2017` fails while any row is unowned, or owned by a lane that has merged.

**Rows:** 80,837 · used 21,135 · owned 41,865 · excluded 13,709 · not-uploaded 4,128 · unowned 0

## By part

| part | rows | objects | MB | used | owned | excluded | not-uploaded | unowned |
| --- | --: | --: | --: | --: | --: | --: | --: | --: |
| models | 14,471 | 14,471 | 2,563 | 9,583 | 1,990 | 2,898 | 0 | 0 |
| collision | 12,941 | 12,941 | 151 | 0 | 10,297 | 2,644 | 0 | 0 |
| anims | 10,270 | 10,270 | 1,110 | 734 | 8,981 | 555 | 0 | 0 |
| textures | 29,836 | 29,836 | 22,103 | 6,865 | 13,716 | 5,127 | 4,128 | 0 |
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
| fonts | 23 | 23 | 36 | 23 | 0 | 0 | 0 | 0 |
| svg | 702 | 702 | 4 | 626 | 17 | 59 | 0 | 0 |
| strings | 2 | 2 | 1 | 2 | 0 | 0 | 0 | 0 |
| data | 1,307 | 83,983 | 2,078 | 184 | 1,094 | 29 | 0 | 0 |
| index | 12 | 12 | 97 | 7 | 1 | 4 | 0 | 0 |
| test | 41 | 41 | 42 | 30 | 0 | 11 | 0 | 0 |

## Owned, by lane

Of each lane’s rows, those its plan did not name are the fifth design’s first finding (`finding: true` in the owners table), given to it when the ledger was first written.

| lane | design | owned rows | of them, the first finding |
| --- | --- | --: | --: |
| E | #848 | 25,818 | 10,009 |
| A | #848 | 8,634 | 51 |
| T | #839 | 1,732 | 1,732 |
| surfaces-Q6 | #844 | 1,394 | 0 |
| O | #848 | 917 | 448 |
| 5 | #812 | 625 | 625 |
| M | #848 | 588 | 535 |
| 4 | #812 | 488 | 488 |
| X | #836 | 367 | 312 |
| space | #848 | 326 | 68 |
| Y | #839 | 310 | 0 |
| B | #839 | 171 | 0 |
| 6 | #812 | 122 | 122 |
| surfaces-Q4 | #844 | 119 | 0 |
| 7 | #812 | 79 | 79 |
| surfaces-Q3 | #844 | 65 | 0 |
| N | #836 | 30 | 0 |
| D | #839 | 27 | 0 |
| surfaces-Q1 | #844 | 22 | 0 |
| colour | #877 | 21 | 0 |
| W | #839 | 10 | 0 |

## Excluded, by rule

| rule | rows |
| --- | --: |
| era | 11,609 |
| scaffolding | 2,100 |
