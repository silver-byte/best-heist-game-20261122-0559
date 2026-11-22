# One Night at Meridian Bank

[![One Night at Meridian Bank on make.fun](https://make.fun/badge/best-heist-game-20261122-0559.svg)](https://make.fun/bounty/best-heist-game-20261122-0559)
[![rank](https://make.fun/badge/best-heist-game-20261122-0559/silver-byte/best-heist-game-20261122-0559/rank.svg)](https://make.fun/bounty/best-heist-game-20261122-0559)
[![reward](https://make.fun/badge/best-heist-game-20261122-0559/silver-byte/best-heist-game-20261122-0559/reward.svg)](https://make.fun/bounty/best-heist-game-20261122-0559)

A top-down stealth heist game: slip through Meridian Bank at night, grab the vault gem (top right) and reach the escape van (bottom left) without the sweeping cameras and patrolling guards filling your alarm bar. It plays offline in desktop Chrome from plain static files — no libraries, no network, no randomness.

## How to play

- **Controls**: Arrow keys or WASD move one tile per press. Walls and crates block movement.
- **Cones**: Guards and cameras project vision cones — translucent yellow tiles for guards, translucent pink tiles for cameras. Standing inside any cone raises the alarm.
- **Cameras**: Two fixed cameras sweep their cones, rotating direction every few steps.
- **Alarm**: The gold bar across the top is the alarm. It fills while you stand in a cone and drains when you are clear; full alarm means you are caught and reset to the start (any gem is lost).
- **Crates**: Wooden crates block sight and movement — crouch behind one to stay out of every cone.
- **Gem**: The gold diamond in the top right. Step onto it to take it (the player turns gold).
- **Van**: The blue rectangle at the bottom left. Reach it while carrying the gem to win.

## Run it

Serve the game locally (Node 22, standard library only):

```
node serve.ts
```

Then open http://localhost:8080 in Chrome.

To build the hand-in the way the judge does (writes `game/`, `screenshots/` and `dossier.json` into an output directory):

```
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

Outside the grader's container, `MAKEFUN_OUTPUT_DIR` stands in for `/output`. Two runs write byte-identical output — no network, no clock, no randomness.