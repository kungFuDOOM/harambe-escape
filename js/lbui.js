// Name-entry overlay shown when a run ends. Plain DOM so phones get a real keyboard; styled to match the game's panels.
import { cleanName, getName, setName, submitScore, friendlyError } from './leaderboard.js';
let el, input, msg, title, sc, btnGo, btnSkip, btnLb, cur = null;
function build() {
  if (el) return;
  el = document.createElement('div'); el.id = 'lbPrompt'; el.hidden = true;
  el.innerHTML = '<div class="lbbox"><div class="lbt"></div><div class="lbs"></div><div class="lbrow"><input type="text" maxlength="12" autocomplete="off" autocapitalize="characters" autocorrect="off" spellcheck="false" enterkeyhint="send" placeholder="YOUR NAME" aria-label="Leaderboard name (3 to 12 characters)"><button type="button" class="lbgo">SUBMIT</button><button type="button" class="lbsk">SKIP</button></div><div class="lbm"></div></div>';
  document.body.appendChild(el);
  input = el.querySelector('input'); msg = el.querySelector('.lbm'); title = el.querySelector('.lbt'); sc = el.querySelector('.lbs'); btnGo = el.querySelector('.lbgo'); btnSkip = el.querySelector('.lbsk');
  el.addEventListener('pointerdown', e => e.stopPropagation()); el.addEventListener('keydown', e => e.stopPropagation()); el.addEventListener('keyup', e => e.stopPropagation());
  input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); go(); } else if (e.key === 'Escape') close(false); });
  btnGo.addEventListener('click', go); btnSkip.addEventListener('click', () => close(false));
}
function close(sub) { el.hidden = true; try { input.blur(); } catch (_) {} const c = cur; cur = null; if (c) c.done(sub); }
async function go() {
  if (!cur) return;
  if (cur.finished) { const c = cur; cur = null; el.hidden = true; c.done(true, true); return; }
  const v = cleanName(input.value); if (!v.ok) { msg.textContent = v.err; msg.className = 'lbm bad'; return; }
  btnGo.disabled = true; msg.textContent = 'SENDING...'; msg.className = 'lbm';
  try {
    const r = await submitScore({ name: v.name, score: cur.score, stage: cur.stage, won: cur.won });
    setName(v.name); cur.finished = true;
    msg.textContent = 'SAVED!' + (r.rank ? ' YOU ARE RANK #' + r.rank : ''); msg.className = 'lbm ok';
    btnGo.textContent = 'LEADERBOARD'; btnGo.disabled = false; btnSkip.textContent = 'CLOSE'; input.disabled = true;
    cur.result = { id: r.id, rank: r.rank, name: v.name, score: cur.score };
    cur.onSaved && cur.onSaved(cur.result);
  } catch (e) { msg.textContent = friendlyError(e) + ' (RETRY OR SKIP)'; msg.className = 'lbm bad'; btnGo.disabled = false; }
}
// opts: {score, stage, won, title, onSaved, done(submitted, openBoard)}
export function openPrompt(opts) {
  build(); cur = { ...opts, finished: false };
  title.textContent = opts.title; sc.textContent = 'SCORE ' + opts.score; msg.textContent = 'ENTER A NAME FOR THE GLOBAL BOARD'; msg.className = 'lbm';
  btnGo.textContent = 'SUBMIT'; btnGo.disabled = false; btnSkip.textContent = 'SKIP'; input.disabled = false; input.value = getName();
  el.hidden = false; setTimeout(() => { try { input.focus(); input.select(); } catch (_) {} }, 50);
}
export const promptOpen = () => !!cur;
