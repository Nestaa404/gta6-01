// Solmara — the wanted system and the police who answer it.
// Stars rise with crimes and fall when the player stays out of sight.
// Police cars chase and ram; police on foot close in and arrest.
// The module owns the wanted level, the police roster and the
// busted / escaped outcomes.

import { CFG } from './config.js';
import { clamp, dist, dist2, angleDiff, normalizeAngle, range } from './util.js';
import { makeCar } from './entities.js';
import { nearestRoad, clampToWorld, resolveBuildingCollision } from './world.js';

export function createPolice() {
  return {
    wanted: 0,
    cars: [],
    foot: [],
    // How long the player has been unseen by any police unit.
    unseenTimer: 0,
    // How long a unit has been holding the player still.
    bustTimer: 0,
    spawnTimer: 0,
    flash: 0,
  };
}

// A crime adds stars (capped) and resets the cool-down clock.
export function addWanted(police, stars) {
  police.wanted = clamp(police.wanted + stars, 0, CFG.maxWanted);
  police.unseenTimer = 0;
}

export function setWanted(police, stars) {
  police.wanted = clamp(stars, 0, CFG.maxWanted);
  police.unseenTimer = 0;
}

// How many police units the current wanted level calls for.
export function wantedUnitCount(wanted) {
  return [0, 1, 2, 3, 4, 5][wanted] || 0;
}

function spawnSpot(city, player, rng) {
  // Appear on a road just off-screen from the player.
  for (let tries = 0; tries < 12; tries++) {
    const road = nearestRoad(city, player.x, player.y);
    const along = range(rng, -700, 700);
    const side = rng() < 0.5 ? -1 : 1;
    let x;
    let y;
    if (road.axis === 'x') {
      x = clamp(player.x + along, 80, city.size - 80);
      y = road.line + side * 520;
    } else {
      x = road.line + side * 520;
      y = clamp(player.y + along, 80, city.size - 80);
    }
    if (dist(x, y, player.x, player.y) > 560) return { x, y };
  }
  return { x: clamp(player.x + 700, 80, city.size - 80), y: clamp(player.y, 80, city.size - 80) };
}

export function updatePolice(police, dt, city, player, rng, events) {
  police.flash += dt;
  const wanted = police.wanted;

  // Keep the roster at the wanted level's size.
  const wantCars = wanted >= 2 ? wantedUnitCount(wanted) : 0;
  const wantFoot = wanted === 1 ? 2 : wanted >= 3 ? 1 : 0;
  police.spawnTimer -= dt;
  if (police.cars.length < wantCars && police.spawnTimer <= 0) {
    const spot = spawnSpot(city, player, rng);
    const car = makeCar(spot.x, spot.y, Math.atan2(player.y - spot.y, player.x - spot.x), '#1f3a93', 'police');
    car.cruise = CFG.policeCarSpeed;
    police.cars.push(car);
    police.spawnTimer = 1.2;
  }
  if (police.foot.length < wantFoot && police.spawnTimer <= 0) {
    const spot = spawnSpot(city, player, rng);
    police.foot.push({ x: spot.x, y: spot.y, angle: 0, speed: CFG.policeFootSpeed, phase: rng() * 6 });
    police.spawnTimer = 1.2;
  }

  // Drop far-away units so the chase stays near the player.
  police.cars = police.cars.filter((c) => dist(c.x, c.y, player.x, player.y) < 1600);
  police.foot = police.foot.filter((f) => dist(f.x, f.y, player.x, player.y) < 1200);

  // Chase: steer toward the player, accelerate, slide around blocks.
  for (const car of police.cars) {
    if (car.detourT > 0) {
      // Detouring around a building: hold a perpendicular heading.
      car.detourT -= dt;
      car.angle += car.detourDir * 2.2 * dt;
    } else {
      const targetAngle = Math.atan2(player.y - car.y, player.x - car.x);
      const diff = angleDiff(car.angle, targetAngle);
      car.angle += clamp(diff, -3.1 * dt, 3.1 * dt);
    }
    car.angle = normalizeAngle(car.angle);
    const wantSpeed = dist(car.x, car.y, player.x, player.y) < 90 ? 240 : CFG.policeCarSpeed;
    car.speed += clamp(wantSpeed - car.speed, -600 * dt, 420 * dt);
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    if (resolveBuildingCollision(city, car, 20)) {
      car.speed *= 0.5;
      if (car.detourT <= 0) {
        car.detourT = 0.9;
        car.detourDir = rng() < 0.5 ? 1 : -1;
      }
    }
    clampToWorld(city, car, 26);
    // Unstick: if barely moving while far from the player, reverse out.
    const moved = dist(car.x, car.y, car.lastX, car.lastY);
    if (moved < 4 && dist(car.x, car.y, player.x, player.y) > 120) {
      car.stuckTimer += dt;
      if (car.stuckTimer > 0.8) {
        car.angle += Math.PI * 0.9;
        car.speed = -160;
        car.stuckTimer = 0;
      }
    } else {
      car.stuckTimer = 0;
    }
    car.lastX = car.x;
    car.lastY = car.y;
  }

  // Foot police walk straight at the player.
  for (const f of police.foot) {
    const d = dist(f.x, f.y, player.x, player.y);
    if (d > 12) {
      f.angle = Math.atan2(player.y - f.y, player.x - f.x);
      f.x += Math.cos(f.angle) * f.speed * dt;
      f.y += Math.sin(f.angle) * f.speed * dt;
      resolveBuildingCollision(city, f, 10);
      clampToWorld(city, f, 12);
    }
  }

  // Ramming hurts the player and the car.
  const playerCar = player.inCar;
  for (const car of police.cars) {
    if (playerCar) {
      if (dist2(car.x, car.y, playerCar.x, playerCar.y) < 44 * 44) {
        player.health -= 14 * dt;
        playerCar.speed *= 0.94;
        car.speed *= 0.7;
        events.push({ type: 'ram' });
      }
    } else if (dist2(car.x, car.y, player.x, player.y) < 30 * 30) {
      player.health -= 10 * dt;
      events.push({ type: 'ram' });
    }
  }

  // Busted: a unit holds the player still for a moment.
  let held = false;
  if (!playerCar) {
    for (const f of police.foot) {
      if (dist2(f.x, f.y, player.x, player.y) < 30 * 30) held = true;
    }
    for (const car of police.cars) {
      if (dist2(car.x, car.y, player.x, player.y) < 34 * 34) held = true;
    }
  } else if (Math.abs(playerCar.speed) < 12) {
    for (const car of police.cars) {
      if (dist2(car.x, car.y, playerCar.x, playerCar.y) < 40 * 40) held = true;
    }
  }
  if (held && wanted > 0) {
    police.bustTimer += dt;
    if (police.bustTimer >= CFG.bustHoldSeconds) events.push({ type: 'busted' });
  } else {
    police.bustTimer = 0;
  }

  // Cool-down: with no unit near, stars fade one at a time.
  const nearest = nearestPoliceDistance(police, player);
  if (wanted > 0 && nearest > 520) {
    police.unseenTimer += dt;
    if (police.unseenTimer >= CFG.wantedCoolDown) {
      police.wanted -= 1;
      police.unseenTimer = 0;
      events.push({ type: 'starLost' });
      if (police.wanted === 0) {
        police.cars = [];
        police.foot = [];
      }
    }
  } else {
    police.unseenTimer = 0;
  }
}

export function nearestPoliceDistance(police, player) {
  let best = Infinity;
  for (const c of police.cars) best = Math.min(best, dist(c.x, c.y, player.x, player.y));
  for (const f of police.foot) best = Math.min(best, dist(f.x, f.y, player.x, player.y));
  return best;
}

export function clearPolice(police) {
  police.cars = [];
  police.foot = [];
  police.wanted = 0;
  police.bustTimer = 0;
  police.unseenTimer = 0;
}
