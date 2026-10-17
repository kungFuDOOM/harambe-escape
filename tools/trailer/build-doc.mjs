// The 30 s "nature documentary" cut: mostly gameplay, a hushed narrator, soft music, logo.
// Narration is synthesized with Piper (https://github.com/rhasspy/piper) using a stock British voice; lines are cached.
// usage: PIPER=/path/to/piper PIPER_VOICE=/path/to/en_GB-alan-medium.onnx node tools/trailer/build-doc.mjs <rawdir> <out.mp4>
import { layout, encode } from './edit.mjs';
import { existsSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';

const RAW = path.resolve(process.argv[2] || 'trailer-raw'), OUT = path.resolve(process.argv[3] || 'harambe-doc.mp4');
const PIPER = process.env.PIPER || 'piper', VOICE = process.env.PIPER_VOICE;
if (!VOICE) { console.error('set PIPER_VOICE to a Piper .onnx voice (e.g. en_GB-alan-medium.onnx)'); process.exit(1); }

const { segs, total, at } = layout([
  ['s0_waves', 0.3, 5.4], // the zoo gates; a crate does not survive
  ['s0_waves', 6.6, 6.4], // keepers with nets... KO at 12.8
  ['s1_waves', 6.4, 4.8], // the police arrive
  ['s4_waves', 4.6, 5.0], // chest-pound shockwave at 7.7
  ['s4_bossko', 9.6, 4.0], // the Baron goes down: STAGE CLEAR!
  ['card_end', 0, 5.0, [[0.05, 'fanfare'], [1.15, 'special']]],
]);

// [start s on the timeline, line]
const SCRIPT = [
  [0.5, 'Cincinnati. In the concrete jungle, the silverback stirs.'],
  [5.4, 'The zookeeper approaches, armed with a net. A bold strategy.'],
  [10.2, 'It will not work.'],
  [12.0, 'The local police travel in packs. They rarely learn.'],
  [16.5, 'When threatened, the male performs a dramatic chest display.'],
  [21.9, 'And still... the jungle calls him home.'],
  [27.2, "The child, I'm told, is fine."],
];
const cache = path.join(RAW, 'vo'); mkdirSync(cache, { recursive: true });
const dur = f => +spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).stdout.toString();
const voice = SCRIPT.map(([t, line]) => {
  const f = path.join(cache, createHash('sha1').update(VOICE + line).digest('hex').slice(0, 12) + '.wav');
  if (!existsSync(f)) {
    const r = spawnSync(PIPER, ['-m', VOICE, '--length-scale', '1.1', '-f', f], { input: line, stdio: ['pipe', 'ignore', 'inherit'] });
    if (r.status) process.exit(r.status || 1);
  }
  return [t, f];
});
voice.forEach(([t, f], i) => { const end = t + dur(f), next = voice[i + 1]?.[0] ?? total;
  console.log(`${t.toFixed(1)}-${end.toFixed(1)}s ${SCRIPT[i][1]}${end > next ? '   <-- OVERLAPS NEXT' : ''}`); });

const end = at('card_end');
const music = [ // soft, drumless underscore in the cutscene style
  { t0: 0, t1: end, root: 48, tempo: 80, mode: 'dorian', seed: 59, vol: 0.8, fadeOut: 0.4, parts: { kick: false, snare: false, hat: false } },
];
const extra = [{ kind: 'chord', t: end, dur: 4.5, root: 48, mode: 'dorian' }];
await encode({ raw: RAW, out: OUT, segs, total, music, extra, musicVol: 0.45, sfxVol: 0.5, voice });
