// Stage data. Enemy waves trigger when the camera reaches `at`.
const L = 'L', R = 'R';
const w = (t, side = R, n = 1) => Array.from({ length: n }, (_, i) => ({ t, side: i % 2 ? (side === R ? L : R) : side }));
const cat = (...a) => a.flat();

export const ENEMIES = {
  keeper:  { name: 'Zookeeper',  hp: 28, speed: 34, dmg: 7,  pts: 100, pal: { body: '#c9a24a', pants: '#6b5a2a', hat: '#8a6a22', skin: '#f2c49b' }, kind: 'melee' },
  guard:   { name: 'Security',   hp: 42, speed: 42, dmg: 9,  pts: 160, pal: { body: '#3a63c8', pants: '#1f2f66', hat: '#1b2550', skin: '#e0a577' }, kind: 'melee' },
  catcher: { name: 'Animal Control', hp: 32, speed: 30, dmg: 8, pts: 180, pal: { body: '#3da35a', pants: '#2a5a35', hat: '#255a35', skin: '#f2c49b' }, kind: 'net' },
  cop:     { name: 'Cop',        hp: 58, speed: 40, dmg: 11, pts: 250, pal: { body: '#27315f', pants: '#161c3a', hat: '#10142b', skin: '#d9a07a' }, kind: 'melee', blocks: true },
  tourist: { name: 'Angry Tourist', hp: 20, speed: 54, dmg: 5, pts: 80, pal: { body: '#ff7ac8', pants: '#3a8ad8', hat: '#ffd23a', skin: '#f2c49b' }, kind: 'melee' },
  sailor:  { name: 'Dockhand',   hp: 50, speed: 36, dmg: 12, pts: 220, pal: { body: '#e8e8e8', pants: '#2a3b66', hat: '#e8e8e8', skin: '#c98b62' }, kind: 'melee' },
  hunter:  { name: 'Hunter',     hp: 48, speed: 34, dmg: 10, pts: 300, pal: { body: '#8a6a3a', pants: '#4a3a1e', hat: '#5a4a24', skin: '#e0a577' }, kind: 'net' },
};

export const BOSSES = {
  headkeeper: { name: 'HEAD KEEPER', hp: 260, speed: 36, dmg: 12, pts: 2000, scale: 1.5, pal: { body: '#e0b84a', pants: '#5a4a1e', hat: '#b02a2a', skin: '#f2c49b' }, moves: ['charge', 'melee'], prop: 'tranq' },
  chiefcatcher: { name: 'CHIEF CATCHER', hp: 340, speed: 38, dmg: 13, pts: 3000, scale: 1.5, pal: { body: '#2f9a54', pants: '#1b5a31', hat: '#e0d23a', skin: '#e0a577' }, moves: ['net', 'charge', 'melee'], prop: 'net' },
  riotcaptain: { name: 'RIOT CAPTAIN', hp: 420, speed: 34, dmg: 15, pts: 4000, scale: 1.55, pal: { body: '#1e2447', pants: '#10142b', hat: '#0a0d1e', skin: '#d9a07a' }, moves: ['slam', 'charge', 'melee'], prop: 'shield', blocks: true },
  bargeboss: { name: 'BARGE BOSS', hp: 480, speed: 33, dmg: 16, pts: 5000, scale: 1.7, pal: { body: '#c84a2a', pants: '#2a3b66', hat: '#e8e8e8', skin: '#c98b62' }, moves: ['slam', 'summon', 'melee'], prop: 'anchor' },
  safarihunter: { name: 'BARON VON SAFARI', hp: 700, speed: 40, dmg: 18, pts: 10000, scale: 1.65, pal: { body: '#a98a4a', pants: '#3a2a14', hat: '#d8c07a', skin: '#e0a577' }, moves: ['net', 'charge', 'slam', 'summon', 'melee'], prop: 'rifle', summons: 'hunter' },
};

export const STAGES = [
  {
    name: 'CINCINNATI ZOO', sub: 'HAY THERE, KID', bg: 'zoo', length: 1500, boss: 'headkeeper', music: { root: 57, tempo: 132, mode: 'minor' },
    events: [
      { at: 180, wave: cat(w('keeper', R, 2)) },
      { at: 520, wave: cat(w('keeper', R, 3)) },
      { at: 900, wave: cat(w('keeper', R, 2), w('guard', L, 1)) },
      { at: 1180, wave: cat(w('guard', R, 2), w('keeper', L, 2)) },
    ],
    props: [{ x: 300, kind: 'crate' }, { x: 680, kind: 'barrel' }, { x: 1020, kind: 'crate' }, { x: 1300, kind: 'barrel' }],
  },
  {
    name: 'VINE STREET', sub: 'NOT THE ZOO BUS', bg: 'street', length: 1700, boss: 'chiefcatcher', music: { root: 52, tempo: 144, mode: 'dorian' },
    events: [
      { at: 160, wave: cat(w('guard', R, 2), w('tourist', L, 2)) },
      { at: 520, wave: cat(w('catcher', R, 2), w('keeper', L, 2)) },
      { at: 900, wave: cat(w('tourist', R, 4), w('guard', L, 1)) },
      { at: 1260, wave: cat(w('catcher', R, 2), w('guard', L, 2)) },
    ],
    props: [{ x: 280, kind: 'barrel' }, { x: 640, kind: 'crate' }, { x: 1080, kind: 'barrel' }, { x: 1400, kind: 'crate' }],
  },
  {
    name: 'OHIO RIVERFRONT', sub: 'ROEBLING RUMBLE', bg: 'river', length: 1800, boss: 'riotcaptain', music: { root: 55, tempo: 150, mode: 'minor' },
    events: [
      { at: 150, wave: cat(w('cop', R, 2), w('guard', L, 1)) },
      { at: 500, wave: cat(w('sailor', R, 2), w('catcher', L, 2)) },
      { at: 900, wave: cat(w('cop', R, 2), w('sailor', L, 2)) },
      { at: 1300, wave: cat(w('sailor', R, 3), w('cop', L, 2)) },
    ],
    props: [{ x: 260, kind: 'crate' }, { x: 700, kind: 'barrel' }, { x: 1100, kind: 'crate' }, { x: 1500, kind: 'barrel' }],
  },
  {
    name: 'KENTUCKY BACKROADS', sub: 'THE LONG WAY HOME', bg: 'night', length: 1900, boss: 'bargeboss', music: { root: 50, tempo: 156, mode: 'phrygian' },
    events: [
      { at: 170, wave: cat(w('hunter', R, 2), w('cop', L, 1)) },
      { at: 540, wave: cat(w('cop', R, 2), w('sailor', L, 2), w('catcher', R, 1)) },
      { at: 940, wave: cat(w('hunter', R, 2), w('guard', L, 3)) },
      { at: 1380, wave: cat(w('cop', R, 3), w('hunter', L, 2)) },
    ],
    props: [{ x: 300, kind: 'barrel' }, { x: 760, kind: 'crate' }, { x: 1150, kind: 'barrel' }, { x: 1600, kind: 'crate' }],
  },
  {
    name: 'THE JUNGLE', sub: 'HOME AT LAST', bg: 'jungle', length: 2000, boss: 'safarihunter', music: { root: 48, tempo: 164, mode: 'minor' },
    events: [
      { at: 160, wave: cat(w('hunter', R, 2), w('guard', L, 2)) },
      { at: 560, wave: cat(w('hunter', R, 3), w('cop', L, 2)) },
      { at: 980, wave: cat(w('sailor', R, 2), w('hunter', L, 2), w('cop', R, 2)) },
      { at: 1450, wave: cat(w('hunter', R, 3), w('cop', L, 3)) },
    ],
    props: [{ x: 320, kind: 'crate' }, { x: 800, kind: 'barrel' }, { x: 1200, kind: 'crate' }, { x: 1700, kind: 'barrel' }],
  },
];
