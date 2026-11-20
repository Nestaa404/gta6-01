# Solmara — an open-world crime game

[![make.fun bounty](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/Nestaa404/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/Nestaa404/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01)

Entry for make.fun bounty — [Make GTA 6](https://make.fun/bounty/gta6-01)

**Solmara** is an original top-down open-world crime game that runs
entirely offline in a desktop browser. No Rockstar assets, names or
maps — just a sun-soaked coastal city of its own, built from scratch
in plain Canvas 2D with no libraries and no network requests.

## The city

Solmara is a 3200×3200-pixel coastal city: a road grid of downtown
blocks with coloured rooftops, a palm park, a beach with animated
waves on the south shore, and a marina on the east edge. Traffic
cruises the roads, pedestrians stroll the sidewalks and flee from
danger, and parked cars line the kerbs waiting to be borrowed.

## What you can do

- **Explore on foot** — WASD to walk, Shift to run, mouse to aim.
- **Steal and drive cars** — walk up to any car and press E. Arcade
  handling with acceleration, braking, reverse and a handbrake.
- **Wanted level** — stealing cars, hitting pedestrians and shooting
  raise your stars (0–5). Police cars chase and ram you; police on
  foot close in and arrest you. Stay out of sight and the heat fades.
- **Combat** — click or press F to shoot. Bullets hit walls, cars,
  pedestrians and police.
- **Missions and story** — four jobs from Rico, your fixer: steal a
  getaway car, make a timed delivery, lose a three-star chase, and
  pull the Marina Job. Each pays out and unlocks the next.
- **HUD and minimap** — health, money, wanted stars, speedometer,
  mission objective bar and a live minimap with the player, police
  and objective marker.
- **Save** — progress (money, finished missions, position) saves to
  localStorage automatically on mission completion and with S in the
  pause menu; Continue resumes it from the title screen.
- **Sound** — fully synthesized with Web Audio: engine hum, police
  siren, gunshots, crashes and mission jingles. M mutes.

## Controls

| Key | Action |
| --- | --- |
| W A S D / Arrows | Move / drive |
| Shift | Run |
| E | Enter / exit car |
| Mouse + Click / F | Aim and shoot |
| Space | Handbrake |
| T | Talk to Rico (next mission) |
| P / Esc | Pause |
| M | Mute sound |
| S (in pause) | Save game |
| R (after busted / wasted) | Try again |

## Play it

```sh
node serve.ts
# open http://localhost:8080
```

No build step, no dependencies: `game/index.html` plus its ES
modules under `game/src/` is the whole game.

## Layout

- `game/index.html` — the page and its canvas.
- `game/src/main.js` — game loop, state machine, boot.
- `game/src/world.js` — deterministic city generation and collision.
- `game/src/entities.js` — player, cars, traffic, pedestrians, bullets.
- `game/src/police.js` — wanted level and police AI.
- `game/src/missions.js` — the four missions and their story.
- `game/src/render.js` — camera, world, HUD, minimap and screens.
- `game/src/audio.js` — synthesized Web Audio sound.
- `game/src/input.js` — keyboard and mouse.
- `game/src/save.js` — localStorage save / load.
- `game/src/shots.js` — staged screenshot scenes (`?shot=...`).
- `game/src/config.js` — tuning numbers and palette.
- `game/src/util.js` — math and seeded random helpers.
- `main.ts` — the entrypoint: copies `game/` and `screenshots/` to
  the output and writes `dossier.json`.

## License

MIT — see `LICENSE`.
