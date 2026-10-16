# Harambe: Jungle Brawl

A single-player, Turtles-in-Time-style arcade beat-'em-up. In this alternate universe, Harambe tosses the kid onto a giant haystack (the kid is fine and wants to go again), escapes the Cincinnati Zoo, and brawls his way to the nearest jungle while the whole city turns out to stop him. Cartoon violence only: nets, tranquilizer darts, stun bolts and comic hit sparks.

| Stage | Enemies | Boss |
|---|---|---|
| 1 Cincinnati Zoo | zookeepers: net, tranq-dart and stun-baton keepers | Head Zookeeper |
| 2 Vine Street | cops: baton, riot shield, taser (ranged) | Police Captain |
| 3 FBI Field Office | agents: flying kick, net launcher, briefcase | Special Agent |
| 4 Fort Cincinnati | soldiers: shield troopers, net gunners, shock troopers | Armored General |
| 5 The Jungle | mixed elite squads of all four factions | The Baron |

Every stage is harder than the last: more enemies per wave, more HP, speed and damage, faster attacks, more enemies attacking at once, burst fire from ranged troops, and tougher bosses (bosses enrage below 40% health and call backup). Light and heavy swings can bat nets, darts and bolts out of the air. Crates and barrels drop bananas (health).

## Controls
| Action | Keyboard | Touch |
|---|---|---|
| Move (4-way, depth lanes) | WASD / arrows | left stick |
| Light attack (3-hit combo) | J / Z | ATK |
| Heavy attack (knockdown) | K / X | HVY |
| Jump (attack in the air for a jump kick) | Space / C | JUMP |
| Special chest-pound shockwave (costs 8 HP) | L / V | SP |
| Pause / start | Enter / P | ❚❚ |
| Mute | M | |

## Run
It is a static site with ES modules and no build step. Serve the folder and open it:

```bash
python3 -m http.server 8080   # then visit http://localhost:8080
npm test                       # unit tests for the game rules and stage data (node:test)
```

URL params for QA: `?debugstart&stage=N` skips straight into stage N (0-based), `&god` for invulnerability, `?skipintro`.

Deploys as-is to Vercel (or any static host). Audio is synthesized with WebAudio. The game has no runtime dependencies.

## Art pipeline
Characters and stage backgrounds are AI-generated 16-bit pixel art (magenta-background sprite sheets and 16:9 background plates), sliced into game assets by `tools/ai-art/`:

```bash
pip install pillow numpy scipy
python3 tools/ai-art/build_sprites.py /path/to/art-src   # hero.jpg, enemy-*.jpg, boss1..5-anim.jpg (+ bosses.jpg fallback) -> assets/atlas/*.png + assets/atlas.json + assets/icon.png
python3 tools/ai-art/build_props.py /path/to/art-src     # props.jpg (kid, crates, barrels, bananas, heart, hay) -> assets/props_ai.png + props_ai.json
python3 tools/ai-art/build_bg.py /path/to/art-src        # bg-*.jpg -> assets/bg/*.webp + bg.json (sky / main / foreground layers, floor lane per stage)
```
The slicer keys out the magenta (hue based, so the darker ground shadows go too, with JPEG-fringe cleanup and despill), finds each sprite by connected components, flips the left-facing enemy sheets so everything faces right, scales every character to a common standing height, and anchors every frame at its feet so animations don't jitter. The game draws on a 960x540 canvas (a 3x scale of the 320x180 logic grid) so the art is shown at native resolution. Backgrounds tile mirrored along the stage; the zoo and base have a slower sky layer and the jungle a faster foreground strip for slight parallax. Each boss has an 8-frame strip (idle, 3 walk frames, wind-up, strike, hurt, defeated; the Police Captain and FBI agent strips have 7 and reuse a walk frame as the wind-up); frames a strip lacks fall back to the older `bosses.jpg` frames. The kid, crates, barrels, bananas, banana bunch, heart and haystack are AI art too (`props_ai`). The small remaining procedural bits (hit sparks, dust, net, the pixel font) are built by `python3 tools/art/build_all.py`.

By kungFuDOOM.
