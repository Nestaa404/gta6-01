// Drawing only: the city, its cars and people, the HUD with its minimap, and
// every screen. The 1280x720 view is scaled to fit the window and centred; the
// camera follows the player and is clamped to the city. Flat shapes, warm
// sun-soaked colours, soft shadows — all drawn from the world's state.
import { CAR, DISTRICTS, FONT, PALETTE, PLAYER, ROADS, VIEW, WEAPONS, WORLD } from './config.js';
import { PLACES } from './city.js';
import { MISSION_COUNT, STORY } from './missions.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_HELP = 'help';
export const SCREEN_BUSTED = 'busted';
export const SCREEN_WASTED = 'wasted';
export const SCREEN_END = 'end';

const MINIMAP = { x: 18, y: VIEW.height - 196, w: 220, h: 178 };

function starPath(ctx, x, y, r) {
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 === 0 ? r : r * 0.45;
    const px = x + Math.cos(a) * rad;
    const py = y + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const camera = { x: 0, y: 0 };
  const fonts = new Map();

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / VIEW.width, height / VIEW.height);
    view.x = (width - VIEW.width * view.scale) / 2;
    view.y = (height - VIEW.height * view.scale) / 2;
  }

  function text(value, x, y, size, color, align, baseline) {
    if (!fonts.has(size)) fonts.set(size, `bold ${size}px ${FONT}`);
    ctx.font = fonts.get(size);
    ctx.fillStyle = color;
    ctx.textAlign = align ?? 'left';
    ctx.textBaseline = baseline ?? 'alphabetic';
    ctx.fillText(value, x, y);
  }

  function plainText(value, x, y, size, color, align, baseline) {
    if (!fonts.has(-size)) fonts.set(-size, `${size}px ${FONT}`);
    ctx.font = fonts.get(-size);
    ctx.fillStyle = color;
    ctx.textAlign = align ?? 'left';
    ctx.textBaseline = baseline ?? 'alphabetic';
    ctx.fillText(value, x, y);
  }

  function inView(x, y, pad) {
    const p = pad ?? 60;
    return x > camera.x - p && x < camera.x + VIEW.width + p && y > camera.y - p && y < camera.y + VIEW.height + p;
  }

  function drawGround() {
    ctx.fillStyle = PALETTE.grass;
    ctx.fillRect(camera.x - 10, camera.y - 10, VIEW.width + 20, VIEW.height + 20);
    // The southern beach and the sea beyond it.
    const sandY = DISTRICTS.beachY;
    if (sandY < camera.y + VIEW.height) {
      ctx.fillStyle = PALETTE.sand;
      ctx.fillRect(camera.x - 10, Math.max(sandY, camera.y - 10), VIEW.width + 20, WORLD.height - Math.max(sandY, camera.y - 10));
      ctx.fillStyle = PALETTE.sea;
      ctx.fillRect(camera.x - 10, 2680, VIEW.width + 20, WORLD.height - 2680);
      ctx.fillStyle = PALETTE.seaDeep;
      for (let x = Math.floor(camera.x / 90) * 90; x < camera.x + VIEW.width; x += 90) {
        ctx.fillRect(x, 2710 + ((x / 90) % 2) * 24, 52, 5);
      }
    }
  }

  function drawRoads() {
    const { avenues, streets, width: w, sidewalk: sw } = ROADS;
    // Sidewalks first, then the asphalt, then the centre dashes.
    ctx.fillStyle = PALETTE.sidewalk;
    for (const ax of avenues) ctx.fillRect(ax - w / 2 - sw, camera.y - 10, w + sw * 2, VIEW.height + 20);
    for (const sy of streets) ctx.fillRect(camera.x - 10, sy - w / 2 - sw, VIEW.width + 20, w + sw * 2);
    ctx.fillStyle = PALETTE.road;
    for (const ax of avenues) ctx.fillRect(ax - w / 2, camera.y - 10, w, VIEW.height + 20);
    for (const sy of streets) ctx.fillRect(camera.x - 10, sy - w / 2, VIEW.width + 20, w);
    ctx.fillStyle = PALETTE.lane;
    for (const ax of avenues) {
      for (let y = Math.floor(camera.y / 48) * 48; y < camera.y + VIEW.height; y += 48) ctx.fillRect(ax - 2, y, 4, 24);
    }
    for (const sy of streets) {
      for (let x = Math.floor(camera.x / 48) * 48; x < camera.x + VIEW.width; x += 48) ctx.fillRect(x, sy - 2, 24, 4);
    }
  }

  function drawCity(city, time) {
    drawGround();
    // Parks and parking lots.
    for (const park of city.parks) {
      if (!inView(park.x + park.w / 2, park.y + park.h / 2, 200)) continue;
      ctx.fillStyle = PALETTE.park;
      ctx.fillRect(park.x, park.y, park.w, park.h);
      ctx.fillStyle = '#e8d39a';
      ctx.fillRect(park.x + park.w / 2 - 6, park.y, 12, park.h);
    }
    for (const lot of city.lots) {
      if (!inView(lot.x + lot.w / 2, lot.y + lot.h / 2, 200)) continue;
      ctx.fillStyle = '#8f8a80';
      ctx.fillRect(lot.x, lot.y, lot.w, lot.h);
      ctx.strokeStyle = '#e8e8e8';
      ctx.lineWidth = 2;
      for (let x = lot.x + 30; x < lot.x + lot.w - 20; x += 56) {
        ctx.beginPath();
        ctx.moveTo(x, lot.y + 14);
        ctx.lineTo(x, lot.y + 44);
        ctx.stroke();
      }
    }
    drawRoads();
    // Buildings: a shaded side for height, then the roof.
    for (const b of city.buildings) {
      if (!inView(b.x + b.w / 2, b.y + b.h / 2, 160)) continue;
      const lift = Math.min(26, b.height * 0.24);
      ctx.fillStyle = PALETTE.buildingSide;
      ctx.fillRect(b.x + lift, b.y + lift, b.w, b.h);
      ctx.fillStyle = b.glass ? PALETTE.downtownGlass : b.roof;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      if (b.glass) {
        ctx.fillStyle = '#ffffff22';
        for (let gx = b.x + 10; gx < b.x + b.w - 8; gx += 22) ctx.fillRect(gx, b.y + 8, 10, b.h - 16);
      } else {
        ctx.strokeStyle = '#00000022';
        ctx.lineWidth = 2;
        ctx.strokeRect(b.x + 5, b.y + 5, b.w - 10, b.h - 10);
      }
      if (b.height > 60) {
        ctx.fillStyle = '#ffffff18';
        ctx.fillRect(b.x + 8, b.y + 8, b.w - 16, 10);
      }
    }
    // Trees.
    for (const t of city.trees) {
      if (!inView(t.x, t.y, 40)) continue;
      ctx.fillStyle = '#00000022';
      ctx.beginPath();
      ctx.ellipse(t.x + 4, t.y + 5, t.r, t.r * 0.7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = t.palm ? '#4a9e4f' : PALETTE.tree;
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = PALETTE.treeDark;
      ctx.beginPath();
      ctx.arc(t.x - t.r * 0.3, t.y - t.r * 0.3, t.r * 0.45, 0, Math.PI * 2);
      ctx.fill();
    }
    // Place labels.
    ctx.textAlign = 'center';
    for (const key of Object.keys(PLACES)) {
      const p = PLACES[key];
      if (!inView(p.x, p.y, 80)) continue;
      plainText(p.name, p.x, p.y - 14, 15, '#ffffffdd', 'center');
    }
    void time;
  }

  function drawCar(car, time) {
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    ctx.fillStyle = '#00000030';
    roundRect(ctx, -CAR.length / 2 + 4, -CAR.width / 2 + 5, CAR.length, CAR.width, 8);
    ctx.fill();
    ctx.fillStyle = car.police ? PALETTE.copCar : car.color;
    roundRect(ctx, -CAR.length / 2, -CAR.width / 2, CAR.length, CAR.width, 8);
    ctx.fill();
    ctx.fillStyle = '#222831';
    ctx.fillRect(-8, -CAR.width / 2 + 4, 18, CAR.width - 8);
    ctx.fillStyle = '#3d4a5c';
    ctx.fillRect(-CAR.length / 2 + 6, -CAR.width / 2 + 5, 10, CAR.width - 10);
    ctx.fillStyle = '#ffe9a8';
    ctx.fillRect(CAR.length / 2 - 4, -CAR.width / 2 + 4, 3, 7);
    ctx.fillRect(CAR.length / 2 - 4, CAR.width / 2 - 11, 3, 7);
    if (car.police) {
      const on = Math.floor(time * 4) % 2 === 0;
      ctx.fillStyle = on ? '#ff3b30' : '#2f7bff';
      ctx.fillRect(-4, -CAR.width / 2 - 2, 8, 6);
      ctx.fillStyle = on ? '#2f7bff' : '#ff3b30';
      ctx.fillRect(-4, CAR.width / 2 - 4, 8, 6);
      ctx.fillStyle = '#1d2a44';
      plainText('POLICE', 0, 4, 9, '#1d2a44', 'center');
    }
    ctx.restore();
  }

  function drawPed(ped) {
    const bob = ped.down > 0 ? 0 : Math.sin(ped.walkPhase) * 2;
    ctx.fillStyle = '#0000002e';
    ctx.beginPath();
    ctx.ellipse(ped.x + 2, ped.y + 3, 9, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    if (ped.down > 0) {
      // Knocked down: lying flat.
      ctx.fillStyle = ped.shirt;
      ctx.beginPath();
      ctx.ellipse(ped.x, ped.y, 14, 7, ped.angle, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    ctx.fillStyle = ped.shirt;
    ctx.beginPath();
    ctx.arc(ped.x, ped.y + bob * 0.3, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8b98a';
    ctx.beginPath();
    ctx.arc(ped.x + Math.cos(ped.angle) * 3, ped.y + Math.sin(ped.angle) * 3 + bob * 0.3, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawCop(cop, time) {
    if (cop.kind === 'car') return; // drawn with the cars
    ctx.fillStyle = '#0000002e';
    ctx.beginPath();
    ctx.ellipse(cop.x + 2, cop.y + 3, 10, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.cop;
    ctx.beginPath();
    ctx.arc(cop.x, cop.y, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f4f1e8';
    ctx.beginPath();
    ctx.arc(cop.x + Math.cos(cop.angle) * 3, cop.y + Math.sin(cop.angle) * 3, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#16233d';
    ctx.beginPath();
    ctx.arc(cop.x + Math.cos(cop.angle) * 3, cop.y + Math.sin(cop.angle) * 3 - 2, 6, Math.PI, 0);
    ctx.fill();
    if (cop.arrest > 0) {
      ctx.fillStyle = '#ff5a3c';
      ctx.fillRect(cop.x - 14, cop.y - 26, 28 * (cop.arrest / 2.2), 4);
    }
    void time;
  }

  function drawEnemy(e) {
    ctx.fillStyle = '#0000002e';
    ctx.beginPath();
    ctx.ellipse(e.x + 2, e.y + 3, 10, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = e.boss ? '#3a0d0d' : '#8c2f2f';
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.boss ? 14 : 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8b98a';
    ctx.beginPath();
    ctx.arc(e.x + Math.cos(e.angle) * 3, e.y + Math.sin(e.angle) * 3, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(e.x, e.y);
    ctx.lineTo(e.x + Math.cos(e.angle) * 22, e.y + Math.sin(e.angle) * 22);
    ctx.stroke();
    ctx.fillStyle = '#ff5a3c';
    ctx.fillRect(e.x - 14, e.y - (e.boss ? 30 : 26), 28, 4);
    ctx.fillStyle = '#7fb069';
    ctx.fillRect(e.x - 14, e.y - (e.boss ? 30 : 26), 28 * Math.max(0, e.health / (e.boss ? 220 : 70)), 4);
    if (e.boss) plainText('KADE', e.x, e.y - 34, 11, '#ffd23f', 'center');
  }

  function drawPlayer(state, time) {
    const p = state.player;
    if (p.inCar) return;
    const blink = p.invulnerable > 0 && Math.floor(time * 12) % 2 === 0;
    if (blink) return;
    ctx.fillStyle = '#00000030';
    ctx.beginPath();
    ctx.ellipse(p.x + 2, p.y + 4, 12, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.playerShirt;
    ctx.beginPath();
    ctx.arc(p.x, p.y, PLAYER.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.player;
    ctx.beginPath();
    ctx.arc(p.x, p.y - 3, 7, 0, Math.PI * 2);
    ctx.fill();
    // Aim direction.
    ctx.strokeStyle = '#f4f1e8';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + Math.cos(p.angle) * 24, p.y + Math.sin(p.angle) * 24);
    ctx.stroke();
    if (p.weapon !== 'fists') {
      ctx.strokeStyle = '#222';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(p.x + Math.cos(p.angle) * 12, p.y + Math.sin(p.angle) * 12);
      ctx.lineTo(p.x + Math.cos(p.angle) * 26, p.y + Math.sin(p.angle) * 26);
      ctx.stroke();
    }
  }

  function drawWorld(state, city, missions, time) {
    drawCity(city, time);
    // Objective beam and marker.
    const target = missions.objectiveTarget();
    if (target && inView(target.x, target.y, 100)) {
      const pulse = 0.6 + Math.sin(time * 4) * 0.25;
      ctx.fillStyle = `rgba(255, 210, 63, ${0.25 * pulse})`;
      ctx.fillRect(target.x - 30, target.y - 30, 60, 60);
      ctx.fillStyle = PALETTE.marker;
      ctx.save();
      ctx.translate(target.x, target.y - 18 - Math.sin(time * 3) * 6);
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-9, -9, 18, 18);
      ctx.restore();
    }
    for (const pickup of state.pickups) {
      const bob = Math.sin(time * 3 + pickup.bob) * 3;
      ctx.fillStyle = '#00000022';
      ctx.beginPath();
      ctx.ellipse(pickup.x, pickup.y + 8, 10, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      if (pickup.kind === 'health') {
        ctx.fillStyle = '#2f9e44';
        ctx.beginPath();
        ctx.arc(pickup.x, pickup.y + bob, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.fillRect(pickup.x - 2, pickup.y + bob - 7, 4, 14);
        ctx.fillRect(pickup.x - 7, pickup.y + bob - 2, 14, 4);
      } else if (pickup.kind === 'money') {
        ctx.fillStyle = '#ffd23f';
        ctx.beginPath();
        ctx.arc(pickup.x, pickup.y + bob, 11, 0, Math.PI * 2);
        ctx.fill();
        plainText('$', pickup.x, pickup.y + bob + 4, 14, '#7a5b00', 'center');
      } else {
        ctx.fillStyle = '#8a6d4b';
        ctx.beginPath();
        ctx.arc(pickup.x, pickup.y + bob, 12, 0, Math.PI * 2);
        ctx.fill();
        plainText(pickup.kind === 'shotgun' ? 'SG' : 'P', pickup.x, pickup.y + bob + 4, 12, '#fff', 'center');
      }
    }
    for (const car of state.cars) if (inView(car.x, car.y, 80)) drawCar(car, time);
    for (const ped of state.peds) if (inView(ped.x, ped.y, 40)) drawPed(ped);
    for (const cop of state.cops) if (inView(cop.x, cop.y, 60)) drawCop(cop, time);
    for (const e of state.enemies) if (!e.dead && inView(e.x, e.y, 60)) drawEnemy(e);
    drawPlayer(state, time);
    for (const b of state.bullets) {
      ctx.strokeStyle = '#ffe9a8';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(b.x - Math.cos(b.angle) * 14, b.y - Math.sin(b.angle) * 14);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    for (const p of state.particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }

  function drawMinimap(state, missions) {
    const { x, y, w, h } = MINIMAP;
    const sx = w / WORLD.width;
    const sy = h / WORLD.height;
    ctx.fillStyle = 'rgba(16, 20, 24, 0.85)';
    roundRect(ctx, x - 6, y - 6, w + 12, h + 12, 8);
    ctx.fill();
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    ctx.fillStyle = '#5d8a48';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = PALETTE.sea;
    ctx.fillRect(x, y + DISTRICTS.beachY * sy, w, h - DISTRICTS.beachY * sy);
    ctx.strokeStyle = '#3d3a38';
    ctx.lineWidth = 2;
    for (const ax of ROADS.avenues) {
      ctx.beginPath();
      ctx.moveTo(x + ax * sx, y);
      ctx.lineTo(x + ax * sx, y + h);
      ctx.stroke();
    }
    for (const sy2 of ROADS.streets) {
      ctx.beginPath();
      ctx.moveTo(x, y + sy2 * sy);
      ctx.lineTo(x + w, y + sy2 * sy);
      ctx.stroke();
    }
    const target = missions.objectiveTarget();
    if (target) {
      ctx.fillStyle = PALETTE.marker;
      ctx.save();
      ctx.translate(x + target.x * sx, y + target.y * sy);
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-5, -5, 10, 10);
      ctx.restore();
    }
    for (const cop of state.cops) {
      ctx.fillStyle = '#ff3b30';
      ctx.beginPath();
      ctx.arc(x + cop.x * sx, y + cop.y * sy, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const e of state.enemies) {
      if (e.dead) continue;
      ctx.fillStyle = '#ff9f1c';
      ctx.beginPath();
      ctx.arc(x + e.x * sx, y + e.y * sy, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    const p = state.player;
    ctx.fillStyle = '#fff';
    ctx.save();
    ctx.translate(x + p.x * sx, y + p.y * sy);
    ctx.rotate(p.angle);
    ctx.beginPath();
    ctx.moveTo(7, 0);
    ctx.lineTo(-5, -5);
    ctx.lineTo(-5, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.restore();
    plainText('SOLMARA', x + w / 2, y - 8, 11, PALETTE.hudMuted, 'center');
  }

  function drawHud(state, missions, time) {
    const p = state.player;
    // Top-left: money and health.
    ctx.fillStyle = PALETTE.hudPanel;
    roundRect(ctx, 16, 14, 250, 64, 10);
    ctx.fill();
    text(`$${p.money.toLocaleString('en-US')}`, 30, 40, 24, '#7bf1a8', 'left');
    plainText('HEALTH', 236, 38, 11, PALETTE.hudMuted, 'right');
    ctx.fillStyle = '#3a3f45';
    roundRect(ctx, 30, 50, 200, 12, 6);
    ctx.fill();
    ctx.fillStyle = p.health > 40 ? '#7bf1a8' : '#ff5a3c';
    roundRect(ctx, 30, 50, 200 * (p.health / PLAYER.health), 12, 6);
    ctx.fill();
    // Top-right: wanted stars.
    ctx.fillStyle = PALETTE.hudPanel;
    roundRect(ctx, VIEW.width - 236, 14, 220, 64, 10);
    ctx.fill();
    plainText(state.wanted > 0 ? 'WANTED' : 'CLEAN', VIEW.width - 30, 34, 12, state.wanted > 0 ? '#ff5a3c' : PALETTE.hudMuted, 'right');
    for (let i = 0; i < 5; i += 1) {
      ctx.fillStyle = i < state.wanted ? PALETTE.star : PALETTE.starEmpty;
      starPath(ctx, VIEW.width - 202 + i * 38, 58, 13);
      ctx.fill();
    }
    // Top-centre: mission objective.
    const objective = missions.objectiveLabel();
    if (objective) {
      const target = missions.objectiveTarget();
      let label = objective;
      if (target) {
        const d = Math.round(Math.hypot(target.x - p.x, target.y - p.y) / 10);
        label += `  ·  ${d}m`;
      }
      const w = ctx.measureText(label).width + 40;
      ctx.fillStyle = PALETTE.hudPanel;
      roundRect(ctx, (VIEW.width - 520) / 2, 14, 520, 40, 10);
      ctx.fill();
      ctx.fillStyle = PALETTE.objective;
      ctx.fillRect((VIEW.width - 520) / 2 + 14, 26, 8, 16);
      plainText(label, (VIEW.width - 520) / 2 + 34, 40, 16, PALETTE.hudText, 'left');
      void w;
    }
    // Clock.
    const hours = Math.floor(state.timeOfDay);
    const minutes = Math.floor((state.timeOfDay - hours) * 60);
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const h12 = ((hours + 11) % 12) + 1;
    plainText(`${h12}:${String(minutes).padStart(2, '0')} ${ampm}  ·  ${STORY.city}`, VIEW.width / 2, 76, 13, PALETTE.hudMuted, 'center');
    // Bottom-right: weapon and speed.
    const weapon = WEAPONS[p.weapon];
    ctx.fillStyle = PALETTE.hudPanel;
    roundRect(ctx, VIEW.width - 236, VIEW.height - 64, 220, 48, 10);
    ctx.fill();
    const ammo = weapon.ammo === Infinity ? '∞' : String(p.ammo[p.weapon]);
    text(`${weapon.name}  ${ammo}`, VIEW.width - 30, VIEW.height - 30, 20, PALETTE.hudText, 'right');
    if (p.inCar) {
      const mph = Math.round(Math.abs(p.inCar.speed) / 6.2);
      text(`${mph} mph`, VIEW.width - 30, VIEW.height - 84, 26, PALETTE.hudText, 'right');
    }
    // Controls hint, first seconds of play.
    if (state.elapsed < 14 && !p.inCar) {
      plainText('WASD move · Shift run · E steal car · Click shoot · Q weapon · F save · P pause', VIEW.width / 2, VIEW.height - 14, 13, '#ffffffaa', 'center');
    }
    if (state.elapsed < 14 && p.inCar) {
      plainText('W/S drive · A/D steer · Space handbrake · E exit car', VIEW.width / 2, VIEW.height - 14, 13, '#ffffffaa', 'center');
    }
    // Message line.
    if (state.message) {
      ctx.fillStyle = 'rgba(16,20,24,0.8)';
      const mw = ctx.measureText(state.message).width + 36;
      roundRect(ctx, (VIEW.width - mw) / 2, 96, mw, 36, 8);
      ctx.fill();
      plainText(state.message, VIEW.width / 2, 120, 16, PALETTE.hudText, 'center');
    }
    // Mission banner.
    if (missions.state.bannerTimer > 0 && missions.state.banner) {
      ctx.fillStyle = 'rgba(16,20,24,0.88)';
      ctx.fillRect(0, VIEW.height / 2 - 52, VIEW.width, 104);
      text(missions.state.banner, VIEW.width / 2, VIEW.height / 2 - 2, 40, PALETTE.objective, 'center');
      const m = missions.current();
      if (m && missions.state.banner === m.title) plainText(m.brief, VIEW.width / 2, VIEW.height / 2 + 32, 15, PALETTE.hudMuted, 'center');
    }
    drawMinimap(state, missions);
  }

  function drawPanel(title, lines, prompt, accent) {
    const width = 640;
    const height = 150 + lines.length * 34;
    const x = (VIEW.width - width) / 2;
    const y = (VIEW.height - height) / 2;
    ctx.fillStyle = 'rgba(12, 15, 20, 0.92)';
    roundRect(ctx, x, y, width, height, 14);
    ctx.fill();
    ctx.strokeStyle = accent ?? PALETTE.objective;
    ctx.lineWidth = 3;
    ctx.strokeRect(x + 6, y + 6, width - 12, height - 12);
    text(title, VIEW.width / 2, y + 74, 46, PALETTE.hudText, 'center');
    for (let i = 0; i < lines.length; i += 1) {
      plainText(lines[i], VIEW.width / 2, y + 118 + i * 34, 18, PALETTE.hudMuted, 'center');
    }
    if (prompt) text(prompt, VIEW.width / 2, y + height - 30, 20, accent ?? PALETTE.objective, 'center');
  }

  function drawTitle(state, city, hasSave, best) {
    // The city behind the title, slowly drifting.
    camera.x = 1200 + Math.sin(state.elapsed * 0.05) * 200;
    camera.y = 800;
    ctx.save();
    ctx.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    ctx.translate(-camera.x, -camera.y);
    drawCity(city, state.elapsed);
    ctx.restore();
    ctx.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    ctx.fillStyle = 'rgba(10, 14, 20, 0.55)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    text('SOLMARA', VIEW.width / 2, 190, 96, '#ffd23f', 'center');
    text('AN OPEN-WORLD CRIME STORY', VIEW.width / 2, 240, 24, PALETTE.hudText, 'center');
    plainText('Sun, sea, and Silas Kade owning every street. Lena Voss needs a wheelman.', VIEW.width / 2, 272, 16, PALETTE.hudMuted, 'center');
    const lines = [
      'WASD move · Shift run · Mouse aim · Click shoot · F punch',
      'E steal & enter cars · Q switch weapon · F save · P pause · M mute',
      hasSave ? 'Continue your story — press C' : 'No save yet — your story starts fresh',
      best > 0 ? `Best fortune so far: $${best.toLocaleString('en-US')}` : 'Five missions. One city. Make it yours.',
    ];
    drawPanelLines(lines, hasSave);
  }

  function drawPanelLines(lines, hasSave) {
    const width = 620;
    const height = 40 + lines.length * 32 + 64;
    const x = (VIEW.width - width) / 2;
    const y = 310;
    ctx.fillStyle = 'rgba(12, 15, 20, 0.85)';
    roundRect(ctx, x, y, width, height, 12);
    ctx.fill();
    for (let i = 0; i < lines.length; i += 1) {
      plainText(lines[i], VIEW.width / 2, y + 40 + i * 32, 16, i === 2 ? PALETTE.objective : PALETTE.hudMuted, 'center');
    }
    text(hasSave ? 'ENTER — New game      C — Continue' : 'ENTER — Start the story', VIEW.width / 2, y + height - 22, 20, '#7bf1a8', 'center');
  }

  /** Paint one frame. `screen` picks the overlay; `ui` carries menu extras. */
  function draw(state, city, missions, screen, ui) {
    const time = state.elapsed;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#101418';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    if (screen === SCREEN_TITLE) {
      drawTitle(state, city, ui.hasSave, ui.best);
      return;
    }
    const p = state.player;
    const shakeX = state.cameraShake > 0 ? (Math.random() - 0.5) * state.cameraShake : 0;
    const shakeY = state.cameraShake > 0 ? (Math.random() - 0.5) * state.cameraShake : 0;
    camera.x = Math.max(0, Math.min(WORLD.width - VIEW.width, p.x - VIEW.width / 2 + shakeX));
    camera.y = Math.max(0, Math.min(WORLD.height - VIEW.height, p.y - VIEW.height / 2 + shakeY));
    ctx.save();
    ctx.translate(-camera.x, -camera.y);
    drawWorld(state, city, missions, time);
    ctx.restore();
    drawHud(state, missions, time);
    if (screen === SCREEN_PAUSED) {
      ctx.fillStyle = 'rgba(10,14,20,0.6)';
      ctx.fillRect(0, 0, VIEW.width, VIEW.height);
      drawPanel('Paused', [
        `Money $${p.money.toLocaleString('en-US')}  ·  Missions done ${state.missionsDone} / ${MISSION_COUNT}`,
        'F — save your progress   ·   H — how to play',
        'Your save stays in this browser.',
      ], 'P or Enter to resume');
    } else if (screen === SCREEN_HELP) {
      ctx.fillStyle = 'rgba(10,14,20,0.6)';
      ctx.fillRect(0, 0, VIEW.width, VIEW.height);
      drawPanel('How to play', [
        'WASD / arrows — move on foot, drive in a car',
        'Mouse — aim · Click — shoot / punch · Q — switch weapon',
        'E — steal or enter a car, E again to get out',
        'Stealing, hitting people and shooting raise your wanted stars',
        'Police chase you while wanted — lose them to cool down',
        'Follow the yellow marker: missions pay, and the story ends at Marina Tower',
        'F — save · M — mute · P — pause',
      ], 'P to go back');
    } else if (screen === SCREEN_BUSTED) {
      ctx.fillStyle = 'rgba(20,10,10,0.55)';
      ctx.fillRect(0, 0, VIEW.width, VIEW.height);
      drawPanel('BUSTED', ['The Solmara PD caught you. Lena bailed you out.', 'You lost $200 and your heat.'], 'Press Enter to get back out there', '#5aa2ff');
    } else if (screen === SCREEN_WASTED) {
      ctx.fillStyle = 'rgba(20,10,10,0.55)';
      ctx.fillRect(0, 0, VIEW.width, VIEW.height);
      drawPanel('WASTED', ['You woke up at Solmara General.', 'The city is still yours to take.'], 'Press Enter to get back out there', '#ff5a3c');
    } else if (screen === SCREEN_END) {
      ctx.fillStyle = 'rgba(10,14,20,0.6)';
      ctx.fillRect(0, 0, VIEW.width, VIEW.height);
      drawPanel('KING OF SOLMARA', [
        'Silas Kade is finished. The tower, the docks, the streets — all yours.',
        `Fortune: $${p.money.toLocaleString('en-US')}  ·  Cars stolen: ${state.carsStolen}`,
        'Free roam continues. Solmara never sleeps.',
      ], 'Press Enter to keep roaming', '#ffd23f');
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw };
}
