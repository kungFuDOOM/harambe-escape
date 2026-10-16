// Versioned auto-save. Storage is injectable so it can be tested; every call is safe if storage is blocked.
export const SAVE_KEY = 'harambe-save', SAVE_VERSION = 1;
const num = (v, a, b, d) => (typeof v === 'number' && isFinite(v) ? Math.min(b, Math.max(a, v)) : d);
function store(s) { if (s) return s; try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch (_) { return null; } }

// Make a clean snapshot from the live game state (stage index, lives, score, max health).
export function makeSave(stage, p, score, stageCount = 5) {
  return { v: SAVE_VERSION, stage: Math.floor(num(stage, 0, stageCount - 1, 0)), lives: Math.round(num(p && p.lives, 1, 9, 3)), score: Math.round(num(score, 0, 1e9, 0)), max: Math.round(num(p && p.max, 1, 999, 100)), at: Date.now() };
}
// Validate parsed data; returns a clean save or null.
export function sanitize(d, stageCount = 5) {
  if (!d || typeof d !== 'object' || d.v !== SAVE_VERSION) return null;
  if (!Number.isInteger(d.stage) || d.stage < 0 || d.stage >= stageCount) return null;
  if (typeof d.lives !== 'number' || typeof d.score !== 'number') return null;
  return { v: SAVE_VERSION, stage: d.stage, lives: Math.round(num(d.lives, 1, 9, 3)), score: Math.round(num(d.score, 0, 1e9, 0)), max: Math.round(num(d.max, 1, 999, 100)), at: num(d.at, 0, 1e15, 0) };
}
export function writeSave(save, s) { const st = store(s); if (!st) return false; try { st.setItem(SAVE_KEY, JSON.stringify(save)); return true; } catch (_) { return false; } }
export function readSave(stageCount = 5, s) {
  const st = store(s); if (!st) return null;
  try { const raw = st.getItem(SAVE_KEY); if (!raw) return null; return sanitize(JSON.parse(raw), stageCount); } catch (_) { return null; }
}
export function clearSave(s) { const st = store(s); if (!st) return false; try { st.removeItem(SAVE_KEY); return true; } catch (_) { return false; } }
