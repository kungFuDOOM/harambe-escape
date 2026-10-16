// Per-stage screen sequences: every camera stop (start, each wave stop, boss arena) is a "screen" with its own look,
// so the level visibly travels from one place to the next. Pure data + maths (no DOM) so tests/bgscreens.test.js can check it.
import { STAGES } from './levels.js';

export const TILE_W = 320; // one plate = one logic screen
// Each tile is two 160px halves of the 320px plate: A=left, B=right, a lowercase 'f' suffix = mirrored.
// Every tile type begins and ends on a plate edge (col 0 or col 319) so neighbours that share an edge join without a seam.
export const TILE_TYPES = [
  { name: 'full',      halves: ['A', 'B'],   start: 0,   end: 319 },
  { name: 'right-mir', halves: ['Bf', 'B'],  start: 319, end: 319 },
  { name: 'full-rev',  halves: ['Bf', 'Af'], start: 319, end: 0 },
  { name: 'left-mir',  halves: ['A', 'Af'],  start: 0,   end: 0 },
];
const rgb = (r, g, b) => [r, g, b];
const ID = rgb(255, 255, 255);

/** Camera stops of a stage: the start, each wave stop, then the boss arena. */
export const stopsOf = st => [0, ...st.events.map(e => e.at), st.length - 320];

// look: top/bot = multiply tint of the wall/sky (top) and floor (bot); warm = additive wash [r,g,b,a]; fog = fog opacity; stars/rain/motes = overlay strength.
// lm: landmarks [kind, dxFromStop, ...args]; lights: [dx, y, radius, [r,g,b], pulse]
export const SCREENS = {
  zoo: {
    tiles: [0, 1, 2, 3, 0, 1, 2, 3],
    screens: [
      { name: 'Entrance Plaza', top: ID, bot: ID, lm: [['hsign', 120, 'WELCOME', '#2a6a3a', '#ffe9a0'], ['bush', 30, 26, '#1e4a28'], ['bush', 270, 30, '#235a2c']], lights: [] },
      { name: 'Food Court', top: rgb(255, 232, 208), bot: rgb(255, 238, 218), warm: [255, 150, 40, 0.06], lm: [['stand', 20, '#e0a020', '#fff2d0', 'FOOD'], ['stand', 150, '#c8321e', '#f2e6c8', 'DRINKS'], ['bench', 250]], lights: [[60, 62, 26, [255, 190, 90], 1], [170, 62, 26, [255, 190, 90], 1]] },
      { name: 'Lion House', plate: 'zoo-lion', top: rgb(228, 196, 232), bot: rgb(238, 224, 236), lm: [['bench', 236]], lights: [], },
      { name: 'Primate World', top: rgb(190, 184, 232), bot: rgb(214, 214, 240), stars: 0.35, lm: [['tree', 40, 70], ['tree', 280, 78], ['sign', 150, 'PRIMATE WORLD', '#2a5a30', '#d8ffb0'], ['bush', 220, 22, '#1a4a30']], lights: [] },
      { name: 'Night Path', plate: 'zoo-reptile', lift: 0.08, top: rgb(120, 128, 196), bot: rgb(158, 168, 214), stars: 0.9, fog: 0.22, lm: [['bush', 26, 26, '#142e24'], ['bush', 296, 24, '#142e24']], lights: [] },
      { name: 'Zoo Exit', top: rgb(92, 104, 176), bot: rgb(140, 152, 204), stars: 1, fog: 0.3, warm: [255, 40, 60, 0.04], lm: [['bus', 220], ['sign', 70, 'EXIT', '#7a1a1a', '#ffe6e0'], ['lamp', 20, '#ff9a7a'], ['cone', 150], ['cone', 168]], lights: [[20, 70, 30, [255, 150, 120], 1]], siren: 1 },
    ],
  },
  street: {
    tiles: [0, 2, 3, 0, 1, 2, 3, 0],
    screens: [
      { name: 'Back Alley', top: ID, bot: ID, rain: 0.5, lm: [['dumpster', 40], ['hydrant', 210], ['pipe', 270]], lights: [] },
      { name: 'Vine Plaza', top: rgb(205, 222, 255), bot: rgb(225, 235, 255), rain: 0.4, lm: [['lamp', 40, '#9fd0ff'], ['planter', 130], ['bench', 200], ['lamp', 300, '#9fd0ff']], lights: [[40, 70, 34, [140, 200, 255], 1], [300, 70, 34, [140, 200, 255], 1]] },
      { name: 'Storefront Row', plate: 'city-stores', top: rgb(255, 214, 250), bot: rgb(255, 232, 250), rain: 0.3, lm: [['hydrant', 24]], lights: [] },
      { name: 'Diner Corner', top: rgb(255, 224, 190), bot: rgb(255, 236, 214), warm: [255, 150, 40, 0.06], rain: 0.2, lm: [['diner', 40], ['sign', 235, 'ONE WAY', '#222a36', '#ffffff'], ['hydrant', 300]], lights: [[80, 84, 40, [255, 200, 110], 1]] },
      { name: 'Bridge Approach', plate: 'city-bridge', top: rgb(180, 204, 240), bot: rgb(206, 224, 244), fog: 0.28, rain: 0.35, lm: [['barrier', 250], ['cone', 200]], lights: [] },
      { name: 'Under the Bridge', plate: 'city-stores', flip: 1, top: rgb(120, 140, 190), bot: rgb(150, 168, 206), fog: 0.38, rain: 0.2, lm: [['girders', 0], ['dumpster', 220], ['cone', 120]], lights: [[160, 40, 46, [120, 170, 255], 1]] },
      { name: 'Precinct Barricade', top: rgb(210, 190, 220), bot: rgb(226, 214, 232), rain: 0.25, lm: [['barrier', 60], ['barrier', 120], ['sign', 238, 'POLICE LINE', '#1a2a5a', '#ffffff'], ['cone', 200]], lights: [], siren: 1 },
    ],
  },
  office: {
    tiles: [0, 2, 3, 0, 1, 2, 3, 0, 1],
    screens: [
      { name: 'Lobby', top: ID, bot: ID, lm: [['plant', 30], ['seal', 150], ['bench', 250]], lights: [] },
      { name: 'Cubicles', top: rgb(235, 240, 240), bot: rgb(240, 244, 244), lm: [['cubicle', 20], ['cubicle', 110], ['cubicle', 200], ['cooler', 295]], lights: [] },
      { name: 'Records Corridor', plate: 'fbi-server', flip: 1, top: rgb(250, 238, 214), bot: rgb(250, 242, 224), warm: [255, 190, 90, 0.05], lm: [['door', 30, '101'], ['door', 110, '102'], ['door', 190, '103'], ['door', 270, '104']], lights: [[70, 24, 30, [255, 230, 170], 1], [230, 24, 30, [255, 230, 170], 1]] },
      { name: 'Conference Wing', plate: 'fbi-archive', flip: 1, top: rgb(214, 226, 250), bot: rgb(230, 238, 250), lm: [['glass', 20, 150], ['table', 190], ['flag', 296]], lights: [] },
      { name: 'Server Room', plate: 'fbi-server', top: rgb(150, 190, 240), bot: rgb(186, 208, 240), lm: [['cart', 60]], lights: [], blink: 1 },
      { name: 'Archives', plate: 'fbi-archive', top: rgb(240, 214, 176), bot: rgb(246, 230, 204), warm: [255, 160, 50, 0.07], lm: [['cart', 290]], lights: [] },
      { name: 'Elevator Bank', top: rgb(222, 224, 232), bot: rgb(232, 232, 238), lm: [['elevator', 40], ['elevator', 130], ['sign', 238, 'DIRECTOR', '#1a1a22', '#ffd070'], ['plant', 300]], lights: [[70, 40, 22, [255, 240, 200], 1], [160, 40, 22, [255, 240, 200], 1]] },
      { name: "Director's Office", top: rgb(232, 186, 186), bot: rgb(238, 210, 206), warm: [255, 40, 40, 0.06], lm: [['curtain', 10], ['curtain', 280], ['seal', 150]], lights: [[160, 30, 40, [255, 90, 80], 1]], siren: 1 },
    ],
  },
  base: {
    tiles: [0, 1, 2, 3, 0, 1, 2, 3, 0, 2],
    screens: [
      { name: 'Main Gate', top: ID, bot: ID, lm: [['gatepost', 40], ['sign', 130, 'FORT CINCINNATI', '#2a3a1a', '#e8f0b0'], ['sandbags', 230, 4], ['flag', 300]], lights: [], beams: 0 },
      { name: 'Motor Pool', top: rgb(255, 214, 196), bot: rgb(255, 226, 210), lm: [['jeep', 60], ['drums', 190, 3], ['sign', 262, 'MOTOR POOL', '#3a3a20', '#ffe6a0']], lights: [], beams: 0.4 },
      { name: 'Barracks', plate: 'base-airfield', flip: 1, top: rgb(238, 190, 180), bot: rgb(246, 214, 204), lm: [['tent', 30, 78], ['tent', 150, 70], ['tent', 262, 74]], lights: [[70, 90, 24, [255, 200, 110], 1]], beams: 0.6, stars: 0.2 },
      { name: 'Fuel Depot', top: rgb(210, 160, 170), bot: rgb(226, 196, 196), lm: [['tank', 40], ['drums', 140, 5], ['sign', 232, 'FUEL', '#6a1a10', '#ffe0a0'], ['wire', 270]], lights: [], beams: 0.8, stars: 0.4 },
      { name: 'Airfield', plate: 'base-airfield', lift: 0.13, top: rgb(160, 130, 170), bot: rgb(196, 176, 196), stars: 0.55, lm: [['sandbags', 230, 3]], lights: [], beams: 0.9 },
      { name: 'Wire Line', top: rgb(130, 112, 160), bot: rgb(176, 160, 186), stars: 0.7, fog: 0.2, lm: [['wire', 10], ['wire', 120], ['sign', 232, 'KEEP OUT', '#7a1010', '#ffffff'], ['sandbags', 290, 3]], lights: [], beams: 1 },
      { name: 'Bunker Row', plate: 'base-airfield', flip: 1, top: rgb(106, 100, 150), bot: rgb(156, 150, 180), stars: 0.85, fog: 0.26, lm: [['bunker', 20], ['bunker', 170], ['lamp', 300, '#ff9a7a']], lights: [[300, 70, 30, [255, 150, 120], 1]], beams: 1 },
      { name: 'Command HQ', top: rgb(86, 84, 140), bot: rgb(140, 138, 176), stars: 1, fog: 0.3, warm: [255, 30, 40, 0.05], lm: [['hq', 30], ['flag', 210], ['sandbags', 270, 4]], lights: [[120, 60, 40, [255, 90, 90], 1]], beams: 1, siren: 1 },
    ],
  },
  jungle: {
    tiles: [0, 1, 2, 3, 0, 2, 3, 0, 1, 2, 3],
    screens: [
      { name: 'Treeline', top: rgb(230, 240, 230), bot: ID, motes: 0.3, lm: [['fern', 30], ['fern', 250], ['vines', 120, 5]], lights: [] },
      { name: 'Vine Thicket', top: rgb(190, 215, 175), bot: rgb(220, 235, 210), motes: 0.4, lm: [['vines', 20, 8], ['vines', 100, 6], ['vines', 200, 9], ['fern', 150], ['fern', 290]], lights: [] },
      { name: 'River Ford', plate: 'jungle-waterfall', flip: 1, top: rgb(175, 210, 215), bot: rgb(210, 232, 232), fog: 0.3, lm: [['rocks', 40], ['rocks', 270]], lights: [] },
      { name: 'Old Ruins', top: rgb(215, 215, 175), bot: rgb(232, 230, 200), lm: [['pillar', 30, 96], ['pillar', 100, 70], ['totem', 220], ['fern', 290]], lights: [[220, 70, 30, [255, 220, 120], 1]] },
      { name: 'Dark Canopy', plate: 'jungle-canopy', lift: 0.12, top: rgb(120, 160, 130), bot: rgb(166, 196, 164), fog: 0.2, motes: 0.9, lm: [['fern', 30], ['fern', 290]], lights: [], flies: 1 },
      { name: 'Glow Cave', top: rgb(110, 140, 170), bot: rgb(160, 186, 196), fog: 0.25, motes: 0.7, lm: [['glowflower', 30], ['glowflower', 90], ['glowflower', 200], ['glowflower', 270], ['rocks', 150]], lights: [[34, 112, 28, [140, 220, 255], 1], [94, 112, 28, [200, 150, 255], 1], [204, 112, 28, [140, 220, 255], 1], [274, 112, 28, [200, 150, 255], 1]], flies: 1 },
      { name: 'Waterfall Mist', plate: 'jungle-waterfall', lift: 0.08, top: rgb(190, 225, 235), bot: rgb(215, 238, 240), fog: 0.22, lm: [['rocks', 300]], lights: [] },
      { name: 'Temple Approach', plate: 'jungle-canopy', flip: 1, top: rgb(246, 226, 160), bot: rgb(250, 238, 200), warm: [255, 200, 60, 0.06], motes: 0.6, lm: [['totem', 30], ['totem', 270], ['pillar', 150, 100]], lights: [[160, 60, 50, [255, 210, 110], 1]] },
      { name: 'Home Clearing', top: rgb(255, 238, 190), bot: rgb(255, 246, 214), warm: [255, 210, 90, 0.09], motes: 0.8, lm: [['fern', 20], ['fern', 120], ['fern', 220], ['fern', 300], ['sign', 150, 'HOME', '#4a3a10', '#ffe890']], lights: [[160, 50, 60, [255, 230, 130], 1]] },
    ],
  },
};
export const KIND_OF = { zoo: 0, street: 1, office: 2, base: 3, jungle: 4 };
export const screensFor = kind => SCREENS[kind];

/** Sequence of tile types the plate walks through: every tile starts on the edge the previous one ended on. */
export function tileAt(kind, k) { const t = SCREENS[kind].tiles; return TILE_TYPES[t[Math.max(0, Math.min(t.length - 1, k))]]; }

const lerp = (a, b, t) => a + (b - a) * t;
const lerp3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const ss = t => t * t * (3 - 2 * t);
/** Which two screens the camera is between, and how far along (smoothstep), so looks blend while the view slides. */
export function screenPos(stops, cam) {
  const n = stops.length; if (cam <= stops[0]) return { i: 0, j: 0, t: 0 };
  for (let i = 0; i < n - 1; i++) if (cam < stops[i + 1]) return { i, j: i + 1, t: ss((cam - stops[i]) / (stops[i + 1] - stops[i])) };
  return { i: n - 1, j: n - 1, t: 0 };
}
/** Blended look at a camera position. */
export function lookAt(kind, stops, cam) {
  const S = SCREENS[kind].screens, { i, j, t } = screenPos(stops, cam), a = S[i], b = S[j];
  const w = (x, y) => lerp(x || 0, y || 0, t), wa = a.warm || [0, 0, 0, 0], wb = b.warm || [0, 0, 0, 0];
  return { i, j, t, top: lerp3(a.top, b.top, t), bot: lerp3(a.bot, b.bot, t), warm: [lerp(wa[0], wb[0], t), lerp(wa[1], wb[1], t), lerp(wa[2], wb[2], t), w(wa[3], wb[3])],
    fog: w(a.fog, b.fog), stars: w(a.stars, b.stars), rain: w(a.rain, b.rain), motes: w(a.motes, b.motes), beams: w(a.beams, b.beams), siren: w(a.siren, b.siren), flies: w(a.flies, b.flies), blink: w(a.blink, b.blink), lift: w(a.lift, b.lift) };
}
/** Stable signature of a screen's look, used by tests to count distinct looks. */
export function signature(kind, idx, stops) {
  const s = SCREENS[kind].screens[idx], x0 = stops[idx], k0 = Math.floor(x0 / TILE_W);
  return JSON.stringify([s.top, s.bot, s.warm || 0, s.fog || 0, s.stars || 0, s.lm.map(l => l[0] + (l[2] || '')), tileAt(kind, k0).name, tileAt(kind, k0 + 1).name, (s.plate || 0) + (s.flip ? 'f' : '')]);
}
export function stagesByKind() { return STAGES.map(st => ({ kind: st.bg, stops: stopsOf(st), st })); }
