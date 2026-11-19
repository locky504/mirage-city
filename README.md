[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/c/gta6-01)
[![rank](https://make.fun/badge/gta6-01/locky504/mirage-city/rank.svg)](https://make.fun/c/gta6-01)
[![reward](https://make.fun/badge/gta6-01/locky504/mirage-city/reward.svg)](https://make.fun/c/gta6-01)

# Mirage City — Desert Heat Run

An original open-world crime game for the [make.fun GTA 6 bounty](https://make.fun/c/gta6-01):
a desert casino city at dusk to explore on foot and by car, built with three.js
from plain static files — no build step, no network requests.

Referral code: `dvanqqs1`

**The city:** Solara, a neon casino city in the desert at dusk — the Solara Grand
tower on the central plaza, a road grid of neon-lit blocks, dunes and cacti
beyond the streets, traffic, pedestrians, palms and street lamps, all under a
low desert sun.

**The story:** Jax Moreno, courier driver, takes six jobs from dispatcher Rosa
Delgado — parcel runs, a timed dash through a dust storm, a junkyard shootout
with the Dust Vipers, a high-roller VIP drive, and finally the Solara Grand
vault heist — plus repeatable taxi fares and courier runs for cash.

**The systems:** stealable cars (E to enter, F to jack, +1 ★), a 0–5 star wanted
level with police cars that chase and ram, pistol combat, a HUD with a circular
minimap, start / pause / wasted / finale menus, autosave to localStorage with
Continue, and fully procedural WebAudio sound and music.

## Play

```sh
node serve.ts
# open http://localhost:8080
```

WASD walk / drive · drag mouse to orbit the camera · click to shoot · E enter a
car · F steal a car · Space handbrake · Shift run · P pause · R restart mission · M mute.

## Layout

- `game/` — the playable game (`index.html`, `style.css`, `src/*.js`, three.js vendored as `game/three.min.js`)
- `screenshots/` — real in-game renders
- `main.ts` — the make.fun entry program (copies `game/` + `screenshots/` to `/output`, writes `dossier.json`)
- `serve.ts` — local static server for playtesting
