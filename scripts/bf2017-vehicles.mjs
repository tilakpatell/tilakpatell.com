// Lane V's cast: every vehicle the galaxy takes from Star Wars Battlefront II
// (2017), by the site's kind, with the drop's model and the import's flags,
// so the whole set can be made again (docs/superpowers/evidence/
// bf2017-vehicles/cast.md says where each stands). Each row runs
// scripts/bf2017-import.mjs into catalog/bf2017-vehicles.js; the fetch comes
// first where the drop's files aren't on disk yet.
//
//   node scripts/bf2017-vehicles.mjs [kind,kind…|--group ground|turret|air|cockpit|walker] [--fetch] [--dry]
//
// A walker's rig: --rig keeps the game's skin (the AT-AT's, AT-TE's,
// AT-RT's, droideka's, and the two spider droids', whose skeletons have no
// clips in the drop); --bind skins the AT-ST's rigid composite to the
// skeleton its clips are on. A fighter with a cockpit stands in the frame
// its manifest bounds give (--hull-frame), and its cockpit (`<kind>cockpit`)
// in the same one, so the seat is where the hull's is.

import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from './lib/args.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const V = 'gameplay/vehicles';

// [kind, group, manifest name, what it is, more flags, parts]
export const CAST = [
  // (its LOD1, 61,901 triangles, a hair over the plain's 60,000: the next down is a
  // sixth of its ultra, past ultra.js's four times)
  // (the head's maps are bound inside its shader graph, SS_ATAT_Head, which the drop's GLB does not name: the desktop's shader-depot probe lists them)
  ['atat', 'walker', `${V}/ground/at-at/old/atat_mesh`, 'the AT-AT', ['--rig', '--hero', '--cuts', 'plain=1', '--textures', 'ATAT_Head_Layered=color:Gameplay/Vehicles/Ground/AT-AT/texture/T_ATATHead_01_CW,normal:Gameplay/Vehicles/Ground/AT-AT/texture/T_ATATHead_01_N']],
  ['atst', 'walker', `${V}/ground/atst/atst_static_donotuse_mesh`, 'the AT-ST', ['--hero', '--bind', 'Cinematics/Objects/ATST/ATST_Ske01']],
  ['atte', 'walker', `${V}/ground/at_te/at_te_mesh`, 'the AT-TE', ['--rig', '--hero']],
  ['atrt', 'walker', `${V}/ground/atrt/atrt_mesh`, 'the AT-RT', ['--rig', '--hero']],
  ['droideka', 'walker', `${V}/ground/droideka_01/droideka_01_mesh`, 'a droideka', ['--rig', '--hero']],

  ['aat', 'ground', `${V}/ground/aat/vehicle_ground_aat_static_donotuse_mesh`, 'the AAT battle tanks'],
  ['mtt', 'ground', `${V}/ground/mtt/vehicle_ground_mtt_static_donotuse_mesh`, 'the MTT troop carriers'],
  ['stap', 'ground', `${V}/ground/stap/stap_static_mesh`, 'the STAPs'],
  ['barc', 'ground', `${V}/ground/barc/barc_speeder_static_donotuse_mesh`, 'the BARC speeders'],
  ['speederbike', 'ground', `${V}/ground/74z/speederbike_static_donotuse_mesh`, 'the 74-Z speeder bikes'],
  ['landspeeder', 'ground', `${V}/ground/x34/vehicle_ground_x34_static_donotuse_mesh`, 'Luke’s X-34 landspeeder'],
  ['homingspider', 'ground', `${V}/ground/homingspiderdroid/geo_homingspiderdroid_anim_mesh`, 'the homing spider droids', ['--rig']],
  ['dwarfspider', 'ground', `${V}/ground/dwarfspiderdroid/dwarfspiderdroid_skinned_mesh`, 'the dwarf spider droids', ['--rig']],

  ['eweb', 'turret', `${V}/stationary/e-web/e-web_mesh`, 'the E-Web heavy blasters'],
  ['turret', 'turret', `${V}/stationary/df9/old/df9_01_static_mesh`, 'the DF.9 turrets'],
  ['atgar', 'turret', `${V}/stationary/atgar14fdptower/atgar14fdptower_mesh`, 'the Atgar anti-vehicle towers'],
  ['markii', 'turret', `${V}/stationary/markii/vehicle_markii_deployed_mesh`, 'the Mark II medium repeating blasters'],
  ['turbolaser', 'turret', `${V}/stationary/turbolaser/turretturbolaser_01_mesh`, 'the turbolaser towers'],
  ['aaturret', 'turret', `${V}/stationary/turretantiair_yavin/turretantiair_yavin_livingworld_mesh`, 'the Rebel anti-air turrets'],

  ['snowspeeder', 'air', `${V}/air/airspeeder/airspeeder_static_donotuse_mesh`, 'the snowspeeders', ['--hull-frame']],
  ['xwing', 'air', `${V}/air/xwing_t65/vehicle_air_xwing_t65_static_donotuse_mesh`, 'the T-65 X-wings', ['--hull-frame']],
  ['parkedxwing', 'air', `${V}/air/xwing_red5/xwing_red5_landing_mesh`, 'the parked X-wings (Red Five, gear down)'],
  ['ywing', 'air', `${V}/air/ywing/vehicle_air_ywing_static_donotuse_mesh`, 'the Y-wings', ['--hull-frame']],
  ['awing', 'air', `${V}/air/awing/vehicle_air_awing_01_static_donotuse_mesh`, 'the A-wings', ['--hull-frame']],
  ['uwing', 'air', `${V}/air/uwing/vehicle_air_uwing_static_donotuse_mesh`, 'the U-wings'],
  ['tiefighter', 'air', `${V}/air/tiefighter/vehicle_air_tiefighter_static_donotuse_mesh`, 'the TIE fighters', ['--hull-frame']],
  ['tiebomber', 'air', `${V}/air/tiebomber/vehicle_air_tiebomber_static_donotuse_mesh`, 'the TIE bombers', ['--hull-frame']],
  ['tieinterceptor', 'air', `${V}/air/tieinterceptor/vehicle_air_tieinterceptor_static_donotuse_mesh`, 'the TIE interceptors'],
  ['tieadvanced', 'air', `${V}/air/tieadvancedx1/vehicle_air_tieadvancedx1_static_donotuse_mesh`, 'Vader’s TIE Advanced x1', ['--hull-frame']],
  // (the Falcon's gameplay mesh names no maps in the drop; its landmark, the
  // one parked on the game's maps, has them)
  // (its details and legs are shader graphs of their own, SS_MillenniumFalcon_01_Landmark_Details and _Legs: the maps from the depot probe)
  ['falcon', 'air', `${V}/air/millenniumfalcon/landmark/millenniumfalcon_01_landmark_mesh`, 'the Millennium Falcon', ['--hull-frame', '--hero', '--textures', 'Details_Shader1=color:Gameplay/Vehicles/Air/MillenniumFalcon/T_MillenniumFalconDetails_01_CS,normal:Gameplay/Vehicles/Air/MillenniumFalcon/T_MillenniumFalcon_01_N;Legs_Shader=color:Gameplay/Vehicles/Air/MillenniumFalcon/Landmark/T_MillenniumFalcon_01_Landmark_Legs_CS,normal:Gameplay/Vehicles/Air/MillenniumFalcon/Landmark/T_MillenniumFalcon_01_Landmark_Legs_NMA']],
  ['slave1', 'air', `${V}/air/slave1/vehicle_air_slave1_static_donotuse_mesh`, 'Boba Fett’s Slave I', ['--hull-frame']],
  ['laat', 'air', `${V}/air/laat/vehicle_air_laat_gunship_mesh`, 'the Republic gunships', ['--hull-frame']],
  ['arc170', 'air', `${V}/air/arc170/vehicle_air_arc170_static_donotuse_mesh`, 'the ARC-170s', ['--hull-frame']],
  ['n1fighter', 'air', `${V}/air/n1starfighter/vehicle_air_n1starfighter_static_donotuse_mesh`, 'the N-1 starfighters', ['--hull-frame']],
  ['vwing', 'air', `${V}/air/vwing/vehicle_air_vwing_static_donotuse_mesh`, 'the V-wings', ['--hull-frame']],
  ['vulture', 'air', `${V}/air/vulturedroid/vehicle_air_vulturedroid_static_donotuse_mesh`, 'the vulture droids'],
  ['trifighter', 'air', `${V}/air/droidtrifighter/vehicle_air_droidtrifighter_static_donotuse_mesh`, 'the droid tri-fighters'],
  ['hyena', 'air', `${V}/air/hyenabomber/vehicle_air_hyenabomber_static_donotuse_mesh`, 'the Hyena bombers'],
  ['cloudcar', 'air', `${V}/air/cloudcar/vehicle_air_cloudcar_static_donotuse_mesh`, 'Bespin’s cloud cars', ['--hull-frame']],

  // the cockpits: the game's own interiors, each in its hull's frame, loaded
  // only when someone boards (the rides, the space layer's cockpit view)
  ['snowspeedercockpit', 'cockpit', `${V}/air/airspeeder/airspeeder_cockpit_mesh`, 'the snowspeeder’s cockpit', ['--hull-frame', `${V}/air/airspeeder/airspeeder_static_donotuse_mesh`]],
  ['xwingcockpit', 'cockpit', `${V}/air/xwing_t65/vehicle_air_xwing_t65_cockpit_mesh`, 'the X-wing’s cockpit', ['--hull-frame', `${V}/air/xwing_t65/vehicle_air_xwing_t65_static_donotuse_mesh`]],
  ['ywingcockpit', 'cockpit', `${V}/air/ywing/vehicle_air_ywing_cockpit_mesh`, 'the Y-wing’s cockpit', ['--hull-frame', `${V}/air/ywing/vehicle_air_ywing_static_donotuse_mesh`]],
  ['awingcockpit', 'cockpit', `${V}/air/awing/vehicle_air_awing_cockpit_mesh`, 'the A-wing’s cockpit', ['--hull-frame', `${V}/air/awing/vehicle_air_awing_01_static_donotuse_mesh`]],
  ['tiefightercockpit', 'cockpit', `${V}/air/tiefighter/vehicle_air_tiefighter_cockpit_mesh`, 'the TIE fighter’s cockpit', ['--hull-frame', `${V}/air/tiefighter/vehicle_air_tiefighter_static_donotuse_mesh`]],
  ['tiebombercockpit', 'cockpit', `${V}/air/tiebomber/vehicle_air_tiebomber_cockpit_mesh`, 'the TIE bomber’s cockpit', ['--hull-frame', `${V}/air/tiebomber/vehicle_air_tiebomber_static_donotuse_mesh`]],
  ['tieadvancedcockpit', 'cockpit', `${V}/air/tieadvancedx1/vehicle_air_tieadvanced_cockpit_mesh`, 'the TIE Advanced’s cockpit', ['--hull-frame', `${V}/air/tieadvancedx1/vehicle_air_tieadvancedx1_static_donotuse_mesh`]],
  ['falconcockpit', 'cockpit', `${V}/air/millenniumfalcon/vehicle_air_millenniumfalcon_ot_cockpit_mesh`, 'the Falcon’s cockpit', ['--hull-frame', `${V}/air/millenniumfalcon/landmark/millenniumfalcon_01_landmark_mesh`]],
  ['slave1cockpit', 'cockpit', `${V}/air/slave1/vehicle_air_slave1_cockpit_mesh`, 'Slave I’s cockpit', ['--hull-frame', `${V}/air/slave1/vehicle_air_slave1_static_donotuse_mesh`]],
  ['laatcockpit', 'cockpit', `${V}/air/laat/vehicle_air_laat_cockpit_mesh`, 'the gunship’s cockpit', ['--hull-frame', `${V}/air/laat/vehicle_air_laat_gunship_mesh`]],
  ['arc170cockpit', 'cockpit', `${V}/air/arc170/vehicle_air_arc170_cockpit_mesh`, 'the ARC-170’s cockpit', ['--hull-frame', `${V}/air/arc170/vehicle_air_arc170_static_donotuse_mesh`]],
  ['n1fightercockpit', 'cockpit', `${V}/air/n1starfighter/vehicle_air_n1starfighter_cockpit_mesh`, 'the N-1’s cockpit', ['--hull-frame', `${V}/air/n1starfighter/vehicle_air_n1starfighter_static_donotuse_mesh`]],
  ['vwingcockpit', 'cockpit', `${V}/air/vwing/vehicle_air_vwing_cockpit_mesh`, 'the V-wing’s cockpit', ['--hull-frame', `${V}/air/vwing/vehicle_air_vwing_static_donotuse_mesh`]],
  ['cloudcarcockpit', 'cockpit', `${V}/air/cloudcar/vehicle_air_cloudcar_cockpit_mesh`, 'the cloud car’s cockpit', ['--hull-frame', `${V}/air/cloudcar/vehicle_air_cloudcar_static_donotuse_mesh`]],
];

// a row's arguments for the import (a cockpit has no far cut: it's only ever near)
// (and every one native: the game's own KTX2 maps, untouched but for the mip
// levels each cut drops: the plain cut's colour at 1024 and its normal and
// ORM maps at 512 (the measured high row's ORM; at 1024 Hoth's models came to
// 60.1 MB and Geonosis's to 72.9, over the 60 MB row), the light cut's at 512
// and 256, the ultra cut's every map at the game's own size;
// the caps are lib/bf2017-caps.mjs's native ones, and the files go to the
// bucket: scripts/assets-publish.mjs)
export const NATIVE_ARGS = ['--native', '--tex', '1024', '--maps', '512', '--ultra-tex', '4096', '--ultra-maps', '4096'];
export function importArgs([kind, group, name, as, more = []]) {
  const cuts = group === 'cockpit' ? [] : ['--far', '--ultra'];
  return [name, '--kind', kind, '--as', as, '--asis', '--vehicle', ...NATIVE_ARGS, ...cuts, ...more, '--catalog', 'src/components/galaxy/surface/catalog/bf2017-vehicles.js'];
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2));
  const only = args._[0] ? new Set(String(args._[0]).split(',')) : null;
  const rows = CAST.filter((r) => (!only || only.has(r[0])) && (!args.group || r[1] === args.group));
  for (const row of rows) {
    const a = importArgs(row);
    console.log(`\n${row[0]}: node scripts/bf2017-import.mjs ${a.map((x) => (/[\s’']/.test(x) ? `'${x.replace(/'/g, "'\\''")}'` : x)).join(' ')}`);
    if (args.dry) continue;
    try {
      if (args.fetch) execFileSync('node', ['scripts/bf2017-fetch.mjs', row[2]], { cwd: ROOT, stdio: ['ignore', 'ignore', 'inherit'] });
      const said = execFileSync('node', ['scripts/bf2017-import.mjs', ...a], { cwd: ROOT, encoding: 'utf8' });
      for (const line of said.split('\n')) if (line && !line.startsWith('  map ') && !line.startsWith('next:')) console.log(line);
    } catch (e) {
      console.log(`  failed: ${String(e.stderr || e.message).trim().split('\n').pop()}`);
    }
  }
}
