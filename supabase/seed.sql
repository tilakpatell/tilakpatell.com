-- The planets a thing may be built on, and the places on them where nothing
-- may be. Written by scripts/supabase-seed.mjs from scripts/fixtures/planets.json; do not edit by hand.
-- Upserts, so it can be applied again after the list changes.

insert into public.planets (id, name, type, seed) values ('tatooine', 'Tatooine', 'desert', '8647508281676935542') on conflict (id) do update set name = excluded.name, type = excluded.type, seed = excluded.seed;
insert into public.planets (id, name, type, seed) values ('hoth', 'Hoth', 'ice', '1223795395') on conflict (id) do update set name = excluded.name, type = excluded.type, seed = excluded.seed;
insert into public.planets (id, name, type, seed) values ('endor', 'Endor', 'forest', '17936333477305376403') on conflict (id) do update set name = excluded.name, type = excluded.type, seed = excluded.seed;
insert into public.planets (id, name, type, seed) values ('yavin', 'Yavin 4', 'forest', '1927579065696738100') on conflict (id) do update set name = excluded.name, type = excluded.type, seed = excluded.seed;
insert into public.planets (id, name, type, seed) values ('bespin', 'Bespin', 'gas', '5485698255689101500') on conflict (id) do update set name = excluded.name, type = excluded.type, seed = excluded.seed;
insert into public.planets (id, name, type, seed) values ('dagobah', 'Dagobah', 'swamp', '1702958522028571207') on conflict (id) do update set name = excluded.name, type = excluded.type, seed = excluded.seed;
insert into public.planets (id, name, type, seed) values ('mustafar', 'Mustafar', 'lava', '1127027023069150644') on conflict (id) do update set name = excluded.name, type = excluded.type, seed = excluded.seed;
insert into public.planets (id, name, type, seed) values ('coruscant', 'Coruscant', 'city', '13422630211582984297') on conflict (id) do update set name = excluded.name, type = excluded.type, seed = excluded.seed;
insert into public.planets (id, name, type, seed) values ('naboo', 'Naboo', 'temperate', '13265591532015992144') on conflict (id) do update set name = excluded.name, type = excluded.type, seed = excluded.seed;
insert into public.planets (id, name, type, seed) values ('kashyyyk', 'Kashyyyk', 'forest', '1526000029368774964') on conflict (id) do update set name = excluded.name, type = excluded.type, seed = excluded.seed;
insert into public.planets (id, name, type, seed) values ('kamino', 'Kamino', 'ocean', '16829253035778520168') on conflict (id) do update set name = excluded.name, type = excluded.type, seed = excluded.seed;
insert into public.planets (id, name, type, seed) values ('geonosis', 'Geonosis', 'desert', '7091074928947837158') on conflict (id) do update set name = excluded.name, type = excluded.type, seed = excluded.seed;
insert into public.planets (id, name, type, seed) values ('scarif', 'Scarif', 'ocean', '6853207733044931143') on conflict (id) do update set name = excluded.name, type = excluded.type, seed = excluded.seed;
insert into public.planets (id, name, type, seed) values ('nevarro', 'Nevarro', 'lava', '13487258476707400418') on conflict (id) do update set name = excluded.name, type = excluded.type, seed = excluded.seed;
insert into public.planets (id, name, type, seed) values ('mandalore', 'Mandalore', 'desert', '13075852038549019104') on conflict (id) do update set name = excluded.name, type = excluded.type, seed = excluded.seed;
insert into public.planets (id, name, type, seed) values ('lothal', 'Lothal', 'temperate', '5339334118646393569') on conflict (id) do update set name = excluded.name, type = excluded.type, seed = excluded.seed;
insert into public.planets (id, name, type, seed) values ('sorgan', 'Sorgan', 'forest', '16486895930758120779') on conflict (id) do update set name = excluded.name, type = excluded.type, seed = excluded.seed;
insert into public.planets (id, name, type, seed) values ('gazorpazorp', 'Gazorpazorp', 'desert', '2431803148514356742') on conflict (id) do update set name = excluded.name, type = excluded.type, seed = excluded.seed;
insert into public.planets (id, name, type, seed) values ('squanch', 'Squanch', 'stylised', '9590996167492738644') on conflict (id) do update set name = excluded.name, type = excluded.type, seed = excluded.seed;
insert into public.planets (id, name, type, seed) values ('birdworld', 'Bird World', 'stylised', '13643440753565578034') on conflict (id) do update set name = excluded.name, type = excluded.type, seed = excluded.seed;
insert into public.planets (id, name, type, seed) values ('gearworld', 'Gear World', 'stylised', '7139150669210096398') on conflict (id) do update set name = excluded.name, type = excluded.type, seed = excluded.seed;
insert into public.planets (id, name, type, seed) values ('pluto', 'Pluto', 'ice', '11588391963419968745') on conflict (id) do update set name = excluded.name, type = excluded.type, seed = excluded.seed;
insert into public.planets (id, name, type, seed) values ('snakeplanet', 'Snake Planet', 'temperate', '9125054182730542529') on conflict (id) do update set name = excluded.name, type = excluded.type, seed = excluded.seed;
insert into public.planets (id, name, type, seed) values ('nuptia', 'Nuptia 4', 'stylised', '1523212486951103434') on conflict (id) do update set name = excluded.name, type = excluded.type, seed = excluded.seed;
insert into public.planets (id, name, type, seed) values ('resort', 'Immortality Field Resort', 'stylised', '7590726331716762136') on conflict (id) do update set name = excluded.name, type = excluded.type, seed = excluded.seed;
insert into public.planets (id, name, type, seed) values ('cronenberg', 'Cronenberg World', 'temperate', '3701917680389589232') on conflict (id) do update set name = excluded.name, type = excluded.type, seed = excluded.seed;
insert into public.planets (id, name, type, seed) values ('purge', 'Purge Planet', 'temperate', '9565460683774068840') on conflict (id) do update set name = excluded.name, type = excluded.type, seed = excluded.seed;
insert into public.planets (id, name, type, seed) values ('cybertron', 'Cybertron', 'metal', '16057552536471276517') on conflict (id) do update set name = excluded.name, type = excluded.type, seed = excluded.seed;
insert into public.planets (id, name, type, seed) values ('middle-earth', 'Middle-earth', 'temperate', '18187206293295419981') on conflict (id) do update set name = excluded.name, type = excluded.type, seed = excluded.seed;
insert into public.planets (id, name, type, seed) values ('caribbean', 'The Caribbean', 'ocean', '11984462318207453812') on conflict (id) do update set name = excluded.name, type = excluded.type, seed = excluded.seed;
insert into public.planets (id, name, type, seed) values ('albuquerque', 'Albuquerque', 'desert', '10048810785060841797') on conflict (id) do update set name = excluded.name, type = excluded.type, seed = excluded.seed;
insert into public.planets (id, name, type, seed) values ('scranton', 'Scranton', 'temperate', '2812984397735158369') on conflict (id) do update set name = excluded.name, type = excluded.type, seed = excluded.seed;
insert into public.planets (id, name, type, seed) values ('avengers', 'Avengers Compound', 'temperate', '18296028802821282410') on conflict (id) do update set name = excluded.name, type = excluded.type, seed = excluded.seed;
insert into public.planets (id, name, type, seed) values ('invincible', 'Invincible', 'temperate', '17049026213794180600') on conflict (id) do update set name = excluded.name, type = excluded.type, seed = excluded.seed;
insert into public.planets (id, name, type, seed) values ('c-137', 'Earth C-137', 'temperate', '16337440380819003650') on conflict (id) do update set name = excluded.name, type = excluded.type, seed = excluded.seed;
insert into public.planets (id, name, type, seed) values ('earth', 'Earth', 'temperate', '6709468555492038659') on conflict (id) do update set name = excluded.name, type = excluded.type, seed = excluded.seed;
insert into public.planets (id, name, type, seed) values ('dot-matrix', 'Dot Matrix', 'stylised', '11991176794051770286') on conflict (id) do update set name = excluded.name, type = excluded.type, seed = excluded.seed;
insert into public.planets (id, name, type, seed) values ('E:1,0:0:0', 'Lithialsur', 'gas', '9214131500749537690') on conflict (id) do update set name = excluded.name, type = excluded.type, seed = excluded.seed;
insert into public.planets (id, name, type, seed) values ('E:1,0:0:1', 'Selimo', 'forest', '9214132600261165901') on conflict (id) do update set name = excluded.name, type = excluded.type, seed = excluded.seed;
insert into public.planets (id, name, type, seed) values ('E:1,0:0:2', 'Ramsaex', 'lava', '9214129301726281268') on conflict (id) do update set name = excluded.name, type = excluded.type, seed = excluded.seed;
insert into public.planets (id, name, type, seed) values ('E:1,0:0:3', 'Taecle', 'ice', '9214130401237909479') on conflict (id) do update set name = excluded.name, type = excluded.type, seed = excluded.seed;
insert into public.planets (id, name, type, seed) values ('E:1,0:0:4', 'Taedixa', 'rock', '9214127102703024846') on conflict (id) do update set name = excluded.name, type = excluded.type, seed = excluded.seed;
insert into public.planets (id, name, type, seed) values ('E:1,0:0:5', 'Deapho', 'ice', '9214128202214653057') on conflict (id) do update set name = excluded.name, type = excluded.type, seed = excluded.seed;
insert into public.planets (id, name, type, seed) values ('E:1,0:0:6', 'Vaemalo', 'desert', '9214124903679768424') on conflict (id) do update set name = excluded.name, type = excluded.type, seed = excluded.seed;
insert into public.planets (id, name, type, seed) values ('E:1,0:1:0', 'Miace', 'desert', '5034333057882641216') on conflict (id) do update set name = excluded.name, type = excluded.type, seed = excluded.seed;
insert into public.planets (id, name, type, seed) values ('E:1,0:1:1', 'Seritiai', 'ocean', '5034334157394269427') on conflict (id) do update set name = excluded.name, type = excluded.type, seed = excluded.seed;
insert into public.planets (id, name, type, seed) values ('E:1,0:1:2', 'Tephaemom', 'rock', '5034335256905897638') on conflict (id) do update set name = excluded.name, type = excluded.type, seed = excluded.seed;
insert into public.planets (id, name, type, seed) values ('E:1,0:2:0', 'Cunano', 'gas', '9427996514885272807') on conflict (id) do update set name = excluded.name, type = excluded.type, seed = excluded.seed;
insert into public.planets (id, name, type, seed) values ('E:1,0:2:1', 'Nole', 'ocean', '9427995415373644596') on conflict (id) do update set name = excluded.name, type = excluded.type, seed = excluded.seed;
insert into public.planets (id, name, type, seed) values ('E:1,0:2:2', 'Niathia', 'rock', '9427998713908529229') on conflict (id) do update set name = excluded.name, type = excluded.type, seed = excluded.seed;

insert into public.pois (id, planet_id, name, x, z, r) values ('hoth:echo-base', 'hoth', 'Echo Base', 1200, -800, 380) on conflict (id) do update set planet_id = excluded.planet_id, name = excluded.name, x = excluded.x, z = excluded.z, r = excluded.r;
