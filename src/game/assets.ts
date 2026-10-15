export type AnimKey =
  | "idle"
  | "run"
  | "strike"
  | "jump"
  | "keeper"
  | "cop"
  | "tranq"
  | "impact";

export type Sheet = {
  img: HTMLImageElement;
  cols: number;
  rows: number;
  ready: boolean;
};

export type ArtSet = Record<AnimKey, Sheet | null>;

export const SPRITE_SPECS: { key: AnimKey; src: string }[] = [
  { key: "idle", src: "/sprites/harambe-idle.png" },
  { key: "run", src: "/sprites/harambe-run.png" },
  { key: "strike", src: "/sprites/harambe-strike.png" },
  { key: "jump", src: "/sprites/harambe-jump.png" },
  { key: "keeper", src: "/sprites/keeper.png" },
  { key: "cop", src: "/sprites/cop.png" },
  { key: "tranq", src: "/sprites/tranq.png" },
  { key: "impact", src: "/sprites/impact.png" },
];

export function createArt(): ArtSet {
  return {
    idle: null,
    run: null,
    strike: null,
    jump: null,
    keeper: null,
    cop: null,
    tranq: null,
    impact: null,
  };
}

export function loadArt(art: ArtSet) {
  for (const spec of SPRITE_SPECS) {
    const img = new Image();
    img.crossOrigin = "anonymous";
    const sheet: Sheet = { img, cols: 2, rows: 2, ready: false };
    img.onload = () => {
      sheet.ready = img.naturalWidth > 16;
    };
    img.onerror = () => {
      sheet.ready = false;
    };
    img.src = spec.src;
    art[spec.key] = sheet;
  }
}

export function drawSheet(
  ctx: CanvasRenderingContext2D,
  sheet: Sheet | null | undefined,
  frame: number,
  cx: number,
  feet: number,
  height: number,
  facing: number,
): boolean {
  if (!sheet?.ready) return false;
  const { img, cols, rows } = sheet;
  const fw = img.width / cols;
  const fh = img.height / rows;
  const count = cols * rows;
  const f = ((Math.floor(frame) % count) + count) % count;
  const col = f % cols;
  const row = Math.floor(f / cols);
  const w = height * (fw / fh);
  const o = Math.max(1, Math.round(height * 0.018));
  ctx.save();
  ctx.translate(Math.round(cx), Math.round(feet));
  ctx.scale(facing < 0 ? -1 : 1, 1);
  ctx.imageSmoothingEnabled = false;
  ctx.shadowColor = "#120c08";
  ctx.shadowBlur = 0;
  for (const [dx, dy] of [
    [o, 0],
    [-o, 0],
    [0, o],
    [0, -o],
  ] as const) {
    ctx.shadowOffsetX = dx;
    ctx.shadowOffsetY = dy;
    ctx.drawImage(img, col * fw, row * fh, fw, fh, -w / 2, -height, w, height);
  }
  ctx.shadowColor = "transparent";
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  ctx.drawImage(img, col * fw, row * fh, fw, fh, -w / 2, -height, w, height);
  ctx.restore();
  return true;
}
