// The screenshot scenes behind ?shot=start|play|chase|mission. Each one plays
// the real rules forward from a fresh world for a fixed number of steps, steered
// by a small autopilot, so the frame is what real play looks like and the same
// seed always gives the same frame.
//
// start  — the title screen over downtown Solmara.
// play   — driving a stolen car down an avenue, traffic and pedestrians around.
// chase  — three wanted stars, police cars closing in on a getaway.
// mission— mission 3 in progress: Kade's crew at the warehouse, marker on the HUD.
import { CAR, STEP } from './config.js';
import { PLACES } from './city.js';
import { SCREEN_BUSTED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const DRIVE_SECONDS = 10;
const CHASE_SECONDS = 15;
const MISSION_SECONDS = 3.5;

/** A loop around downtown Solmara the autopilot drives, so the shot stays in the city. */
const LOOP = [
  { x: 2100, y: 650 },
  { x: 2100, y: 1050 },
  { x: 1650, y: 1050 },
  { x: 1650, y: 650 },
];

function driveInput(world, targetAngle) {
  const player = world.player;
  const car = player.inCar;
  if (!car) return { up: false, down: false, left: false, right: false, run: false, handbrake: false };
  let diff = targetAngle - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return { up: true, down: false, left: diff < -0.08, right: diff > 0.08, run: false, handbrake: false };
}

function stageDrive(world, seconds, wanted) {
  // Put the player in a car on a downtown street and let the autopilot drive
  // the loop, so the frame shows the city, traffic and the HUD — not the sea.
  const car = world.state.cars[0] ?? null;
  const player = world.player;
  if (car) {
    car.x = 1650; car.y = 650;
    car.angle = 0;
    car.color = '#f2c94c';
    car.traffic = false; car.parked = false;
    player.inCar = car;
    player.x = car.x; player.y = car.y; player.angle = car.angle;
  }
  // The steal already raised one star; set the exact wanted level for the shot.
  world.state.wanted = 0;
  if (wanted > 0) world.addWanted(wanted, '');
  let waypoint = 0;
  let lastX = player.x;
  let lastY = player.y;
  let stuckChecks = 0;
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    const target = LOOP[waypoint];
    const dx = target.x - player.x;
    const dy = target.y - player.y;
    if (dx * dx + dy * dy < 70 * 70) waypoint = (waypoint + 1) % LOOP.length;
    world.step(STEP, driveInput(world, Math.atan2(dy, dx)));
    // Anti-stuck: a pile-up with traffic can wedge the car on a building
    // corner; if it barely moved in the last second, put it back on the loop.
    stuckChecks += 1;
    if (stuckChecks >= 60) {
      stuckChecks = 0;
      const moved = Math.hypot(player.x - lastX, player.y - lastY);
      lastX = player.x;
      lastY = player.y;
      if (moved < 40 && player.inCar) {
        const at = LOOP[waypoint];
        const next = LOOP[(waypoint + 1) % LOOP.length];
        player.inCar.x = at.x;
        player.inCar.y = at.y;
        player.inCar.angle = Math.atan2(next.y - at.y, next.x - at.x);
        player.inCar.speed = 220;
      }
    }
  }
}

export function stageShot(name, world) {
  world.reset();
  if (name === 'play') {
    stageDrive(world, DRIVE_SECONDS, 0);
    return { screen: SCREEN_PLAY, best: 0 };
  }
  if (name === 'chase') {
    stageDrive(world, CHASE_SECONDS, 3);
    return { screen: SCREEN_PLAY, best: 0 };
  }
  if (name === 'mission') {
    // Mission 3: walk to the warehouse, crew spawns, fight starts.
    world.missions.start(2);
    const p = world.player;
    p.x = PLACES.warehouse.x + 180;
    p.y = PLACES.warehouse.y + 220;
    p.weapon = 'pistol';
    p.ammo.pistol = 60;
    const steps = Math.round(MISSION_SECONDS / STEP);
    let shotsFired = 0;
    for (let i = 0; i < steps; i += 1) {
      const input = { up: false, down: false, left: false, right: false, run: false, handbrake: false };
      // Walk toward the warehouse so the crew spawns and the fight opens.
      const dx = PLACES.warehouse.x - p.x;
      const dy = PLACES.warehouse.y - p.y;
      input.left = dx < -8;
      input.right = dx > 8;
      input.up = dy < -8;
      input.down = dy > 8;
      world.step(STEP, input);
      if (world.state.enemies.some((e) => !e.dead) && shotsFired < 3 && i % 55 === 0) {
        // Fire a few shots at the nearest crew member for a live-fire frame,
        // but leave the crew standing so the fight still reads.
        const e = world.state.enemies.find((e2) => !e2.dead);
        if (e) {
          world.playerAttack(Math.atan2(e.y - p.y, e.x - p.x));
          shotsFired += 1;
        }
      }
    }
    return { screen: SCREEN_PLAY, best: 0 };
  }
  if (name === 'busted') {
    return { screen: SCREEN_BUSTED, best: 0 };
  }
  // start (and any unknown name): the title over a living city.
  const steps = Math.round(5 / STEP);
  for (let i = 0; i < steps; i += 1) {
    world.step(STEP, { up: false, down: false, left: false, right: false, run: false, handbrake: false });
  }
  return { screen: SCREEN_TITLE, best: 0 };
}
