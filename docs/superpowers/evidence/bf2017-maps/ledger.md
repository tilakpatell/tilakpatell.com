# The maps’ accuracy ledger

Written by `node scripts/bf2017-map-audit.mjs --all` (the sixth design’s lane maps); do not edit by hand. An E lane runs `node scripts/bf2017-map-audit.mjs <level> --refresh` before its PR, and its row’s drawn columns fill from its pack’s README. `npm run maps:bf2017` checks it in CI.

Of 44 usable maps: 44 have a rulebook, 20 a pack, 20 drawn columns; 2 carry a multiplayer mode in their records.

Columns: in the map / in the pack / drawn (instances: drawn at low·mid·high·ultra, from the pack’s cull row). A map with no pack has its map column and `none`. Modes: in the records · in modes.json · with a rulebook · with hand stages.

| map | kind | pack | sub-levels | instances | lights | decals | effects | actors | vehicles | modes | gaps |
|---|---|---|--:|---|---|---|---|---|---|---|---|
| hoth_01 | multiplayer | hoth | – / 0 | 24532 / 6050 / 5814·5814·5814·5814 | 1234 / 691 / 691 | 0 / 0 / 0 | 648 / 398 / 398 | – / 10 / 10 | – / 27 / 27 | – · galacticAssault, hvv, blast, showdown, coop, arcade · galacticAssault, hvv, blast, showdown, coop, arcade · galacticAssault | – |
| endor_01 | multiplayer | endor | – / 0 | 18530 / 13385 / 3995·7313·9266·13382 | 2335 / 1319 / 1319 | 23 / 11 / 11 | 1505 / 1130 / 1130 | – / 34 / 34 | – / 11 / 11 | – · galacticAssault, hvv, blast, showdown, coop, arcade · galacticAssault, hvv, blast, showdown, coop, arcade · galacticAssault | – |
| tatooine_01 | multiplayer | tatooine | – / 3 | 20321 / 16632 / 13250·15227·16631·– | 1238 / 170 / 170 | 1 / 1 / 1 | 1293 / 383 / 0 | – / 27 / 27 | – / 5 / 5 | – · galacticAssault, hvv, blast, supremacy, showdown, jetpackCargo, coop, arcade · galacticAssault, hvv, blast, supremacy, showdown, coop, jetpackCargo, arcade · galacticAssault | – |
| yavin_01 | multiplayer | yavin | – / 4 | 15428 / 13810 / 3523·4294·7680·– | 733 / 328 / 328 | 7 / 0 / 0 | 799 / 280 / 0 | – / 15 / 15 | – / 7 / 7 | – · galacticAssault, hvv, blast, supremacy, showdown, jetpackCargo, coop, arcade · galacticAssault, hvv, blast, supremacy, showdown, coop, jetpackCargo, arcade · galacticAssault | – |
| kashyyyk_01 | multiplayer | kashyyyk | – / 0 | 15827 / 11391 / 9679·9679·9679·– | 647 / 237 / 237 | 1 / 1 / 1 | 365 / 189 / 0 | – / 0 / 0 | – / 2 / 2 | – · galacticAssault, hvv, blast, showdown, arcade · galacticAssault, hvv, blast, showdown, arcade · galacticAssault | – |
| kamino_01 | multiplayer | kamino | – / 0 | 14330 / 13412 / 1267·1533·1834·– | 866 / 236 / 236 | 51 / 51 / 51 | 532 / 259 / 0 | – / 0 / 0 | – / 0 / 0 | – · galacticAssault, hvv, blast, showdown, coop, arcade · galacticAssault, hvv, blast, showdown, coop, arcade · galacticAssault | – |
| naboo_01 | multiplayer | naboo | – / 3 | 18720 / 17325 / 2137·3177·2631·– | 936 / 189 / 189 | 48 / 48 / 48 | 365 / 197 / 0 | – / 0 / 0 | – / 0 / 0 | – · galacticAssault, hvv, blast, strike, supremacy · galacticAssault, hvv, blast, strike, supremacy · – | – |
| geonosis_01 | multiplayer | geonosis | – / 4 | 9580 / 8112 / 5828·7672·7672·– | 315 / 25 / 25 | 181 / 121 / 121 | 642 / 196 / 0 | – / 0 / 0 | – / 0 / 0 | – · galacticAssault, hvv, blast, supremacy, showdown, coop · galacticAssault, hvv, blast, supremacy, showdown, coop · galacticAssault | – |
| scarif_02 | multiplayer | scarif | – / 3 | 8723 / 4498 / 4345·4380·4380·– | 174 / 16 / 16 | 0 / 0 / 0 | 523 / 12 / 0 | – / 0 / 0 | – / 0 / 0 | – · hvv, supremacy, showdown, coop · hvv, supremacy, showdown, coop · – | – |
| cloudcity_01 | multiplayer | bespin | – / 2 | 5982 / 5719 / 2797·2558·2268·– | 555 / 293 / 293 | 0 / 0 / 0 | 328 / 62 / 0 | – / 0 / 0 | – / 0 / 0 | – · hvv, blast, extraction, showdown, jetpackCargo · hvv, blast, extraction, showdown, jetpackCargo · – | – |
| felucia_01 | multiplayer | felucia | 44 / 44 | 33133 / 10647 / 6989·8001·10604·10604 | 724 / 508 / 508 | 507 / 342 / 342 | 1958 / 1390 / 1390 | 16 / 0 / 0 | 15 / 0 / 0 | hvv, supremacy, showdown, coop · hvv, supremacy, showdown, coop · hvv, supremacy, showdown, coop · – | – |
| kessel_01 | multiplayer | kessel | 21 / 2 | 6872 / 6361 / 2309·3300·6308·6308 | 660 / 374 / 374 | 0 / 0 / 0 | 424 / 338 / 338 | 0 / 0 / 0 | 1 / 0 / 0 | hvv, blast, extraction, showdown, coop · hvv, blast, extraction, showdown, coop · hvv, blast, extraction, showdown, coop · – | – |
| sb_endor_01 | space | sb_endor | – / 5 | 4602 / 2515 / 1346·1556·2238·2331 | 232 / 102 / 102 | 15 / 0 / 0 | 837 / 296 / 296 | – / 0 / 0 | – / 23 / 23 | – · starfighter, heroStarfighters, arcade · heroStarfighters, arcade, starfighter · starfighter | – |
| sb_fondor_01 | space | sb_fondor | – / 5 | 4528 / 2495 / 916·704·1026·2081 | 995 / 758 / 758 | 132 / 98 / 98 | 622 / 386 / 386 | – / 0 / 0 | – / 31 / 31 | – · starfighter, heroStarfighters, arcade · heroStarfighters, arcade, starfighter · starfighter | – |
| sb_kamino_01 | space | sb_kamino | – / 5 | 25226 / 13812 / 9746·9181·9169·13807 | 602 / 267 / 267 | 50 / 24 / 24 | 1103 / 523 / 523 | – / 0 / 0 | – / 0 / 0 | – · starfighter, heroStarfighters, arcade · heroStarfighters, arcade, starfighter · starfighter | – |
| sb_droidbattleship_01 | space | sb_droidbattleship | – / 5 | 5786 / 1878 / 1731·1732·1732·1732 | 2542 / 1558 / 1558 | 80 / 16 / 16 | 1978 / 702 / 702 | – / 0 / 0 | – / 0 / 0 | – · starfighter, heroStarfighters, arcade · heroStarfighters, arcade, starfighter · starfighter | – |
| a1_m2fon_ds02 | campaign | fondor | 8 / 3 | 8496 / 778 / 778·778·778·778 | 882 / 68 / 68 | 1494 / 10 / 10 | 643 / 172 / 172 | 8 / 0 / 0 | 161 / 0 / 0 | – · – · – · – | – |
| a1_m3pil_ds02 | campaign | pillio | 8 / 4 | 1537 / 282 / 267·267·267·267 | 136 / 58 / 58 | 10 / 1 / 1 | 526 / 487 / 487 | 1 / 0 / 0 | 0 / 0 / 0 | – · – · – · – | – |
| a1_m4var_ds02 | campaign | vardos | 16 / 9 | 10122 / 8518 / 3421·4810·6523·8516 | 809 / 785 / 785 | 438 / 124 / 124 | 574 / 574 / 574 | 526 / 0 / 0 | 57 / 0 / 0 | – · – · – · – | – |
| a2_m3sul_ds02 | campaign | sullust | 10 / 10 | 14075 / 14047 / 8161·9473·13563·14044 | 506 / 468 / 468 | 160 / 130 / 130 | 4819 / 4819 / 4819 | 12 / 0 / 0 | 4 / 4 / 4 | – · – · – · – | – |
| hoth_02 | multiplayer | – | – | 6868 / none | 54 | 0 | 262 | – | – | – · supremacy · supremacy · – | no pack |
| endor_02 | multiplayer | – | – | 9302 / none | 236 | 2 | 260 | – | – | – · blast, ewokHunt · blast, ewokHunt · – | no pack |
| endor_04 | multiplayer | – | – | 13424 / none | 281 | 13 | 851 | – | – | – · blast, ewokHunt · blast, ewokHunt · – | no pack |
| tatooine_02 | multiplayer | – | – | 19715 / none | 895 | 1 | 1197 | – | – | – · supremacy · supremacy · – | no pack |
| jabbaspalace_01 | multiplayer | – | – | 11983 / none | 967 | 0 | 487 | – | – | – · hvv, blast, extraction, showdown, coop · hvv, blast, extraction, showdown, coop · – | no pack |
| kashyyyk_02 | multiplayer | – | – | 34010 / none | 718 | 512 | 1855 | – | – | – · supremacy, coop · supremacy, coop · – | no pack |
| kamino_03 | multiplayer | – | – | 32337 / none | 976 | 536 | 2044 | – | – | – · supremacy, coop · supremacy, coop · – | no pack |
| naboo_02 | multiplayer | – | – | 3150 / none | 395 | 0 | 128 | – | – | – · hvv, blast, showdown · hvv, blast, showdown · – | no pack |
| naboo_03 | multiplayer | – | – | 36507 / none | 1094 | 563 | 1914 | – | – | – · hvv, supremacy, showdown, coop · hvv, supremacy, showdown, coop · – | no pack |
| geonosis_02 | multiplayer | – | – | 28859 / none | 587 | 582 | 1939 | – | – | – · hvv, supremacy, showdown, coop · hvv, supremacy, showdown, coop · – | no pack |
| deathstar02_01 | multiplayer | – | – | 21722 / none | 1992 | 119 | 640 | – | – | – · galacticAssault, hvv, blast, supremacy, showdown, coop, arcade · galacticAssault, hvv, blast, supremacy, showdown, coop, arcade · galacticAssault | no pack |
| a1_m0lib_ds02 | campaign | – | – | 13788 / none | 2863 | 4287 | 726 | – | – | – · – · – · – | no pack |
| a1_m1end_ds02 | campaign | – | – | 918 / none | 63 | 7 | 801 | – | – | – · – · – · – | no pack |
| a1_m1end_ds04 | campaign | – | – | 4114 / none | 0 | 0 | 281 | – | – | – · – · – · – | no pack |
| a1_m5nab_ds02 | campaign | – | – | 3062 / none | 524 | 716 | 832 | – | – | – · – · – · – | no pack |
| a1_m5nab_ds05 | campaign | – | – | 9763 / none | 63 | 56 | 128 | – | – | – · – · – · – | no pack |
| a2_m2bes_ds02 | campaign | – | – | 14693 / none | 1604 | 60 | 591 | – | – | – · – · – · – | no pack |
| a3_m1pil_ds02 | campaign | – | – | 85 / none | 0 | 0 | 0 | – | – | – · – · – · – | no pack |
| a3_m1pil_ds04 | campaign | – | 14 | 14776 / none | 982 | 673 | 736 | 22 | 2 | – · – · – · – | no pack |
| a3_m2pil_ds02 | campaign | – | 13 | 4098 / none | 115 | 2 | 587 | 29 | 52 | – · – · – · – | no pack |
| a3_m3ath_ds02 | campaign | – | 1 | 179 / none | 0 | 0 | 2 | 0 | 0 | – · – · – · – | no pack |
| a3_m4var_ds02 | campaign | – | 26 | 16657 / none | 731 | 715 | 433 | 62 | 83 | – · – · – · – | no pack |
| frontend | menu | – | – | 582 / none | 91 | 0 | 43 | – | – | – · – · – · – | no pack |
| initialexperience_01 | menu | – | – | 7564 / none | 708 | 0 | 377 | – | – | – · – · – · – | no pack |
