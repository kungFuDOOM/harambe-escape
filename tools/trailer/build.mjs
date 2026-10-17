// The full 66 s trailer: cold open (the game's intro), faction cards + gameplay on a 150 bpm bar grid, bosses, logo.
// usage: node tools/trailer/build.mjs <rawdir> <out.mp4>
import { layout, encode } from './edit.mjs';
import path from 'node:path';

const RAW = path.resolve(process.argv[2] || 'trailer-raw'), OUT = path.resolve(process.argv[3] || 'harambe-trailer.mp4');
const BAR = 1.6, HALF = BAR / 2; // act 2 runs at 150 bpm and cuts on the bar / half bar

// [clip, start s, duration s, extra sfx [[t, name]] relative to the cut]
const ACT1 = [
  ['intro', 0.5, 3.4], // kid wanders into the exhibit
  ['intro', 5.4, 2.4], // "Harambe has a better idea"
  ['intro', 8.0, 3.8], // the toss, the flop, "AGAIN!"
  ['card_loose', 0, 2.4],
  ['intro', 12.45, 4.55], // sirens, keepers charge, "Time to go home."
];
const ACT2 = [
  ['card_everyone', 0, BAR, [[0, 'heavy']]],
  ['card_zoo', 0, BAR, [[0, 'heavy']]], ['s0_waves', 23.4, 2 * BAR],
  ['card_cops', 0, BAR, [[0, 'heavy']]], ['s1_waves', 11.0, 2 * BAR],
  ['card_fbi', 0, BAR, [[0, 'heavy']]], ['s2_waves', 12.8, 2 * BAR],
  ['card_army', 0, BAR, [[0, 'heavy']]], ['s3_waves', 8.0, 2 * BAR],
  ['card_warning', 0, BAR, [[0, 'boss']]],
  ['s0_boss', 5.0, BAR], ['s1_boss', 6.6, BAR], ['s2_boss', 9.8, BAR], ['s3_boss', 9.8, BAR], ['s4_boss', 6.2, BAR],
  ['cs3_3', 0.2, 2 * BAR], // "i'll be fine."
  ['card_home', 0, BAR, [[0, 'heavy']]],
  ['s4_waves', 7.5, HALF], ['s1_waves', 24.6, HALF], ['s2_waves', 18.1, HALF], ['s4_waves', 22.1, HALF],
  ['s3_waves', 30.8, HALF], ['s4_boss', 11.2, HALF], ['s4_bossko', 11.6, BAR], // the Baron goes down: STAGE CLEAR!
  ['card_end', 0, 6.0, [[0.05, 'fanfare'], [1.15, 'special']]],
  ['card_kidfine', 0, 2.0, [[0.1, 'banana']]],
];
const { segs, total, at } = layout([...ACT1, ...ACT2]), A2 = segs[ACT1.length].at;

const warn = at('card_warning'), story = at('cs3_3'), home = at('card_home'), end = at('card_end');
const music = [
  { t0: 0, t1: at('intro') + 3.4 + 2.4 + 3.8, root: 52, tempo: 100, mode: 'minor', seed: 7, vol: 0.75, parts: { kick: false, snare: false, hat: false } },
  { t0: segs[3].at, t1: A2 - 0.05, root: 52, tempo: 100, mode: 'minor', seed: 7, offset: 32, vol: 0.8, fadeOut: 0.3, parts: { mel: false, snare: false } },
  { t0: A2, t1: warn, root: 52, tempo: 150, mode: 'minor', seed: 63, vol: 1, parts: { drive: true } },
  { t0: warn + BAR, t1: story, root: 50, tempo: 150, mode: 'phrygian', seed: 61, vol: 1, parts: { drive: true, arp: true } },
  { t0: story, t1: home, root: 50, tempo: 150, mode: 'phrygian', seed: 61, vol: 0.7, parts: { mel: false, kick: false, snare: false } },
  { t0: home, t1: end, root: 52, tempo: 150, mode: 'dorian', seed: 63, vol: 1, parts: { drive: true, arp: true } },
];
const extra = [
  { kind: 'boom', t: A2 }, { kind: 'boom', t: warn }, { kind: 'boom', t: warn + BAR }, { kind: 'boom', t: home },
  { kind: 'riser', t0: end - BAR, t1: end }, { kind: 'chord', t: end, dur: 4.5, root: 52, mode: 'dorian' },
];
await encode({ raw: RAW, out: OUT, segs, total, music, extra });
