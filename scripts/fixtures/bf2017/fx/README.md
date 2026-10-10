# Lane X's emitter fixtures

Real records from the bf2017-assets bucket (`data/<Name>.json.gz`, the dump's EBX as JSON), in the bucket's layout with their rows of `data.tsv`, trimmed to stay small (30 KB):

- `FX/Ambient/_MP/Hoth/FX_Snow_FallingSnow_01_Hoth`, the hangar's falling snow: three of its six emitters (the powder, the thin dust, the debris whose Ultra template differs);
- `FX/Vehicles/EngineExhaust/FX_EngineExhaust_TransportGR75_Prim`, a GR-75's engine, whole;
- `FX/impacts/Blaster/Snow/FX_Impact_Blaster_Snow`, a bolt into snow: three of its seven (the sparks' flash, the smoke spikes, the plume);
- `FX/Vehicles/ConTrails/FX_ConTrail_TieFighter`, a TIE's contrail (the one `EmittableType_Ribbon`), whole.

Each blueprint's `Components` is cut to the emitters kept, and each `UpdateClipScaleData`'s lookup table to four values (it is kept under `raw` only). Nothing else is changed. `scripts/lib/bf2017-emitters.test.mjs` reads them; `node scripts/bf2017-emitters.mjs <effect> --root scripts/fixtures/bf2017/fx` makes tables of them. To rebuild them from the bucket: fetch the records (`node scripts/bf2017-emitters.mjs <effect> --bucket` keeps each under `lab/assets/bf2017/`), then copy and trim the same way.
