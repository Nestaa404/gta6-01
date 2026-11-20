// Solmara — the moving things: the player, cars (parked, traffic and
// police), pedestrians and bullets. Physics is deliberately simple and
// arcade-like: cars are circles for collision, traffic follows the road
// grid, pedestrians wander the sidewalks and flee from danger.

import { CFG, CAR_COLORS, PED_COLORS, SHIRT_COLORS } from './config.js';
import {
  clamp, dist, dist2, angleDiff, normalizeAngle, pick, range,
} from './util.js';
import { isOnRoad, nearestRoad, resolveBuildingCollision, clampToWorld } from './world.js';

let nextCarId = 1;
let nextPedId = 1;

export function makeCar(x, y, angle, color, kind) {
  return {
    id: nextCarId++,
    kind: kind || 'parked', // parked | traffic | police | player
    x, y, angle,
    speed: 0,
    color: color || pick(Math.random, CAR_COLORS),
    // Traffic state: which road axis it follows and its cruise speed.
    axis: 'x',
    cruise: 140,
    turnCooldown: 0,
    // Police detour state: steers around a building it rammed.
    detourT: 0,
    detourDir: 1,
    // Police state.
    sirenPhase: Math.random() * 6,
    stuckTimer: 0,
    lastX: x,
    lastY: y,
    removed: false,
  };
}

export function makePed(x, y, rng) {
  return {
    id: nextPedId++,
    x, y,
    angle: rng() * Math.PI * 2,
    speed: range(rng, 28, 55),
    skin: pick(rng, PED_COLORS),
    shirt: pick(rng, SHIRT_COLORS),
    // Wander state.
    targetX: x,
    targetY: y,
    waitTimer: range(rng, 0, 3),
    fleeing: false,
    panic: 0,
  };
}

export function makePlayer(x, y) {
  return {
    x, y,
    angle: -Math.PI / 2,
    health: CFG.playerHealth,
    money: 0,
    inCar: null, // car object when driving, else null
    speed: 0,
    shootCooldown: 0,
    hurtFlash: 0,
    bustTimer: 0,
  };
}

export function makeBullet(x, y, angle) {
  return { x, y, angle, travelled: 0, dead: false };
}

// --- Player on foot -------------------------------------------------------

export function updatePlayerOnFoot(player, input, dt, city) {
  const run = input.isDown('ShiftLeft') || input.isDown('ShiftRight');
  const speed = run ? CFG.runSpeed : CFG.walkSpeed;
  let mx = input.axis('KeyD', 'KeyA') + input.axis('ArrowRight', 'ArrowLeft');
  let my = input.axis('KeyS', 'KeyW') + input.axis('ArrowDown', 'ArrowUp');
  const len = Math.hypot(mx, my);
  if (len > 0) {
    mx /= len;
    my /= len;
    player.angle = Math.atan2(my, mx);
    player.x += mx * speed * dt;
    player.y += my * speed * dt;
    player.speed = speed;
  } else {
    player.speed = 0;
  }
  resolveBuildingCollision(city, player, CFG.playerRadius);
  clampToWorld(city, player, CFG.playerRadius + 2);
  if (player.shootCooldown > 0) player.shootCooldown -= dt;
  if (player.hurtFlash > 0) player.hurtFlash -= dt;
}

// --- Driving --------------------------------------------------------------

// Arcade car physics: forward speed plus steering that bites harder
// with speed, lateral grip that bleeds off in a handbrake slide.
export function updatePlayerCar(car, input, dt, city, onCrash) {
  const forward = input.isDown('KeyW') || input.isDown('ArrowUp');
  const back = input.isDown('KeyS') || input.isDown('ArrowDown');
  const steer = input.axis('KeyA', 'KeyD') + input.axis('ArrowLeft', 'ArrowRight');
  const handbrake = input.isDown('Space');

  if (forward) car.speed += CFG.carAccel * dt;
  if (back) {
    if (car.speed > 20) car.speed -= CFG.carBrake * dt;
    else car.speed -= CFG.carAccel * 0.55 * dt;
  }
  if (!forward && !back) car.speed -= Math.sign(car.speed) * 160 * dt;
  car.speed = clamp(car.speed, -CFG.carReverseMax, CFG.carMaxSpeed);

  const speed01 = Math.abs(car.speed) / CFG.carMaxSpeed;
  const dir = car.speed >= 0 ? 1 : -1;
  car.angle += steer * CFG.carTurnRate * speed01 * dir * dt * (handbrake ? 1.6 : 1);
  car.angle = normalizeAngle(car.angle);

  const nx = Math.cos(car.angle);
  const ny = Math.sin(car.angle);
  car.x += nx * car.speed * dt;
  car.y += ny * car.speed * dt;

  // Buildings stop the car hard; a fast hit costs health and speed.
  if (resolveBuildingCollision(city, car, 20)) {
    const impact = Math.abs(car.speed);
    car.speed *= -0.25;
    if (impact > 240 && onCrash) onCrash(impact);
  }
  clampToWorld(city, car, 26);
  return speed01;
}

// --- Traffic --------------------------------------------------------------

// A traffic car cruises along one road axis. At an intersection it may
// turn onto the crossing road; anywhere else it just holds its lane.
export function updateTrafficCar(car, dt, city, rng) {
  car.turnCooldown -= dt;
  const road = nearestRoad(city, car.x, car.y);
  const along = car.axis === 'x' ? car.x : car.y;
  const cross = car.axis === 'x' ? car.y : car.x;

  // Steer back onto the centre of the road it follows.
  const targetAngle = car.axis === 'x'
    ? (Math.cos(car.angle) >= 0 ? 0 : Math.PI)
    : (Math.sin(car.angle) >= 0 ? Math.PI / 2 : -Math.PI / 2);
  const crossErr = cross - road.line;
  const desired = targetAngle + clamp(-crossErr * 0.004, -0.35, 0.35) * (car.axis === 'x' ? 1 : -1);
  car.angle += clamp(angleDiff(car.angle, desired), -2.2 * dt, 2.2 * dt);

  // Ease toward the cruise speed, but bleed off a shoved speed
  // gradually instead of snapping back to cruise (which would make
  // a shoved car brake hard in front of the car that shoved it).
  if (car.speed < car.cruise) {
    car.speed = Math.min(car.cruise, car.speed + 140 * dt);
  } else {
    car.speed = Math.max(car.cruise, car.speed - 70 * dt);
  }
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;

  // At an intersection (near both a vertical and a horizontal road),
  // sometimes turn. The crossing line is the other axis's road.
  if (car.turnCooldown <= 0 && Math.abs(crossErr) < 14) {
    const other = nearestRoad(city, car.x, car.y);
    const nearCrossing = Math.abs((car.axis === 'x' ? car.x : car.y) - other.line) < 60;
    if (nearCrossing && rng() < 0.02) {
      car.axis = car.axis === 'x' ? 'y' : 'x';
      car.turnCooldown = 4;
    }
  }

  // Wrap around the far edge so traffic never runs out.
  if (car.x < -60) car.x = city.size + 50;
  if (car.x > city.size + 60) car.x = -50;
  if (car.y < -60) car.y = city.size + 50;
  if (car.y > city.size + 60) car.y = -50;

  resolveBuildingCollision(city, car, 20);
}

// --- Pedestrians ----------------------------------------------------------

export function updatePed(ped, dt, city, danger) {
  if (ped.panic > 0) ped.panic -= dt;
  // Flee from a nearby fast car or a gunshot.
  if (danger) {
    const d = dist(ped.x, ped.y, danger.x, danger.y);
    if (d < 170) {
      ped.fleeing = true;
      ped.panic = 2.5;
      ped.targetX = ped.x + (ped.x - danger.x) * 2;
      ped.targetY = ped.y + (ped.y - danger.y) * 2;
    }
  }
  if (ped.fleeing && ped.panic <= 0) ped.fleeing = false;

  const dx = ped.targetX - ped.x;
  const dy = ped.targetY - ped.y;
  const d = Math.hypot(dx, dy);
  if (d < 8) {
    ped.waitTimer -= dt;
    if (ped.waitTimer <= 0) {
      // Pick a new stroll target along a nearby road or sidewalk.
      const road = nearestRoad(city, ped.x, ped.y);
      const off = (Math.random() < 0.5 ? -1 : 1) * (CFG.roadWidth / 2 + 10);
      if (road.axis === 'x') {
        ped.targetX = clamp(ped.x + (Math.random() < 0.5 ? -1 : 1) * range(Math.random, 120, 420), 60, city.size - 60);
        ped.targetY = road.line + off;
      } else {
        ped.targetX = road.line + off;
        ped.targetY = clamp(ped.y + (Math.random() < 0.5 ? -1 : 1) * range(Math.random, 120, 420), 60, city.size - 60);
      }
      ped.waitTimer = range(Math.random, 0.5, 4);
    }
    return;
  }
  const sp = ped.fleeing ? ped.speed * 2.6 : ped.speed;
  ped.angle = Math.atan2(dy, dx);
  ped.x += (dx / d) * sp * dt;
  ped.y += (dy / d) * sp * dt;
  resolveBuildingCollision(city, ped, 10);
  clampToWorld(city, ped, 12);
}

// --- Bullets --------------------------------------------------------------

export function updateBullet(b, dt, city, cars, peds, police, onHit) {
  const step = CFG.bulletSpeed * dt;
  b.x += Math.cos(b.angle) * step;
  b.y += Math.sin(b.angle) * step;
  b.travelled += step;
  if (b.travelled > CFG.bulletRange || b.x < 0 || b.y < 0 || b.x > city.size || b.y > city.size) {
    b.dead = true;
    return;
  }
  if (hitsBuildingPoint(city, b.x, b.y)) {
    b.dead = true;
    onHit('wall', b);
    return;
  }
  for (const car of cars) {
    if (!car.removed && dist2(b.x, b.y, car.x, car.y) < 24 * 24) {
      b.dead = true;
      onHit('car', b, car);
      return;
    }
  }
  for (const p of peds) {
    if (dist2(b.x, b.y, p.x, p.y) < 13 * 13) {
      b.dead = true;
      onHit('ped', b, p);
      return;
    }
  }
  for (const c of police) {
    if (dist2(b.x, b.y, c.x, c.y) < 24 * 24) {
      b.dead = true;
      onHit('police', b, c);
      return;
    }
  }
}

function hitsBuildingPoint(city, x, y) {
  for (const b of city.buildings) {
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return true;
  }
  return false;
}

// Find the nearest car the player could steal, within reach.
export function nearestCar(cars, x, y, maxDist) {
  let best = null;
  let bestD = maxDist * maxDist;
  for (const car of cars) {
    if (car.removed) continue;
    const d = dist2(x, y, car.x, car.y);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

// Keep two cars from overlapping: push them apart, and let the
// faster car shove the slower one along instead of both grinding
// to a halt in a pile-up.
export function separateCars(a, b) {
  const d = dist(a.x, a.y, b.x, b.y);
  const min = 54; // just over a car's length, so they never overlap
  if (d >= min || d < 0.001) return false;
  const push = (min - d) / 2;
  const nx = (b.x - a.x) / d;
  const ny = (b.y - a.y) / d;
  a.x -= nx * push;
  a.y -= ny * push;
  b.x += nx * push;
  b.y += ny * push;
  const fast = Math.abs(a.speed) >= Math.abs(b.speed) ? a : b;
  const slow = fast === a ? b : a;
  slow.speed = fast.speed * 0.85;
  fast.speed *= 0.97;
  return true;
}
