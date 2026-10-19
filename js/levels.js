// Stage data. Enemy waves trigger when the camera reaches `at`. Every stage is harder than the last:
// stats are scaled by STAGES[i].diff on top of each enemy's base stats, waves get bigger, more enemies attack at once.
const L = 'L', R = 'R';
const T = 'T'; // side T = drops in from above (lands with a thud)
const w = (t, side = R, n = 1, o = {}) => Array.from({ length: n }, (_, i) => ({ t, side: side === T ? T : i % 2 ? (side === R ? L : R) : side, ...o }));
const elite = (t, side = R) => w(t, side, 1, { elite: true });   // 1.7x hp, hits harder, gold ring; drops a big banana + gem
const mini = (t, side = R) => w(t, side, 1, { mini: true });     // mini-boss: 2.4x hp, own health bar; drops a big banana, a gem and RAGE
const cat = (...a) => a.flat();

/** kind: melee | lunge (dash kick) | ranged. proj: net | dart | bolt. `reach` = how far the hit extends in front. */
export const ENEMIES = {
  // 1: zoo
  keeper_net:  { name: 'Net Keeper',   sheet: 'keeper_net',  hp: 30, speed: 34, dmg: 6,  pts: 100, kind: 'melee',  reach: 30 },
  keeper_dart: { name: 'Dart Keeper',  sheet: 'keeper_dart', hp: 26, speed: 30, dmg: 6,  pts: 150, kind: 'ranged', proj: 'dart', range: 120 },
  keeper_stun: { name: 'Stun Keeper',  sheet: 'keeper_stun', hp: 36, speed: 38, dmg: 7,  pts: 150, kind: 'melee',  reach: 28 },
  // thrown-object enemies: lob a projectile that lands on the hero's spot after ~0.7s (a red marker shows where)
  keeper_toss: { name: 'Bucket Keeper', sheet: 'keeper_net',  hp: 28, speed: 30, dmg: 7,  pts: 160, kind: 'ranged', proj: 'bucket', lob: true, range: 105 },
  cop_brick:   { name: 'Brick Cop',     sheet: 'cop_baton',   hp: 44, speed: 34, dmg: 9,  pts: 260, kind: 'ranged', proj: 'brick',  lob: true, range: 110 },
  agent_files: { name: 'Filing Agent',  sheet: 'agent_case',  hp: 56, speed: 34, dmg: 10, pts: 380, kind: 'ranged', proj: 'files',  lob: true, range: 115 },
  soldier_nade:{ name: 'Grenadier',     sheet: 'soldier_net', hp: 66, speed: 34, dmg: 13, pts: 520, kind: 'ranged', proj: 'nade',   lob: true, range: 125, blast: 26 },
  // 2: city
  cop_baton:   { name: 'Cop',          sheet: 'cop_baton',   hp: 46, speed: 38, dmg: 8,  pts: 200, kind: 'melee',  reach: 34 },
  cop_shield:  { name: 'Riot Cop',     sheet: 'cop_shield',  hp: 64, speed: 32, dmg: 9,  pts: 260, kind: 'melee',  reach: 26, blocks: true },
  cop_taser:   { name: 'Taser Cop',    sheet: 'cop_taser',   hp: 40, speed: 34, dmg: 8,  pts: 240, kind: 'ranged', proj: 'bolt', range: 125 },
  // 3: FBI
  agent_kick:  { name: 'Agent',        sheet: 'agent_kick',  hp: 60, speed: 46, dmg: 10, pts: 300, kind: 'lunge',  reach: 34 },
  agent_net:   { name: 'Net Agent',    sheet: 'agent_net',   hp: 52, speed: 36, dmg: 10, pts: 340, kind: 'ranged', proj: 'net',  range: 135 },
  agent_case:  { name: 'Case Agent',   sheet: 'agent_case',  hp: 70, speed: 40, dmg: 11, pts: 360, kind: 'melee',  reach: 36, double: true },
  // 4: military
  soldier_shield: { name: 'Shield Trooper', sheet: 'soldier_shield', hp: 90, speed: 34, dmg: 12, pts: 420, kind: 'melee', reach: 28, blocks: true },
  soldier_net:    { name: 'Net Gunner',     sheet: 'soldier_net',    hp: 70, speed: 36, dmg: 12, pts: 460, kind: 'ranged', proj: 'net', range: 140, burst: 2 },
  soldier_baton:  { name: 'Shock Trooper',  sheet: 'soldier_baton',  hp: 100, speed: 42, dmg: 13, pts: 520, kind: 'melee', reach: 36, double: true },
};

/** Boss moves: melee, charge, slam (shockwave), shoot (comic projectile fan), summon. */
export const BOSSES = {
  boss_head:    { name: 'HEAD ZOOKEEPER', sheet: 'boss_head',    hp: 300, speed: 36, dmg: 11, pts: 2000,  moves: ['charge', 'melee', 'shoot'], proj: 'dart', summons: 'keeper_net' },
  boss_captain: { name: 'POLICE CAPTAIN', sheet: 'boss_captain', hp: 420, speed: 36, dmg: 13, pts: 3500,  moves: ['charge', 'melee', 'shoot', 'summon'], proj: 'bolt', summons: 'cop_baton', blocks: true },
  boss_agent:   { name: 'SPECIAL AGENT',  sheet: 'boss_agent',   hp: 520, speed: 46, dmg: 14, pts: 5000,  moves: ['charge', 'melee', 'shoot', 'slam', 'summon'], proj: 'net', summons: 'agent_kick' },
  boss_general: { name: 'ARMORED GENERAL', sheet: 'boss_general', hp: 700, speed: 32, dmg: 17, pts: 7500, moves: ['slam', 'shoot', 'melee', 'charge', 'summon'], proj: 'shell', summons: 'soldier_shield' },
  boss_baron:   { name: 'THE BARON',      sheet: 'boss_baron',   hp: 950, speed: 42, dmg: 19, pts: 15000, moves: ['shoot', 'charge', 'slam', 'melee', 'summon'], proj: 'shell', summons: ['agent_kick', 'cop_taser', 'soldier_baton', 'keeper_dart'] },
};

export const STAGES = [
  {
    name: 'CINCINNATI ZOO', sub: 'HAY THERE, KID', bg: 'zoo', length: 1950, boss: 'boss_head', music: { root: 57, tempo: 132, mode: 'minor' },
    diff: { hp: 1, spd: 1, dmg: 1, cd: 1, atk: 2 },
    // Encounter fields: wave (spawns on stop), phases (next beats, each triggers when <=1 enemy is left), haz (hazards during the lock), title (banner).
    events: [
      { at: 320, title: 'KEEPER GAUNTLET!', wave: cat(w('keeper_net', R, 1)),
        phases: [cat(w('keeper_net', L, 1), w('keeper_net', R, 1)), cat(w('keeper_dart', R, 1), w('keeper_stun', L, 1)), cat(w('keeper_stun', R, 1), w('keeper_net', L, 1))] },
      { at: 650, title: 'AMBUSH!', wave: cat(w('keeper_net', L, 1), w('keeper_net', R, 1), w('keeper_net', T, 2)), haz: { kind: 'drop', obj: 'crate', n: 3, gap: 2.4, start: 1.5 } },
      { at: 980, title: 'BUCKET BRIGADE', wave: cat(w('keeper_toss', R, 2), w('keeper_stun', L, 1)), phases: [cat(elite('keeper_stun', R), w('keeper_dart', L, 1))] },
      { at: 1310, title: 'FINAL SWEEP', wave: cat(w('keeper_stun', L, 2), w('keeper_net', R, 2), w('keeper_dart', T, 1)), phases: [cat(elite('keeper_stun', R), w('keeper_toss', L, 1))], haz: { kind: 'drop', obj: 'crate', n: 3, gap: 3, start: 3 } },
    ],
    stretch: [{ from: 420, to: 600, kind: 'drop', obj: 'crate', every: 4 }, { from: 1080, to: 1250, kind: 'drop', obj: 'crate', every: 3.4 }, { from: 1400, to: 1630, kind: 'drop', obj: 'crate', every: 3 }],
    bossHaz: { kind: 'drop', obj: 'crate', every: 7 },
    props: [{ x: 230, kind: 'crate' }, { x: 340, kind: 'crate' }, { x: 520, kind: 'barrel' }, { x: 780, kind: 'barrel' }, { x: 900, kind: 'crate' }, { x: 1170, kind: 'crate' }, { x: 1420, kind: 'barrel' }, { x: 1610, kind: 'barrel' }, { x: 1700, kind: 'crate', loot: 'life' }],
  },
  {
    name: 'VINE STREET', sub: 'THE COPS ARRIVE', bg: 'street', length: 2280, boss: 'boss_captain', music: { root: 52, tempo: 144, mode: 'dorian' },
    diff: { hp: 1.2, spd: 1.07, dmg: 1.12, cd: 0.92, atk: 2 },
    events: [
      { at: 320, title: 'ROADBLOCK!', wave: cat(w('cop_baton', R, 2), w('keeper_stun', L, 1)), haz: { kind: 'car', n: 1, gap: 4, start: 3 } },
      { at: 650, title: 'SHIELD WALL', wave: cat(w('cop_shield', R, 2), w('cop_taser', L, 1)), phases: [cat(w('cop_brick', L, 1), w('cop_baton', T, 2))] },
      { at: 980, title: 'RUSH HOUR', wave: cat(w('cop_baton', R, 2), w('cop_taser', L, 2)), haz: { kind: 'car', n: 3, gap: 3.6, start: 2.5 } },
      { at: 1310, title: 'PRECINCT SWEEP', wave: cat(w('cop_shield', R, 2), w('cop_brick', L, 2)), phases: [cat(mini('cop_shield', R), w('cop_taser', L, 1))], haz: { kind: 'car', n: 2, gap: 6, start: 6 } },
      { at: 1640, title: 'LAST STAND', wave: cat(w('cop_taser', R, 2), w('cop_shield', L, 2), w('cop_baton', T, 1)), phases: [cat(elite('cop_baton', R), w('cop_brick', L, 2))], haz: { kind: 'car', n: 3, gap: 4.5, start: 2 } },
    ],
    stretch: [{ from: 420, to: 600, kind: 'car', every: 4.5 }, { from: 760, to: 940, kind: 'car', every: 4 }, { from: 1100, to: 1270, kind: 'car', every: 3.8 }, { from: 1420, to: 1600, kind: 'car', every: 3.5 }],
    bossHaz: { kind: 'car', every: 8 },
    props: [{ x: 250, kind: 'barrel' }, { x: 440, kind: 'crate' }, { x: 770, kind: 'crate' }, { x: 1000, kind: 'barrel' }, { x: 1300, kind: 'barrel' }, { x: 1500, kind: 'crate', loot: 'life' }, { x: 1730, kind: 'crate' }, { x: 1900, kind: 'barrel' }],
  },
  {
    name: 'FBI FIELD OFFICE', sub: 'MEN IN BLACK SUITS', bg: 'office', length: 2610, boss: 'boss_agent', music: { root: 55, tempo: 150, mode: 'minor' },
    diff: { hp: 1.45, spd: 1.14, dmg: 1.25, cd: 0.85, atk: 3 },
    events: [
      { at: 320, title: 'SECURITY CHECK', wave: cat(w('agent_kick', R, 2), w('cop_taser', L, 1)), phases: [cat(w('agent_files', L, 1), w('agent_kick', R, 1))] },
      { at: 650, title: 'FILING FRENZY', wave: cat(w('agent_files', R, 2), w('agent_net', L, 1)), haz: { kind: 'drop', obj: 'cabinet', n: 3, gap: 2.8, start: 2 } },
      { at: 980, title: 'AGENT AMBUSH', wave: cat(w('agent_kick', R, 2), w('agent_net', L, 1), w('agent_case', T, 2)) },
      { at: 1310, title: 'THE SUPERVISOR', wave: cat(w('agent_case', R, 2), w('agent_files', L, 1)), phases: [cat(mini('agent_kick', R), w('agent_net', L, 1))], haz: { kind: 'drop', obj: 'cabinet', n: 2, gap: 4, start: 5 } },
      { at: 1640, title: 'PAPER STORM', wave: cat(w('agent_net', R, 2), w('agent_files', L, 2), w('cop_shield', R, 1)), haz: { kind: 'drop', obj: 'cabinet', n: 4, gap: 2.6, start: 1.5 }, phases: [cat(w('agent_kick', T, 2))] },
      { at: 1970, title: 'INTERNAL AFFAIRS', wave: cat(w('agent_kick', R, 2), w('agent_case', L, 2), w('agent_net', T, 1)), phases: [cat(elite('agent_case', R), elite('agent_kick', L))] },
    ],
    stretch: [{ from: 420, to: 600, kind: 'drop', obj: 'cabinet', every: 4.2 }, { from: 1060, to: 1250, kind: 'drop', obj: 'cabinet', every: 3.6 }, { from: 1420, to: 1600, kind: 'drop', obj: 'cabinet', every: 3.2 }, { from: 1750, to: 1930, kind: 'drop', obj: 'cabinet', every: 3 }, { from: 2080, to: 2260, kind: 'drop', obj: 'cabinet', every: 3 }],
    bossHaz: { kind: 'drop', obj: 'cabinet', every: 6.5 },
    props: [{ x: 250, kind: 'barrel' }, { x: 410, kind: 'crate' }, { x: 700, kind: 'barrel' }, { x: 990, kind: 'barrel' }, { x: 1250, kind: 'crate' }, { x: 1580, kind: 'crate' }, { x: 1850, kind: 'barrel', loot: 'life' }, { x: 2260, kind: 'barrel' }, { x: 2400, kind: 'crate' }],
  },
  {
    name: 'FORT CINCINNATI', sub: 'THEY CALLED THE ARMY', bg: 'base', length: 2610, boss: 'boss_general', music: { root: 50, tempo: 156, mode: 'phrygian' },
    diff: { hp: 1.75, spd: 1.22, dmg: 1.4, cd: 0.78, atk: 3 },
    events: [
      { at: 320, title: 'GATE PATROL', wave: cat(w('soldier_shield', R, 2), w('soldier_net', L, 1)), haz: { kind: 'spot', n: 1, start: 1 } },
      { at: 650, title: 'MOTOR POOL', wave: cat(w('soldier_baton', R, 2), w('soldier_net', L, 2)), phases: [cat(w('soldier_nade', L, 2))] },
      { at: 980, title: 'GRENADIERS!', wave: cat(w('soldier_shield', R, 2), w('soldier_nade', L, 2), w('agent_net', R, 1)), phases: [cat(mini('soldier_shield', R))] },
      { at: 1310, title: 'SEARCHLIGHT SWEEP', wave: cat(w('soldier_net', R, 2), w('soldier_baton', L, 2)), haz: { kind: 'spot', n: 2, start: 0.5 } },
      { at: 1640, title: 'DROP ZONE', wave: cat(w('soldier_shield', R, 2), w('soldier_net', L, 1), w('soldier_baton', T, 2)), phases: [cat(elite('soldier_baton', R), w('soldier_nade', L, 1))] },
      { at: 1970, title: 'FULL ASSAULT', wave: cat(w('soldier_baton', R, 2), w('soldier_shield', L, 2), w('soldier_nade', T, 1)), phases: [cat(elite('soldier_net', L), elite('soldier_shield', R))], haz: { kind: 'spot', n: 1, start: 4 } },
    ],
    stretch: [{ from: 420, to: 600, kind: 'spot', every: 9 }, { from: 1060, to: 1240, kind: 'spot', every: 9 }, { from: 1400, to: 1590, kind: 'spot', every: 9 }, { from: 1740, to: 1920, kind: 'spot', every: 9 }, { from: 2080, to: 2260, kind: 'spot', every: 9 }],
    bossHaz: { kind: 'spot', every: 14 },
    props: [{ x: 240, kind: 'crate' }, { x: 300, kind: 'barrel' }, { x: 560, kind: 'barrel' }, { x: 760, kind: 'crate' }, { x: 1180, kind: 'barrel' }, { x: 1480, kind: 'crate' }, { x: 1700, kind: 'crate', loot: 'life' }, { x: 1900, kind: 'barrel' }, { x: 2300, kind: 'crate' }],
  },
  {
    name: 'THE JUNGLE', sub: 'HOME AT LAST', bg: 'jungle', length: 2940, boss: 'boss_baron', music: { root: 48, tempo: 164, mode: 'minor' },
    diff: { hp: 2.1, spd: 1.3, dmg: 1.6, cd: 0.7, atk: 4 },
    events: [
      { at: 320, title: 'JUNGLE AMBUSH', wave: cat(w('soldier_baton', R, 2), w('agent_kick', L, 2), w('keeper_dart', T, 1)) },
      { at: 650, title: 'BOULDER RUN', wave: cat(w('cop_shield', R, 2), w('soldier_net', L, 2), w('agent_case', R, 1)), haz: { kind: 'roll', n: 3, gap: 3.4, start: 2 } },
      { at: 980, title: 'COCONUT CANOPY', wave: cat(w('agent_kick', R, 3), w('cop_taser', L, 2), w('soldier_shield', R, 1)), haz: { kind: 'drop', obj: 'coconut', n: 4, gap: 2.4, start: 1.5 } },
      { at: 1310, title: 'THE HUNTERS', wave: cat(w('soldier_baton', R, 2), w('agent_net', L, 2), w('cop_brick', R, 2)), phases: [cat(mini('agent_case', R), w('soldier_nade', L, 1))] },
      { at: 1640, title: 'RUINS SIEGE', wave: cat(w('soldier_shield', R, 2), w('agent_files', L, 2), w('cop_taser', R, 2), w('keeper_stun', L, 1)), haz: { kind: 'roll', n: 3, gap: 4, start: 3 }, phases: [cat(w('soldier_baton', T, 2))] },
      { at: 1970, title: 'CANOPY STORM', wave: cat(w('soldier_net', R, 2), w('agent_kick', L, 3), w('soldier_baton', R, 2)), haz: { kind: 'drop', obj: 'coconut', n: 5, gap: 2.2, start: 1.5 } },
      { at: 2300, title: 'THE BARON\'S GUARD', wave: cat(w('soldier_baton', R, 3), w('agent_case', L, 2), w('cop_shield', R, 2), w('soldier_net', L, 1)), phases: [cat(elite('soldier_baton', R), elite('agent_kick', L), w('soldier_nade', T, 1))] },
    ],
    stretch: [{ from: 420, to: 600, kind: 'roll', every: 5 }, { from: 760, to: 930, kind: 'drop', obj: 'coconut', every: 3.4 }, { from: 1080, to: 1260, kind: 'roll', every: 4.5 }, { from: 1400, to: 1590, kind: 'drop', obj: 'coconut', every: 3.2 }, { from: 1740, to: 1920, kind: 'roll', every: 4 }, { from: 2080, to: 2250, kind: 'drop', obj: 'coconut', every: 3 }, { from: 2400, to: 2590, kind: 'roll', every: 3.8 }],
    bossHaz: { kind: 'drop', obj: 'coconut', every: 6 },
    props: [{ x: 250, kind: 'barrel' }, { x: 360, kind: 'crate' }, { x: 560, kind: 'crate' }, { x: 900, kind: 'barrel' }, { x: 1150, kind: 'crate' }, { x: 1410, kind: 'crate' }, { x: 1650, kind: 'barrel', loot: 'life' }, { x: 1980, kind: 'barrel' }, { x: 2200, kind: 'crate' }, { x: 2490, kind: 'crate' }, { x: 2700, kind: 'barrel' }],
  },
];
