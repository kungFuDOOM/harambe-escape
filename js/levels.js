// Stage data. Enemy waves trigger when the camera reaches `at`. Every stage is harder than the last:
// stats are scaled by STAGES[i].diff on top of each enemy's base stats, waves get bigger, more enemies attack at once.
const L = 'L', R = 'R';
const w = (t, side = R, n = 1) => Array.from({ length: n }, (_, i) => ({ t, side: i % 2 ? (side === R ? L : R) : side }));
const cat = (...a) => a.flat();

/** kind: melee | lunge (dash kick) | ranged. proj: net | dart | bolt. `reach` = how far the hit extends in front. */
export const ENEMIES = {
  // 1: zoo
  keeper_net:  { name: 'Net Keeper',   sheet: 'keeper_net',  hp: 30, speed: 34, dmg: 6,  pts: 100, kind: 'melee',  reach: 30 },
  keeper_dart: { name: 'Dart Keeper',  sheet: 'keeper_dart', hp: 26, speed: 30, dmg: 6,  pts: 150, kind: 'ranged', proj: 'dart', range: 120 },
  keeper_stun: { name: 'Stun Keeper',  sheet: 'keeper_stun', hp: 36, speed: 38, dmg: 7,  pts: 150, kind: 'melee',  reach: 28 },
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
    events: [
      { at: 320, wave: cat(w('keeper_net', R, 2)) },
      { at: 650, wave: cat(w('keeper_net', R, 2), w('keeper_dart', L, 1)) },
      { at: 980, wave: cat(w('keeper_stun', R, 2), w('keeper_dart', L, 1)) },
      { at: 1310, wave: cat(w('keeper_net', R, 2), w('keeper_stun', L, 2)) },
    ],
    props: [{ x: 340, kind: 'crate' }, { x: 780, kind: 'barrel' }, { x: 1170, kind: 'crate' }, { x: 1610, kind: 'barrel' }],
  },
  {
    name: 'VINE STREET', sub: 'THE COPS ARRIVE', bg: 'street', length: 2280, boss: 'boss_captain', music: { root: 52, tempo: 144, mode: 'dorian' },
    diff: { hp: 1.2, spd: 1.07, dmg: 1.12, cd: 0.92, atk: 2 },
    events: [
      { at: 320, wave: cat(w('cop_baton', R, 2), w('keeper_stun', L, 1)) },
      { at: 650, wave: cat(w('cop_shield', R, 2), w('cop_taser', L, 1)) },
      { at: 980, wave: cat(w('cop_baton', R, 2), w('cop_taser', L, 2)) },
      { at: 1310, wave: cat(w('cop_shield', R, 2), w('cop_baton', L, 2), w('cop_taser', R, 1)) },
      { at: 1640, wave: cat(w('cop_taser', R, 2), w('cop_shield', L, 2), w('cop_baton', R, 1)) },
    ],
    props: [{ x: 340, kind: 'barrel' }, { x: 770, kind: 'crate' }, { x: 1300, kind: 'barrel' }, { x: 1730, kind: 'crate' }],
  },
  {
    name: 'FBI FIELD OFFICE', sub: 'MEN IN BLACK SUITS', bg: 'office', length: 2610, boss: 'boss_agent', music: { root: 55, tempo: 150, mode: 'minor' },
    diff: { hp: 1.45, spd: 1.14, dmg: 1.25, cd: 0.85, atk: 3 },
    events: [
      { at: 320, wave: cat(w('agent_kick', R, 2), w('cop_taser', L, 1)) },
      { at: 650, wave: cat(w('agent_case', R, 2), w('agent_net', L, 1)) },
      { at: 980, wave: cat(w('agent_kick', R, 3), w('agent_net', L, 1)) },
      { at: 1310, wave: cat(w('agent_case', R, 2), w('agent_kick', L, 2), w('agent_net', R, 1)) },
      { at: 1640, wave: cat(w('agent_net', R, 2), w('agent_case', L, 2), w('cop_shield', R, 1)) },
      { at: 1970, wave: cat(w('agent_kick', R, 2), w('agent_case', L, 2), w('agent_net', R, 2)) },
    ],
    props: [{ x: 410, kind: 'crate' }, { x: 990, kind: 'barrel' }, { x: 1580, kind: 'crate' }, { x: 2260, kind: 'barrel' }],
  },
  {
    name: 'FORT CINCINNATI', sub: 'THEY CALLED THE ARMY', bg: 'base', length: 2610, boss: 'boss_general', music: { root: 50, tempo: 156, mode: 'phrygian' },
    diff: { hp: 1.75, spd: 1.22, dmg: 1.4, cd: 0.78, atk: 3 },
    events: [
      { at: 320, wave: cat(w('soldier_shield', R, 2), w('soldier_net', L, 1)) },
      { at: 650, wave: cat(w('soldier_baton', R, 2), w('soldier_net', L, 2)) },
      { at: 980, wave: cat(w('soldier_shield', R, 2), w('soldier_baton', L, 2), w('agent_net', R, 1)) },
      { at: 1310, wave: cat(w('soldier_net', R, 3), w('soldier_baton', L, 2)) },
      { at: 1640, wave: cat(w('soldier_shield', R, 2), w('soldier_net', L, 2), w('soldier_baton', R, 2)) },
      { at: 1970, wave: cat(w('soldier_baton', R, 3), w('soldier_shield', L, 2), w('soldier_net', R, 2)) },
    ],
    props: [{ x: 300, kind: 'barrel' }, { x: 760, kind: 'crate' }, { x: 1180, kind: 'barrel' }, { x: 1700, kind: 'crate' }],
  },
  {
    name: 'THE JUNGLE', sub: 'HOME AT LAST', bg: 'jungle', length: 2940, boss: 'boss_baron', music: { root: 48, tempo: 164, mode: 'minor' },
    diff: { hp: 2.1, spd: 1.3, dmg: 1.6, cd: 0.7, atk: 4 },
    events: [
      { at: 320, wave: cat(w('soldier_baton', R, 2), w('agent_kick', L, 2), w('keeper_dart', R, 1)) },
      { at: 650, wave: cat(w('cop_shield', R, 2), w('soldier_net', L, 2), w('agent_case', R, 1)) },
      { at: 980, wave: cat(w('agent_kick', R, 3), w('cop_taser', L, 2), w('soldier_shield', R, 1)) },
      { at: 1310, wave: cat(w('soldier_baton', R, 2), w('agent_net', L, 2), w('cop_baton', R, 2)) },
      { at: 1640, wave: cat(w('soldier_shield', R, 2), w('agent_case', L, 2), w('cop_taser', R, 2), w('keeper_stun', L, 1)) },
      { at: 1970, wave: cat(w('soldier_net', R, 2), w('agent_kick', L, 3), w('soldier_baton', R, 2)) },
      { at: 2300, wave: cat(w('soldier_baton', R, 3), w('agent_case', L, 2), w('cop_shield', R, 2), w('soldier_net', L, 1)) },
    ],
    props: [{ x: 360, kind: 'crate' }, { x: 900, kind: 'barrel' }, { x: 1410, kind: 'crate' }, { x: 1980, kind: 'barrel' }, { x: 2490, kind: 'crate' }],
  },
];
