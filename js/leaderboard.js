// Global leaderboard client (Supabase REST, public key only). Every call fails soft: the game never depends on the network.
import { LB_URL, LB_KEY } from './lbconfig.js';
const NAME_KEY = 'harambe-lb-name', TOKEN_KEY = 'harambe-lb-token', LAST_KEY = 'harambe-lb-last';
let memToken = null;
const ls = { get(k) { try { return localStorage.getItem(k); } catch (_) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (_) {} } };

// Light profanity filter: lower-case, de-leet, drop non-letters, then look for unambiguous bad stems.
const BAD = ['fuck', 'shit', 'bitch', 'cunt', 'nigg', 'fagg', 'whore', 'slut', 'pussy', 'nazi', 'hitler', 'retard', 'rapist', 'kkk'];
const LEET = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', $: 's', '@': 'a' };
export function cleanName(raw) {
  const s = String(raw == null ? '' : raw).replace(/\s+/g, ' ').trim();
  if (s.length < 3) return { ok: false, err: 'NAME: 3-12 CHARACTERS' };
  if (s.length > 12) return { ok: false, err: 'NAME: 3-12 CHARACTERS' };
  if (!/^[A-Za-z0-9 _.-]+$/.test(s)) return { ok: false, err: 'LETTERS, NUMBERS, _ . - ONLY' };
  if (/\d{5,}/.test(s.replace(/[ .-]/g, '')) || /\.(com|net|org|io)\b/i.test(s)) return { ok: false, err: 'NO PERSONAL INFO IN NAME' };
  const flat = s.toLowerCase().replace(/[013457$@]/g, c => LEET[c]).replace(/[^a-z]/g, '');
  if (BAD.some(b => flat.includes(b))) return { ok: false, err: 'PICK A DIFFERENT NAME' };
  return { ok: true, name: s };
}
export const getName = () => ls.get(NAME_KEY) || '';
export const setName = n => ls.set(NAME_KEY, n);
export function getToken() {
  let t = ls.get(TOKEN_KEY) || memToken;
  if (!t) { const a = new Uint8Array(16); (globalThis.crypto || {}).getRandomValues ? crypto.getRandomValues(a) : a.forEach((_, i) => a[i] = Math.random() * 256); t = Array.from(a, b => b.toString(16).padStart(2, '0')).join(''); memToken = t; ls.set(TOKEN_KEY, t); }
  return t;
}
export function getLast() { try { return JSON.parse(ls.get(LAST_KEY) || 'null'); } catch (_) { return null; } }
export function setLast(o) { ls.set(LAST_KEY, JSON.stringify(o)); }

async function rpc(fn, body, ms = 7000) {
  const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null, to = ctl && setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(LB_URL + '/rest/v1/rpc/' + fn, { method: 'POST', headers: { apikey: LB_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: ctl && ctl.signal });
    const j = await r.json().catch(() => null);
    if (!r.ok) { const e = new Error((j && j.message) || 'http ' + r.status); e.server = true; throw e; }
    return j;
  } finally { if (to) clearTimeout(to); }
}
export function friendlyError(e) {
  const m = String((e && e.message) || '');
  if (/slow down/.test(m)) return 'SLOW DOWN - TRY AGAIN IN A MOMENT';
  if (/rate limit/.test(m)) return 'TOO MANY SUBMISSIONS - TRY LATER';
  if (e && e.server) return 'SCORE REJECTED';
  return 'OFFLINE - SCORE NOT SAVED';
}
export async function submitScore({ name, score, stage, won }) {
  const r = await rpc('submit_score', { p_name: name, p_score: Math.max(0, Math.min(1e7, Math.round(score))), p_stage: stage, p_won: !!won, p_token: getToken() });
  return { id: r && r.id, rank: r && r.rank };
}
export async function fetchTop(n = 10) { const rows = await rpc('top_scores', { p_limit: n }); return Array.isArray(rows) ? rows : []; }
