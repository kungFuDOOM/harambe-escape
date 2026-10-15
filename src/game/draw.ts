import { drawSheet, type ArtSet, type AnimKey } from "@/game/assets";
import { GOAL_X, MAX_HP, WORLD_END, type Block, type Enemy, type GameSim, type Player } from "@/game/engine";
import { CHAR_H, project, type View } from "@/game/view";

type RGB = [number, number, number];

function hash(n: number) {
  const x = Math.sin(n * 127.1 + 19.19) * 43758.5453;
  return x - Math.floor(x);
}

function mix(a: RGB, b: RGB, t: number): RGB {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function css(c: RGB) {
  return `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
}

function smooth(x: number, a: number, b: number) {
  if (x <= a) return 0;
  if (x >= b) return 1;
  const t = (x - a) / (b - a);
  return t * t * (3 - 2 * t);
}

function biome(x: number) {
  const city = smooth(x, 1750, 2350);
  const jungle = smooth(x, 4400, 5100);
  return {
    zoo: (1 - city) * (1 - jungle),
    city: city * (1 - jungle),
    jungle,
  };
}

function skyColor(x: number, horizon: boolean): RGB {
  const b = biome(x);
  const zoo = horizon ? ([255, 196, 110] as RGB) : ([72, 176, 220] as RGB);
  const city = horizon ? ([92, 132, 196] as RGB) : ([16, 22, 58] as RGB);
  const jung = horizon ? ([64, 168, 78] as RGB) : ([8, 42, 28] as RGB);
  return mix(mix(zoo, city, b.city + b.jungle), jung, b.jungle);
}

function groundColor(x: number, front: boolean): RGB {
  const b = biome(x);
  const zoo = front ? ([138, 88, 46] as RGB) : ([228, 186, 112] as RGB);
  const city = front ? ([36, 40, 52] as RGB) : ([78, 86, 104] as RGB);
  const jung = front ? ([22, 52, 30] as RGB) : ([62, 124, 54] as RGB);
  return mix(mix(zoo, city, b.city + b.jungle), jung, b.jungle);
}

function heroFrame(p: Player, animT: number): { key: AnimKey; frame: number } {
  if (p.action === "punch" || p.action === "pound") {
    const dur = p.action === "pound" ? 0.5 : 0.32;
    return { key: "strike", frame: Math.min(3, Math.floor((p.actionT / dur) * 4)) };
  }
  if (p.y > 6) {
    let frame = 2;
    if (p.airT < 0.1) frame = 0;
    else if (p.vy > 80) frame = 1;
    else if (p.vy < -40) frame = 3;
    return { key: "jump", frame };
  }
  if (Math.abs(p.vx) > 28 || Math.abs(p.vz) > 0.1) {
    return { key: "run", frame: Math.floor(p.animDist / 22) % 4 };
  }
  return { key: "idle", frame: Math.floor(animT / 0.18) % 4 };
}

function enemyFrame(e: Enemy) {
  if (e.state === "ko" || e.state === "hurt") return 3;
  if (e.state === "attack") {
    if (e.stateT < 0.18) return 1;
    if (e.stateT < 0.42) return 2;
  }
  return 0;
}

export function draw(ctx: CanvasRenderingContext2D, sim: GameSim, art: ArtSet, v: View) {
  const { w, h } = v;
  const shake = sim.reduce ? 0 : sim.shake;
  ctx.save();
  if (shake > 0.02) {
    ctx.translate((hash(sim.animT * 40) - 0.5) * shake * 6, (hash(sim.animT * 27) - 0.5) * shake * 4);
  }

  const focus = sim.camX + v.worldW * 0.45;
  const top = skyColor(focus, false);
  const hor = skyColor(focus, true);
  const sky = ctx.createLinearGradient(0, 0, 0, v.groundBack);
  sky.addColorStop(0, css(top));
  sky.addColorStop(1, css(hor));
  ctx.fillStyle = sky;
  ctx.fillRect(-8, -8, w + 16, v.groundBack + 8);

  drawFar(ctx, sim, v, focus);
  const g0 = groundColor(focus, false);
  const g1 = groundColor(focus, true);
  const ground = ctx.createLinearGradient(0, v.groundBack, 0, h);
  ground.addColorStop(0, css(g0));
  ground.addColorStop(1, css(g1));
  ctx.fillStyle = ground;
  ctx.fillRect(-8, v.groundBack, w + 16, h - v.groundBack + 8);
  ctx.fillStyle = "rgba(255, 236, 190, 0.55)";
  ctx.fillRect(0, v.groundBack | 0, w, Math.max(2, h * 0.012));
  drawLanes(ctx, v);
  drawGroundMarks(ctx, sim, v, focus);

  for (const block of sim.blocks) {
    if (!block.broken) drawBlock(ctx, sim, v, block);
  }
  drawJungleWall(ctx, sim, v);

  type Actor = { z: number; draw: () => void };
  const actors: Actor[] = [];
  for (const enemy of sim.enemies) {
    actors.push({ z: enemy.z, draw: () => drawEnemy(ctx, sim, art, v, enemy) });
  }
  actors.push({ z: sim.player.z, draw: () => drawHero(ctx, sim, art, v) });
  actors.sort((a, b) => a.z - b.z);
  for (const actor of actors) actor.draw();

  for (const dart of sim.darts) drawDart(ctx, sim, v, dart.x, dart.z, dart.vx);
  for (const pop of sim.pops) drawPop(ctx, sim, art, v, pop.x, pop.z, pop.t / pop.max);
  for (const mote of sim.motes) drawMote(ctx, sim, v, mote.x, mote.z, mote.y, mote.r, mote.color, mote.life / mote.max);
  for (const floater of sim.floaters) drawFloater(ctx, sim, v, floater);

  if (sim.messageT > 0 && sim.message) drawBanner(ctx, v, sim.message, Math.min(1, sim.messageT));
  if (sim.combo >= 2 && sim.phase === "play") drawCombo(ctx, v, sim.combo);
  if (sim.flash > 0) {
    ctx.fillStyle = `rgba(214,242,92,${sim.flash * 0.28})`;
    ctx.fillRect(0, 0, w, h);
  }
  if (sim.phase === "play" && sim.player.hp / MAX_HP < 0.32) {
    ctx.fillStyle = `rgba(226,75,50,${0.18 + Math.sin(sim.animT * 8) * 0.06})`;
    ctx.fillRect(0, 0, w, 6);
    ctx.fillRect(0, h - 6, w, 6);
  }
  ctx.restore();
}

function drawFar(ctx: CanvasRenderingContext2D, sim: GameSim, v: View, focus: number) {
  const b = biome(focus);
  const span = 28;
  const par = 0.28;
  const i0 = Math.floor((sim.camX * par) / span) - 1;
  const i1 = i0 + Math.ceil(v.worldW / span) + 4;
  for (let i = i0; i < i1; i++) {
    const sx = (i * span - sim.camX * par) * v.s;
    const n = hash(i * 3 + 2);
    if (b.jungle > 0.45) {
      const th = (18 + n * 28) * v.s;
      ctx.fillStyle = n > 0.5 ? "#0e4a28" : "#1a6a38";
      ctx.fillRect(sx, v.groundBack - th, 10 * v.s, th);
      ctx.fillStyle = "#3cb85a";
      ctx.fillRect(sx - 6 * v.s, v.groundBack - th - 4 * v.s, 22 * v.s, 12 * v.s);
    } else if (b.city > 0.4) {
      const bh = (22 + n * 40) * v.s;
      ctx.fillStyle = n > 0.5 ? "#2a3868" : "#1c2748";
      ctx.fillRect(sx, v.groundBack - bh, 16 * v.s, bh);
      ctx.fillStyle = n > 0.55 ? "#ffe27a" : "#9ad4f0";
      for (let wy = 4; wy < bh - 4; wy += 6) {
        if (hash(i * 13 + wy) > 0.45) ctx.fillRect(sx + 3, v.groundBack - bh + wy, 2, 2);
        if (hash(i * 9 + wy) > 0.55) ctx.fillRect(sx + 9, v.groundBack - bh + wy, 2, 2);
      }
    } else {
      const bh = (16 + n * 22) * v.s;
      ctx.fillStyle = "#d2643a";
      ctx.fillRect(sx, v.groundBack - bh, 18 * v.s, bh);
      ctx.fillStyle = "#f2d2b0";
      ctx.fillRect(sx, v.groundBack - bh, 18 * v.s, 3);
      for (let row = 6; row < bh; row += 7) {
        ctx.fillStyle = "#f2d2b0";
        ctx.fillRect(sx, v.groundBack - bh + row, 18 * v.s, 1);
      }
      if (i % 3 === 0) {
        ctx.fillStyle = "#f4efe4";
        ctx.fillRect(sx + 20 * v.s, v.groundBack - 18 * v.s, 2, 18 * v.s);
        ctx.fillRect(sx + 20 * v.s, v.groundBack - 14 * v.s, 10 * v.s, 2);
      }
    }
  }
}

function drawLanes(ctx: CanvasRenderingContext2D, v: View) {
  const depth = v.groundFront - v.groundBack;
  for (let i = 1; i <= 3; i++) {
    const y = (v.groundBack + (depth * i) / 4) | 0;
    ctx.fillStyle = i === 2 ? "rgba(255, 214, 120, 0.35)" : "rgba(90, 48, 22, 0.4)";
    ctx.fillRect(0, y, v.w, i === 2 ? 2 : 1);
  }
}

function drawGroundMarks(ctx: CanvasRenderingContext2D, sim: GameSim, v: View, focus: number) {
  const b = biome(focus);
  const step = b.city > 0.4 ? 36 : 22;
  const i0 = Math.floor(sim.camX / step) - 1;
  const i1 = i0 + Math.ceil(v.worldW / step) + 3;
  for (let i = i0; i < i1; i++) {
    const sx = (i * step - sim.camX) * v.s;
    if (b.city > 0.45 && i % 2 === 0) {
      ctx.fillStyle = "#e6c84a";
      const y = v.groundBack + (v.groundFront - v.groundBack) * 0.55;
      ctx.fillRect(sx, y, 10 * v.s, 2);
    } else if (b.jungle > 0.45 && hash(i) > 0.6) {
      ctx.fillStyle = "#143222";
      const y = v.groundFront - 4 - hash(i + 4) * 10;
      ctx.fillRect(sx, y, 3, 4);
    } else if (hash(i) > 0.72) {
      ctx.fillStyle = "rgba(60,36,18,0.45)";
      ctx.fillRect(sx, v.groundBack + 8 + hash(i + 1) * 20, 4, 2);
    }
  }
}

function drawBlock(ctx: CanvasRenderingContext2D, sim: GameSim, v: View, block: Block) {
  const back = project(block.x, 0.08, 0, sim.camX, v);
  const front = project(block.x, 0.92, 0, sim.camX, v);
  const x = back.sx;
  const top = back.sy - 28 * v.s;
  const bot = front.sy;
  const width = block.w * v.s;
  const ratio = block.max > 0 ? block.hp / block.max : 0;
  ctx.save();
  if (block.kind === "gate") {
    ctx.fillStyle = "#8d97a3";
    ctx.fillRect(x - width / 2, top, width, bot - top);
    ctx.fillStyle = "#1c2430";
    for (let i = 0; i < 5; i++) ctx.fillRect(x - width / 2 + 3 + i * (width / 5), top, 2, bot - top);
    ctx.fillStyle = "#d6f25c";
    ctx.fillRect(x - width / 2, top, width * ratio, 3);
  } else if (block.kind === "barricade") {
    ctx.fillStyle = "#c2c6cc";
    ctx.fillRect(x - width / 2, top + 8, width, bot - top - 8);
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = i % 2 ? "#e24b32" : "#f4efe4";
      ctx.fillRect(x - width / 2 + i * (width / 6), top + 10, width / 6 - 1, 8);
    }
    ctx.fillStyle = "#d6f25c";
    ctx.fillRect(x - width / 2, top + 4, width * ratio, 3);
  } else {
    ctx.fillStyle = "#163a6e";
    ctx.fillRect(x - width / 2, top + 6, width, bot - top - 10);
    ctx.fillStyle = "#9fd0ea";
    ctx.fillRect(x - width / 2 + 4, top + 8, width * 0.35, 8);
    ctx.fillStyle = "#e24b32";
    ctx.fillRect(x - width / 2, top + 14, 4, 4);
    ctx.fillStyle = "#7ec8e3";
    ctx.fillRect(x + width / 2 - 4, top + 14, 4, 4);
    ctx.fillStyle = "#111";
    ctx.fillRect(x - width / 2 + 4, bot - 8, 8, 6);
    ctx.fillRect(x + width / 2 - 12, bot - 8, 8, 6);
    ctx.fillStyle = "#d6f25c";
    ctx.fillRect(x - width / 2, top, width * ratio, 3);
  }
  ctx.restore();
}

function drawJungleWall(ctx: CanvasRenderingContext2D, sim: GameSim, v: View) {
  const x0 = (GOAL_X - sim.camX) * v.s;
  if (x0 > v.w + 40) return;
  for (let i = 0; i < 8; i++) {
    const sx = x0 + i * 18 * v.s;
    const th = (30 + (i % 3) * 14) * v.s;
    ctx.fillStyle = i % 2 ? "#0e4a28" : "#166b34";
    ctx.fillRect(sx, v.groundBack - th * 0.3, 16 * v.s, v.h);
    ctx.fillStyle = "#2f9a48";
    ctx.fillRect(sx - 4, v.groundBack - th, 24 * v.s, 16 * v.s);
  }
  if (x0 < v.w) {
    ctx.fillStyle = "rgba(6,20,12,0.35)";
    ctx.fillRect(Math.max(0, x0), 0, v.w, v.h);
  }
  void WORLD_END;
}

function drawHero(ctx: CanvasRenderingContext2D, sim: GameSim, art: ArtSet, v: View) {
  const p = sim.player;
  const depth = 0.86 + p.z * 0.22;
  const feet = project(p.x, p.z, p.y, sim.camX, v);
  const ground = project(p.x, p.z, 0, sim.camX, v);
  const h = CHAR_H * v.s * depth * 1.22;
  shadow(ctx, ground.sx, ground.sy, h * 0.22, p.y);
  if (p.invuln > 0 && Math.floor(sim.animT * 16) % 2 === 0) ctx.globalAlpha = 0.45;
  const frame = heroFrame(p, sim.animT);
  const sheet = art[frame.key] ?? art.idle;
  const ok = drawSheet(ctx, sheet, frame.frame, feet.sx, feet.sy, h, p.facing);
  if (!ok) pixelApe(ctx, feet.sx, feet.sy, h, p.facing, frame.frame);
  ctx.globalAlpha = 1;
}

function drawEnemy(ctx: CanvasRenderingContext2D, sim: GameSim, art: ArtSet, v: View, e: Enemy) {
  const depth = 0.86 + e.z * 0.22;
  const mul = e.kind === "riot" ? 0.95 : e.kind === "cop" ? 0.84 : e.kind === "tranq" ? 0.78 : 0.8;
  const feet = project(e.x, e.z, 0, sim.camX, v);
  const h = CHAR_H * v.s * depth * 1.12 * mul;
  const alpha = e.state === "ko" ? Math.max(0, 1 - e.stateT / 1.15) : 1;
  shadow(ctx, feet.sx, feet.sy, h * 0.2, 0);
  ctx.save();
  ctx.globalAlpha = alpha;
  if (e.state === "ko") {
    ctx.translate(feet.sx, feet.sy);
    ctx.rotate(e.facing * 0.9);
    ctx.translate(-feet.sx, -feet.sy);
  }
  const key: AnimKey = e.kind === "cop" || e.kind === "riot" ? "cop" : e.kind === "tranq" ? "tranq" : "keeper";
  const ok = drawSheet(ctx, art[key], enemyFrame(e), feet.sx, feet.sy, h, e.facing);
  if (!ok) pixelHuman(ctx, feet.sx, feet.sy, h, e.facing, e.kind);
  if (e.kind === "riot" && e.state !== "ko") {
    ctx.fillStyle = "rgba(160,210,230,0.8)";
    ctx.fillRect(feet.sx + e.facing * h * 0.12, feet.sy - h * 0.72, h * 0.18, h * 0.48);
    ctx.strokeStyle = "#d6f25c";
    ctx.strokeRect(feet.sx + e.facing * h * 0.12, feet.sy - h * 0.72, h * 0.18, h * 0.48);
  }
  if (e.hp < e.maxHp && e.state !== "ko") {
    const bw = Math.max(16, h * 0.4);
    const by = feet.sy - h - 4;
    ctx.fillStyle = "#070b09";
    ctx.fillRect(feet.sx - bw / 2, by, bw, 3);
    ctx.fillStyle = e.kind === "cop" || e.kind === "riot" ? "#e24b32" : "#d6f25c";
    ctx.fillRect(feet.sx - bw / 2, by, bw * (e.hp / e.maxHp), 3);
  }
  ctx.restore();
}

function shadow(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, lift: number) {
  ctx.save();
  ctx.fillStyle = `rgba(0,0,0,${0.35 * (1 - Math.min(0.7, lift / 90))})`;
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(4, rx), Math.max(2, rx * 0.28), 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function pixelApe(ctx: CanvasRenderingContext2D, x: number, y: number, h: number, facing: number, frame: number) {
  const w = h * 0.46;
  const bob = (frame % 2) * 2;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(facing, 1);
  ctx.fillStyle = "#14110f";
  ctx.fillRect(-w * 0.35, -h * 0.72 + bob, w * 0.7, h * 0.48);
  ctx.fillStyle = "#c8c2b4";
  ctx.fillRect(-w * 0.22, -h * 0.66 + bob, w * 0.5, h * 0.16);
  ctx.fillStyle = "#c4a48a";
  ctx.fillRect(-w * 0.16, -h * 0.95 + bob, w * 0.38, h * 0.24);
  ctx.fillStyle = "#d6f25c";
  ctx.fillRect(w * 0.02, -h * 0.88 + bob, 2, 2);
  ctx.fillStyle = "#14110f";
  ctx.fillRect(-w * 0.55, -h * 0.62 + bob, w * 0.24, h * 0.34);
  ctx.fillRect(w * 0.28, -h * 0.5 + bob, w * 0.22, h * 0.28);
  ctx.fillRect(-w * 0.22, -h * 0.26, w * 0.16, h * 0.26);
  ctx.fillRect(w * 0.06, -h * 0.26, w * 0.16, h * 0.26);
  ctx.restore();
}

function pixelHuman(ctx: CanvasRenderingContext2D, x: number, y: number, h: number, facing: number, kind: Enemy["kind"]) {
  const shirt = kind === "cop" || kind === "riot" ? "#1d3f86" : kind === "tranq" ? "#e07a1f" : "#c2a36a";
  const pants = kind === "cop" || kind === "riot" ? "#121826" : "#243628";
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(facing, 1);
  ctx.fillStyle = pants;
  ctx.fillRect(-h * 0.1, -h * 0.34, h * 0.08, h * 0.34);
  ctx.fillRect(h * 0.02, -h * 0.34, h * 0.08, h * 0.34);
  ctx.fillStyle = shirt;
  ctx.fillRect(-h * 0.14, -h * 0.68, h * 0.28, h * 0.36);
  ctx.fillStyle = "#e6c2a2";
  ctx.fillRect(-h * 0.08, -h * 0.9, h * 0.16, h * 0.2);
  ctx.fillStyle = kind === "tranq" ? "#e07a1f" : kind === "keeper" ? "#2f6b32" : "#0e1a33";
  ctx.fillRect(-h * 0.09, -h * 0.98, h * 0.18, h * 0.08);
  ctx.restore();
}

function drawDart(
  ctx: CanvasRenderingContext2D,
  sim: GameSim,
  v: View,
  x: number,
  z: number,
  vx: number,
) {
  const p = project(x, z, 18, sim.camX, v);
  ctx.save();
  ctx.translate(p.sx, p.sy);
  ctx.scale(vx < 0 ? -1 : 1, 1);
  ctx.fillStyle = "#d6f25c";
  ctx.fillRect(0, -1, 12, 2);
  ctx.fillStyle = "#e24b32";
  ctx.fillRect(10, -2, 3, 4);
  ctx.restore();
}

function drawPop(ctx: CanvasRenderingContext2D, sim: GameSim, art: ArtSet, v: View, x: number, z: number, u: number) {
  const p = project(x, z, 30, sim.camX, v);
  const h = (18 + u * 20) * v.s * 3;
  const ok = drawSheet(ctx, art.impact, Math.min(3, Math.floor(u * 4)), p.sx, p.sy, h, 1);
  if (!ok) {
    ctx.fillStyle = u < 0.5 ? "#f4efe4" : "#d6f25c";
    ctx.fillRect(p.sx - 3, p.sy - 8, 6, 6);
  }
}

function drawMote(
  ctx: CanvasRenderingContext2D,
  sim: GameSim,
  v: View,
  x: number,
  z: number,
  y: number,
  r: number,
  color: string,
  alpha: number,
) {
  const p = project(x, z, y, sim.camX, v);
  ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
  ctx.fillStyle = color;
  ctx.fillRect(p.sx, p.sy, Math.max(1, r), Math.max(1, r));
  ctx.globalAlpha = 1;
}

function drawFloater(
  ctx: CanvasRenderingContext2D,
  sim: GameSim,
  v: View,
  f: { x: number; z: number; y: number; text: string; life: number; color: string },
) {
  const p = project(f.x, f.z, f.y, sim.camX, v);
  ctx.globalAlpha = Math.max(0, Math.min(1, f.life * 1.6));
  ctx.font = '8px "Press Start 2P", monospace';
  ctx.textAlign = "center";
  ctx.fillStyle = "#070b09";
  ctx.fillText(f.text, p.sx + 1, p.sy + 1);
  ctx.fillStyle = f.color;
  ctx.fillText(f.text, p.sx, p.sy);
  ctx.globalAlpha = 1;
}

function drawBanner(ctx: CanvasRenderingContext2D, v: View, text: string, alpha: number) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = '8px "Press Start 2P", monospace';
  ctx.textAlign = "center";
  ctx.fillStyle = "#070b09";
  ctx.fillRect(v.w * 0.08, v.h * 0.3, v.w * 0.84, 22);
  ctx.fillStyle = "#d6f25c";
  ctx.fillText(text, v.w / 2, v.h * 0.3 + 15);
  ctx.restore();
}

function drawCombo(ctx: CanvasRenderingContext2D, v: View, combo: number) {
  ctx.font = '10px "Press Start 2P", monospace';
  ctx.textAlign = "right";
  ctx.fillStyle = "#070b09";
  ctx.fillText(`x${combo}`, v.w - 7, 28);
  ctx.fillStyle = "#e24b32";
  ctx.fillText(`x${combo}`, v.w - 8, 27);
}
