export const CHAR_H = 210;

export type View = {
  w: number;
  h: number;
  s: number;
  worldW: number;
  groundBack: number;
  groundFront: number;
};

export function makeView(w: number, h: number): View {
  // Widescreen belt-scroller: always show a long stretch of street,
  // even when the monitor is short. Height only caps sprite size.
  const wide = w / 1040;
  const tall = (0.5 * h) / CHAR_H;
  const s = Math.max(0.04, Math.min(wide, tall));
  return {
    w,
    h,
    s,
    worldW: w / s,
    groundBack: h * 0.36,
    groundFront: Math.min(h * 0.94, h - 2),
  };
}

export function project(
  x: number,
  z: number,
  y: number,
  camX: number,
  v: View,
): { sx: number; sy: number } {
  return {
    sx: (x - camX) * v.s,
    sy: v.groundBack + z * (v.groundFront - v.groundBack) - y * v.s,
  };
}
