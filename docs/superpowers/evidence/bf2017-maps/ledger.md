# The maps’ accuracy ledger

Written by `node scripts/bf2017-map-audit.mjs --all` (the sixth design’s lane maps); do not edit by hand. An E lane runs `node scripts/bf2017-map-audit.mjs <level> --refresh` before its PR, and its row’s drawn columns fill from its pack’s README. `npm run maps:bf2017` checks it in CI.

Of 44 usable maps: 44 have a rulebook, 3 a pack, 3 drawn columns; 27 carry a multiplayer mode in their records.

Columns: in the map / in the pack / drawn (instances: drawn at low·mid·high·ultra, from the pack’s cull row). A map with no pack has its map column and `none`. Modes: in the records · in modes.json · with a rulebook · with hand stages.

| map | kind | pack | sub-levels | instances | lights | decals | effects | actors | vehicles | modes | gaps |
|---|---|---|--:|---|---|---|---|---|---|---|---|
| hoth_01 | multiplayer | hoth | 24 / 24 | 24532 / 6051 / 5815·5815·5815·– | 1234 / 0 / 0 | 0 / 0 / 0 | 648 / 398 / 398 | 28 / 0 / 0 | 31 / 0 / 0 | galacticAssault, hvv, blast, showdown, coop, arcade · galacticAssault, hvv, blast, showdown, coop, arcade · galacticAssault, hvv, blast, showdown, coop, arcade · galacticAssault | – |
| sb_endor_01 | space | sb_endor | 17 / 5 | 4602 / 2515 / 1193·1629·2158·– | 232 / 0 / 0 | 15 / 0 / 0 | 837 / 0 / 0 | 0 / 0 / 0 | 279 / 0 / 0 | starfighter, heroStarfighters, arcade · starfighter, heroStarfighters, arcade · heroStarfighters, arcade, starfighter · starfighter | – |
| sb_kamino_01 | space | sb_kamino | 17 / 5 | 25226 / 13843 / 3093·6764·6935·– | 602 / 0 / 0 | 50 / 0 / 0 | 1103 / 0 / 0 | 13 / 0 / 0 | 252 / 0 / 0 | starfighter, heroStarfighters, arcade · starfighter, heroStarfighters, arcade · heroStarfighters, arcade, starfighter · starfighter | – |
| hoth_02 | multiplayer | – | 16 | 6868 / none | 54 | 0 | 262 | 0 | 20 | supremacy · supremacy · supremacy · – | no pack |
| endor_01 | multiplayer | – | 26 | 18530 / none | 2335 | 23 | 1505 | 536 | 12 | galacticAssault, hvv, blast, showdown, coop, arcade · galacticAssault, hvv, blast, showdown, coop, arcade · galacticAssault, hvv, blast, showdown, coop, arcade · galacticAssault | no pack |
| endor_02 | multiplayer | – | 10 | 9302 / none | 236 | 2 | 260 | 176 | 0 | blast, ewokHunt · blast, ewokHunt · blast, ewokHunt · – | no pack |
| endor_04 | multiplayer | – | 12 | 13424 / none | 281 | 13 | 851 | 464 | 0 | blast, ewokHunt · blast, ewokHunt · blast, ewokHunt · – | no pack |
| tatooine_01 | multiplayer | – | 28 | 20321 / none | 1238 | 1 | 1293 | 134 | 9 | galacticAssault, hvv, blast, supremacy, showdown, jetpackCargo, coop, arcade · galacticAssault, hvv, blast, supremacy, showdown, jetpackCargo, coop, arcade · galacticAssault, hvv, blast, supremacy, showdown, coop, jetpackCargo, arcade · galacticAssault | no pack |
| tatooine_02 | multiplayer | – | 18 | 19715 / none | 895 | 1 | 1197 | 28 | 4 | supremacy · supremacy · supremacy · – | no pack |
| jabbaspalace_01 | multiplayer | – | 18 | 11983 / none | 967 | 0 | 487 | 0 | 1 | hvv, blast, extraction, showdown, coop · hvv, blast, extraction, showdown, coop · hvv, blast, extraction, showdown, coop · – | no pack |
| yavin_01 | multiplayer | – | 28 | 15428 / none | 733 | 7 | 799 | 508 | 16 | galacticAssault, hvv, blast, supremacy, showdown, jetpackCargo, coop, arcade · galacticAssault, hvv, blast, supremacy, showdown, jetpackCargo, coop, arcade · galacticAssault, hvv, blast, supremacy, showdown, coop, jetpackCargo, arcade · galacticAssault | no pack |
| kashyyyk_01 | multiplayer | – | 28 | 15827 / none | 647 | 1 | 365 | 67 | 36 | galacticAssault, hvv, blast, showdown, arcade · galacticAssault, hvv, blast, showdown, arcade · galacticAssault, hvv, blast, showdown, arcade · galacticAssault | no pack |
| kashyyyk_02 | multiplayer | – | 39 | 34010 / none | 718 | 512 | 1855 | 5 | 29 | supremacy, coop · supremacy, coop · supremacy, coop · – | no pack |
| kamino_01 | multiplayer | – | 24 | 14330 / none | 866 | 51 | 532 | 14 | 8 | galacticAssault, hvv, blast, showdown, coop, arcade · galacticAssault, hvv, blast, showdown, coop, arcade · galacticAssault, hvv, blast, showdown, coop, arcade · galacticAssault | no pack |
| kamino_03 | multiplayer | – | 40 | 32337 / none | 976 | 536 | 2044 | 12 | 15 | supremacy, coop · supremacy, coop · supremacy, coop · – | no pack |
| naboo_01 | multiplayer | – | 24 | 18720 / none | 936 | 48 | 365 | 38 | 2 | galacticAssault, hvv, blast, strike, supremacy · galacticAssault, hvv, blast, strike, supremacy · galacticAssault, hvv, blast, strike, supremacy · – | no pack |
| naboo_02 | multiplayer | – | 19 | 3150 / none | 395 | 0 | 128 | 0 | 0 | hvv, blast, showdown · hvv, blast, showdown · hvv, blast, showdown · – | no pack |
| naboo_03 | multiplayer | – | 45 | 36507 / none | 1094 | 563 | 1914 | 2 | 20 | hvv, supremacy, showdown, coop · hvv, supremacy, showdown, coop · hvv, supremacy, showdown, coop · – | no pack |
| geonosis_01 | multiplayer | – | 21 | 9580 / none | 315 | 181 | 642 | 83 | 46 | galacticAssault, hvv, blast, supremacy, showdown, coop · galacticAssault, hvv, blast, supremacy, showdown, coop · galacticAssault, hvv, blast, supremacy, showdown, coop · galacticAssault | no pack |
| geonosis_02 | multiplayer | – | 43 | 28859 / none | 587 | 582 | 1939 | 18 | 23 | hvv, supremacy, showdown, coop · hvv, supremacy, showdown, coop · hvv, supremacy, showdown, coop · – | no pack |
| scarif_02 | multiplayer | – | 24 | 8723 / none | 174 | 0 | 523 | 2 | 3 | hvv, supremacy, showdown, coop · hvv, supremacy, showdown, coop · hvv, supremacy, showdown, coop · – | no pack |
| cloudcity_01 | multiplayer | – | 16 | 5982 / none | 555 | 0 | 328 | 0 | 1 | hvv, blast, extraction, showdown, jetpackCargo · hvv, blast, extraction, showdown, jetpackCargo · hvv, blast, extraction, showdown, jetpackCargo · – | no pack |
| deathstar02_01 | multiplayer | – | 22 | 21722 / none | 1992 | 119 | 640 | 20 | 5 | galacticAssault, hvv, blast, supremacy, showdown, coop, arcade · galacticAssault, hvv, blast, supremacy, showdown, coop, arcade · galacticAssault, hvv, blast, supremacy, showdown, coop, arcade · galacticAssault | no pack |
| felucia_01 | multiplayer | – | 44 | 33133 / none | 724 | 507 | 1958 | 16 | 15 | hvv, supremacy, showdown, coop · hvv, supremacy, showdown, coop · hvv, supremacy, showdown, coop · – | no pack |
| kessel_01 | multiplayer | – | 21 | 6872 / none | 660 | 0 | 424 | 0 | 1 | hvv, blast, extraction, showdown, coop · hvv, blast, extraction, showdown, coop · hvv, blast, extraction, showdown, coop · – | no pack |
| sb_fondor_01 | space | – | 17 | 4528 / none | 995 | 132 | 622 | 0 | 349 | starfighter, heroStarfighters, arcade · starfighter, heroStarfighters, arcade · heroStarfighters, arcade, starfighter · – | no pack |
| sb_droidbattleship_01 | space | – | 17 | 5786 / none | 2542 | 80 | 1978 | 0 | 394 | starfighter, heroStarfighters, arcade · starfighter, heroStarfighters, arcade · heroStarfighters, arcade, starfighter · – | no pack |
| a1_m0lib_ds02 | campaign | – | 6 | 13788 / none | 2863 | 4287 | 726 | 19 | 29 | – · – · – · – | no pack |
| a1_m1end_ds02 | campaign | – | 7 | 918 / none | 63 | 7 | 801 | 35 | 9 | – · – · – · – | no pack |
| a1_m1end_ds04 | campaign | – | 11 | 4114 / none | 0 | 0 | 281 | 0 | 2 | – · – · – · – | no pack |
| a1_m2fon_ds02 | campaign | – | 8 | 8496 / none | 882 | 1494 | 643 | 8 | 161 | – · – · – · – | no pack |
| a1_m3pil_ds02 | campaign | – | 8 | 1537 / none | 136 | 10 | 526 | 1 | 0 | – · – · – · – | no pack |
| a1_m4var_ds02 | campaign | – | 16 | 10122 / none | 809 | 438 | 574 | 526 | 57 | – · – · – · – | no pack |
| a1_m5nab_ds02 | campaign | – | 5 | 3062 / none | 524 | 716 | 832 | 1 | 115 | – · – · – · – | no pack |
| a1_m5nab_ds05 | campaign | – | 3 | 9763 / none | 63 | 56 | 128 | 4 | 12 | – · – · – · – | no pack |
| a2_m2bes_ds02 | campaign | – | 10 | 14693 / none | 1604 | 60 | 591 | 31 | 119 | – · – · – · – | no pack |
| a2_m3sul_ds02 | campaign | – | 10 | 14075 / none | 506 | 160 | 4819 | 12 | 4 | – · – · – · – | no pack |
| a3_m1pil_ds02 | campaign | – | 1 | 85 / none | 0 | 0 | 0 | 0 | 0 | – · – · – · – | no pack |
| a3_m1pil_ds04 | campaign | – | 14 | 14776 / none | 982 | 673 | 736 | 22 | 2 | – · – · – · – | no pack |
| a3_m2pil_ds02 | campaign | – | 13 | 4098 / none | 115 | 2 | 587 | 29 | 52 | – · – · – · – | no pack |
| a3_m3ath_ds02 | campaign | – | 1 | 179 / none | 0 | 0 | 2 | 0 | 0 | – · – · – · – | no pack |
| a3_m4var_ds02 | campaign | – | 26 | 16657 / none | 731 | 715 | 433 | 62 | 83 | – · – · – · – | no pack |
| frontend | menu | – | 7 | 582 / none | 91 | 0 | 43 | 1 | 0 | – · – · – · – | no pack |
| initialexperience_01 | menu | – | 5 | 7564 / none | 708 | 0 | 377 | 0 | 0 | – · – · – · – | no pack |
