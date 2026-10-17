// Cuts the raw footage (capture.mjs) into the trailer, renders its soundtrack (audio.mjs) and encodes a 1080p MP4.
// usage: node tools/trailer/build.mjs <rawdir> <out.mp4>
import { renderAudio } from './audio.mjs';
import { FPS } from './harness.mjs';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
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
const segs = [...ACT1, ...ACT2].map(([clip, start, dur, extra = []]) => ({ clip, start, dur, extra }));
let t = 0; for (const s of segs) { s.at = t; t += Math.round(s.dur * FPS) / FPS; }
const TOTAL = t, A2 = segs[ACT1.length].at;
const at = name => segs.find(s => s.clip === name).at;

// ---- soundtrack: clip sfx in place + trailer stings + music sections on the bar grid ----
const sfx = [];
const logFor = clip => { const m = clip.match(/^s(\d)_(waves|boss|bossko)$/), f = m ? `${m[2] === 'waves' ? 'waves' : 'boss'}_${m[1]}${m[2] === 'bossko' ? '_16_5_0.12' : ''}` : clip.startsWith('cs') ? null : clip;
  const p = f && path.join(RAW, f + '.sfx.json'); return p && existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : []; };
for (const s of segs) {
  for (const [ts, n] of logFor(s.clip)) if (ts >= s.start && ts < s.start + s.dur - 0.02) sfx.push([s.at + ts - s.start, n]);
  for (const [ts, n] of s.extra) sfx.push([s.at + ts, n]);
}
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
console.log(`trailer ${TOTAL.toFixed(2)}s, ${segs.length} cuts, ${sfx.length} sfx`);
const wav = await renderAudio({ dur: TOTAL + 0.5, sfx, music, extra, musicVol: 0.5, sfxVol: 0.55 });
const wavPath = OUT.replace(/\.mp4$/, '.wav'); writeFileSync(wavPath, wav);

// ---- picture: frame-exact trims, 2x nearest-neighbour upscale to 1080p, fades at the ends ----
const files = [...new Set(segs.map(s => s.clip))], idx = Object.fromEntries(files.map((f, i) => [f, i]));
const parts = segs.map((s, i) => { const a = Math.round(s.start * FPS), b = a + Math.round(s.dur * FPS);
  return `[${idx[s.clip]}:v]trim=start_frame=${a}:end_frame=${b},setpts=PTS-STARTPTS,format=yuv444p[v${i}]`; });
const fc = parts.join(';') + ';' + segs.map((_, i) => `[v${i}]`).join('') + `concat=n=${segs.length}:v=1:a=0,scale=1920:1080:flags=neighbor,`
  + `fade=t=in:st=0:d=0.6,fade=t=out:st=${(TOTAL - 0.5).toFixed(3)}:d=0.5,format=yuv420p[v]`;
const args = ['-loglevel', 'error', '-y', ...files.flatMap(f => ['-i', path.join(RAW, f + '.mp4')]), '-i', wavPath, '-filter_complex', fc,
  '-map', '[v]', '-map', `${files.length}:a`, '-af', `loudnorm=I=-14:TP=-1.5:LRA=11,afade=t=out:st=${(TOTAL - 0.6).toFixed(3)}:d=0.6`, '-ar', '48000',
  '-c:v', 'libx264', '-preset', 'slow', '-tune', 'animation', '-crf', '24', '-r', String(FPS), '-c:a', 'aac', '-b:a', '192k', '-t', TOTAL.toFixed(3), '-movflags', '+faststart', OUT];
const r = spawnSync('ffmpeg', args, { stdio: 'inherit' });
if (r.status) process.exit(r.status);
console.log('wrote', OUT);
