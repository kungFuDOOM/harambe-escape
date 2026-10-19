// The arcade trailers' narration: monster-truck opener, the three story beats, the closing call. Times are given relative
// to each cut's cards, so every arcade cut gets the same reads in the same places.
import { narrate, HARAMBE } from './voice.mjs';
import { writeFileSync } from 'node:fs';
import path from 'node:path';

export function arcadeVO(raw, out, { toss, news, slam, end, total }) {
  const VO = narrate([ // echo: true gets the stadium repeats
    { t: 0.15, text: 'Saturday! Saturday! Saturday!', echo: true },
    { t: toss + 1.9, text: 'He saves the boy.', style: 'drama' },
    { t: news + 0.8, text: 'But they still want to kill.', style: 'drama' },
    { t: slam + 0.2, text: `${HARAMBE}.`, style: 'drama' }, // three separate beats: read as one sentence it blurs into "Grombe Skate"
    { t: slam + 1.2, text: 'Escape.', style: 'drama' },
    { t: slam + 2.25, text: 'Escape.', style: 'drama' },
    { t: end + 0.2, text: 'Play it today! Today! Today!', echo: true },
  ], path.join(raw, 'vo'));
  VO.forEach((v, i) => { const next = VO[i + 1]?.t ?? total, speech = v.t + v.dur - (v.echo ? 2.8 : 0); // echo lines carry a 2.8 s tail (pad + repeats)
    console.log(`${v.t.toFixed(1)}-${speech.toFixed(1)}s ${v.text}${speech > next ? '   <-- RUNS INTO NEXT' : ''}`); });
  writeFileSync(out.replace(/\.mp4$/, '.vo.json'), JSON.stringify(VO, null, 1)); // line -> file list, for checking the reads (e.g. with a speech recognizer)
  return VO.map(v => [v.t, v.file]);
}
