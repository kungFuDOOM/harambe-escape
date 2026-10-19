// Narration: Piper TTS (https://github.com/rhasspy/piper) + an ffmpeg effects chain per line, cached by content.
// styles: 'shout' = monster-truck radio announcer (pitched down, slammed compressor, soft-clipped, slapback room);
//         'drama' = slower, deeper, ominous read for the story beats;
//         'fine'  = fast small-print read; echo: true adds the big stadium repeats (SATURDAY! saturday... saturday...).
// env: PIPER (binary, default "piper"), PIPER_VOICE (.onnx voice model, e.g. en_US-joe-medium.onnx)
import { existsSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';

const STYLE = {
  shout: { tts: ['--length-scale', '0.92', '--noise-scale', '0.9', '--noise-w-scale', '1.0'],
    fx: 'asetrate=22050*0.92,aresample=22050,atempo=1.06,highpass=f=90,lowpass=f=7500,equalizer=f=2500:t=q:w=1:g=5,'
      + 'acompressor=threshold=-28dB:ratio=10:attack=3:release=60:makeup=14dB,volume=1.4,asoftclip=type=tanh,aecho=0.8:0.6:45:0.25' },
  drama: { tts: ['--length-scale', '1.25', '--noise-scale', '0.7', '--noise-w-scale', '0.9', '--sentence-silence', '0.3'], // slow, low, ominous
    fx: 'asetrate=22050*0.86,aresample=22050,atempo=1.04,highpass=f=70,lowpass=f=6500,equalizer=f=180:t=q:w=1:g=4,'
      + 'acompressor=threshold=-28dB:ratio=8:attack=5:release=120:makeup=12dB,volume=1.2,asoftclip=type=tanh,aecho=0.8:0.6:60:0.3' },
  fine: { tts: ['--length-scale', '0.62', '--noise-scale', '0.5'],
    fx: 'highpass=f=150,lowpass=f=6000,acompressor=threshold=-24dB:ratio=6:attack=5:release=80:makeup=8dB,volume=0.55' },
};
const ECHO = ',apad=pad_dur=1.6,aecho=0.9:0.8:300|600|900|1200:0.6|0.42|0.28|0.16';

export function narrate(lines, cacheDir) {
  const PIPER = process.env.PIPER || 'piper', VOICE = process.env.PIPER_VOICE;
  if (!VOICE) { console.error('set PIPER_VOICE to a Piper .onnx voice (e.g. en_US-joe-medium.onnx)'); process.exit(1); }
  mkdirSync(cacheDir, { recursive: true });
  return lines.map(({ t, text, style = 'shout', echo = false }) => {
    const S = STYLE[style], fx = S.fx + (echo ? ECHO : '') + ',alimiter=limit=0.9';
    const key = createHash('sha1').update([VOICE, text, S.tts.join(' '), fx].join('|')).digest('hex').slice(0, 12);
    const raw = path.join(cacheDir, key + '.raw.wav'), out = path.join(cacheDir, key + '.wav');
    if (!existsSync(out)) {
      let r = spawnSync(PIPER, ['-m', VOICE, ...S.tts, '-f', raw], { input: text, stdio: ['pipe', 'ignore', 'inherit'] });
      if (!r.status) r = spawnSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', raw, '-af', fx, '-ar', '48000', out], { stdio: 'inherit' });
      if (r.status) process.exit(r.status || 1);
    }
    const dur = +spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', out]).stdout.toString();
    return { t, text, echo, file: out, dur };
  });
}
