// Solmara — staged scenes for screenshots. When the page is opened
// with ?shot=<name>, the game skips the title screen and arranges a
// fixed, lively moment so a screenshot shows a real system at work:
// the start screen, driving in traffic, a police chase, or a mission
// in progress. The scenes use the same code paths as normal play, so
// what the screenshot shows is what the player gets.

import { CFG } from './config.js';
import { makeCar } from './entities.js';
import { setWanted } from './police.js';
import { startMission } from './missions.js';
import { range } from './util.js';

export const SHOT_NAMES = ['start', 'drive', 'chase', 'mission'];

// Put the player in a car on a downtown road, traffic around them.
// The car auto-drives east along its road (until the player touches
// the driving keys) so a screenshot catches it in motion.
function stageDrive(game, rng) {
  const city = game.city;
  const road = city.lines[3];
  const car = makeCar(road, city.lines[3], 0, '#d94f3d', 'player');
  car.speed = 260;
  game.player.inCar = car;
  game.player.x = car.x;
  game.player.y = car.y;
  game.cars.push(car);
  game.autoDrive = true;
  // Traffic spread along three nearby roads, each on its own lane and
  // heading so no two cars stack on the same spot.
  for (let i = 0; i < 8; i++) {
    const line = city.lines[2 + (i % 3)];
    const along = road - 480 + i * 150;
    const horizontal = i % 2 === 0;
    const t = makeCar(
      horizontal ? along : line,
      horizontal ? line : along,
      horizontal ? (i % 4 < 2 ? 0 : Math.PI) : (i % 4 < 2 ? Math.PI / 2 : -Math.PI / 2),
      undefined,
      'traffic',
    );
    t.axis = horizontal ? 'x' : 'y';
    t.cruise = range(rng, CFG.trafficSpeedMin, CFG.trafficSpeedMax);
    t.speed = t.cruise;
    game.cars.push(t);
  }
}

// Same as drive, but with a three-star chase closing in.
function stageChase(game, rng) {
  stageDrive(game, rng);
  setWanted(game.police, 3);
  const px = game.player.inCar.x;
  const py = game.player.inCar.y;
  const spots = [
    { x: px - 260, y: py - 180, angle: Math.PI / 4 },
    { x: px + 220, y: py - 240, angle: Math.PI * 0.75 },
    { x: px - 320, y: py + 200, angle: -Math.PI / 4 },
  ];
  for (const s of spots) {
    const cop = makeCar(s.x, s.y, s.angle, '#1f3a93', 'police');
    cop.cruise = CFG.policeCarSpeed;
    cop.speed = 380;
    game.police.cars.push(cop);
  }
  game.player.money = 1250;
}

// Mission 2 (Sunset Delivery) in progress: the player drives toward
// the warehouse with the timer running and the objective on the HUD.
function stageMission(game, rng) {
  stageDrive(game, rng);
  const def = startMission(game.missions, 1);
  // Skip the "get a car" step: the player is already driving.
  game.missions.stepIndex = 1;
  game.missions.timer = 58;
  game.player.money = 450;
  return def;
}

export function applyShot(game, name, rng) {
  if (name === 'start') {
    game.state = 'title';
    return;
  }
  game.state = 'playing';
  game.startedAt = game.time;
  if (name === 'drive') stageDrive(game, rng);
  else if (name === 'chase') stageChase(game, rng);
  else if (name === 'mission') stageMission(game, rng);
  // Centre the camera on the action immediately.
  const px = game.player.inCar ? game.player.inCar.x : game.player.x;
  const py = game.player.inCar ? game.player.inCar.y : game.player.y;
  game.camera.x = px - game.viewW / 2;
  game.camera.y = py - game.viewH / 2;
}
