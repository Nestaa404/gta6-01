// The simulation of Solmara: the player on foot or in a car, traffic cars that
// follow the roads, pedestrians on the sidewalks, police who respond to the
// wanted level, combat, pickups and particles. No drawing and no browser here:
// step() advances one fixed step and returns what happened as bit flags.
import { CAR, PEDS, PLAYER, POLICE, ROADS, STEP, TRAFFIC, WANTED, WEAPONS, WORLD } from './config.js';
import { createCity, PLACES } from './city.js';
import { createMissionManager } from './missions.js';

export const EVENT_SHOT = 1;
export const EVENT_PUNCH = 2;
export const EVENT_CRIME = 4;
export const EVENT_PICKUP = 8;
export const EVENT_BUSTED = 16;
export const EVENT_WASTED = 32;
export const EVENT_MISSION_DONE = 64;
export const EVENT_SIREN = 128;

const CAR_COLORS = ['#d94f3d', '#3d7bd9', '#e8c33d', '#e8e8e8', '#3a3a3a', '#7fb069', '#c77dff', '#e07a2f', '#4ecdc4'];
const PED_SHIRTS = ['#d94f3d', '#3d7bd9', '#e8c33d', '#7fb069', '#c77dff', '#e07a2f', '#f4f1e8', '#8a6d4b'];

function dist2(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}
function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v;
}
function angleTo(ax, ay, bx, by) {
  return Math.atan2(by - ay, bx - ax);
}
function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export function createWorld(random) {
  const city = createCity(random);
  const missions = createMissionManager();

  const player = {
    x: PLACES.garage.x, y: PLACES.garage.y + 120, angle: -Math.PI / 2,
    vx: 0, vy: 0, health: PLAYER.health, money: 250,
    inCar: null, weapon: 'fists', ammo: { pistol: 60, shotgun: 8 },
    cooldown: 0, punchTimer: 0, invulnerable: 0, run: false,
  };

  const cars = [];
  const peds = [];
  const cops = [];
  const enemies = [];
  const pickups = [];
  const particles = [];
  const bullets = [];

  const state = {
    player, cars, peds, cops, enemies, pickups, particles, bullets,
    wanted: 0, heatTimer: 0, elapsed: 0, timeOfDay: 10.5,
    kills: 0, carsStolen: 0, missionsDone: 0,
    policeTimer: 0, spawnTimer: 0, arrestTimer: 0,
    cameraShake: 0, message: '', messageTimer: 0,
  };

  function makeCar(x, y, angle, opts) {
    const o = opts ?? {};
    return {
      x, y, angle, speed: 0, color: o.color ?? random.pick(CAR_COLORS),
      traffic: !!o.traffic, police: !!o.police, parked: !!o.parked,
      driver: o.traffic ? true : false, steer: 0,
      cruise: o.traffic ? TRAFFIC.speed + random.range(-TRAFFIC.speedJitter, TRAFFIC.speedJitter) : 0,
      turnAt: 0, honk: 0, dead: false,
    };
  }

  function spawnTrafficCar() {
    const p = city.randomRoadPoint();
    const angle = p.vertical ? (random.chance(0.5) ? Math.PI / 2 : -Math.PI / 2) : (random.chance(0.5) ? 0 : Math.PI);
    const car = makeCar(p.x, p.y, angle, { traffic: true });
    // Keep some distance from the player so cars do not pop in on top of them.
    if (dist2(car.x, car.y, player.x, player.y) < 500 * 500) return;
    cars.push(car);
  }

  function spawnPed() {
    const p = city.randomWalkPoint();
    if (dist2(p.x, p.y, player.x, player.y) < 420 * 420) return;
    peds.push({
      x: p.x, y: p.y, angle: random.range(0, Math.PI * 2),
      speed: PEDS.speed + random.range(-PEDS.speedJitter, PEDS.speedJitter),
      shirt: random.pick(PED_SHIRTS), walkPhase: random.range(0, 6),
      flee: 0, down: 0, panic: 0, dead: false, target: null,
    });
  }

  function spawnPoliceCar() {
    const a = random.range(0, Math.PI * 2);
    const x = clamp(player.x + Math.cos(a) * 700, 80, WORLD.width - 80);
    const y = clamp(player.y + Math.sin(a) * 700, 80, WORLD.height - 80);
    const near = city.nearestRoadPoint(x, y);
    const car = makeCar(near.x, near.y, angleTo(near.x, near.y, player.x, player.y), { police: true, color: '#e8e8e8' });
    car.speed = 200;
    cars.push(car);
    cops.push({ kind: 'car', car, x: car.x, y: car.y, angle: car.angle, health: 100, arrest: 0 });
  }

  function spawnFootCop() {
    const a = random.range(0, Math.PI * 2);
    const x = clamp(player.x + Math.cos(a) * 420, 40, WORLD.width - 40);
    const y = clamp(player.y + Math.sin(a) * 420, 40, WORLD.height - 40);
    cops.push({ kind: 'foot', car: null, x, y, angle: angleTo(x, y, player.x, player.y), health: 60, arrest: 0 });
  }

  function spawnEnemy(x, y, boss) {
    enemies.push({
      x: x + random.range(-70, 70), y: y + random.range(-70, 70),
      angle: random.range(0, Math.PI * 2), health: boss ? 220 : 70,
      speed: boss ? 150 : 120, shootTimer: random.range(0.5, 1.5),
      boss: !!boss, dead: false, weapon: boss ? 'shotgun' : 'pistol',
    });
  }

  function spawnPickup(kind, x, y) {
    pickups.push({ kind, x, y, bob: random.range(0, 6), taken: false });
  }

  function addParticles(x, y, color, count, speed) {
    for (let i = 0; i < count; i += 1) {
      const a = random.range(0, Math.PI * 2);
      const s = random.range(speed * 0.3, speed);
      particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: random.range(0.3, 0.8), max: 0.8, color, size: random.range(2, 5) });
    }
  }

  function addWanted(level, reason) {
    if (level <= 0) return;
    state.wanted = clamp(state.wanted + level, 0, WANTED.max);
    state.heatTimer = 0;
    if (reason) showMessage(reason);
  }

  function showMessage(text) {
    state.message = text;
    state.messageTimer = 3;
  }

  function nearestCar(maxDist) {
    let best = null;
    let bestD = maxDist * maxDist;
    for (const car of cars) {
      if (car.dead) continue;
      const d = dist2(car.x, car.y, player.x, player.y);
      if (d < bestD) { bestD = d; best = car; }
    }
    return best;
  }

  function reset() {
    player.x = PLACES.garage.x;
    player.y = PLACES.garage.y + 120;
    player.angle = -Math.PI / 2;
    player.vx = 0; player.vy = 0;
    player.health = PLAYER.health;
    player.money = 250;
    player.inCar = null;
    player.weapon = 'fists';
    player.ammo = { pistol: 60, shotgun: 8 };
    player.cooldown = 0; player.invulnerable = 0;
    cars.length = 0; peds.length = 0; cops.length = 0;
    enemies.length = 0; pickups.length = 0; particles.length = 0; bullets.length = 0;
    state.wanted = 0; state.heatTimer = 0; state.elapsed = 0;
    state.kills = 0; state.carsStolen = 0; state.missionsDone = 0;
    state.policeTimer = 0; state.spawnTimer = 0; state.arrestTimer = 0;
    state.cameraShake = 0; state.message = ''; state.messageTimer = 0;
    missions.start(0);
    // Parked cars near the garage so the first mission can start at once.
    cars.push(makeCar(PLACES.garage.x, PLACES.garage.y - 70, Math.PI / 2, { parked: true, color: '#e8c33d' }));
    cars.push(makeCar(PLACES.garage.x + 4, PLACES.garage.y + 190, -Math.PI / 2, { parked: true, color: '#3d7bd9' }));
    for (let i = 0; i < 3; i += 1) {
      const p = city.randomRoadPoint();
      cars.push(makeCar(p.x, p.y, random.chance(0.5) ? 0 : Math.PI / 2, { parked: true }));
    }
    for (let i = 0; i < TRAFFIC.count; i += 1) spawnTrafficCar();
    for (let i = 0; i < PEDS.count; i += 1) spawnPed();
    spawnPickup('health', PLACES.hospital.x + 40, PLACES.hospital.y);
    spawnPickup('pistol', PLACES.garage.x - 60, PLACES.garage.y + 60);
    spawnPickup('money', PLACES.plaza.x, PLACES.plaza.y);
  }

  function loadSave(save) {
    reset();
    player.x = save.x; player.y = save.y;
    player.health = save.health; player.money = save.money;
    state.wanted = 0;
    state.missionsDone = save.missionsDone;
    missions.start(Math.min(save.missionIndex, 4));
    if (save.missionIndex >= 5) missions.state.index = 5;
  }

  function toSave() {
    return {
      x: Math.round(player.x), y: Math.round(player.y),
      health: Math.round(player.health), money: player.money,
      missionIndex: missions.state.index, missionsDone: state.missionsDone,
    };
  }

  function playerSpeed() {
    if (player.inCar) return Math.abs(player.inCar.speed);
    return Math.hypot(player.vx, player.vy);
  }

  function damagePlayer(amount, fromCop) {
    if (player.invulnerable > 0) return;
    player.health -= amount;
    player.invulnerable = 0.25;
    state.cameraShake = Math.max(state.cameraShake, 6);
    if (player.health <= 0) {
      player.health = 0;
      if (fromCop && state.wanted > 0 && !player.inCar) {
        // Caught on foot: busted.
        state.wanted = 0;
        player.money = Math.max(0, player.money - 200);
        player.x = PLACES.hospital.x; player.y = PLACES.hospital.y + 80;
        player.health = PLAYER.health;
        player.inCar = null;
        cops.length = 0;
        showMessage('BUSTED — Lena bailed you out. -$200');
        return EVENT_BUSTED;
      }
      player.health = PLAYER.health;
      player.x = PLACES.hospital.x; player.y = PLACES.hospital.y + 80;
      player.inCar = null;
      state.wanted = 0;
      cops.length = 0;
      showMessage('WASTED — You woke up at Solmara General.');
      return EVENT_WASTED;
    }
    return 0;
  }

  function shoot(fromX, fromY, angle, damage, range, friendly) {
    bullets.push({ x: fromX, y: fromY, angle, damage, range, left: range, friendly, speed: 900 });
  }

  function playerAttack(aimAngle) {
    if (player.cooldown > 0) return 0;
    const weapon = WEAPONS[player.weapon];
    player.angle = aimAngle;
    if (player.weapon === 'fists') {
      player.cooldown = weapon.cooldown;
      player.punchTimer = 0.2;
      const hx = player.x + Math.cos(aimAngle) * weapon.range;
      const hy = player.y + Math.sin(aimAngle) * weapon.range;
      for (const e of enemies) {
        if (!e.dead && dist2(e.x, e.y, hx, hy) < 40 * 40) {
          e.health -= weapon.damage;
          addParticles(e.x, e.y, '#ffd23f', 6, 140);
          if (e.health <= 0) killEnemy(e);
          return EVENT_PUNCH;
        }
      }
      for (const cop of cops) {
        if (cop.kind === 'foot' && dist2(cop.x, cop.y, hx, hy) < 40 * 40) {
          cop.health -= weapon.damage;
          if (cop.health <= 0) { cops.splice(cops.indexOf(cop), 1); addWanted(WANTED.crime.killCop, 'You took down a cop!'); }
          return EVENT_PUNCH;
        }
      }
      return EVENT_PUNCH;
    }
    if (player.ammo[player.weapon] <= 0) {
      player.weapon = 'fists';
      showMessage('Out of ammo — fists it is.');
      return 0;
    }
    player.ammo[player.weapon] -= 1;
    player.cooldown = weapon.cooldown;
    const gx = player.x + Math.cos(aimAngle) * 22;
    const gy = player.y + Math.sin(aimAngle) * 22;
    const spread = player.weapon === 'shotgun' ? 0.09 : 0.02;
    const shots = player.weapon === 'shotgun' ? 5 : 1;
    for (let i = 0; i < shots; i += 1) {
      shoot(gx, gy, aimAngle + random.range(-spread, spread), weapon.damage, weapon.range, true);
    }
    addWanted(WANTED.crime.shoot, '');
    state.cameraShake = Math.max(state.cameraShake, 3);
    return EVENT_SHOT;
  }

  function killEnemy(e) {
    e.dead = true;
    state.kills += 1;
    addParticles(e.x, e.y, '#d94f3d', 14, 220);
    if (random.chance(0.5)) spawnPickup('money', e.x, e.y);
    if (random.chance(0.35)) spawnPickup('health', e.x + 20, e.y);
    const cleared = missions.registerKill();
    if (cleared) showMessage('Crew dealt with. Move!');
  }

  function stepTraffic(dt) {
    for (const car of cars) {
      if (car.dead || !car.traffic) continue;
      // Slow down for a car ahead on the same road.
      let slow = false;
      for (const other of cars) {
        if (other === car || other.dead) continue;
        const dx = other.x - car.x;
        const dy = other.y - car.y;
        const ahead = dx * Math.cos(car.angle) + dy * Math.sin(car.angle);
        const side = Math.abs(-dx * Math.sin(car.angle) + dy * Math.cos(car.angle));
        if (ahead > 0 && ahead < 90 && side < 34) { slow = true; break; }
      }
      const target = slow ? 0 : car.cruise;
      car.speed += clamp(target - car.speed, -300 * dt, 200 * dt);
      car.x += Math.cos(car.angle) * car.speed * dt;
      car.y += Math.sin(car.angle) * car.speed * dt;
      // At an intersection, maybe turn.
      const near = city.nearestRoadPoint(car.x, car.y);
      const onCross = Math.abs(car.x - near.x) < 6 && Math.abs(car.y - near.y) < 6;
      if (onCross && random.chance(0.5)) {
        const dirs = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
        car.angle = random.pick(dirs);
      }
      if (car.x < 60 || car.x > WORLD.width - 60 || car.y < 60 || car.y > WORLD.height - 60) {
        // Recycle far-off traffic to a road near the player.
        const p = city.randomRoadPoint();
        car.x = p.x; car.y = p.y;
        car.angle = p.vertical ? Math.PI / 2 : 0;
      }
      city.resolveCircle(car, CAR.width / 2);
    }
  }

  function stepPeds(dt) {
    for (const ped of peds) {
      if (ped.dead) continue;
      if (ped.down > 0) { ped.down -= dt; continue; }
      const dPlayer = dist2(ped.x, ped.y, player.x, player.y);
      if (dPlayer < 260 * 260 && (playerSpeed() > 300 || state.wanted > 0)) ped.flee = 1.2;
      if (ped.flee > 0) {
        ped.flee -= dt;
        const a = angleTo(player.x, player.y, ped.x, ped.y);
        ped.angle = a;
        ped.x += Math.cos(a) * ped.speed * 2.1 * dt;
        ped.y += Math.sin(a) * ped.speed * 2.1 * dt;
      } else {
        ped.walkPhase += dt * 6;
        ped.x += Math.cos(ped.angle) * ped.speed * dt;
        ped.y += Math.sin(ped.angle) * ped.speed * dt;
        if (city.onRoad(ped.x, ped.y, 4) || random.chance(0.004)) {
          // Wander back onto a sidewalk and pick a new heading.
          const near = city.nearestRoadPoint(ped.x, ped.y);
          ped.angle = near.vertical ? (random.chance(0.5) ? Math.PI / 2 : -Math.PI / 2) : (random.chance(0.5) ? 0 : Math.PI);
          if (random.chance(0.5)) ped.angle += Math.PI;
        }
      }
      ped.x = clamp(ped.x, 30, WORLD.width - 30);
      ped.y = clamp(ped.y, 30, WORLD.height - 30);
      city.resolveCircle(ped, 10);
    }
  }

  function stepPolice(dt) {
    // Spawn pressure scales with the wanted level.
    if (state.wanted > 0) {
      state.policeTimer -= dt;
      const wantCars = Math.min(state.wanted, POLICE.maxCars);
      const carCount = cops.filter((c) => c.kind === 'car').length;
      if (state.policeTimer <= 0 && carCount < wantCars) {
        spawnPoliceCar();
        state.policeTimer = POLICE.spawnInterval;
      }
      const wantFoot = state.wanted >= 2 ? state.wanted - 1 : 0;
      const footCount = cops.filter((c) => c.kind === 'foot').length;
      if (state.policeTimer <= 0 && footCount < wantFoot && !player.inCar) {
        spawnFootCop();
        state.policeTimer = POLICE.spawnInterval;
      }
      // Wanted fades when the player lies low and no cop is near.
      let nearestCop = Infinity;
      for (const cop of cops) nearestCop = Math.min(nearestCop, dist2(cop.x, cop.y, player.x, player.y));
      if (nearestCop > WANTED.copSightRange * WANTED.copSightRange) {
        state.heatTimer += dt;
        if (state.heatTimer > WANTED.decaySeconds) {
          state.wanted -= 1;
          state.heatTimer = 0;
          if (state.wanted === 0) { cops.length = 0; showMessage('You lost the heat.'); }
        }
      } else {
        state.heatTimer = 0;
      }
    }

    for (let i = cops.length - 1; i >= 0; i -= 1) {
      const cop = cops[i];
      if (cop.kind === 'car') {
        const car = cop.car;
        if (!car || car.dead) { cops.splice(i, 1); continue; }
        // Police stay on the roads: off-road, they steer back to the nearest
        // road first instead of cutting across parks and blocks.
        let targetAngle;
        if (!city.onRoad(car.x, car.y, 0)) {
          const near = city.nearestRoadPoint(car.x, car.y);
          targetAngle = angleTo(car.x, car.y, near.x, near.y);
        } else {
          targetAngle = angleTo(car.x, car.y, player.x, player.y);
        }
        const diff = angleDiff(targetAngle, car.angle);
        car.angle += clamp(diff, -2.4 * dt, 2.4 * dt);
        const want = state.wanted > 0 ? POLICE.carSpeed : 0;
        car.speed += clamp(want - car.speed, -500 * dt, 320 * dt);
        car.x += Math.cos(car.angle) * car.speed * dt;
        car.y += Math.sin(car.angle) * car.speed * dt;
        cop.x = car.x; cop.y = car.y; cop.angle = car.angle;
        city.resolveCircle(car, CAR.width / 2);
        // Ram the player: on foot it hurts, in a car it shoves.
        const d = dist2(car.x, car.y, player.x, player.y);
        if (d < 46 * 46) {
          if (player.inCar) {
            player.inCar.speed *= 0.92;
            state.cameraShake = Math.max(state.cameraShake, 4);
          } else {
            const ev = damagePlayer(12, true);
            if (ev) return ev;
          }
        }
        if (d > 1600 * 1600) { car.dead = true; cops.splice(i, 1); }
      } else {
        const d = Math.sqrt(dist2(cop.x, cop.y, player.x, player.y));
        if (d < POLICE.arrestRange && !player.inCar && state.wanted > 0) {
          cop.arrest += dt;
          if (cop.arrest > POLICE.arrestTime) return damagePlayer(999, true) || EVENT_BUSTED;
        } else {
          cop.arrest = Math.max(0, cop.arrest - dt);
        }
        const targetAngle = angleTo(cop.x, cop.y, player.x, player.y);
        cop.angle += clamp(angleDiff(targetAngle, cop.angle), -4 * dt, 4 * dt);
        const speed = state.wanted > 0 ? POLICE.footSpeed : 120;
        cop.x += Math.cos(cop.angle) * speed * dt;
        cop.y += Math.sin(cop.angle) * speed * dt;
        city.resolveCircle(cop, 12);
        if (d < 40 && player.inCar) {
          // A foot cop next to a slow car tries to pull the player out.
          if (Math.abs(player.inCar.speed) < 60) {
            const ev = damagePlayer(8, true);
            if (ev) return ev;
          }
        }
        if (d > 1400) cops.splice(i, 1);
      }
    }
    return 0;
  }

  function stepEnemies(dt) {
    const stepInfo = missions.currentStep();
    for (const e of enemies) {
      if (e.dead) continue;
      const d = Math.sqrt(dist2(e.x, e.y, player.x, player.y));
      const inRange = stepInfo && stepInfo.type === 'fight' && dist2(e.x, e.y, stepInfo.x, stepInfo.y) < 500 * 500;
      if (d < 560 && (inRange || d < 260)) {
        e.angle = angleTo(e.x, e.y, player.x, player.y);
        if (d > 220) {
          e.x += Math.cos(e.angle) * e.speed * dt;
          e.y += Math.sin(e.angle) * e.speed * dt;
        }
        e.shootTimer -= dt;
        if (e.shootTimer <= 0 && d < 480) {
          e.shootTimer = e.boss ? 0.9 : 1.6;
          shoot(e.x, e.y, e.angle + random.range(-0.08, 0.08), e.boss ? 16 : 9, 480, false);
        }
      }
      city.resolveCircle(e, 12);
    }
  }

  function stepBullets(dt) {
    for (let i = bullets.length - 1; i >= 0; i -= 1) {
      const b = bullets[i];
      b.x += Math.cos(b.angle) * b.speed * dt;
      b.y += Math.sin(b.angle) * b.speed * dt;
      b.left -= b.speed * dt;
      let dead = b.left <= 0;
      if (!dead && city.collidesBuilding(b.x, b.y, 2)) {
        addParticles(b.x, b.y, '#c9c2b2', 4, 120);
        dead = true;
      }
      if (!dead && b.friendly) {
        for (const e of enemies) {
          if (!e.dead && dist2(e.x, e.y, b.x, b.y) < 16 * 16) {
            e.health -= b.damage;
            addParticles(b.x, b.y, '#ffd23f', 5, 150);
            if (e.health <= 0) killEnemy(e);
            dead = true;
            break;
          }
        }
        if (!dead) {
          for (const cop of cops) {
            if (cop.kind === 'foot' && dist2(cop.x, cop.y, b.x, b.y) < 16 * 16) {
              cop.health -= b.damage;
              if (cop.health <= 0) { cops.splice(cops.indexOf(cop), 1); addWanted(WANTED.crime.killCop, 'You killed a cop!'); }
              dead = true;
              break;
            }
          }
        }
      } else if (!dead && !b.friendly) {
        if (dist2(player.x, player.y, b.x, b.y) < 16 * 16) {
          const ev = damagePlayer(b.damage, false);
          if (ev) return ev;
          dead = true;
        }
      }
      if (dead) bullets.splice(i, 1);
    }
    return 0;
  }

  function stepPlayer(dt, input) {
    if (player.cooldown > 0) player.cooldown -= dt;
    if (player.punchTimer > 0) player.punchTimer -= dt;
    if (player.invulnerable > 0) player.invulnerable -= dt;
    if (player.health < PLAYER.health && state.wanted === 0) {
      player.health = Math.min(PLAYER.health, player.health + 2 * dt);
    }

    if (player.inCar) {
      const car = player.inCar;
      const fwd = input.up ? 1 : input.down ? -1 : 0;
      const steer = (input.left ? -1 : 0) + (input.right ? 1 : 0);
      if (fwd > 0) car.speed += CAR.accel * dt;
      else if (fwd < 0) car.speed -= (car.speed > 0 ? CAR.brake : CAR.reverseAccel) * dt;
      else car.speed -= car.speed * 1.4 * dt;
      car.speed = clamp(car.speed, -CAR.maxReverse, CAR.maxSpeed);
      const dir = car.speed >= 0 ? 1 : -1;
      car.angle += steer * CAR.steer * dt * dir * clamp(Math.abs(car.speed) / 120, 0, 1);
      car.x += Math.cos(car.angle) * car.speed * dt;
      car.y += Math.sin(car.angle) * car.speed * dt;
      car.x = clamp(car.x, 40, WORLD.width - 40);
      car.y = clamp(car.y, 40, WORLD.height - 40);
      if (city.resolveCircle(car, CAR.width / 2)) {
        car.speed *= 0.55;
        state.cameraShake = Math.max(state.cameraShake, 3);
        addParticles(car.x, car.y, '#c9c2b2', 3, 100);
      }
      // Running over pedestrians is a crime.
      for (const ped of peds) {
        if (!ped.dead && ped.down <= 0 && dist2(ped.x, ped.y, car.x, car.y) < 34 * 34 && Math.abs(car.speed) > 120) {
          ped.down = 4;
          addWanted(WANTED.crime.hitPed, 'You hit a pedestrian!');
          addParticles(ped.x, ped.y, '#d94f3d', 8, 160);
        }
      }
      // Bump traffic cars.
      for (const other of cars) {
        if (other === car || other.dead) continue;
        const d2 = dist2(other.x, other.y, car.x, car.y);
        if (d2 < 52 * 52) {
          const d = Math.sqrt(d2) || 1;
          const push = (52 - d) / 2;
          const nx = (other.x - car.x) / d;
          const ny = (other.y - car.y) / d;
          other.x += nx * push; other.y += ny * push;
          car.x -= nx * push; car.y -= ny * push;
          if (Math.abs(car.speed) > 200) {
            other.speed = car.speed * 0.4;
            state.cameraShake = Math.max(state.cameraShake, 5);
          }
        }
      }
      player.x = car.x; player.y = car.y; player.angle = car.angle;
      return 0;
    }

    // On foot.
    const mx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    const my = (input.down ? 1 : 0) - (input.up ? 1 : 0);
    const moving = mx !== 0 || my !== 0;
    const speed = input.run ? PLAYER.runSpeed : PLAYER.walkSpeed;
    if (moving) {
      const len = Math.hypot(mx, my);
      player.vx = (mx / len) * speed;
      player.vy = (my / len) * speed;
      player.angle = Math.atan2(my, mx);
    } else {
      player.vx = 0; player.vy = 0;
    }
    player.x += player.vx * dt;
    player.y += player.vy * dt;
    player.x = clamp(player.x, 30, WORLD.width - 30);
    player.y = clamp(player.y, 30, WORLD.height - 30);
    city.resolveCircle(player, PLAYER.radius);

    // Pickups.
    for (const p of pickups) {
      if (p.taken) continue;
      if (dist2(p.x, p.y, player.x, player.y) < 30 * 30) {
        p.taken = true;
        if (p.kind === 'health') player.health = Math.min(PLAYER.health, player.health + 50);
        else if (p.kind === 'money') player.money += random.int(40, 120);
        else if (p.kind === 'pistol') { player.weapon = 'pistol'; player.ammo.pistol += 60; }
        else if (p.kind === 'shotgun') { player.weapon = 'shotgun'; player.ammo.shotgun += 12; }
        addParticles(p.x, p.y, '#7fb069', 10, 140);
        return EVENT_PICKUP;
      }
    }
    return 0;
  }

  function stepMissions(dt, input) {
    const m = missions.current();
    const s = missions.currentStep();
    if (!m || !s) return 0;
    if (s.type === 'steal') {
      if (player.inCar) return missions.advance() ? 0 : 0;
      return 0;
    }
    if (s.type === 'collect') {
      if (dist2(player.x, player.y, s.x, s.y) < 44 * 44) {
        player.money += 100;
        missions.advance();
        showMessage('Package collected.');
      }
      return 0;
    }
    if (s.type === 'fight') {
      // Spawn the crew once, when the player arrives.
      const alive = enemies.filter((e) => !e.dead).length;
      if (alive === 0 && missions.state.kills === 0 && dist2(player.x, player.y, s.x, s.y) < 420 * 420) {
        for (let i = 0; i < s.count; i += 1) spawnEnemy(s.x, s.y, s.boss && i === 0);
        if (s.boss) showMessage('Silas Kade is here. End this.');
        else showMessage("Kade's crew — take them down!");
      }
      return 0;
    }
    if (s.type === 'goto') {
      if (dist2(player.x, player.y, s.x, s.y) < 70 * 70) {
        const next = missions.advance();
        if (!next) {
          // Mission finished: pay out and start the next one.
          player.money += m.reward;
          state.missionsDone += 1;
          showMessage(`Mission complete — $${m.reward}`);
          missions.complete();
          const following = missions.current();
          if (following) {
            missions.start(missions.state.index);
            if (following.wantedOnStart) addWanted(following.wantedOnStart, 'The cops are onto you!');
            return EVENT_MISSION_DONE;
          }
          showMessage('All missions complete — Solmara is yours, Marco.');
          return EVENT_MISSION_DONE;
        }
      }
      return 0;
    }
    return 0;
  }

  function step(dt, input) {
    let events = 0;
    state.elapsed += dt;
    state.timeOfDay = (10.5 + state.elapsed / 240) % 24;
    if (state.messageTimer > 0) {
      state.messageTimer -= dt;
      if (state.messageTimer <= 0) state.message = '';
    }
    if (state.cameraShake > 0) state.cameraShake = Math.max(0, state.cameraShake - dt * 22);
    if (missions.state.bannerTimer > 0) missions.state.bannerTimer -= dt;

    // Traffic and pedestrians keep the city alive.
    state.spawnTimer -= dt;
    if (state.spawnTimer <= 0) {
      state.spawnTimer = 1.5;
      if (cars.filter((c) => c.traffic && !c.dead).length < TRAFFIC.count) spawnTrafficCar();
      if (peds.filter((p) => !p.dead).length < PEDS.count) spawnPed();
    }
    for (let i = cars.length - 1; i >= 0; i -= 1) if (cars[i].dead) cars.splice(i, 1);
    for (let i = peds.length - 1; i >= 0; i -= 1) if (peds[i].dead) peds.splice(i, 1);

    events |= stepPlayer(dt, input);
    stepTraffic(dt);
    stepPeds(dt);
    const policeEvent = stepPolice(dt);
    if (policeEvent) return policeEvent;
    stepEnemies(dt);
    const bulletEvent = stepBullets(dt);
    if (bulletEvent) return bulletEvent;
    events |= stepMissions(dt, input);

    for (let i = particles.length - 1; i >= 0; i -= 1) {
      const p = particles[i];
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.life <= 0) particles.splice(i, 1);
    }
    for (let i = pickups.length - 1; i >= 0; i -= 1) {
      if (pickups[i].taken) pickups.splice(i, 1);
    }
    if (player.weapon !== 'fists' && player.ammo[player.weapon] <= 0) player.weapon = 'fists';
    return events;
  }

  /** Enter the nearest car, or leave the one the player is driving. */
  function enterExitCar() {
    if (player.inCar) {
      const car = player.inCar;
      player.inCar = null;
      player.x = car.x + Math.cos(car.angle + Math.PI / 2) * 40;
      player.y = car.y + Math.sin(car.angle + Math.PI / 2) * 40;
      player.vx = 0; player.vy = 0;
      return 'exit';
    }
    const car = nearestCar(90);
    if (!car) return 'none';
    if (car.traffic || car.parked) {
      car.traffic = false;
      car.parked = false;
      car.driver = false;
      state.carsStolen += 1;
      addWanted(CAR.stealWanted, 'You stole a car!');
      showMessage('Car stolen — the heat is on.');
    }
    player.inCar = car;
    player.vx = 0; player.vy = 0;
    return 'enter';
  }

  function switchWeapon() {
    const order = ['fists', 'pistol', 'shotgun'];
    const i = order.indexOf(player.weapon);
    for (let k = 1; k <= order.length; k += 1) {
      const next = order[(i + k) % order.length];
      if (next === 'fists' || player.ammo[next] > 0) {
        player.weapon = next;
        return next;
      }
    }
    return player.weapon;
  }

  reset();
  return {
    state, city, missions, player,
    step, reset, loadSave, toSave, enterExitCar, switchWeapon,
    playerAttack, addWanted, showMessage, spawnPickup, spawnEnemy,
  };
}
