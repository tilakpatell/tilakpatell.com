# Lane W’s dry runs, 2026-10-11 (a cloud session)

`_source`: `node scripts/desktop/bf2017-<job>.mjs --dry` for each job, in a cloud container with no export, no GPU and no encoders, on the branch `claude/bf2017-w-desktop`; the texture index was the bucket’s `web/textures.jsonl`, fetched into `lab/assets/bf2017/` (git-ignored) with the environment’s keys. Every “no” in a table is what the cloud does not have and the desktop does; every count is the plan’s, from the repository’s data. The paths below are the container’s.

## bf2017 panoramas (dry run: nothing made)

- 15 panoramas and 16 fog gradients, named by 12 light records (src/data/bf2017/light/*.json; the design counted 8 panoramas before the records were all read)
- sizes and formats from lab/assets/bf2017/web/textures.jsonl
- Zstandard on this Node: yes

| needs | ok | detail |
| --- | --- | --- |
| the export | **no** | /root/Downloads/BF2_Extract; fix: set BF2_EXPORT to the export folder (BF2_Extract) |
| the export's texture index | **no** | /root/Downloads/BF2_Extract/web/textures.jsonl; fix: the export writes web/textures.jsonl |
| texconv (DirectXTex) | **no** | texconv; fix: winget install Microsoft.DirectXTex (or put texconv.exe on PATH, or set TEXCONV) |
| python | yes | python3 |
| the export's uploader | **no** | /root/Downloads/BF2_Extract/tool/upload_supabase.py; fix: the export keeps tool/upload_supabase.py |
| the bucket's keys | yes | SUPABASE_URL set, key set |

31 items.

| name | kind | native | sizes | uses |
| --- | --- | --- | --- | --- |
| Levels/Lighting/Endor/Foggy_01/T_Endor_Foggy_01_C | panorama | 4096×1024 | 4096×1024, 2048×512 | endor/foggy |
| Levels/Lighting/Hoth/Sunny_01/T_Hoth_Sunny_02_C | panorama | 8192×2048 | 4096×1024, 2048×512 | hoth/sunny hoth/interior |
| Levels/Lighting/Hoth/Sunset_01/T_Hoth_Sunset_01_Panoramic_C | panorama | 8192×2048 | 4096×1024, 2048×512 | hoth/sunset |
| Levels/Lighting/Kamino/Stormy_01/T_Kamino_Stormy_01_Panoramic_C | panorama | 8192×2048 | 4096×1024, 2048×512 | kamino/stormy kamino/interior |
| Levels/Lighting/Kamino/Stormy_01/T_Kamino_Stormy_02_Panoramic_C | panorama | 8192×2048 | 4096×1024, 2048×512 | sb_kamino/stormy |
| Levels/Lighting/Kashyyyk/Night_01/T_Kashyyyk_Night_01_C | panorama | 4096×1024 | 4096×1024, 2048×512 | endor/night kashyyyk/night |
| Levels/Lighting/Kashyyyk/Overcast_01/T_Kashyyyk_Overcast_Panoramic_01_C | panorama | 8192×2048 | 4096×1024, 2048×512 | kashyyyk/overcast kashyyyk/interior |
| Levels/Lighting/Naboo/Dusk/T_Naboo_01_Dusk_01_C | panorama | 8192×2048 | 4096×1024, 2048×512 | naboo/dusk |
| Levels/Lighting/Tatooine/Sunny/Textures/T_Tatooine_Sunny_06_C | panorama | 8192×2048 | 4096×1024, 2048×512 | tatooine/sunny tatooine/interior |
| Levels/Lighting/Yavin/Sunny_01/T_Yavin_Sunny_01_C | panorama | 8192×2048 | 4096×1024, 2048×512 | yavin/sunny yavin/interior |
| Levels/Lighting/Yavin/Sunset_01/T_Yavin_Sunset_02_Panoramic_C | panorama | 8192×2048 | 4096×1024, 2048×512 | yavin/sunset |
| Levels/SP/A1/M1END/DS02/Lighting/T_A1_M1END_Sky_Sunny_01_C | panorama | 4096×1024 | 4096×1024, 2048×512 | endor/sunny endor/interior |
| S2/Levels/CloudCity_01/textures/T_Sky_Clouds_Dusk_01_01_C | panorama | 8192×4096 | 4096×1024, 2048×512 | bespin/dusk bespin/interior |
| S5_1/Levels/MP/Geonosis_01/Lighting/Textures/T_GEonosis_Sky_01_F_Grade | panorama | 8192×2048 | 4096×1024, 2048×512 | geonosis/cloudy geonosis/interior |
| S9_3/Scarif/Levels/MP/Scarif_02/Lighting/Sky/T_Beach_Sky_Sunset_01_C | panorama | 8192×2048 | 4096×1024, 2048×512 | scarif/sunset |
| Levels/Forest/Lighting/Textures/T_Sky_Forest_02_Fog_Sunny_C | gradient | 512×256 | 512×256 | endor/sunny endor/interior |
| Levels/Lighting/Endor/Foggy_01/T_Endor_Foggy_01_Fog_C | gradient | 512×256 | 512×256 | endor/foggy |
| Levels/Lighting/Endor/night_01/T_Endor_Night_01_Fog_D | gradient | 512×256 | 512×256 | endor/night |
| Levels/Lighting/Hoth/Sunny_01/T_Hoth_Sunny_02_Fog_C | gradient | 512×256 | 512×256 | hoth/sunny hoth/interior |
| Levels/Lighting/Hoth/Sunset_01/T_Hoth_Sunset_01_Fog_C | gradient | 512×256 | 512×256 | hoth/sunset |
| Levels/Lighting/Kamino/Stormy_01/T_Kamino_Stormy_01_Fog_C | gradient | 512×256 | 512×256 | kamino/stormy kamino/interior |
| Levels/Lighting/Kamino/Stormy_01/T_Kamino_Stormy_02_Fog_C | gradient | 512×256 | 512×256 | sb_kamino/stormy |
| Levels/Lighting/Kashyyyk/Night_01/T_Kashyyyk_Night_01_Fog_C | gradient | 512×256 | 512×256 | kashyyyk/night |
| Levels/Lighting/Kashyyyk/Overcast_01/T_Kashyyyk_Overcast_Fog_01_C | gradient | 512×256 | 512×256 | kashyyyk/overcast kashyyyk/interior |
| Levels/Lighting/Naboo/Dusk/T_Naboo_01_Dusk_01_Fog_C | gradient | 512×256 | 512×256 | naboo/dusk |
| Levels/Lighting/Tatooine/Sunny/Textures/T_Tatooine_Sunny_06_Fog_C | gradient | 512×256 | 512×256 | tatooine/sunny tatooine/interior |
| Levels/Lighting/Yavin/Sunny_01/T_Yavin_Sunny_01_Fog_C | gradient | 512×256 | 512×256 | yavin/sunny yavin/interior |
| Levels/Lighting/Yavin/Sunset_01/T_Yavin_Sunset_01_Fog_C | gradient | 512×256 | 512×256 | yavin/sunset |
| S2/Levels/CloudCity_01/textures/T_Clouds_Dusk_Fog_01_C | gradient | 512×256 | 512×256 | bespin/dusk bespin/interior |
| S5_1/Levels/MP/Geonosis_01/Lighting/Textures/T_GEonosis_Fog_01_D_Grade | gradient | 512×256 | 512×256 | geonosis/cloudy geonosis/interior |
| S9_3/Scarif/Levels/MP/Scarif_02/Lighting/Sky/T_Beach_Sky_Sunset_01_Fog_C | gradient | 512×256 | 512×256 | scarif/sunset |
## bf2017 atlases (dry run: nothing made)

- 868 maps in 176 sets (irradiance 176), 4.8 GB of PNG in the export, from lab/assets/bf2017/web/textures.jsonl

| needs | ok | detail |
| --- | --- | --- |
| the export | **no** | /root/Downloads/BF2_Extract; fix: set BF2_EXPORT to the export folder (BF2_Extract) |
| the export's texture index | **no** | /root/Downloads/BF2_Extract/web/textures.jsonl; fix: the export writes web/textures.jsonl |
| python | yes | python3 |
| the export's encoder | **no** | /root/Downloads/BF2_Extract/tool/ktx2_encode.py; fix: the export keeps tool/ktx2_encode.py |
| the export's uploader | **no** | /root/Downloads/BF2_Extract/tool/upload_supabase.py; fix: the export keeps tool/upload_supabase.py |
| texconv (DirectXTex) | **no** | texconv; fix: winget install Microsoft.DirectXTex (or put texconv.exe on PATH, or set TEXCONV) |
| the bucket's keys | yes | SUPABASE_URL set, key set |

868 items.

| name | kind | size | format |
| --- | --- | --- | --- |
| A3/Levels/SP/M2PIL/DS02/Lighting/FL_A3_M2PIL_DS02_Gangers_staticDirectionTextureB | directionB | 2616×2200 | BC7_UNORM |
| A3/Levels/SP/M2PIL/DS02/Lighting/FL_A3_M2PIL_DS02_Gangers_staticDirectionTextureG | directionG | 2616×2200 | BC7_UNORM |
| A3/Levels/SP/M2PIL/DS02/Lighting/FL_A3_M2PIL_DS02_Gangers_staticDirectionTextureR | directionR | 2616×2200 | BC7_UNORM |
| A3/Levels/SP/M2PIL/DS02/Lighting/FL_A3_M2PIL_DS02_Gangers_staticIrradianceTexture | irradiance | 2616×2200 | BC6U_FLOAT |
| A3/Levels/SP/M2PIL/DS02/Lighting/FL_A3_M2PIL_DS02_Gangers_staticSkyVisibilityData | sky | 2616×2200 | BC7_UNORM |
| A3/Levels/SP/M2PIL/DS02/Lighting/FL_A3_M2PIL_DS02_S0200_Outdoor_staticDirectionTextureB | directionB | 2444×2580 | BC7_UNORM |
| A3/Levels/SP/M2PIL/DS02/Lighting/FL_A3_M2PIL_DS02_S0200_Outdoor_staticDirectionTextureG | directionG | 2444×2580 | BC7_UNORM |
| A3/Levels/SP/M2PIL/DS02/Lighting/FL_A3_M2PIL_DS02_S0200_Outdoor_staticDirectionTextureR | directionR | 2444×2580 | BC7_UNORM |
| A3/Levels/SP/M2PIL/DS02/Lighting/FL_A3_M2PIL_DS02_S0200_Outdoor_staticIrradianceTexture | irradiance | 2444×2580 | BC6U_FLOAT |
| A3/Levels/SP/M2PIL/DS02/Lighting/FL_A3_M2PIL_DS02_S0200_Outdoor_staticSkyVisibilityData | sky | 2444×2580 | BC7_UNORM |
| A3/Levels/SP/M2PIL/DS02/Lighting/FL_A3_M2PIL_DS02_S0300_CavernsCreatures_staticDirectionTextureB | directionB | 2200×2096 | BC7_UNORM |
| A3/Levels/SP/M2PIL/DS02/Lighting/FL_A3_M2PIL_DS02_S0300_CavernsCreatures_staticDirectionTextureG | directionG | 2200×2096 | BC7_UNORM |
| A3/Levels/SP/M2PIL/DS02/Lighting/FL_A3_M2PIL_DS02_S0300_CavernsCreatures_staticDirectionTextureR | directionR | 2200×2096 | BC7_UNORM |
| A3/Levels/SP/M2PIL/DS02/Lighting/FL_A3_M2PIL_DS02_S0300_CavernsCreatures_staticIrradianceTexture | irradiance | 2200×2096 | BC6U_FLOAT |
| A3/Levels/SP/M2PIL/DS02/Lighting/FL_A3_M2PIL_DS02_S0300_CavernsCreatures_staticSkyVisibilityData | sky | 2200×2096 | BC7_UNORM |
| A3/Levels/SP/M2PIL/DS02/Lighting/FL_A3_M2PIL_DS02_SpeederBike_staticDirectionTextureB | directionB | 3624×3064 | BC7_UNORM |
| A3/Levels/SP/M2PIL/DS02/Lighting/FL_A3_M2PIL_DS02_SpeederBike_staticDirectionTextureG | directionG | 3624×3064 | BC7_UNORM |
| A3/Levels/SP/M2PIL/DS02/Lighting/FL_A3_M2PIL_DS02_SpeederBike_staticDirectionTextureR | directionR | 3624×3064 | BC7_UNORM |
| A3/Levels/SP/M2PIL/DS02/Lighting/FL_A3_M2PIL_DS02_SpeederBike_staticIrradianceTexture | irradiance | 3624×3064 | BC6U_FLOAT |
| A3/Levels/SP/M2PIL/DS02/Lighting/FL_A3_M2PIL_DS02_SpeederBike_staticSkyVisibilityData | sky | 3624×3064 | BC7_UNORM |
| A3/Levels/SP/M2PIL/DS02/Lighting/FL_A3_M2PIL_DS02_Terrain_staticDirectionTextureB | directionB | 512×384 | BC7_UNORM |
| A3/Levels/SP/M2PIL/DS02/Lighting/FL_A3_M2PIL_DS02_Terrain_staticDirectionTextureG | directionG | 512×384 | BC7_UNORM |
| A3/Levels/SP/M2PIL/DS02/Lighting/FL_A3_M2PIL_DS02_Terrain_staticDirectionTextureR | directionR | 512×384 | BC7_UNORM |
| A3/Levels/SP/M2PIL/DS02/Lighting/FL_A3_M2PIL_DS02_Terrain_staticIrradianceTexture | irradiance | 512×384 | BC6U_FLOAT |
| A3/Levels/SP/M2PIL/DS02/Lighting/FL_A3_M2PIL_DS02_Terrain_staticSkyVisibilityData | sky | 512×384 | BC7_UNORM |
| A3/Levels/SP/M3ATH/DS02/Lighting/FL_A3_M3ATH_DS02_Tunnels_staticDirectionTextureB | directionB | 4×4 | BC7_UNORM |
| A3/Levels/SP/M3ATH/DS02/Lighting/FL_A3_M3ATH_DS02_Tunnels_staticDirectionTextureG | directionG | 4×4 | BC7_UNORM |
| A3/Levels/SP/M3ATH/DS02/Lighting/FL_A3_M3ATH_DS02_Tunnels_staticDirectionTextureR | directionR | 4×4 | BC7_UNORM |
| A3/Levels/SP/M3ATH/DS02/Lighting/FL_A3_M3ATH_DS02_Tunnels_staticIrradianceTexture | irradiance | 4×4 | BC6U_FLOAT |
| A3/Levels/SP/M3ATH/DS02/Lighting/FL_A3_M3ATH_DS02_Tunnels_staticSkyVisibilityData | sky | 4×4 | BC7_UNORM |
| A3/Levels/SP/M3ATH/DS02/Lighting/FL_A3_M3ATH_DS02_staticDirectionTextureB | directionB | 136×264 | BC7_UNORM |
| A3/Levels/SP/M3ATH/DS02/Lighting/FL_A3_M3ATH_DS02_staticDirectionTextureG | directionG | 136×264 | BC7_UNORM |
| A3/Levels/SP/M3ATH/DS02/Lighting/FL_A3_M3ATH_DS02_staticDirectionTextureR | directionR | 136×264 | BC7_UNORM |
| A3/Levels/SP/M3ATH/DS02/Lighting/FL_A3_M3ATH_DS02_staticIrradianceTexture | irradiance | 136×264 | BC6U_FLOAT |
| A3/Levels/SP/M3ATH/DS02/Lighting/FL_A3_M3ATH_DS02_staticSkyVisibilityData | sky | 136×264 | BC7_UNORM |
| A3/Levels/SP/M4VAR/DS02/Lighting/FL_A3M4VAR_CityVistas_staticDirectionTextureB | directionB | 2468×2072 | BC7_UNORM |
| A3/Levels/SP/M4VAR/DS02/Lighting/FL_A3M4VAR_CityVistas_staticDirectionTextureG | directionG | 2468×2072 | BC7_UNORM |
| A3/Levels/SP/M4VAR/DS02/Lighting/FL_A3M4VAR_CityVistas_staticDirectionTextureR | directionR | 2468×2072 | BC7_UNORM |
| A3/Levels/SP/M4VAR/DS02/Lighting/FL_A3M4VAR_CityVistas_staticIrradianceTexture | irradiance | 2468×2072 | BC6U_FLOAT |
| A3/Levels/SP/M4VAR/DS02/Lighting/FL_A3M4VAR_CityVistas_staticSkyVisibilityData | sky | 2468×2072 | BC7_UNORM |
| … 828 more |  |  |  |
## bf2017 textures (dry run: nothing made)

- 3301 rows not uploaded (docs/superpowers/evidence/bf2017-coverage/ledger.json.gz, less the atlases and the sequel era's)
- 3301 have a file in the index (lab/assets/bf2017/web/textures.jsonl); 0 have none
- once uploaded: 3296 owned (O 1437, M 903, T 389, X 241, E 144, 4 79), 5 with no lane, 0 owned by a lane that has merged (none): the coverage check fails on both kinds until `scripts/lib/bf2017-owners.mjs` names a lane that will use them
- the most, by folder: UI/Bitmaps 748, Objects/Nature 673, Objects/Architecture 236, Objects/Props 216, FX/Textures 150, Characters/Heads 127

| needs | ok | detail |
| --- | --- | --- |
| the export | **no** | /root/Downloads/BF2_Extract; fix: set BF2_EXPORT to the export folder (BF2_Extract) |
| the export's texture index | **no** | /root/Downloads/BF2_Extract/web/textures.jsonl; fix: the export writes web/textures.jsonl |
| python | yes | python3 |
| the export's encoder | **no** | /root/Downloads/BF2_Extract/tool/ktx2_encode.py; fix: the export keeps tool/ktx2_encode.py |
| the export's uploader | **no** | /root/Downloads/BF2_Extract/tool/upload_supabase.py; fix: the export keeps tool/upload_supabase.py |
| the uploader's record | **no** | /root/Downloads/BF2_Extract/web_opt/upload_state.tsv; fix: the uploader keeps web_opt/upload_state.tsv (the ledger is made again from it) |
| the bucket's keys | yes | SUPABASE_URL set, key set |

3301 items.

| name | size | format | class | owner |
| --- | --- | --- | --- | --- |
| A3/FX/Decals/VolumeDecals/Textures/DecalCracksVardos_02_CS | 2048×2048 | BC7_SRGB | color | surfaces-Q4 |
| A3/FX/Textures/Gradients/T_Hosnian_Beam_02_M | 512×512 | BC7_SRGB | color | X |
| A3/FX/Decals/VolumeDecals/Textures/DecalDamageVardos_02_CS | 2048×2048 | BC7_SRGB | color | surfaces-Q4 |
| A3/FX/Decals/VolumeDecals/Textures/T_PaintStripes_01_M | 2048×2048 | BC7_UNORM | attrib | surfaces-Q4 |
| A3/FX/Decals/VolumeDecals/Textures/DecalDamageVardos_02_NA | 2048×2048 | BC7_UNORM | attrib | surfaces-Q4 |
| A3/FX/Decals/VolumeDecals/Textures/DecalCracksVardos_02_NA | 2048×2048 | BC7_UNORM | attrib | surfaces-Q4 |
| A3/Gameplay/Vehicles/Air/ARC170/T_ARC170_FuseLage_Gleb_CS_01 | 2048×2048 | BC7_SRGB | color | 4 |
| A3/Gameplay/Vehicles/Air/ARC170/T_ARC170_Wings_Gleb_NMA_01 | 2048×2048 | BC7_UNORM | attrib | 4 |
| A3/Gameplay/Vehicles/Air/ARC170/T_ARC170_Wings_Gleb_01_CS | 2048×2048 | BC7_SRGB | color | 4 |
| A3/Gameplay/Vehicles/Air/N1Starfighter/T_N1StarfighterGleb_01_NMA | 2048×2048 | BC7_UNORM | attrib | 4 |
| A3/Gameplay/Vehicles/Air/N1Starfighter/T_N1StarfighterGleb_01_CS | 2048×2048 | BC7_SRGB | color | 4 |
| A3/Gameplay/Vehicles/Air/VWingGleb/T_VWingGleb_01_NMA | 2048×2048 | BC7_UNORM | attrib | 4 |
| A3/Gameplay/Vehicles/Air/VWingGleb/T_VWingGleb_01_CS | 2048×2048 | BC7_SRGB | color | 4 |
| A3/Gameplay/Vehicles/Air/ARC170/T_ARC170_FuseLage_Gleb_NMA_01 | 2048×2048 | BC7_UNORM | attrib | 4 |
| A3/Levels/SP/M2PIL/DS02/Lighting/T_PillioDead_Sunny_01_Fog_C | 512×256 | R32G32B32A32_FLOAT | attrib | E |
| A3/Levels/SP/M4VAR/DS02/Lighting/T_Sky_Clouds_DawnStorm_04_02_Fog_C | 512×256 | BC6U_FLOAT | attrib | E |
| A3/Levels/SP/M4VAR/DS02/Lighting/T_Sky_Clouds_DawnStorm_05_02_FogTick_C | 512×256 | BC6U_FLOAT | attrib | E |
| A3/Levels/SP/M4VAR/DS02/Lighting/T_Sky_Clouds_DawnStorm_05_02_Fog_C | 512×256 | BC6U_FLOAT | attrib | E |
| A3/Levels/SP/M4VAR/DS02/Lighting/T_Sky_Clouds_DawnStorm_CloudShadow_04_02_C | 2048×2048 | BC1_UNORM | attrib | E |
| A3/Levels/SP/M4VAR/DS02/Lighting/T_Sky_Clouds_DawnStorm_04_02_C | 8192×2048 | BC6U_FLOAT | attrib | E |
| A3/Levels/SP/M4VAR/TerrainTextures/T_Vardos02_AshBase_01_NOH | 2048×2048 | BC7_UNORM | attrib | E |
| A3/Levels/SP/M4VAR/DS02/Lighting/T_Sky_Clouds_DawnStorm_05_02_C | 8192×2048 | BC6U_FLOAT | attrib | E |
| A3/Levels/SP/M4VAR/TerrainTextures/T_Vardos02_AshChunkyWind_01_NOH | 2048×2048 | BC7_UNORM | attrib | E |
| A3/Levels/SP/M4VAR/TerrainTextures/T_Vardos02_AshChunkyWind_01_BCS | 2048×2048 | BC7_SRGB | color | E |
| A3/Levels/SP/M4VAR/TerrainTextures/T_Vardos02_AshRough_01_BCS | 2048×2048 | BC7_SRGB | color | E |
| A3/Levels/SP/M4VAR/TerrainTextures/T_Vardos02_AshRough_Puddle_01_BCS | 2048×2048 | BC7_SRGB | color | E |
| A3/Levels/SP/M4VAR/TerrainTextures/T_Vardos02_AshRough_Puddle_01_NOH | 2048×2048 | BC7_UNORM | attrib | E |
| A3/Levels/SP/M4VAR/TerrainTextures/T_Vardos02_AshTrampled_01_NOH | 2048×2048 | BC7_UNORM | attrib | E |
| A3/Levels/SP/M4VAR/TerrainTextures/T_Vardos02_AshBase_01_BCS | 2048×2048 | BC7_SRGB | color | E |
| A3/Levels/SP/M4VAR/TerrainTextures/T_Vardos02_AshTrampled_01_BCS | 2048×2048 | BC7_SRGB | color | E |
| A3/Levels/SP/M4VAR/TerrainTextures/T_Vardos02_AshRough_01_NOH | 2048×2048 | BC7_UNORM | attrib | E |
| A3/Levels/SP/M4VAR/TerrainTextures/T_Vardos02_MarbleTiles_01_NOH | 2048×2048 | BC7_UNORM | attrib | E |
| A3/Levels/SP/M4VAR/TerrainTextures/T_Vardos02_AshTrampled_Puddle_01_NOH | 2048×2048 | BC7_UNORM | attrib | E |
| A3/Levels/SP/M4VAR/TerrainTextures/T_Vardos02_AshTrampled_Puddle_01_BCS | 2048×2048 | BC7_SRGB | color | E |
| A3/Levels/SP/M4VAR/TerrainTextures/T_Vardos02_Roads_01_NOH | 2048×2048 | BC7_UNORM | attrib | E |
| A3/Levels/SP/M4VAR/TerrainTextures/T_Vardos02_SideWalks_01_NOH | 2048×2048 | BC7_UNORM | attrib | E |
| A3/Levels/SP/M5STA/DS01/T_VardosGroundVista_01_C | 2048×2048 | BC7_UNORM | attrib | E |
| A3/Levels/SP/M5STA/DS01/T_VardosGroundVista_01_N | 2048×2048 | BC7_UNORM | attrib | E |
| A3/Objects/Architecture/Vardos_02/Decals/T_Decal_GlebLogo_01_RGBA | 16×16 | BC7_SRGB | color | O |
| A3/Objects/Architecture/Vardos_02/Decals/T_Decal_GlebLogo_02_RGBA | 16×16 | BC7_SRGB | color | O |
| … 3261 more |  |  |  |  |
## bf2017 uastc (dry run: nothing made)

- 220 colour maps over 5 packs (public/models/galaxy/bf2017/levels/*/level.json `tex`, slugs ending _c or _cs)
- 220 with a master in the index; 0 without; 9 with more than one file of that name (the first taken)
- kept when UASTC beats the served ETC1S by 3 dB or more

| needs | ok | detail |
| --- | --- | --- |
| the export | **no** | /root/Downloads/BF2_Extract; fix: set BF2_EXPORT to the export folder (BF2_Extract) |
| the export's texture index | **no** | /root/Downloads/BF2_Extract/web/textures.jsonl; fix: the export writes web/textures.jsonl |
| toktx (KTX-Software) | **no** | toktx; fix: winget install KhronosGroup.KTX-Software (toktx on PATH), or set TOKTX |
| python | yes | python3 |
| the export's uploader | **no** | /root/Downloads/BF2_Extract/tool/upload_supabase.py; fix: the export keeps tool/upload_supabase.py |
| the bucket's keys | yes | SUPABASE_URL set, key set |

220 items.

| name | master | size | file |
| --- | --- | --- | --- |
| hoth/t_arcticbase_rock_large_01_c | 2048×2048 | 2048 | textures/objects/nature/arctic/_arcticbase/arcticbase_rock_large_01/t_arcticbase_rock_large_01_c.png |
| hoth/t_arcticbase_rock_large_02_c | 512×512 | 512 | textures/objects/nature/arctic/_arcticbase/arcticbase_rock_large_02/t_arcticbase_rock_large_02_c.png |
| hoth/t_arcticbase_rock_large_03_c | 1024×1024 | 1024 | textures/objects/nature/arctic/_arcticbase/arcticbase_rock_large_03/t_arcticbase_rock_large_03_c.png |
| hoth/t_arcticbase_rock_medium_01_c | 512×512 | 512 | textures/objects/nature/arctic/_arcticbase/arcticbase_rock_medium_01/t_arcticbase_rock_medium_01_c.png |
| hoth/t_arcticbase_rock_medium_02_c | 512×512 | 512 | textures/objects/nature/arctic/_arcticbase/arcticbase_rock_medium_02/t_arcticbase_rock_medium_02_c.png |
| hoth/t_arcticbase_rock_medium_03_c | 1024×1024 | 1024 | textures/objects/nature/arctic/_arcticbase/arcticbase_rock_medium_03/t_arcticbase_rock_medium_03_c.png |
| hoth/t_arcticbase_rock_medium_04_c | 1024×512 | 1024 | textures/objects/nature/arctic/_arcticbase/arcticbase_rock_medium_04/t_arcticbase_rock_medium_04_c.png |
| hoth/t_arcticbase_rock_medium_05_c | 1024×1024 | 1024 | textures/objects/nature/arctic/_arcticbase/arcticbase_rock_medium_05/t_arcticbase_rock_medium_05_c.png |
| hoth/t_arcticbase_rock_small_02_c | 256×256 | 256 | textures/objects/nature/arctic/_arcticbase/arcticbase_rock_small_02/t_arcticbase_rock_small_02_c.png |
| hoth/t_arcticbase_rock_small_03_c | 256×256 | 256 | textures/objects/nature/arctic/_arcticbase/arcticbase_rock_small_03/t_arcticbase_rock_small_03_c.png |
| hoth/t_arcticbase_rockwall_huge_01_c | 1024×512 | 1024 | textures/objects/nature/arctic/_arcticbase/arcticbase_bd_rockwall_huge_01/t_arcticbase_rockwall_huge_01_c.png |
| hoth/t_arcticbase_rockwall_large_01_02_c | 2048×1024 | 2048 | textures/objects/nature/arctic/_arcticbase/arcticbase_rockwall_large_01/t_arcticbase_rockwall_large_01_02_c.png |
| hoth/t_arcticbase_rockwall_large_03_c | 2048×1024 | 2048 | textures/objects/nature/arctic/_arcticbase/arcticbase_rockwall_large_03/t_arcticbase_rockwall_large_03_c.png |
| hoth/t_arcticbase_rockwall_large_04_c | 2048×2048 | 2048 | textures/objects/nature/arctic/_arcticbase/arcticbase_rockwall_large_04/t_arcticbase_rockwall_large_04_c.png |
| hoth/t_arcticbase_rockwall_large_06_c | 2048×1024 | 2048 | textures/objects/nature/arctic/_arcticbase/arcticbase_rockwall_large_06/t_arcticbase_rockwall_large_06_c.png |
| hoth/t_arcticbase_rockwall_large_07_c | 2048×1024 | 2048 | textures/objects/nature/arctic/_arcticbase/arcticbase_rockwall_large_07/t_arcticbase_rockwall_large_07_c.png |
| hoth/t_arcticbase_rockwallmossy_large_01_c | 2048×1024 | 2048 | textures/objects/nature/arctic/_arcticbase/arcticbase_rockwallmossy_large_01/t_arcticbase_rockwallmossy_large_01_c.png |
| hoth/t_arcticbase_rockwallmossy_large_02_c | 2048×1024 | 2048 | textures/objects/nature/arctic/_arcticbase/arcticbase_rockwallmossy_large_02/t_arcticbase_rockwallmossy_large_02_c.png |
| hoth/t_arcticbase_rockwallmossy_large_03_c | 2048×1024 | 2048 | textures/objects/nature/arctic/_arcticbase/arcticbase_rockwallmossy_large_03/t_arcticbase_rockwallmossy_large_03_c.png |
| hoth/t_arcticbase_rockwallmossy_medium_01_c | 2048×2048 | 2048 | textures/objects/nature/arctic/_arcticbase/arcticbase_rockwallmossy_medium_01/t_arcticbase_rockwallmossy_medium_01_c.png |
| hoth/t_arcticbase_rockwallmossy_medium_02_c | 2048×1024 | 2048 | textures/objects/nature/arctic/_arcticbase/arcticbase_rockwallmossy_medium_02/t_arcticbase_rockwallmossy_medium_02_c.png |
| hoth/t_at-at_belly_01_cs | 2048×2048 | 2048 | textures/gameplay/vehicles/ground/at-at/texture/t_at-at_belly_01_cs.png |
| hoth/t_at-at_chassi_01_cs | 2048×2048 | 2048 | textures/gameplay/vehicles/ground/at-at/texture/t_at-at_chassi_01_cs.png |
| hoth/t_at-at_feet_01_cs | 2048×2048 | 2048 | textures/gameplay/vehicles/ground/at-at/texture/t_at-at_feet_01_cs.png |
| hoth/t_at-at_head_01_cs | 2048×2048 | 2048 | textures/gameplay/vehicles/ground/at-at/texture/t_at-at_head_01_cs.png |
| hoth/t_at-at_leg_01_cs | 2048×2048 | 2048 | textures/gameplay/vehicles/ground/at-at/texture/t_at-at_leg_01_cs.png |
| hoth/t_box_m_01_a_cs | 512×1024 | 1024 | textures/objects/props/objectsets/_rebelalliance/box_m_01/t_box_m_01_a_cs.png |
| hoth/t_box_m_02_cs | 512×1024 | 1024 | textures/objects/props/objectsets/_rebelalliance/box_m_02/t_box_m_02_cs.png |
| hoth/t_box_s_04_cs | 512×1024 | 1024 | textures/objects/props/objectsets/_rebelalliance/box_s_04/t_box_s_04_cs.png |
| hoth/t_boxsmall_01_cs | 512×1024 | 1024 | textures/objects/props/objectsets/_rebelalliance/boxsmall_01/t_boxsmall_01_cs.png |
| hoth/t_cableaccessories_01_c | 1024×1024 | 1024 | textures/tobedeleted_tempintransition/objects/props/_commontextures/cabletextures/t_cableaccessories_01_c.png |
| hoth/t_container_l_01_cs | 2048×2048 | 2048 | textures/objects/props/objectsets/_rebelalliance/container_l_01/t_container_l_01_cs.png |
| hoth/t_container_s_01_cs | 512×256 | 512 | textures/objects/props/objectsets/_galacticempire/container_s_01/t_container_s_01_cs.png |
| hoth/t_corvettecr90_01_cs | 2048×2048 | 2048 | textures/objects/props/landmarks/_rebelalliance/bd_corvettecr90_01/t_corvettecr90_01_cs.png |
| hoth/t_doorsideentranceframe_01_cs | 256×1024 | 1024 | textures/objects/architecture/hoth/corridorsystem_01/new/t_doorsideentranceframe_01_cs.png |
| hoth/t_floorboards_01_cs | 1024×512 | 1024 | textures/objects/props/objectsets/_rebelalliance/floorboards_01/t_floorboards_01_cs.png |
| hoth/t_frigatenebulonb_01_cs | 2048×2048 | 2048 | textures/objects/props/landmarks/_rebelalliance/bd_frigatenebulonb_01/t_frigatenebulonb_01_cs.png |
| hoth/t_gasflask_01_cs | 256×256 | 256 | textures/objects/props/objectsets/_rebelalliance/gasflask_01/t_gasflask_01_cs.png |
| hoth/t_glass_01_cs | 1024×1024 | 1024 | textures/tobedeleted_tempintransition/objects/props/_commontextures/t_glass_01_cs.png |
| hoth/t_hangarsystem_blastdoor_01_c | 1024×2048 | 2048 | textures/objects/architecture/hoth/hangarsystem_01/new/t_hangarsystem_blastdoor_01_c.png |
| … 180 more |  |  |  |
## bf2017 depots (dry run: nothing made)

- no probe here (/root/Downloads/BF2_Extract/maps_work/shaderdepots.jsonl): it is the desktop's
- writes src/data/bf2017/shaderParams.json through scripts/bf2017-shader-names.mjs --depots

| needs | ok | detail |
| --- | --- | --- |
| the depot probe | **no** | /root/Downloads/BF2_Extract/maps_work/shaderdepots.jsonl; fix: the exporter's depot probe writes maps_work/shaderdepots.jsonl (tool/bf2export.csproj) |
| the bucket's keys | yes | SUPABASE_URL set, key set |

1 item.

| name | file |
| --- | --- |
| shaderdepots | /root/Downloads/BF2_Extract/maps_work/shaderdepots.jsonl |
## bf2017 gate (dry run: nothing made)

- legs: d3d11, webgpu (ANGLE d3d11; webgpu adds ?gpu=webgpu)
- held to the ultra row (src/lib/budgets.js) and 16.7 ms p95 at 2,560 × 1,440
- baseline: none yet (the d3d11 leg makes lab/baseline/surface-ultra.json)

| needs | ok | detail |
| --- | --- | --- |
| Chrome (the real GPU, WebGPU) | yes | /opt/pw-browsers/chromium-1194/chrome-linux/chrome |

17 items.

| name | legs |
| --- | --- |
| tatooine | d3d11, webgpu |
| hoth | d3d11, webgpu |
| endor | d3d11, webgpu |
| yavin | d3d11, webgpu |
| bespin | d3d11, webgpu |
| dagobah | d3d11, webgpu |
| mustafar | d3d11, webgpu |
| coruscant | d3d11, webgpu |
| naboo | d3d11, webgpu |
| kashyyyk | d3d11, webgpu |
| kamino | d3d11, webgpu |
| geonosis | d3d11, webgpu |
| scarif | d3d11, webgpu |
| nevarro | d3d11, webgpu |
| mandalore | d3d11, webgpu |
| lothal | d3d11, webgpu |
| sorgan | d3d11, webgpu |
