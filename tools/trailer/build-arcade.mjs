// The arcade attract-mode trailer (~50 s): cabinet self-test, the haystack save, breaking news, logo slam, player select, five SCENE splashes
// over gameplay with comic bursts, rapid-fire boss VS cards, the Baron going down, INSERT COIN. Cuts on a 150 bpm grid.
// Narrated by a monster-truck radio announcer (voice.mjs; needs Piper + a voice, e.g. en_US-joe-medium).
// usage: PIPER=piper PIPER_VOICE=en_US-joe-medium.onnx node tools/trailer/build-arcade.mjs <rawdir> <out.mp4>
import { layout, encode } from './edit.mjs';
import { narrate } from './voice.mjs';
import path from 'node:path';

const RAW = path.resolve(process.argv[2] || 'trailer-raw'), OUT = path.resolve(process.argv[3] || 'harambe-arcade.mp4');
const BAR = 1.6, HALF = BAR / 2;
const HIT = [[0.12, 'heavy']];

const { segs, total, at } = layout([
  ['card_boot', 0, BAR, [[0.2, 'select'], [0.36, 'select'], [0.52, 'select'], [0.68, 'select'], [0.84, 'alert']]],
  ['intro', 8.0, 2 * BAR], // the haystack toss: he saves the boy
  ['card_news', 0, 2 * BAR, [[0.05, 'siren'], [1.0, 'siren']]],
  ['card_slam', 0, 2 * BAR, [[0.15, 'heavy'], [0.3, 'swing']]],
  ['card_hero', 0, 2 * BAR, [[1.2, 'select'], [1.7, 'special']]],
  ['s0_waves', 23.4, 2 * BAR, [[0, 'go']], 'card_o_zoo'],
  ['s1_waves', 11.0, 2 * BAR, [[0, 'go']], 'card_o_street'],
  ['s2_waves', 15.6, 2 * BAR, [[0, 'go']], 'card_o_fbi'],
  ['s3_waves', 29.0, 2 * BAR, [[0, 'go']], 'card_o_army'],
  ['s4_waves', 20.6, 2 * BAR, [[0, 'go']], 'card_o_jungle'],
  ['card_vs_head', 0, HALF, HIT], ['card_vs_captain', 0, HALF, HIT], ['card_vs_agent', 0, HALF, HIT], ['card_vs_general', 0, HALF, HIT],
  ['s0_boss', 5.2, HALF], ['s1_boss', 6.8, HALF], ['s2_boss', 10.0, HALF], ['s3_boss', 10.0, HALF],
  ['card_vs_baron', 0, BAR, [[0.05, 'boss']]],
  ['s4_bossko', 11.6, BAR], // the Baron goes down: STAGE CLEAR!
  ['s4_waves', 7.5, HALF], ['s1_waves', 24.6, HALF], ['s4_waves', 15.0, HALF], ['s2_waves', 18.1, HALF],
  ['card_attract', 0, 4.5 * BAR, [[0.12, 'heavy'], [0.3, 'fanfare'], [1.0, 'special']]],
]);

const toss = at('intro'), news = at('card_news'), slam = at('card_slam'), hero = at('card_hero'), vs = at('card_vs_head'), baron = at('card_vs_baron'), end = at('card_attract');
const music = [
  { t0: toss, t1: slam, root: 52, tempo: 150, mode: 'minor', seed: 63, vol: 0.7, parts: { mel: false, snare: false } }, // tension under the story beats
  { t0: hero, t1: vs, root: 52, tempo: 150, mode: 'minor', seed: 63, vol: 1, parts: { drive: true, arp: true } },
  { t0: vs, t1: baron + BAR, root: 50, tempo: 150, mode: 'phrygian', seed: 61, vol: 1, parts: { drive: true, arp: true } },
  { t0: baron + BAR, t1: end, root: 52, tempo: 150, mode: 'dorian', seed: 63, vol: 1, parts: { drive: true, arp: true } },
  { t0: end + 2 * BAR, t1: total, root: 52, tempo: 150, mode: 'dorian', seed: 63, vol: 0.55, fadeOut: 0.8, parts: { kick: false, snare: false } }, // attract-loop bed under PUSH START
];
const extra = [
  { kind: 'chord', t: slam + 0.15, dur: 1.4, root: 52, mode: 'minor' }, { kind: 'boom', t: hero }, { kind: 'boom', t: vs }, { kind: 'boom', t: baron },
  { kind: 'riser', t0: end - 2 * HALF, t1: end }, { kind: 'chord', t: end + 0.12, dur: 4.5, root: 52, mode: 'dorian' },
];
const zoo = at('s0_waves'), ko = at('s4_bossko'), hype = ko + BAR;
const VO = narrate([ // echo: true gets the stadium repeats
  { t: 0.15, text: 'Saturday! Saturday! Saturday!', echo: true },
  { t: toss + 1.9, text: 'He saves the boy.', style: 'drama' },
  { t: news + 0.8, text: 'But they still want to kill...', style: 'drama' },
  { t: slam + 0.25, text: 'Harambe... escape... escape...', style: 'drama', echo: true },
  { t: hero + 1.1, text: 'Four hundred pounds of fury!' },
  { t: zoo + 0.3, text: 'Smash the zoo!' },
  { t: zoo + 2 * BAR + 0.3, text: 'Bust up the cops!' },
  { t: zoo + 4 * BAR + 0.3, text: 'Flatten the feds!' },
  { t: zoo + 6 * BAR + 0.3, text: 'Crush the army!' },
  { t: zoo + 8 * BAR + 0.3, text: 'And brawl your way home!' },
  { t: vs + 0.1, text: 'Five! Monster! Bosses!', echo: true },
  { t: baron + 0.1, text: 'And the Baron!' },
  { t: ko + 0.2, text: 'Down goes the Baron!' },
  { t: hype + 0.1, text: "It's free! It's in your browser! It's bananas!" },
  { t: end + 0.2, text: 'Play it today! Today! Today!', echo: true },
  { t: end + 4.8, text: 'The kid is fine. Bananas sold separately.', style: 'fine' },
], path.join(RAW, 'vo'));
VO.forEach((v, i) => { const next = VO[i + 1]?.t ?? total, speech = v.t + v.dur - (v.echo ? 2.8 : 0); // echo lines carry a 2.8 s tail (pad + repeats)
  console.log(`${v.t.toFixed(1)}-${speech.toFixed(1)}s ${v.text}${speech > next ? '   <-- RUNS INTO NEXT' : ''}`); });
await encode({ raw: RAW, out: OUT, segs, total, music, extra, musicVol: 0.5, sfxVol: 0.6, crt: true, voice: VO.map(v => [v.t, v.file]), voiceVol: 1.0 });
