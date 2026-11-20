# Solmara — An Open-World Crime Story

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/Nestaa404/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/Nestaa404/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

Entry for make.fun bounty `gta6-01` — build the most complete open-world crime game:
https://make.fun/bounty/gta6-01

`main.ts` (Node 22, standard library only) copies the static browser game in
`game/` plus `screenshots/` to `/output` and writes `dossier.json` with the
vendored make.fun library.

## The game

**Solmara** is an original open-world crime game that runs offline in a desktop
browser from static files — no network, no build step. Sun, sea, and Silas Kade
owning every street: you are Marco Solis, a wheelman for hire, taking jobs from
fixer Lena Voss across five story missions.

- **A city to explore** — Solmara: downtown towers, the marina, the docks, an
  industrial quarter, residential streets, parks, and Playa Sol beach, all on a
  3600×2800 map with traffic and pedestrians living their own lives.
- **On foot and by car** — walk, run, steal any car (E), drive with real
  acceleration, steering and handbrake, and run from the consequences.
- **Wanted level + police** — five stars. Stealing, hitting pedestrians and
  shooting raise the heat; police cars chase and ram you, foot cops try to
  arrest you. Lie low to cool down — or get busted or wasted.
- **Missions and a story** — five missions with a waypoint marker, objectives
  and payouts, ending in a showdown with Silas Kade at Marina Tower.
- **Combat** — fists, pistol and shotgun with mouse aim, health and ammo
  pickups, enemy crews that shoot back.
- **HUD + minimap** — money, health, wanted stars, weapon and ammo, speed,
  mission objective with distance, a live minimap, and a clock.
- **Start and save** — title screen with New Game / Continue, pause menu, and
  progress saved in the browser (F).
- **Sound** — synthesised with WebAudio: a chiptune loop, engine hum, sirens,
  gunshots. No audio files.

## Run it

```sh
node serve.ts
# then open http://localhost:8080
```

Play: WASD move / drive · Shift run · mouse aim · click shoot · E steal & enter
cars · Q switch weapon · F save · P pause · H how to play · M mute.

## Screenshots

`shots.json` lists the four staged shots; `?shot=start|play|chase|mission`
with `&seed=7` reproduces each one deterministically from the real game.

Built by Brio and sub-agents for @anesta-s-kurniawansyah. All city, characters,
names, story, art and music are original — nothing from any commercial game.
