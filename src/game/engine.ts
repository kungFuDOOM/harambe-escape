import type { AudioBus } from "@/game/audio";

export const START_X = 220;
export const GOAL_X = 5720;
export const WORLD_END = 6200;
export const MAX_HP = 130;

const SAVE_KEY = "harambe-escape-v1";
const STRIKE_AT = 0.3;
const RECOVER_AT = 0.62;

export type Phase = "title" | "play" | "pause" | "dead" | "win";
export type Kind = "keeper" | "tranq" | "cop" | "riot";
export type BlockKind = "gate" | "barricade" | "cruiser";
export type Face = 1 | -1;

export type Player = {
  x: number;
  z: number;
  y: number;
  vx: number;
  vz: number;
  vy: number;
  facing: Face;
  hp: number;
  action: "none" | "punch" | "pound";
  actionT: number;
  didHit: boolean;
  coyote: number;
  jumpBuf: number;
  invuln: number;
  airT: number;
  animDist: number;
  landT: number;
  hurtT: number;
};

export type Enemy = {
  id: number;
  kind: Kind;
  x: number;
  z: number;
  vx: number;
  facing: Face;
  hp: number;
  maxHp: number;
  state: "idle" | "attack" | "hurt" | "ko";
  stateT: number;
  cd: number;
  homeX: number;
};

export type Block = {
  kind: BlockKind;
  x: number;
  w: number;
  hp: number;
  max: number;
  broken: boolean;
};

export type Dart = { x: number; z: number; vx: number; life: number; dmg: number };
export type Floater = { x: number; z: number; y: number; text: string; life: number; color: string };
export type Mote = {
  x: number;
  z: number;
  y: number;
  vx: number;
  vy: number;
  grav: number;
  life: number;
  max: number;
  color: string;
  r: number;
};
export type Pop = { x: number; z: number; t: number; max: number };

export type HudSnap = {
  phase: Phase;
  hp: number;
  maxHp: number;
  kos: number;
  combo: number;
  zone: string;
  progress: number;
  pound: number;
  score: number;
  time: number;
  bestScore: number;
  bestKos: number;
  bestTime: number;
  muted: boolean;
  checkpoint: number;
  message: string;
};

export type ControlsProbe = {
  getYaw: () => number;
  getSpeed: () => number;
  getX: () => number;
  getZ: () => number;
  setKeys: (codes: string[]) => void;
};

declare global {
  interface Window {
    __controlsTest?: ControlsProbe;
  }
}

type Save = { bestScore: number; bestKos: number; bestTime: number; muted: boolean };

const STATS: Record<Kind, { hp: number; speed: number; dmg: number; range: number; cd: number; zSpeed: number }> = {
  keeper: { hp: 46, speed: 98, dmg: 9, range: 74, cd: 1.05, zSpeed: 0.55 },
  tranq: { hp: 32, speed: 86, dmg: 8, range: 230, cd: 1.35, zSpeed: 0.48 },
  cop: { hp: 60, speed: 128, dmg: 11, range: 70, cd: 0.82, zSpeed: 0.68 },
  riot: { hp: 118, speed: 72, dmg: 13, range: 78, cd: 1.2, zSpeed: 0.4 },
};

const SPAWNS: { x: number; z: number; kind: Kind }[] = [
  { x: 470, z: 0.48, kind: "keeper" },
  { x: 880, z: 0.36, kind: "keeper" },
  { x: 1100, z: 0.74, kind: "tranq" },
  { x: 1360, z: 0.48, kind: "keeper" },
  { x: 2020, z: 0.42, kind: "cop" },
  { x: 2200, z: 0.72, kind: "cop" },
  { x: 2400, z: 0.3, kind: "cop" },
  { x: 2660, z: 0.55, kind: "riot" },
  { x: 3420, z: 0.4, kind: "cop" },
  { x: 3600, z: 0.74, kind: "riot" },
  { x: 3800, z: 0.28, kind: "tranq" },
  { x: 4000, z: 0.56, kind: "cop" },
  { x: 4720, z: 0.46, kind: "cop" },
  { x: 4900, z: 0.7, kind: "keeper" },
  { x: 5100, z: 0.32, kind: "riot" },
  { x: 5300, z: 0.58, kind: "cop" },
  { x: 5480, z: 0.44, kind: "tranq" },
];

const BLOCK_TEMPLATES: { kind: BlockKind; x: number; max: number; w: number }[] = [
  { kind: "gate", x: 1680, max: 72, w: 64 },
  { kind: "barricade", x: 3120, max: 100, w: 80 },
  { kind: "cruiser", x: 4380, max: 126, w: 124 },
];

const ZONES = [
  { x: 0, name: "CINCINNATI ZOO" },
  { x: 1600, name: "FRONT GATE" },
  { x: 1900, name: "THE STREET" },
  { x: 3200, name: "LOCKDOWN" },
  { x: 4500, name: "TREE LINE" },
  { x: 5550, name: "THE JUNGLE" },
];

const POUND_CD = 2.05;

function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v));
}

function approach(v: number, t: number, max: number) {
  if (v < t) return Math.min(t, v + max);
  if (v > t) return Math.max(t, v - max);
  return t;
}

function faceOf(n: number): Face {
  return n >= 0 ? 1 : -1;
}

export function formatTime(t: number) {
  const s = Math.max(0, Math.floor(t));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function zoneAt(x: number) {
  let name = ZONES[0].name;
  for (const z of ZONES) if (x >= z.x) name = z.name;
  return name;
}

export class GameSim {
  phase: Phase = "title";
  player: Player = this.makePlayer();
  enemies: Enemy[] = [];
  blocks: Block[] = [];
  darts: Dart[] = [];
  floaters: Floater[] = [];
  motes: Mote[] = [];
  pops: Pop[] = [];
  camX = 80;
  time = 0;
  animT = 0;
  shake = 0;
  flash = 0;
  hitstop = 0;
  kos = 0;
  combo = 0;
  comboT = 0;
  message = "";
  messageT = 0;
  checkpoint = START_X;
  poundCd = 0;
  zone = "CINCINNATI ZOO";
  muted = false;
  reduce = false;
  best: Save = { bestScore: 0, bestKos: 0, bestTime: 0, muted: false };
  keys = new Set<string>();
  touch = { jx: 0, jy: 0, jump: false, slam: false, pound: false };
  sfx: AudioBus | null = null;
  viewWorldW = 900;

  private nextId = 1;
  private prevJump = false;
  private prevSlam = false;
  private prevPound = false;
  private beat = -1;
  private zoneName = "CINCINNATI ZOO";

  constructor() {
    this.spawnWorld();
    this.load();
    this.muted = this.best.muted;
  }

  bindProbe() {
    window.__controlsTest = {
      getYaw: () => this.player.facing,
      getSpeed: () => Math.abs(this.player.vx),
      getX: () => this.player.x,
      getZ: () => this.player.z,
      setKeys: (codes) => this.setKeys(codes),
    };
  }

  setKeys(codes: string[]) {
    this.keys.clear();
    for (const code of codes) this.keys.add(code);
  }

  start() {
    this.spawnWorld();
    this.phase = "play";
    this.time = 0;
    this.kos = 0;
    this.combo = 0;
    this.checkpoint = START_X;
    this.message = "CINCINNATI ZOO";
    this.messageT = 1.45;
    this.sfx?.play("start");
  }

  togglePause() {
    if (this.phase === "play") this.phase = "pause";
    else if (this.phase === "pause") this.phase = "play";
  }

  toggleMute() {
    this.muted = !this.muted;
    this.best.muted = this.muted;
    if (this.sfx) this.sfx.muted = this.muted;
    this.persist();
  }

  retry(full: boolean) {
    const cp = full ? START_X : this.checkpoint;
    const kos = full ? 0 : this.kos;
    const time = full ? 0 : this.time;
    const keep = full ? [] : this.blocks.filter((b) => b.broken && b.x < cp - 30).map((b) => b.x);
    this.spawnWorld();
    this.kos = kos;
    this.time = time;
    this.checkpoint = cp;
    this.player.x = cp;
    this.player.hp = full ? MAX_HP : 108;
    this.player.invuln = 1.15;
    this.phase = "play";
    if (!full) {
      this.enemies = this.enemies.filter((e) => e.homeX >= cp - 220);
      for (const block of this.blocks) {
        if (keep.includes(block.x)) {
          block.broken = true;
          block.hp = 0;
        }
      }
    }
    this.message = full ? "CINCINNATI ZOO" : "GET UP";
    this.messageT = 1.2;
    this.camX = Math.max(0, cp - 180);
    this.zoneName = zoneAt(cp);
    this.zone = this.zoneName;
  }

  snapshot(): HudSnap {
    const won = this.phase === "win";
    return {
      phase: this.phase,
      hp: this.player.hp,
      maxHp: MAX_HP,
      kos: this.kos,
      combo: this.combo,
      zone: this.zone,
      progress: clamp(this.player.x / GOAL_X, 0, 1),
      pound: clamp(1 - this.poundCd / POUND_CD, 0, 1),
      score: this.scoreOf(won),
      time: this.time,
      bestScore: this.best.bestScore,
      bestKos: this.best.bestKos,
      bestTime: this.best.bestTime,
      muted: this.muted,
      checkpoint: this.checkpoint,
      message: this.message,
    };
  }

  step(dt: number, viewWorldW: number) {
    this.viewWorldW = viewWorldW;
    if (this.phase === "play" && this.hitstop > 0) {
      this.hitstop -= dt;
      return;
    }
    this.animT += dt;
    this.decayPresentation(dt);
    if (this.phase !== "pause") this.tickAmbient(dt);

    if (this.phase === "title") {
      this.camToward(this.player.x - this.viewWorldW * 0.22, dt);
      return;
    }
    if (this.phase === "pause" || this.phase === "dead") return;
    if (this.phase === "win") {
      this.camToward(this.player.x - viewWorldW * 0.38, dt);
      return;
    }

    this.time += dt;
    this.updatePlayer(dt);
    this.resolvePlayerHits();
    for (const enemy of this.enemies) this.updateEnemy(enemy, dt);
    this.updateDarts(dt);
    this.separate();
    this.constrainAll();
    this.updateZone();
    this.camera(dt);
    if (this.player.hp <= 0 && this.phase === "play") this.down();
    else if (this.player.x >= GOAL_X && this.phase === "play") this.win();
    this.music();
  }

  private makePlayer(): Player {
    return {
      x: START_X,
      z: 0.58,
      y: 0,
      vx: 0,
      vz: 0,
      vy: 0,
      facing: 1,
      hp: MAX_HP,
      action: "none",
      actionT: 0,
      didHit: false,
      coyote: 0.12,
      jumpBuf: 0,
      invuln: 0,
      airT: 0,
      animDist: 0,
      landT: 0,
      hurtT: 0,
    };
  }

  private makeEnemy(s: { x: number; z: number; kind: Kind }): Enemy {
    const st = STATS[s.kind];
    return {
      id: this.nextId++,
      kind: s.kind,
      x: s.x,
      z: s.z,
      vx: 0,
      facing: -1,
      hp: st.hp,
      maxHp: st.hp,
      state: "idle",
      stateT: 0,
      cd: 0.4,
      homeX: s.x,
    };
  }

  private spawnWorld() {
    this.player = this.makePlayer();
    this.enemies = SPAWNS.map((s) => this.makeEnemy(s));
    this.blocks = BLOCK_TEMPLATES.map((b) => ({ ...b, hp: b.max, broken: false }));
    this.darts = [];
    this.floaters = [];
    this.pops = [];
    this.camX = 80;
    this.flash = 0;
    this.shake = 0;
    this.hitstop = 0;
    this.poundCd = 0;
    this.combo = 0;
    this.comboT = 0;
    this.zone = "CINCINNATI ZOO";
    this.zoneName = "CINCINNATI ZOO";
    this.message = "";
    this.messageT = 0;
    this.beat = -1;
  }

  private updatePlayer(dt: number) {
    const p = this.player;
    // Side view, not a vehicle: A / left decreases x (left on screen).
    // W / up decreases z, which draws higher on screen (back lane).
    let moveX = this.touch.jx;
    let moveZ = this.touch.jy;
    if (this.keys.has("KeyA") || this.keys.has("ArrowLeft")) moveX -= 1;
    if (this.keys.has("KeyD") || this.keys.has("ArrowRight")) moveX += 1;
    if (this.keys.has("KeyW") || this.keys.has("ArrowUp")) moveZ -= 1;
    if (this.keys.has("KeyS") || this.keys.has("ArrowDown")) moveZ += 1;
    moveX = clamp(moveX, -1, 1);
    moveZ = clamp(moveZ, -1, 1);

    const jumpHeld = this.keys.has("Space") || this.touch.jump;
    const slamDown = this.keys.has("KeyJ") || this.keys.has("KeyZ") || this.touch.slam;
    const poundDown = this.keys.has("KeyK") || this.keys.has("KeyX") || this.touch.pound;
    const jumpEdge = jumpHeld && !this.prevJump;
    const slamEdge = slamDown && !this.prevSlam;
    const poundEdge = poundDown && !this.prevPound;
    this.prevJump = jumpHeld;
    this.prevSlam = slamDown;
    this.prevPound = poundDown;

    if (jumpEdge) p.jumpBuf = 0.13;
    else p.jumpBuf = Math.max(0, p.jumpBuf - dt);
    if (!jumpHeld && this.prevJump === false && p.vy > 0 && p.y > 0) {
      /* release handled below via edge */
    }
    if (!jumpHeld && p.vy > 0 && !jumpEdge) {
      // cut once: compare previous held, already stored after assignment.
    }

    p.invuln = Math.max(0, p.invuln - dt);
    p.hurtT = Math.max(0, p.hurtT - dt);
    p.landT = Math.max(0, p.landT - dt);
    this.poundCd = Math.max(0, this.poundCd - dt);

    if (p.action !== "none") {
      p.actionT += dt;
      const dur = p.action === "pound" ? 0.5 : 0.32;
      if (p.actionT >= dur) p.action = "none";
    }

    if (poundEdge && this.poundCd <= 0 && p.y <= 1 && p.action === "none") {
      p.action = "pound";
      p.actionT = 0;
      p.didHit = false;
      this.poundCd = POUND_CD;
    } else if (slamEdge && p.action === "none") {
      p.action = "punch";
      p.actionT = 0;
      p.didHit = false;
    }

    const lock = p.action === "pound" ? 0 : p.action === "punch" ? 0.4 : 1;
    if (p.action === "none") {
      if (moveX < -0.2) p.facing = -1;
      else if (moveX > 0.2) p.facing = 1;
    }

    const accel = p.y > 1 ? 980 : 1700;
    p.vx = approach(p.vx, moveX * 205 * lock, accel * dt);
    p.x += p.vx * dt;
    p.animDist += Math.abs(p.vx) * dt + Math.abs(moveZ) * 80 * dt;
    p.z = clamp(p.z + moveZ * 1.25 * (p.action === "pound" ? 0.2 : 1) * dt, 0.08, 0.92);

    const released = !jumpHeld && jumpEdge === false && this.wasJumpCut(jumpHeld);
    if (released && p.vy > 0) p.vy *= 0.45;

    const canJump = p.y <= 0.4 || p.coyote > 0;
    if (p.jumpBuf > 0 && canJump && p.action !== "pound") {
      p.vy = 640;
      p.y = 0.2;
      p.jumpBuf = 0;
      p.coyote = 0;
      p.airT = 0;
      this.sfx?.play("jump");
    }

    const grav = p.vy > 0 ? (p.vy < 170 ? 980 : 1750) : 3100;
    const wasUp = p.y > 1;
    p.vy -= grav * dt;
    if (p.vy < -920) p.vy = -920;
    p.y += p.vy * dt;
    if (p.y <= 0) {
      if (wasUp) {
        p.landT = 0.12;
        this.sfx?.play("land");
        this.burst(p.x, p.z, 4);
      }
      p.y = 0;
      p.vy = 0;
      p.coyote = 0.11;
      p.airT = 0;
    } else {
      p.coyote = Math.max(0, p.coyote - dt);
      p.airT += dt;
    }

    this.jumpRelease = jumpHeld;
  }

  private jumpRelease = false;
  private wasJumpCut(held: boolean) {
    const cut = this.jumpRelease && !held;
    return cut;
  }

  private resolvePlayerHits() {
    const p = this.player;
    if (p.action === "none" || p.didHit) return;
    const punching = p.action === "punch" && p.actionT >= 0.1 && p.actionT <= 0.2;
    const pounding = p.action === "pound" && p.actionT >= 0.16 && p.actionT <= 0.28;
    if (!punching && !pounding) return;
    p.didHit = true;
    let hit = false;
    if (pounding) {
      this.sfx?.play("pound");
      this.shake = Math.min(1, this.shake + 0.75);
      this.flash = 0.85;
      this.hitstop = 0.07;
      for (const enemy of this.enemies) {
        if (enemy.state === "ko") continue;
        const d = Math.hypot(enemy.x - p.x, (enemy.z - p.z) * 210);
        if (d < 162) {
          this.hurtEnemy(enemy, 40, 380);
          hit = true;
        }
      }
      for (const block of this.blocks) this.tryHitBlock(block, 42, 176);
      this.darts = this.darts.filter((d) => Math.hypot(d.x - p.x, (d.z - p.z) * 210) > 162);
    } else {
      this.sfx?.play("punch");
      const air = p.y > 28 ? 8 : 0;
      for (const enemy of this.enemies) {
        if (enemy.state === "ko") continue;
        const dx = enemy.x - p.x;
        if (p.facing * dx < 18 || p.facing * dx > 88) continue;
        if (Math.abs(enemy.z - p.z) > 0.2) continue;
        this.hurtEnemy(enemy, 22 + air, 250);
        hit = true;
      }
      for (const block of this.blocks) this.tryHitBlock(block, 22, 96);
      if (hit) this.hitstop = 0.04;
      this.shake = Math.min(1, this.shake + (hit ? 0.3 : 0.08));
    }
    if (hit) this.burst(p.x + p.facing * 46, p.z, pounding ? 12 : 7);
  }

  private hurtEnemy(e: Enemy, dmg: number, knock: number) {
    if (e.state === "ko") return;
    let amount = dmg * (1 + Math.min(this.combo, 8) * 0.05);
    let push = knock;
    if (e.kind === "riot" && this.player.action !== "pound") {
      const fromFront = (this.player.x - e.x) * e.facing > 0;
      if (fromFront) {
        amount *= 0.3;
        push *= 0.35;
        this.float(e.x, e.z, "BLOCK", "#f4efe4");
      }
    }
    e.hp -= amount;
    e.vx = this.player.facing * push;
    e.state = "hurt";
    e.stateT = 0;
    this.combo += 1;
    this.comboT = 1.15;
    this.float(e.x, e.z, `${Math.round(amount)}`, "#d6f25c");
    if (e.hp <= 0) {
      e.hp = 0;
      e.state = "ko";
      e.stateT = 0;
      this.kos += 1;
      this.shake = Math.min(1, this.shake + 0.4);
      this.sfx?.play("ko");
      this.float(e.x, e.z + 0.02, "KO", "#d6f25c");
    }
  }

  private tryHitBlock(block: Block, dmg: number, reach: number) {
    if (block.broken) return;
    const dx = block.x - this.player.x;
    if (this.player.action === "pound") {
      if (Math.abs(dx) > reach) return;
    } else if (this.player.facing * dx < 0 || Math.abs(dx) > reach + block.w * 0.35) {
      return;
    }
    block.hp -= dmg;
    this.shake = Math.min(1, this.shake + 0.22);
    if (block.hp <= 0) {
      block.hp = 0;
      block.broken = true;
      this.checkpoint = Math.max(this.checkpoint, block.x + 90);
      this.player.hp = Math.min(MAX_HP, this.player.hp + 30);
      this.poundCd = 0;
      this.message = block.kind === "gate" ? "GATE'S DOWN" : block.kind === "barricade" ? "BARRICADE SPLITS" : "CRUISER SHOVED";
      this.messageT = 1.5;
      this.flash = 0.55;
      this.sfx?.play("gate");
      this.burst(block.x, 0.5, 14);
    } else {
      this.sfx?.play("block");
    }
  }

  private updateEnemy(e: Enemy, dt: number) {
    e.cd = Math.max(0, e.cd - dt);
    e.x += e.vx * dt;
    e.vx = approach(e.vx, 0, 760 * dt);
    if (e.state === "ko") {
      e.stateT += dt;
      return;
    }
    if (e.state === "hurt") {
      e.stateT += dt;
      if (e.stateT > 0.28) e.state = "idle";
      return;
    }
    if (e.state === "attack") {
      const prev = e.stateT;
      e.stateT += dt;
      if (e.stateT < 0.16) e.x += e.facing * 80 * dt;
      if (prev < STRIKE_AT && e.stateT >= STRIKE_AT) this.enemyStrike(e);
      if (e.stateT > RECOVER_AT) e.state = "idle";
      return;
    }

    const st = STATS[e.kind];
    const dx = this.player.x - e.x;
    const dz = this.player.z - e.z;
    const adx = Math.abs(dx);
    if (adx > 680) {
      const home = e.homeX - e.x;
      if (Math.abs(home) > 8) {
        e.facing = faceOf(home);
        e.x += e.facing * st.speed * 0.55 * dt;
      }
      return;
    }
    if (adx > 460 && Math.abs(e.x - e.homeX) < 24) {
      e.facing = faceOf(dx);
      return;
    }
    e.facing = faceOf(dx);
    if (e.kind === "tranq") {
      const want = 240;
      if (adx > want + 30) e.x += e.facing * st.speed * dt;
      else if (adx < want - 36) e.x -= e.facing * st.speed * 0.8 * dt;
      e.z = clamp(approach(e.z, this.player.z, st.zSpeed * dt), 0.08, 0.92);
      if (e.cd <= 0 && adx < 340 && Math.abs(dz) < 0.24) this.beginAttack(e);
      return;
    }
    const inX = adx < st.range;
    const inZ = Math.abs(dz) < 0.17;
    if (!inX) e.x += e.facing * st.speed * dt;
    if (!inZ) e.z = clamp(approach(e.z, this.player.z, st.zSpeed * dt), 0.08, 0.92);
    if (inX && inZ && e.cd <= 0) this.beginAttack(e);
  }

  private beginAttack(e: Enemy) {
    e.state = "attack";
    e.stateT = 0;
    e.cd = STATS[e.kind].cd;
  }

  private enemyStrike(e: Enemy) {
    if (e.kind === "tranq") {
      this.darts.push({
        x: e.x + e.facing * 34,
        z: e.z,
        vx: e.facing * 310,
        life: 1.7,
        dmg: STATS.tranq.dmg,
      });
      this.sfx?.play("dart");
      return;
    }
    const dx = this.player.x - e.x;
    if (e.facing * dx > 8 && e.facing * dx < STATS[e.kind].range + 24 && Math.abs(this.player.z - e.z) < 0.18) {
      this.hurtPlayer(STATS[e.kind].dmg, e.x);
    }
  }

  private hurtPlayer(dmg: number, fromX: number) {
    const p = this.player;
    if (p.invuln > 0 || this.phase !== "play") return;
    let amount = dmg;
    if (p.action === "pound") amount *= 0.45;
    p.hp -= amount;
    p.invuln = 0.74;
    p.hurtT = 0.26;
    this.combo = 0;
    this.comboT = 0;
    p.vx = faceOf(p.x - fromX) * 230;
    this.shake = Math.min(1, this.shake + 0.5);
    this.sfx?.play("hurt");
    this.float(p.x, p.z, `${Math.round(amount)}`, "#e24b32");
    if (p.hp <= 0) this.down();
  }

  private updateDarts(dt: number) {
    for (const dart of this.darts) {
      dart.x += dart.vx * dt;
      dart.z = approach(dart.z, this.player.z, 0.25 * dt);
      dart.life -= dt;
      if (this.phase === "play") {
        const near = Math.hypot(dart.x - this.player.x, (dart.z - this.player.z) * 210);
        if (near < 30) {
          this.hurtPlayer(dart.dmg, dart.x);
          dart.life = 0;
        }
      }
    }
    this.darts = this.darts.filter((d) => d.life > 0);
  }

  private separate() {
    const live = this.enemies.filter((e) => e.state !== "ko");
    for (let i = 0; i < live.length; i++) {
      for (let j = i + 1; j < live.length; j++) this.push(live[i], live[j], false);
      this.push(this.player, live[i], true);
    }
  }

  private push(a: { x: number; z: number }, b: { x: number; z: number }, player: boolean) {
    let dx = b.x - a.x;
    let dz = b.z - a.z;
    const minX = 48;
    const minZ = 0.13;
    if (Math.abs(dx) >= minX || Math.abs(dz) >= minZ) return;
    if (Math.abs(dx) < 0.01) dx = 1;
    const dir = Math.sign(dx);
    const pen = minX - Math.abs(dx);
    const za = player ? 0.72 : 0.5;
    a.x -= dir * pen * za;
    b.x += dir * pen * (1 - za);
    if (Math.abs(dz) < 0.001) dz = 0.01;
    const zd = Math.sign(dz);
    const zpen = (minZ - Math.abs(dz)) * 0.5;
    a.z = clamp(a.z - zd * zpen, 0.08, 0.92);
    b.z = clamp(b.z + zd * zpen, 0.08, 0.92);
  }

  private constrainAll() {
    const moved = this.solidClamp(this.player.x, this.player.vx, 30);
    this.player.x = clamp(moved.x, 40, WORLD_END - 20);
    this.player.vx = moved.vx;
    for (const enemy of this.enemies) {
      if (enemy.state === "ko") continue;
      const next = this.solidClamp(enemy.x, enemy.vx, 26);
      enemy.x = next.x;
      enemy.vx = next.vx;
    }
  }

  private solidClamp(x: number, vx: number, radius: number) {
    for (const block of this.blocks) {
      if (block.broken) continue;
      const left = block.x - block.w * 0.5 - radius;
      const right = block.x + block.w * 0.5 + radius;
      if (x > left && x < right) {
        if (x < block.x) {
          x = left;
          if (vx > 0) vx = 0;
        } else {
          x = right;
          if (vx < 0) vx = 0;
        }
      }
    }
    return { x, vx };
  }

  private updateZone() {
    const name = zoneAt(this.player.x);
    this.zone = name;
    if (name !== this.zoneName) {
      this.zoneName = name;
      this.message = name;
      this.messageT = 1.35;
    }
  }

  private camera(dt: number) {
    const lead = this.player.facing * 52;
    this.camToward(this.player.x - this.viewWorldW * 0.36 + lead, dt);
  }

  private camToward(target: number, dt: number) {
    const max = Math.max(0, WORLD_END - this.viewWorldW + 30);
    const t = 1 - Math.exp(-5.5 * dt);
    this.camX += (target - this.camX) * t;
    this.camX = clamp(this.camX, 0, max);
  }

  private down() {
    if (this.phase !== "play") return;
    this.player.hp = 0;
    this.phase = "dead";
    this.message = "DOWN";
    this.messageT = 2;
    this.sfx?.play("ko");
    this.noteScore(false);
  }

  private win() {
    this.phase = "win";
    this.message = "THE JUNGLE";
    this.messageT = 2.4;
    this.player.vx = 0;
    this.sfx?.play("win");
    this.flash = 0.7;
    this.noteScore(true);
    for (let i = 0; i < 18; i++) this.burst(this.player.x + (Math.random() - 0.5) * 80, Math.random(), 2);
  }

  private music() {
    const step = Math.floor(this.time * 2);
    if (step === this.beat) return;
    this.beat = step;
    const x = this.player.x;
    const biome = x > 4500 ? 2 : x > 1900 ? 1 : 0;
    this.sfx?.beat(step, biome);
  }

  private scoreOf(won: boolean) {
    const base = this.kos * 120 + Math.floor(this.player.x / 6);
    if (!won) return base;
    return base + Math.max(0, Math.floor(110 - this.time)) * 6;
  }

  private noteScore(won: boolean) {
    const score = this.scoreOf(won);
    let changed = false;
    if (score > this.best.bestScore) {
      this.best.bestScore = score;
      changed = true;
    }
    if (this.kos > this.best.bestKos) {
      this.best.bestKos = this.kos;
      changed = true;
    }
    if (won && (this.best.bestTime <= 0 || this.time < this.best.bestTime)) {
      this.best.bestTime = this.time;
      changed = true;
    }
    if (changed) this.persist();
  }

  private float(x: number, z: number, text: string, color: string) {
    this.floaters.push({ x, z, y: 36, text, life: 0.7, color });
    if (this.floaters.length > 24) this.floaters.shift();
  }

  private burst(x: number, z: number, n: number) {
    this.pops.push({ x, z, t: 0, max: 0.28 });
    if (this.pops.length > 14) this.pops.shift();
    for (let i = 0; i < n; i++) {
      this.motes.push({
        x,
        z,
        y: 16 + Math.random() * 36,
        vx: (Math.random() - 0.5) * 220,
        vy: 50 + Math.random() * 140,
        grav: 420,
        life: 0.35 + Math.random() * 0.28,
        max: 0.6,
        color: Math.random() > 0.45 ? "#d6f25c" : "#f4efe4",
        r: 2 + Math.random() * 3,
      });
    }
  }

  private tickAmbient(dt: number) {
    if (this.motes.length > 80) return;
    const rate = this.reduce ? 1.2 : 7;
    if (Math.random() > dt * rate) return;
    const x = this.camX - 20 + Math.random() * (this.viewWorldW + 40);
    const jungle = x > 4700;
    const city = x > 2000 && !jungle;
    this.motes.push({
      x,
      z: Math.random(),
      y: 30 + Math.random() * 140,
      vx: -12 + Math.random() * 24,
      vy: jungle ? 10 + Math.random() * 18 : 8,
      grav: 0,
      life: 2.4,
      max: 2.4,
      r: jungle ? 1.6 : 2.1,
      color: jungle ? "#d6f25c" : city ? "#e7a15a" : "#f4efe4",
    });
  }

  private decayPresentation(dt: number) {
    this.shake = Math.max(0, this.shake - dt * 1.8);
    this.flash = Math.max(0, this.flash - dt * 2.4);
    this.messageT = Math.max(0, this.messageT - dt);
    this.comboT = Math.max(0, this.comboT - dt);
    if (this.comboT <= 0) this.combo = 0;
    for (const mote of this.motes) {
      mote.life -= dt;
      mote.x += mote.vx * dt;
      mote.y += mote.vy * dt;
      mote.vy -= mote.grav * dt;
    }
    this.motes = this.motes.filter((m) => m.life > 0 && m.y > -10);
    for (const floater of this.floaters) {
      floater.life -= dt;
      floater.y += 46 * dt;
    }
    this.floaters = this.floaters.filter((f) => f.life > 0);
    for (const pop of this.pops) pop.t += dt;
    this.pops = this.pops.filter((p) => p.t < p.max);
    this.enemies = this.enemies.filter((e) => e.state !== "ko" || e.stateT < 1.2);
  }

  private load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw) as Partial<Save>;
      this.best = {
        bestScore: Number(data.bestScore) || 0,
        bestKos: Number(data.bestKos) || 0,
        bestTime: Number(data.bestTime) || 0,
        muted: Boolean(data.muted),
      };
    } catch {
      /* ignore broken saves */
    }
  }

  private persist() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.best));
    } catch {
      /* ignore quota */
    }
  }
}
