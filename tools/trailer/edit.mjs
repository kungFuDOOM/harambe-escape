// Shared edit/encode for the trailer cuts (build.mjs, build-doc.mjs): lays out a cut list, collects the in-game sound
// effects that fall inside each cut, renders the soundtrack (audio.mjs), optionally mixes a voice-over on top (ducking
// the game audio under it), and encodes a 1080p MP4 with frame-exact trims and a 2x nearest-neighbour upscale.
import { renderAudio } from './audio.mjs';
import { FPS } from './harness.mjs';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

// list: [clip, start s, duration s, extra sfx [[t, name]] relative to the cut, overlay clip drawn over the cut from its frame 0]
export function layout(list) {
  const segs = list.map(([clip, start, dur, extra = [], ov = null]) => ({ clip, start, dur, extra, ov }));
  let t = 0; for (const s of segs) { s.at = t; t += Math.round(s.dur * FPS) / FPS; }
  return { segs, total: t, at: name => segs.find(s => s.clip === name).at };
}

function sfxLog(raw, clip) { // record() writes <clip>.sfx.json; older captures only have the job-named log, e.g. boss_4_16_5_0.12.sfx.json
  const own = path.join(raw, clip + '.sfx.json'); if (existsSync(own)) return JSON.parse(readFileSync(own, 'utf8'));
  const m = clip.match(/^s(\d)_(waves|boss|bossko)$/);
  const f = m ? `${m[2] === 'waves' ? 'waves' : 'boss'}_${m[1]}${m[2] === 'bossko' ? '_16_5_0.12' : ''}` : clip.startsWith('cs') ? null : clip;
  const p = f && path.join(raw, f + '.sfx.json'); return p && existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : [];
}

const src = (raw, clip) => { const mp4 = path.join(raw, clip + '.mp4'); return existsSync(mp4) ? mp4 : path.join(raw, clip + '.mov'); };

// crt: scanlines on every 6th device row (one logic pixel row) plus a soft vignette, overlaid on the 1080p picture
function crtMask(raw) {
  const f = path.join(raw, 'crt-mask.png');
  if (!existsSync(f)) spawnSync('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=black:s=1920x1080,format=rgba', '-frames:v', '1', '-vf',
    "geq=r=0:g=0:b=0:a='min(255,if(gte(mod(Y,6),4),46,0)+60*pow(hypot((X-960)/960,(Y-540)/540),3))'", f], { stdio: 'inherit' });
  return f;
}

export async function encode({ raw, out, segs, total, music, extra, musicVol = 0.5, sfxVol = 0.55, voice = [], voiceVol = 1.6, crt = false }) {
  const sfx = [];
  for (const s of segs) {
    for (const [ts, n] of sfxLog(raw, s.clip)) if (ts >= s.start && ts < s.start + s.dur - 0.02) sfx.push([s.at + ts - s.start, n]);
    for (const [ts, n] of s.extra) sfx.push([s.at + ts, n]);
  }
  console.log(`${path.basename(out)}: ${total.toFixed(2)}s, ${segs.length} cuts, ${sfx.length} sfx, ${voice.length} voice lines`);
  const wavPath = out.replace(/\.mp4$/, '.wav');
  writeFileSync(wavPath, await renderAudio({ dur: total + 0.5, sfx, music, extra, musicVol, sfxVol }));

  const files = [...new Set(segs.flatMap(s => s.ov ? [s.clip, s.ov] : [s.clip]))], idx = Object.fromEntries(files.map((f, i) => [f, i]));
  const frames = Object.fromEntries(files.map(f => [f, +spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v', '-show_entries', 'stream=nb_frames', '-of', 'csv=p=0', src(raw, f)]).stdout.toString()]));
  for (const s of segs) for (const [f, a] of s.ov ? [[s.clip, s.start], [s.ov, 0]] : [[s.clip, s.start]]) // a short source would silently shift every later cut off the soundtrack
    if (Math.round(a * FPS) + Math.round(s.dur * FPS) > frames[f]) { console.error(`${f} has ${frames[f]} frames, cut needs ${Math.round(a * FPS) + Math.round(s.dur * FPS)}: re-capture it longer`); process.exit(1); }
  const vparts = segs.map((s, i) => { const a = Math.round(s.start * FPS), n = Math.round(s.dur * FPS);
    const base = `[${idx[s.clip]}:v]trim=start_frame=${a}:end_frame=${a + n},setpts=PTS-STARTPTS,format=yuv444p`;
    return s.ov ? `${base}[b${i}];[${idx[s.ov]}:v]trim=start_frame=0:end_frame=${n},setpts=PTS-STARTPTS,format=rgba[o${i}];[b${i}][o${i}]overlay=format=auto,format=yuv444p[v${i}]`
      : `${base}[v${i}]`; });
  let fc = vparts.join(';') + ';' + segs.map((_, i) => `[v${i}]`).join('') + `concat=n=${segs.length}:v=1:a=0,scale=1920:1080:flags=neighbor`
    + (crt ? `[pic];movie=${crtMask(raw)},format=rgba[mask];[pic][mask]overlay=format=auto` : '')
    + `,fade=t=in:st=0:d=0.3,fade=t=out:st=${(total - 0.5).toFixed(3)}:d=0.5,format=yuv420p[v]`;
  const ga = files.length, master = `loudnorm=I=-14:TP=-1.5:LRA=11,afade=t=out:st=${(total - 0.6).toFixed(3)}:d=0.6`;
  if (voice.length) { // each line delayed into place; the game audio ducks under the narration
    fc += ';' + voice.map(([t], i) => `[${ga + 1 + i}:a]aresample=48000,aformat=channel_layouts=stereo,adelay=${Math.round(t * 1000)}:all=1[n${i}]`).join(';')
      + ';' + voice.map((_, i) => `[n${i}]`).join('') + `amix=inputs=${voice.length}:normalize=0,volume=${voiceVol},asplit[vo][k0];[k0]apad[key]` // padded key: the ducker must not end with the last line
      + `;[${ga}:a]aresample=48000[g];[g][key]sidechaincompress=threshold=0.02:ratio=5:attack=30:release=500[gd]`
      + `;[gd][vo]amix=inputs=2:normalize=0,${master}[a]`;
  } else fc += `;[${ga}:a]${master}[a]`;
  const args = ['-loglevel', 'error', '-y', ...files.flatMap(f => ['-i', src(raw, f)]), '-i', wavPath, ...voice.flatMap(([, w]) => ['-i', w]),
    '-filter_complex', fc, '-map', '[v]', '-map', '[a]', '-ar', '48000',
    '-c:v', 'libx264', '-preset', 'slow', '-tune', 'animation', '-crf', '24', '-r', String(FPS), '-c:a', 'aac', '-b:a', '192k', '-t', total.toFixed(3), '-movflags', '+faststart', out];
  const r = spawnSync('ffmpeg', args, { stdio: 'inherit' });
  if (r.status) process.exit(r.status);
  console.log('wrote', out);
}
