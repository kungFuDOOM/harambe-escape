// Shared edit/encode for the trailer cuts (build.mjs, build-doc.mjs): lays out a cut list, collects the in-game sound
// effects that fall inside each cut, renders the soundtrack (audio.mjs), optionally mixes a voice-over on top (ducking
// the game audio under it), and encodes a 1080p MP4 with frame-exact trims and a 2x nearest-neighbour upscale.
import { renderAudio } from './audio.mjs';
import { FPS } from './harness.mjs';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

// list: [clip, start s, duration s, extra sfx [[t, name]] relative to the cut]
export function layout(list) {
  const segs = list.map(([clip, start, dur, extra = []]) => ({ clip, start, dur, extra }));
  let t = 0; for (const s of segs) { s.at = t; t += Math.round(s.dur * FPS) / FPS; }
  return { segs, total: t, at: name => segs.find(s => s.clip === name).at };
}

function sfxLog(raw, clip) { // capture.mjs names its logs after the job, e.g. s4_bossko.mp4 -> boss_4_16_5_0.12.sfx.json
  const m = clip.match(/^s(\d)_(waves|boss|bossko)$/);
  const f = m ? `${m[2] === 'waves' ? 'waves' : 'boss'}_${m[1]}${m[2] === 'bossko' ? '_16_5_0.12' : ''}` : clip.startsWith('cs') ? null : clip;
  const p = f && path.join(raw, f + '.sfx.json'); return p && existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : [];
}

export async function encode({ raw, out, segs, total, music, extra, musicVol = 0.5, sfxVol = 0.55, voice = [], voiceVol = 1.6 }) {
  const sfx = [];
  for (const s of segs) {
    for (const [ts, n] of sfxLog(raw, s.clip)) if (ts >= s.start && ts < s.start + s.dur - 0.02) sfx.push([s.at + ts - s.start, n]);
    for (const [ts, n] of s.extra) sfx.push([s.at + ts, n]);
  }
  console.log(`${path.basename(out)}: ${total.toFixed(2)}s, ${segs.length} cuts, ${sfx.length} sfx, ${voice.length} voice lines`);
  const wavPath = out.replace(/\.mp4$/, '.wav');
  writeFileSync(wavPath, await renderAudio({ dur: total + 0.5, sfx, music, extra, musicVol, sfxVol }));

  const files = [...new Set(segs.map(s => s.clip))], idx = Object.fromEntries(files.map((f, i) => [f, i]));
  const vparts = segs.map((s, i) => { const a = Math.round(s.start * FPS), b = a + Math.round(s.dur * FPS);
    return `[${idx[s.clip]}:v]trim=start_frame=${a}:end_frame=${b},setpts=PTS-STARTPTS,format=yuv444p[v${i}]`; });
  let fc = vparts.join(';') + ';' + segs.map((_, i) => `[v${i}]`).join('') + `concat=n=${segs.length}:v=1:a=0,scale=1920:1080:flags=neighbor,`
    + `fade=t=in:st=0:d=0.6,fade=t=out:st=${(total - 0.5).toFixed(3)}:d=0.5,format=yuv420p[v]`;
  const ga = files.length, master = `loudnorm=I=-14:TP=-1.5:LRA=11,afade=t=out:st=${(total - 0.6).toFixed(3)}:d=0.6`;
  if (voice.length) { // each line delayed into place; the game audio ducks under the narration
    fc += ';' + voice.map(([t], i) => `[${ga + 1 + i}:a]aresample=48000,aformat=channel_layouts=stereo,adelay=${Math.round(t * 1000)}:all=1[n${i}]`).join(';')
      + ';' + voice.map((_, i) => `[n${i}]`).join('') + `amix=inputs=${voice.length}:normalize=0,volume=${voiceVol},asplit[vo][key]`
      + `;[${ga}:a]aresample=48000[g];[g][key]sidechaincompress=threshold=0.02:ratio=5:attack=30:release=500[gd]`
      + `;[gd][vo]amix=inputs=2:normalize=0,${master}[a]`;
  } else fc += `;[${ga}:a]${master}[a]`;
  const args = ['-loglevel', 'error', '-y', ...files.flatMap(f => ['-i', path.join(raw, f + '.mp4')]), '-i', wavPath, ...voice.flatMap(([, w]) => ['-i', w]),
    '-filter_complex', fc, '-map', '[v]', '-map', '[a]', '-ar', '48000',
    '-c:v', 'libx264', '-preset', 'slow', '-tune', 'animation', '-crf', '24', '-r', String(FPS), '-c:a', 'aac', '-b:a', '192k', '-t', total.toFixed(3), '-movflags', '+faststart', out];
  const r = spawnSync('ffmpeg', args, { stdio: 'inherit' });
  if (r.status) process.exit(r.status);
  console.log('wrote', out);
}
