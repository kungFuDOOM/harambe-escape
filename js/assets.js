// Asset loader. Characters and stage backgrounds are AI-generated 16-bit art, sliced by tools/ai-art (atlas.json, bg/bg.json).
// The props atlas (crates, bananas, sparks, kid) and pixel font still come from tools/art.
const img = src => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('asset ' + src)); i.src = src; });
export const A = { atlas: null, sheets: {}, flash: {}, props: null, propsImg: null, propsAi: null, propsAiImg: null, font: null, bgMeta: null, bg: {}, icon: null, ready: false };

function whiteCopy(im) { // white silhouette of a sheet, used for hit flashes
  const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const g = c.getContext('2d');
  g.drawImage(im, 0, 0); g.globalCompositeOperation = 'source-atop'; g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); return c;
}
export async function loadAssets() {
  const [atlas, bgMeta, props, propsAi] = await Promise.all([fetch('assets/atlas.json').then(r => r.json()), fetch('assets/bg/bg.json').then(r => r.json()), fetch('assets/props.json').then(r => r.json()), fetch('assets/props_ai.json').then(r => r.json())]);
  A.atlas = atlas; A.bgMeta = bgMeta; A.props = props; A.propsAi = propsAi;
  const jobs = [];
  for (const k of Object.keys(atlas)) jobs.push(img('assets/' + atlas[k].img).then(i => { A.sheets[k] = i; A.flash[k] = whiteCopy(i); }));
  jobs.push(img('assets/props.png').then(i => A.propsImg = i), img('assets/props_ai.png').then(i => A.propsAiImg = i), img('assets/font.png').then(i => A.font = i), img('assets/icon.png').then(i => A.icon = i));
  for (const [k, m] of Object.entries(bgMeta)) {
    A.bg[k] = {};
    jobs.push(img(`assets/bg/${k}.webp`).then(i => A.bg[k].main = i));
    if (m.sky) jobs.push(img(`assets/bg/${k}_sky.webp`).then(i => A.bg[k].sky = i));
    if (m.fg) jobs.push(img(`assets/bg/${k}_fg.webp`).then(i => A.bg[k].fg = i));
  }
  await Promise.all(jobs); A.ready = true;
}
