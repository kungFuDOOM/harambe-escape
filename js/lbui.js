// Name-entry / wallet overlay. Plain DOM so phones get a real keyboard; styled to match the game's panels.
import { cleanName, checkWallet, getName, setName, getWallet, saveWallet, submitScore, friendlyError } from './leaderboard.js';
let el, input, wal, msg, title, sc, btnGo, btnSkip, cur = null;
const NOTE = 'WALLET OPTIONAL. ONLY FOR POSSIBLE FUTURE PRIZES. STORED PRIVATELY, NEVER SHOWN ON THE BOARD.';
function build() {
  if (el) return;
  el = document.createElement('div'); el.id = 'lbPrompt'; el.hidden = true;
  el.innerHTML = '<div class="lbbox"><div class="lbt"></div><div class="lbs"></div>'
    + '<div class="lbrow"><input class="lbname" type="text" maxlength="12" autocomplete="off" autocapitalize="characters" autocorrect="off" spellcheck="false" enterkeyhint="next" placeholder="YOUR NAME" aria-label="Leaderboard name (3 to 12 characters)"><button type="button" class="lbgo">SUBMIT</button><button type="button" class="lbsk">SKIP</button></div>'
    + '<div class="lbrow lbw"><input class="lbwal" type="text" maxlength="50" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="send" placeholder="SOL WALLET (OPTIONAL)" aria-label="Solana wallet address, optional"></div>'
    + '<div class="lbn"></div><div class="lbm"></div></div>';
  document.body.appendChild(el);
  input = el.querySelector('.lbname'); wal = el.querySelector('.lbwal'); msg = el.querySelector('.lbm'); title = el.querySelector('.lbt'); sc = el.querySelector('.lbs'); btnGo = el.querySelector('.lbgo'); btnSkip = el.querySelector('.lbsk');
  el.querySelector('.lbn').textContent = NOTE;
  el.addEventListener('pointerdown', e => e.stopPropagation()); el.addEventListener('keydown', e => e.stopPropagation()); el.addEventListener('keyup', e => e.stopPropagation());
  input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); wal.focus(); } else if (e.key === 'Escape') close(false); });
  wal.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); go(); } else if (e.key === 'Escape') close(false); });
  btnGo.addEventListener('click', go); btnSkip.addEventListener('click', () => close(false));
}
function close(sub) { el.hidden = true; try { input.blur(); wal.blur(); } catch (_) {} const c = cur; cur = null; if (c) c.done(sub); }
const bad = t => { msg.textContent = t; msg.className = 'lbm bad'; };
async function go() {
  if (!cur || btnGo.disabled) return;
  if (cur.finished) { const c = cur; cur = null; el.hidden = true; c.done(true, true); return; }
  const v = cleanName(input.value); if (!v.ok) return bad(v.err);
  const w = checkWallet(wal.value); if (!w.ok) return bad(w.err);
  btnGo.disabled = true; msg.textContent = 'SENDING...'; msg.className = 'lbm';
  let note = '';
  try {
    if (cur.walletOnly) { await saveWallet(v.name, w.wallet); setName(v.name); msg.textContent = w.wallet ? 'WALLET SAVED' : 'WALLET REMOVED'; msg.className = 'lbm ok'; cur.finished = true; btnGo.disabled = false; btnGo.textContent = 'OK'; btnSkip.hidden = true; return; }
    const r = await submitScore({ name: v.name, score: cur.score, stage: cur.stage, won: cur.won });
    setName(v.name); cur.finished = true; cur.result = { id: r.id, rank: r.rank, name: v.name, score: cur.score };
    cur.onSaved && cur.onSaved(cur.result);
    if (w.wallet || getWallet()) { try { await saveWallet(v.name, w.wallet); note = w.wallet ? ' WALLET SAVED.' : ''; } catch (e) { note = ' (WALLET NOT SAVED: ' + friendlyError(e).replace('SCORE ', '') + ')'; } }
    msg.textContent = 'SAVED!' + (r.rank ? ' YOU ARE RANK #' + r.rank + '.' : '') + note; msg.className = 'lbm ok';
    btnGo.textContent = 'LEADERBOARD'; btnGo.disabled = false; btnSkip.textContent = 'CLOSE'; input.disabled = true; wal.disabled = true;
  } catch (e) { bad(friendlyError(e) + ' (RETRY OR SKIP)'); btnGo.disabled = false; }
}
// opts: {score, stage, won, title, walletOnly, onSaved, done(submitted, openBoard)}
export function openPrompt(opts) {
  build(); cur = { ...opts, finished: false };
  title.textContent = opts.title; sc.textContent = opts.walletOnly ? 'SOL WALLET FOR POSSIBLE FUTURE PRIZES' : 'SCORE ' + opts.score; sc.hidden = false;
  msg.textContent = opts.walletOnly ? 'LEAVE WALLET EMPTY TO REMOVE IT' : 'ENTER A NAME FOR THE GLOBAL BOARD'; msg.className = 'lbm';
  btnGo.textContent = opts.walletOnly ? 'SAVE' : 'SUBMIT'; btnGo.disabled = false; btnSkip.textContent = opts.walletOnly ? 'CANCEL' : 'SKIP'; btnSkip.hidden = false;
  input.disabled = false; wal.disabled = false; input.value = getName(); wal.value = getWallet();
  el.hidden = false; setTimeout(() => { try { (input.value ? wal : input).focus(); } catch (_) {} }, 50);
}
export const promptOpen = () => !!cur;
