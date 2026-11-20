// Solmara — the game loop and state machine. Wires the city, the
// entities, the police, the missions and the renderer together, and
// owns the screens: title, mission intro, pause, busted / wasted.
// Open with ?shot=start|drive|chase|mission to stage a screenshot
// scene instead of the title screen.

import { CFG, CAR_COLORS } from './config.js';
import { makeRng, clamp, dist, dist2, pick, range, angleDiff } from './util.js';
import { buildCity, nearestRoad } from './world.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import {
  makeCar, makePed, makePlayer, makeBullet,
  updatePlayerOnFoot, updatePlayerCar, updateTrafficCar, updatePed,
  updateBullet, nearestCar, separateCars,
} from './entities.js';
import { createPolice, addWanted, setWanted, updatePolice, clearPolice } from './police.js';
import {
  createMissions, startMission, updateMissions, nextMissionIndex,
  currentObjective, objectivePoint,
} from './missions.js';
import {
  createCamera, updateCamera,
  drawWorld, drawCar, drawPed, drawPlayer, drawObjectiveMarker,
  drawBullets, drawParticles, drawHUD, drawMinimap,
  drawTitle, drawPause, drawEnd, drawMissionIntro,
} from './render.js';
import { hasSave, saveGame, loadSave, clearSave } from './save.js';
import { applyShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const viewW = CFG.viewWidth;
const viewH = CFG.viewHeight;

const input = createInput(canvas);
const audio = createAudio();
const rng = makeRng(20261120);

const game = {
  state: 'title', // title | intro | playing | paused | end
  time: 0,
  viewW, viewH,
  city: buildCity(20261120),
  player: null,
  cars: [], // parked + traffic + the player's car
  peds: [],
  police: createPolice(),
  missions: null,
  bullets: [],
  particles: [],
  camera: createCamera(),
  menuIndex: 0,
  showHelp: false,
  hint: '',
  endKind: null,
  endDetail: '',
  introDef: null,
  saveExists: hasSave(),
  muted: false,
  autoDrive: false, // staged screenshot scenes drive themselves
  shotFiredAt: -10,
};

function spawnTraffic(count) {
  for (let i = 0; i < count; i++) {
    const line = pick(rng, game.city.lines);
    const along = range(rng, 200, game.city.size - 200);
    const axis = rng() < 0.5 ? 'x' : 'y';
    const dir = rng() < 0.5 ? 0 : Math.PI;
    const x = axis === 'x' ? along : line;
    const y = axis === 'x' ? line : along;
    const car = makeCar(x, y, axis === 'x' ? dir : dir + Math.PI / 2, undefined, 'traffic');
    car.axis = axis;
    car.cruise = range(rng, CFG.trafficSpeedMin, CFG.trafficSpeedMax);
    car.speed = car.cruise;
    game.cars.push(car);
  }
}

function spawnPeds(count) {
  for (let i = 0; i < count; i++) {
    const line = pick(rng, game.city.lines);
    const along = range(rng, 150, game.city.size - 150);
    const off = (rng() < 0.5 ? -1 : 1) * (CFG.roadWidth / 2 + 10);
    const x = rng() < 0.5 ? along : line + off;
    const y = rng() < 0.5 ? line + off : along;
    game.peds.push(makePed(x, y, rng));
  }
}

function resetWorld() {
  game.city = buildCity(20261120);
  game.cars = [];
  game.peds = [];
  game.bullets = [];
  game.particles = [];
  game.autoDrive = false;
  game.police = createPolice();
  game.missions = createMissions(game.city);
  const home = game.city.places.safehouse;
  game.player = makePlayer(home.x + 40, home.y + 40);
  // Parked cars from the city's own spots.
  for (const spot of game.city.parkingSpots.slice(0, 18)) {
    game.cars.push(makeCar(spot.x, spot.y, spot.angle, undefined, 'parked'));
  }
  spawnTraffic(CFG.trafficCount);
  spawnPeds(CFG.pedCount);
  game.camera.x = game.player.x - viewW / 2;
  game.camera.y = game.player.y - viewH / 2;
}

function newGame() {
  clearSave();
  resetWorld();
  game.saveExists = false;
  game.state = 'playing';
  game.hint = 'Press T — Rico has a job for you';
  audio.ensure();
}

function continueGame() {
  const save = loadSave();
  resetWorld();
  if (save) {
    game.player.money = save.money || 0;
    game.player.x = save.player?.x ?? game.player.x;
    game.player.y = save.player?.y ?? game.player.y;
    game.player.health = save.player?.health ?? CFG.playerHealth;
    game.missions.completed = (save.completed || []).slice();
    if (save.activeIndex >= 0 && save.activeIndex < game.missions.defs.length) {
      startMission(game.missions, save.activeIndex);
      game.missions.stepIndex = save.stepIndex || 0;
    }
  }
  game.state = 'playing';
  audio.ensure();
}

function respawnAfterEnd() {
  const home = game.city.places.safehouse;
  game.player.x = home.x + 40;
  game.player.y = home.y + 40;
  game.player.health = CFG.playerHealth;
  game.player.inCar = null;
  clearPolice(game.police);
  game.missions.activeIndex = -1;
  game.missions.stepIndex = 0;
  game.camera.x = game.player.x - viewW / 2;
  game.camera.y = game.player.y - viewH / 2;
  game.state = 'playing';
}

// --- Actions ---------------------------------------------------------------

function tryEnterExitCar() {
  const player = game.player;
  if (player.inCar) {
    // Step out beside the car.
    const car = player.inCar;
    car.speed = 0;
    player.x = car.x + Math.cos(car.angle + Math.PI / 2) * 34;
    player.y = car.y + Math.sin(car.angle + Math.PI / 2) * 34;
    player.angle = car.angle;
    player.inCar = null;
    return;
  }
  const car = nearestCar(game.cars, player.x, player.y, 62);
  if (!car) return;
  if (car.kind !== 'player') {
    addWanted(game.police, 1);
    game.missions.banner = { text: 'Car stolen — the cops noticed (+1 ★)', until: game.time + 3 };
  }
  car.kind = 'player';
  player.inCar = car;
  player.x = car.x;
  player.y = car.y;
  audio.pickup();
}

function tryShoot() {
  const player = game.player;
  if (player.inCar || player.shootCooldown > 0) return;
  player.shootCooldown = CFG.shootCooldown;
  const wx = game.camera.x + input.mouseX;
  const wy = game.camera.y + input.mouseY;
  const angle = Math.atan2(wy - player.y, wx - player.x);
  player.angle = angle;
  game.bullets.push(makeBullet(
    player.x + Math.cos(angle) * 20,
    player.y + Math.sin(angle) * 20,
    angle,
  ));
  audio.gunshot();
  spawnSparks(player.x + Math.cos(angle) * 22, player.y + Math.sin(angle) * 22, 3, '#ffe9a8');
}

function spawnSparks(x, y, n, color) {
  for (let i = 0; i < n; i++) {
    const a = rng() * Math.PI * 2;
    const sp = range(rng, 40, 160);
    game.particles.push({
      x, y,
      vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      life: 0.4, maxLife: 0.4, size: range(rng, 2, 4.5), color,
    });
  }
}

// --- Update ----------------------------------------------------------------

function updatePlaying(dt) {
  const player = game.player;
  const events = [];

  // Hurt flash fades whether on foot or driving.
  if (player.hurtFlash > 0) player.hurtFlash -= dt;

  // Global keys.
  if (input.wasPressed('KeyP') || input.wasPressed('Escape')) {
    game.state = 'paused';
    return;
  }
  if (input.wasPressed('KeyM')) {
    game.muted = !game.muted;
    audio.setMuted(game.muted);
  }
  if (input.wasPressed('KeyT')) {
    const next = nextMissionIndex(game.missions);
    if (next >= 0 && game.missions.activeIndex < 0) {
      game.introDef = game.missions.defs[next];
      game.state = 'intro';
      return;
    }
  }
  if (input.wasPressed('KeyE')) tryEnterExitCar();
  if (input.wasPressed('KeyF') || input.mouseClicked) tryShoot();

  // Player movement.
  if (player.inCar) {
    // Staged screenshot scenes auto-drive until the player takes the
    // wheel: hold W and steer back onto the eastbound road.
    let driveInput = input;
    if (game.autoDrive) {
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']
        .some((c) => input.wasPressed(c))) {
        game.autoDrive = false;
      } else {
        const steer = clamp(-angleDiff(0, player.inCar.angle) * 2, -1, 1);
        driveInput = {
          isDown: (code) => code === 'KeyW' || code === 'ArrowUp' || input.isDown(code),
          axis: (pos, neg) => (
            pos === 'KeyA' ? steer : input.axis(pos, neg)
          ),
          wasPressed: (c) => input.wasPressed(c),
        };
      }
    }
    const speed01 = updatePlayerCar(player.inCar, driveInput, dt, game.city, (impact) => {
      player.health -= Math.min(18, (impact - 240) / 22);
      player.hurtFlash = 0.5;
      audio.crash();
      spawnSparks(player.inCar.x, player.inCar.y, 8, '#ffb347');
    });
    audio.setEngine(speed01, true);
  } else {
    updatePlayerOnFoot(player, input, dt, game.city);
    // Aim with the mouse while on foot.
    const wx = game.camera.x + input.mouseX;
    const wy = game.camera.y + input.mouseY;
    if (dist(wx, wy, player.x, player.y) > 30) {
      player.angle = Math.atan2(wy - player.y, wx - player.x);
    }
    audio.setEngine(0, false);
  }

  // Traffic and pedestrians keep the city alive.
  for (const car of game.cars) {
    if (car.kind === 'traffic') updateTrafficCar(car, dt, game.city, rng);
  }
  const danger = player.inCar && Math.abs(player.inCar.speed) > 120
    ? { x: player.inCar.x, y: player.inCar.y }
    : null;
  for (const ped of game.peds) updatePed(ped, dt, game.city, danger);

  // Player car vs traffic / police: separate and spark on hard hits.
  const movers = [...game.cars.filter((c) => c.kind === 'traffic' || c.kind === 'player'), ...game.police.cars];
  for (let i = 0; i < movers.length; i++) {
    for (let j = i + 1; j < movers.length; j++) {
      const a = movers[i];
      const b = movers[j];
      if (dist2(a.x, a.y, b.x, b.y) < 54 * 54) {
        const rel = Math.abs(a.speed - b.speed);
        if (separateCars(a, b) && rel > 200) {
          // Sparks and a crunch, but ramming traffic does not hurt
          // the driver — only buildings and police rams do.
          audio.crash();
          spawnSparks((a.x + b.x) / 2, (a.y + b.y) / 2, 6, '#ffb347');
        }
      }
    }
  }

  // Player car running over a pedestrian: a crime, and a heavy price.
  if (player.inCar && Math.abs(player.inCar.speed) > 130) {
    for (let i = game.peds.length - 1; i >= 0; i--) {
      const ped = game.peds[i];
      if (dist2(ped.x, ped.y, player.inCar.x, player.inCar.y) < 28 * 28) {
        game.peds.splice(i, 1);
        addWanted(game.police, 2);
        spawnSparks(ped.x, ped.y, 10, '#e74c3c');
        game.missions.banner = { text: 'Pedestrian hit! (+2 ★)', until: game.time + 3 };
        player.inCar.speed *= 0.7;
      }
    }
  }

  // Bullets.
  for (const b of game.bullets) {
    updateBullet(b, dt, game.city, game.cars, game.peds, game.police.cars, (kind, bullet, target) => {
      if (kind === 'wall') {
        spawnSparks(bullet.x, bullet.y, 4, '#ffd23f');
      } else if (kind === 'car') {
        spawnSparks(bullet.x, bullet.y, 5, '#ffb347');
        if (target.kind === 'police') addWanted(game.police, 1);
      } else if (kind === 'ped') {
        game.peds = game.peds.filter((p) => p !== target);
        addWanted(game.police, 2);
        spawnSparks(bullet.x, bullet.y, 8, '#e74c3c');
      } else if (kind === 'police') {
        spawnSparks(bullet.x, bullet.y, 6, '#ff5a5a');
        addWanted(game.police, 1);
      }
    });
  }
  game.bullets = game.bullets.filter((b) => !b.dead);

  // Particles.
  for (const p of game.particles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.92;
    p.vy *= 0.92;
    p.life -= dt;
  }
  game.particles = game.particles.filter((p) => p.life > 0);

  // Police and wanted level.
  updatePolice(game.police, dt, game.city, player, rng, events);
  audio.setSiren(game.police.wanted > 0);
  for (const ev of events) {
    if (ev.type === 'busted') {
      endGame('busted', 'The Solmara PD caught you. Bail set: $100.');
      player.money = Math.max(0, player.money - 100);
      audio.busted();
      return;
    }
  }

  // Missions.
  const missionEvent = updateMissions(game.missions, dt, game);
  if (missionEvent === 'done') {
    audio.missionDone();
    saveGame(game);
  } else if (missionEvent === 'failed') {
    game.missions.banner = { text: game.missions.failed, until: game.time + 4 };
  }

  // Health.
  if (player.health <= 0) {
    endGame('wasted', 'You pushed your luck too far in Solmara.');
    audio.busted();
    return;
  }
  if (player.health < CFG.playerHealth) {
    player.health = Math.min(CFG.playerHealth, player.health + 1.2 * dt);
  }

  // Context hint.
  if (!player.inCar) {
    const near = nearestCar(game.cars, player.x, player.y, 62);
    game.hint = near
      ? 'Press E to steal the car'
      : (game.missions.activeIndex < 0 ? 'Press T — Rico has a job for you' : '');
  } else {
    game.hint = '';
  }

  // Camera follows the player or the car.
  const tx = player.inCar ? player.inCar.x : player.x;
  const ty = player.inCar ? player.inCar.y : player.y;
  updateCamera(game.camera, tx, ty, viewW, viewH, dt);
}

function endGame(kind, detail) {
  game.state = 'end';
  game.endKind = kind;
  game.endDetail = detail;
  audio.setEngine(0, false);
  audio.setSiren(false);
  saveGame(game);
}

function updateTitle(dt) {
  // Slow cinematic pan over downtown behind the menu.
  const cx = game.city.places.downtown.x + Math.cos(game.time * 0.05) * 300;
  const cy = game.city.places.downtown.y + Math.sin(game.time * 0.04) * 220;
  updateCamera(game.camera, cx, cy, viewW, viewH, dt);
  for (const car of game.cars) {
    if (car.kind === 'traffic') updateTrafficCar(car, dt, game.city, rng);
  }
  for (const ped of game.peds) updatePed(ped, dt, game.city, null);

  if (game.showHelp) {
    if (input.wasPressed('Escape') || input.wasPressed('Enter')) game.showHelp = false;
    return;
  }
  const options = game.saveExists ? 3 : 2;
  if (input.wasPressed('ArrowDown') || input.wasPressed('KeyS')) {
    game.menuIndex = (game.menuIndex + 1) % options;
  }
  if (input.wasPressed('ArrowUp') || input.wasPressed('KeyW')) {
    game.menuIndex = (game.menuIndex - 1 + options) % options;
  }
  if (input.wasPressed('Enter')) {
    audio.ensure();
    if (game.saveExists) {
      if (game.menuIndex === 0) continueGame();
      else if (game.menuIndex === 1) newGame();
      else game.showHelp = true;
    } else if (game.menuIndex === 0) {
      newGame();
    } else {
      game.showHelp = true;
    }
  }
}

// --- Render ----------------------------------------------------------------

function render() {
  ctx.save();
  ctx.clearRect(0, 0, viewW, viewH);
  ctx.translate(-Math.round(game.camera.x), -Math.round(game.camera.y));

  drawWorld(ctx, game.city, game.camera, viewW, viewH, game.time);

  // Objective marker under everything else that moves.
  drawObjectiveMarker(ctx, objectivePoint(game.missions), game.time);

  // Parked and traffic cars, then the player's car on top.
  for (const car of game.cars) {
    if (car.kind !== 'player') drawCar(ctx, car, false, game.time);
  }
  for (const car of game.police.cars) drawCar(ctx, car, false, game.time);
  if (game.player.inCar) drawCar(ctx, game.player.inCar, true, game.time);

  for (const ped of game.peds) drawPed(ctx, ped, game.time);
  for (const f of game.police.foot) {
    // Foot police: dark uniform, badge dot.
    ctx.fillStyle = '#1f3a93';
    ctx.beginPath();
    ctx.arc(f.x, f.y, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f0c8a0';
    ctx.beginPath();
    ctx.arc(f.x + Math.cos(f.angle) * 3, f.y + Math.sin(f.angle) * 3, 6, 0, Math.PI * 2);
    ctx.fill();
  }
  if (!game.player.inCar && game.state !== 'title') drawPlayer(ctx, game.player, game.time);

  drawBullets(ctx, game.bullets);
  drawParticles(ctx, game.particles);
  ctx.restore();

  // Screen-space overlays.
  if (game.state === 'title') {
    drawTitle(ctx, game, viewW, viewH, game.saveExists);
  } else if (game.state === 'intro' && game.introDef) {
    drawMissionIntro(ctx, viewW, viewH, game.introDef);
  } else if (game.state === 'paused') {
    drawHUD(ctx, game, viewW, viewH);
    drawMinimap(ctx, game, viewW);
    drawPause(ctx, viewW, viewH);
  } else if (game.state === 'end') {
    drawHUD(ctx, game, viewW, viewH);
    drawMinimap(ctx, game, viewW);
    drawEnd(ctx, viewW, viewH, game.endKind, game.endDetail);
  } else {
    drawHUD(ctx, game, viewW, viewH);
    drawMinimap(ctx, game, viewW);
  }
}

// --- Main loop -------------------------------------------------------------

let last = performance.now();

function frame(now) {
  const dt = clamp((now - last) / 1000, 0, 0.05);
  last = now;
  game.time += dt;

  if (game.state === 'title') {
    updateTitle(dt);
  } else if (game.state === 'playing') {
    updatePlaying(dt);
  } else if (game.state === 'intro') {
    if (input.wasPressed('Enter')) {
      const idx = game.missions.defs.indexOf(game.introDef);
      startMission(game.missions, idx);
      game.state = 'playing';
      audio.ensure();
    } else if (input.wasPressed('Escape')) {
      game.state = 'playing';
    }
  } else if (game.state === 'paused') {
    if (input.wasPressed('KeyP') || input.wasPressed('Escape')) game.state = 'playing';
    if (input.wasPressed('KeyS')) {
      saveGame(game);
      game.missions.banner = { text: 'Game saved', until: game.time + 2 };
      game.state = 'playing';
    }
    if (input.wasPressed('KeyQ')) {
      game.state = 'title';
      game.menuIndex = 0;
      game.saveExists = hasSave();
    }
  } else if (game.state === 'end') {
    if (input.wasPressed('KeyR')) respawnAfterEnd();
  }

  render();
  input.endFrame();
  requestAnimationFrame(frame);
}

// --- Boot ------------------------------------------------------------------

resetWorld();
// Debug / automation handle: lets a play-test read the live state.
window.__solmara = game;
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
if (shot) {
  applyShot(game, shot, rng);
} else {
  game.state = 'title';
}
requestAnimationFrame(frame);
