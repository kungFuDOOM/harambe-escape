# Harambe: Jungle Brawl

A single-player, Turtles-in-Time-style arcade beat-'em-up. In this alternate universe, Harambe tosses the kid onto a giant haystack (the kid is fine and wants to go again), escapes the Cincinnati Zoo, and brawls through zookeepers, security, animal control, cops and hunters on the way to the nearest jungle.

**Stages:** 1 Cincinnati Zoo · 2 Vine Street · 3 Ohio Riverfront · 4 Kentucky Backroads · 5 The Jungle. Each stage has enemy waves, a boss, and breakable crates and barrels that drop bananas (health). The final boss is Baron von Safari.

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

Deploys as-is to Vercel (or any static host). All art is drawn procedurally and all audio is synthesized with WebAudio. There are no assets or dependencies.

By kungFuDOOM.
