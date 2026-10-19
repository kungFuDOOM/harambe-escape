// Second arcade attract-mode cut: same cards, story beats and narration as build-arcade.mjs, all-new gameplay
// (later waves of every stage, other seeds, a flashier bot), boss VS cards intercut with their fights, two boss KOs.
// footage: node tools/trailer/capture.mjs <raw2> waves:0:30:101:2:1 waves:1:30:102:3:1 waves:2:30:103:2:1 waves:3:30:104:2:1
//   waves:4:30:105:2:1 boss:0:26:301 boss:1:26:302 boss:2:26:303 boss:3:26:304 boss:3:22:404:0.08 boss:4:22:406:0.08
//   card:o2_zoo:3.2 card:o2_street:3.2 card:o2_fbi:3.2 card:o2_army:3.2 card:o2_jungle:3.2  (+ the arcade cards and intro)
// usage: PIPER=piper PIPER_VOICE=en_US-joe-medium.onnx node tools/trailer/build-arcade2.mjs <raw2> <out.mp4>
import { layout, encode } from './edit.mjs';
import { arcadeVO } from './arcade-vo.mjs';
import path from 'node:path';

const RAW = path.resolve(process.argv[2] || 'trailer-raw2'), OUT = path.resolve(process.argv[3] || 'harambe-arcade2.mp4');
const BAR = 1.6, HALF = BAR / 2;
const HIT = [[0.12, 'heavy']];

const { segs, total, at } = layout([
  ['card_boot', 0, BAR, [[0.2, 'select'], [0.36, 'select'], [0.52, 'select'], [0.68, 'select'], [0.84, 'alert']]],
  ['intro', 8.0, 2 * BAR], // the haystack toss: he saves the boy
  ['card_news', 0, 2 * BAR, [[0.05, 'siren'], [1.0, 'siren']]],
  ['card_slam', 0, 2 * BAR, [[0.15, 'heavy'], [0.3, 'swing']]],
  ['card_hero', 0, BAR, [[1.2, 'select']]],
  ['s0_waves', 6.2, 2 * BAR, [[0, 'go']], 'card_o2_zoo'],
  ['s1_waves', 10.0, 2 * BAR, [[0, 'go']], 'card_o2_street'],
  ['s2_waves', 11.6, 2 * BAR, [[0, 'go']], 'card_o2_fbi'],
  ['s3_waves', 19.6, 2 * BAR, [[0, 'go']], 'card_o2_army'],
  ['s4_waves', 14.8, 2 * BAR, [[0, 'go']], 'card_o2_jungle'],
  ['card_vs_head', 0, HALF, HIT], ['s0_boss', 10.6, HALF],
  ['card_vs_captain', 0, HALF, HIT], ['s1_boss', 15.6, HALF],
  ['card_vs_agent', 0, HALF, HIT], ['s2_boss', 4.0, HALF],
  ['card_vs_general', 0, HALF, HIT], ['s3_bossko', 5.9, HALF], // the General goes down
  ['card_vs_baron', 0, BAR, [[0.05, 'boss']]],
  ['s4_bossko', 11.5, BAR], // the Baron goes down: STAGE CLEAR!
  ['s0_waves', 24.6, HALF], ['s3_waves', 26.7, HALF], ['s1_waves', 3.2, HALF], ['s4_waves', 22.5, HALF],
  ['s2_waves', 25.6, HALF], ['s1_waves', 27.8, HALF],
  ['card_attract', 0, 4.5 * BAR, [[0.12, 'heavy'], [0.3, 'fanfare'], [1.0, 'special']]],
]);

const toss = at('intro'), news = at('card_news'), slam = at('card_slam'), hero = at('card_hero'), vs = at('card_vs_head'), baron = at('card_vs_baron'), end = at('card_attract');
const music = [
  { t0: toss, t1: slam, root: 52, tempo: 150, mode: 'minor', seed: 63, vol: 0.7, parts: { mel: false, snare: false } }, // tension under the story beats
  { t0: hero, t1: vs, root: 50, tempo: 150, mode: 'dorian', seed: 71, vol: 1, parts: { drive: true, arp: true } },
  { t0: vs, t1: baron + BAR, root: 50, tempo: 150, mode: 'phrygian', seed: 61, vol: 1, parts: { drive: true, arp: true } },
  { t0: baron + BAR, t1: end, root: 52, tempo: 150, mode: 'minor', seed: 73, vol: 1, parts: { drive: true, arp: true } },
  { t0: end + 2 * BAR, t1: total, root: 52, tempo: 150, mode: 'dorian', seed: 63, vol: 0.55, fadeOut: 0.8, parts: { kick: false, snare: false } }, // attract-loop bed under PUSH START
];
const extra = [
  { kind: 'chord', t: slam + 0.15, dur: 1.4, root: 52, mode: 'minor' }, { kind: 'boom', t: hero }, { kind: 'boom', t: vs }, { kind: 'boom', t: baron },
  { kind: 'riser', t0: end - 2 * HALF, t1: end }, { kind: 'chord', t: end + 0.12, dur: 4.5, root: 52, mode: 'dorian' },
];
const voice = arcadeVO(RAW, OUT, { toss, news, slam, end, total });
await encode({ raw: RAW, out: OUT, segs, total, music, extra, musicVol: 0.5, sfxVol: 0.6, crt: true, voice, voiceVol: 1.0 });
