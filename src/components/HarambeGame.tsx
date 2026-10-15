import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from "react";
import { createArt, loadArt, type ArtSet } from "@/game/assets";
import { AudioBus } from "@/game/audio";
import { draw } from "@/game/draw";
import { formatTime, GameSim, START_X, type HudSnap } from "@/game/engine";
import { makeView } from "@/game/view";

const EMPTY: HudSnap = {
  phase: "title",
  hp: 130,
  maxHp: 130,
  kos: 0,
  combo: 0,
  zone: "CINCINNATI ZOO",
  progress: 0,
  pound: 1,
  score: 0,
  time: 0,
  bestScore: 0,
  bestKos: 0,
  bestTime: 0,
  muted: false,
  checkpoint: START_X,
  message: "",
};

function pad(n: number) {
  return String(Math.max(0, Math.floor(n))).padStart(6, "0");
}

export function HarambeGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const simRef = useRef<GameSim | null>(null);
  const audioRef = useRef<AudioBus | null>(null);
  const [hud, setHud] = useState<HudSnap>(EMPTY);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const sim = new GameSim();
    const audio = new AudioBus();
    sim.sfx = audio;
    audio.muted = sim.muted;
    sim.reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    sim.bindProbe();
    simRef.current = sim;
    audioRef.current = audio;
    const art: ArtSet = createArt();
    loadArt(art);
    const buf = document.createElement("canvas");
    const bctx = buf.getContext("2d");
    let raf = 0;
    let dead = false;
    let last = performance.now();
    let acc = 0;
    let hudAcc = 0;
    let lastPhase = sim.phase;

    const onKeyDown = (e: KeyboardEvent) => {
      if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) e.preventDefault();
      sim.keys.add(e.code);
      if (e.code === "Enter" && sim.phase === "title") {
        audio.unlock();
        sim.start();
      }
      if ((e.code === "Escape" || e.code === "KeyP") && (sim.phase === "play" || sim.phase === "pause")) {
        sim.togglePause();
      }
      if (e.code === "KeyM") sim.toggleMute();
    };
    const onKeyUp = (e: KeyboardEvent) => {
      sim.keys.delete(e.code);
    };
    const onBlur = () => sim.keys.clear();
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);

    const frame = (now: number) => {
      if (dead) return;
      const delta = Math.min(0.05, (now - last) / 1000);
      last = now;
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const scale = rect.width >= 1000 ? 4 : 3;
      const pw = Math.max(2, Math.round(rect.width / scale));
      const ph = Math.max(2, Math.round(rect.height / scale));
      if (buf.width !== pw) buf.width = pw;
      if (buf.height !== ph) buf.height = ph;
      const view = makeView(pw, ph);
      acc += delta;
      let steps = 0;
      while (acc >= 1 / 60 && steps < 5) {
        sim.step(1 / 60, view.worldW);
        acc -= 1 / 60;
        steps += 1;
      }
      if (steps === 5) acc = 0;
      if (bctx) {
        bctx.imageSmoothingEnabled = false;
        draw(bctx, sim, art, view);
      }
      const ctx = canvas.getContext("2d");
      const bw = Math.max(1, Math.floor(rect.width * dpr));
      const bh = Math.max(1, Math.floor(rect.height * dpr));
      if (canvas.width !== bw) canvas.width = bw;
      if (canvas.height !== bh) canvas.height = bh;
      if (ctx) {
        ctx.imageSmoothingEnabled = false;
        ctx.fillStyle = "#070b09";
        ctx.fillRect(0, 0, bw, bh);
        ctx.drawImage(buf, 0, 0, bw, bh);
      }
      hudAcc += delta;
      if (hudAcc > 0.1 || sim.phase !== lastPhase) {
        hudAcc = 0;
        lastPhase = sim.phase;
        setHud(sim.snapshot());
      }
      raf = requestAnimationFrame(frame);
    };

    setHud(sim.snapshot());
    raf = requestAnimationFrame(frame);
    return () => {
      dead = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      delete window.__controlsTest;
    };
  }, []);

  const unlock = () => audioRef.current?.unlock();
  const low = hud.hp / hud.maxHp < 0.3;

  return (
    <div className="shell">
      <div className="marquee" aria-hidden="true">
        <span>HARAMBE ESCAPE</span>
        <span>ZOO → JUNGLE</span>
      </div>
      <div className="stage-well">
        <div className="stage">
        <canvas ref={canvasRef} className="stage-canvas" aria-label="Harambe Escape arcade brawler" />
        {hud.phase === "play" && (
          <div className="hud">
            <div className="hud-row">
              <div>
                <div className="kicker">1UP</div>
                <div className="score">{pad(hud.score)}</div>
              </div>
              <div className="bar-wrap">
                <div className="meter-label">POWER</div>
                <div className={low ? "bar danger" : "bar"}>
                  <span style={{ width: `${(hud.hp / hud.maxHp) * 100}%` }} />
                </div>
                <div className="meter-label">POUND</div>
                <div className="bar thin">
                  <span style={{ width: `${hud.pound * 100}%` }} />
                </div>
              </div>
              <div>
                <div className="kicker">HI</div>
                <div className="score">{pad(hud.bestScore)}</div>
              </div>
              <button type="button" className="icon-btn" aria-label="Pause" onClick={() => simRef.current?.togglePause()}>
                II
              </button>
              <button
                type="button"
                className="icon-btn"
                aria-label={hud.muted ? "Unmute" : "Mute"}
                onClick={() => simRef.current?.toggleMute()}
              >
                {hud.muted ? "X" : "M"}
              </button>
            </div>
            <div className="hud-meta">
              <span className="zone">{hud.zone}</span>
              <span className="kos">
                KO {hud.kos}
                {hud.combo >= 2 ? `  x${hud.combo}` : ""}
              </span>
            </div>
          </div>
        )}
        {hud.phase === "title" && (
          <div className="title-wrap">
            <div className="title-card">
              <p className="kicker">1 PLAYER</p>
              <h1 className="title-word">HARAMBE</h1>
              <p className="title-word sub">ESCAPE</p>
              <p className="lede">Cincinnati Zoo to the jungle. Slam the line. Break the gates.</p>
              <p className="touch-help">Stick moves. ATK hits. POW is the chest pound. JUMP hops.</p>
              <p className="keys-help">
                <kbd>A</kbd>
                <kbd>D</kbd> move <kbd>W</kbd>
                <kbd>S</kbd> lane <kbd>J</kbd> attack <kbd>K</kbd> pound <kbd>Space</kbd> jump
              </p>
              <div className="actions-row">
                <button
                  type="button"
                  className="btn btn-accent"
                  onClick={() => {
                    unlock();
                    simRef.current?.start();
                  }}
                >
                  START
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => simRef.current?.toggleMute()}>
                  {hud.muted ? "SOUND OFF" : "SOUND ON"}
                </button>
              </div>
              {hud.bestScore > 0 && (
                <p className="best">
                  HI {pad(hud.bestScore)} · BEST KO {hud.bestKos}
                  {hud.bestTime > 0 ? ` · ${formatTime(hud.bestTime)}` : ""}
                </p>
              )}
            </div>
          </div>
        )}
        {hud.phase === "pause" && (
          <div className="modal-wrap">
            <div className="panel">
              <p className="kicker">PAUSED</p>
              <h2>HOLD</h2>
              <p>A D move. W S change lane. J attacks. K is the chest pound. Space jumps.</p>
              <div className="actions-row">
                <button type="button" className="btn btn-accent" onClick={() => simRef.current?.togglePause()}>
                  RESUME
                </button>
              </div>
            </div>
          </div>
        )}
        {hud.phase === "dead" && (
          <div className="modal-wrap">
            <div className="panel">
              <p className="kicker">KO</p>
              <h2>DOWN</h2>
              <p>The line held. Get up at the last gate, or run it from the zoo.</p>
              <div className="stat-grid">
                <div>
                  <span>Score</span>
                  <strong>{pad(hud.score)}</strong>
                </div>
                <div>
                  <span>KO</span>
                  <strong>{hud.kos}</strong>
                </div>
                <div>
                  <span>Time</span>
                  <strong>{formatTime(hud.time)}</strong>
                </div>
              </div>
              <div className="actions-row">
                {hud.checkpoint > START_X + 40 && (
                  <button type="button" className="btn btn-accent" onClick={() => simRef.current?.retry(false)}>
                    GET UP
                  </button>
                )}
                <button type="button" className="btn" onClick={() => simRef.current?.retry(true)}>
                  FROM ZOO
                </button>
              </div>
            </div>
          </div>
        )}
        {hud.phase === "win" && (
          <div className="modal-wrap">
            <div className="panel">
              <p className="kicker">CLEAR</p>
              <h2>JUNGLE</h2>
              <p>The canopy closed behind you. Zoo, street, and sirens stayed on the other side.</p>
              <div className="stat-grid">
                <div>
                  <span>Score</span>
                  <strong>{pad(hud.score)}</strong>
                </div>
                <div>
                  <span>KO</span>
                  <strong>{hud.kos}</strong>
                </div>
                <div>
                  <span>Time</span>
                  <strong>{formatTime(hud.time)}</strong>
                </div>
              </div>
              <div className="actions-row">
                <button
                  type="button"
                  className="btn btn-accent"
                  onClick={() => {
                    unlock();
                    simRef.current?.start();
                  }}
                >
                  RUN IT BACK
                </button>
              </div>
            </div>
          </div>
        )}
        </div>
      </div>
      <TouchBar simRef={simRef} onUse={unlock} />
    </div>
  );
}

function TouchBar({ simRef, onUse }: { simRef: RefObject<GameSim | null>; onUse: () => void }) {
  return (
    <div className="touch-controls">
      <Joystick simRef={simRef} onUse={onUse} />
      <div className="act-row">
        <Hold label="JUMP" className="act" flag="jump" simRef={simRef} onUse={onUse} />
        <Hold label="ATK" className="act slam" flag="slam" simRef={simRef} onUse={onUse} />
        <Hold label="POW" className="act pound" flag="pound" simRef={simRef} onUse={onUse} />
      </div>
    </div>
  );
}

function Hold({
  label,
  className,
  flag,
  simRef,
  onUse,
}: {
  label: string;
  className: string;
  flag: "jump" | "slam" | "pound";
  simRef: RefObject<GameSim | null>;
  onUse: () => void;
}) {
  const set = (down: boolean) => (e: ReactPointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (down) {
      onUse();
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    const sim = simRef.current;
    if (sim) sim.touch[flag] = down;
  };
  return (
    <button type="button" className={className} onPointerDown={set(true)} onPointerUp={set(false)} onPointerCancel={set(false)} onContextMenu={(e) => e.preventDefault()}>
      {label}
    </button>
  );
}

function Joystick({ simRef, onUse }: { simRef: RefObject<GameSim | null>; onUse: () => void }) {
  const base = useRef<HTMLDivElement>(null);
  const pid = useRef<number | null>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });

  const move = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (pid.current !== e.pointerId || !base.current) return;
    const rect = base.current.getBoundingClientRect();
    const max = rect.width * 0.32;
    let dx = e.clientX - (rect.left + rect.width / 2);
    let dy = e.clientY - (rect.top + rect.height / 2);
    const mag = Math.hypot(dx, dy) || 1;
    const clamped = Math.min(max, mag);
    dx = (dx / mag) * clamped;
    dy = (dy / mag) * clamped;
    setKnob({ x: dx, y: dy });
    const sim = simRef.current;
    if (!sim) return;
    sim.touch.jx = dx / max;
    sim.touch.jy = dy / max;
  };

  const end = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (pid.current !== e.pointerId) return;
    pid.current = null;
    setKnob({ x: 0, y: 0 });
    const sim = simRef.current;
    if (!sim) return;
    sim.touch.jx = 0;
    sim.touch.jy = 0;
  };

  return (
    <div
      ref={base}
      className="joy"
      aria-label="Move"
      onPointerDown={(e) => {
        onUse();
        pid.current = e.pointerId;
        e.currentTarget.setPointerCapture(e.pointerId);
        move(e);
      }}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
    >
      <div className="joy-knob" style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }} />
    </div>
  );
}
