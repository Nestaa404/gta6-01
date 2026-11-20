// Solmara — everything the player sees. A camera that follows the
// player or their car, the city drawn top-down with soft shadows,
// cars and pedestrians, the HUD (health, money, wanted stars, speed,
// objective) and the minimap, plus the title, pause and end screens.

import { CFG, PALETTE } from './config.js';
import { clamp, lerp } from './util.js';
import { CONTROLS } from './input.js';
import { currentObjective, objectivePoint } from './missions.js';

export function createCamera() {
  return { x: 0, y: 0, zoom: 1 };
}

export function updateCamera(cam, targetX, targetY, viewW, viewH, dt) {
  const k = 1 - Math.pow(0.001, dt);
  cam.x = lerp(cam.x, targetX - viewW / 2, k);
  cam.y = lerp(cam.y, targetY - viewH / 2, k);
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

export function drawWorld(ctx, city, cam, viewW, viewH, time) {
  const x0 = Math.max(0, cam.x - 80);
  const y0 = Math.max(0, cam.y - 80);
  const x1 = Math.min(city.size, cam.x + viewW + 80);
  const y1 = Math.min(city.size, cam.y + viewH + 80);

  // Ground: dry grass with a sand beach on the south strip and water
  // beyond it, plus a marina basin on the east edge.
  ctx.fillStyle = PALETTE.grass;
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  ctx.fillStyle = PALETTE.grassDry;
  for (let gx = Math.floor(x0 / 260) * 260; gx < x1; gx += 260) {
    for (let gy = Math.floor(y0 / 260) * 260; gy < y1; gy += 260) {
      if (((gx + gy) / 260) % 2 === 0) ctx.fillRect(gx, gy, 260, 260);
    }
  }
  // Beach and sea.
  const beachTop = city.size - 190;
  if (y1 > beachTop) {
    ctx.fillStyle = PALETTE.sand;
    ctx.fillRect(x0, Math.max(y0, beachTop), x1 - x0, Math.min(y1, city.size) - Math.max(y0, beachTop));
    ctx.fillStyle = PALETTE.water;
    ctx.fillRect(x0, Math.max(y0, city.size - 90), x1 - x0, Math.min(y1, city.size) - Math.max(y0, city.size - 90));
    // Gentle wave lines.
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      const wy = city.size - 70 + i * 26 + Math.sin(time * 0.7 + i * 2) * 4;
      if (wy < y0 || wy > y1) continue;
      ctx.beginPath();
      for (let wx = x0; wx <= x1; wx += 40) {
        const wob = Math.sin(wx * 0.02 + time + i) * 3;
        if (wx === x0) ctx.moveTo(wx, wy + wob);
        else ctx.lineTo(wx, wy + wob);
      }
      ctx.stroke();
    }
  }

  // Parks.
  for (const park of city.parks) {
    ctx.fillStyle = PALETTE.park;
    ctx.fillRect(park.x, park.y, park.w, park.h);
  }

  // Roads: dark asphalt with a pale sidewalk border and a dashed
  // centre line, drawn per road line so intersections read clearly.
  for (const line of city.lines) {
    ctx.fillStyle = PALETTE.sidewalk;
    ctx.fillRect(x0, line - CFG.roadWidth / 2 - CFG.sidewalk, x1 - x0, CFG.roadWidth + CFG.sidewalk * 2);
    ctx.fillRect(line - CFG.roadWidth / 2 - CFG.sidewalk, y0, CFG.roadWidth + CFG.sidewalk * 2, y1 - y0);
    ctx.fillStyle = PALETTE.road;
    ctx.fillRect(x0, line - CFG.roadWidth / 2, x1 - x0, CFG.roadWidth);
    ctx.fillRect(line - CFG.roadWidth / 2, y0, CFG.roadWidth, y1 - y0);
  }
  // Centre dashes.
  ctx.strokeStyle = PALETTE.roadLine;
  ctx.lineWidth = 3;
  ctx.setLineDash([26, 30]);
  for (const line of city.lines) {
    ctx.beginPath();
    ctx.moveTo(x0, line);
    ctx.lineTo(x1, line);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(line, y0);
    ctx.lineTo(line, y1);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // Buildings: soft drop shadow, coloured roof, darker edge and a few
  // windows so blocks read as a city from above.
  for (const b of city.buildings) {
    if (b.x > x1 || b.y > y1 || b.x + b.w < x0 || b.y + b.h < y0) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.fillRect(b.x + 6, b.y + 8, b.w, b.h);
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2);
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    const cols = Math.max(1, Math.floor(b.w / 46));
    const rows = Math.max(1, Math.floor(b.h / 46));
    for (let cxi = 0; cxi < cols; cxi++) {
      for (let cyi = 0; cyi < rows; cyi++) {
        ctx.fillRect(b.x + 10 + cxi * 46, b.y + 10 + cyi * 46, 18, 12);
      }
    }
  }

  // Trees.
  for (const t of city.trees) {
    if (t.x < x0 || t.x > x1 || t.y < y0 || t.y > y1) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.arc(t.x + 4, t.y + 5, t.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = t.r > 12 ? PALETTE.tree : PALETTE.treeLight;
    ctx.beginPath();
    ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function drawCar(ctx, car, isPlayer, time) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  roundRect(ctx, -CFG.carLength / 2 + 3, -CFG.carWidth / 2 + 4, CFG.carLength, CFG.carWidth, 8);
  ctx.fill();
  ctx.fillStyle = car.color;
  roundRect(ctx, -CFG.carLength / 2, -CFG.carWidth / 2, CFG.carLength, CFG.carWidth, 8);
  ctx.fill();
  // Windshield, roof and rear window.
  ctx.fillStyle = 'rgba(20,30,50,0.85)';
  ctx.fillRect(6, -CFG.carWidth / 2 + 3, 12, CFG.carWidth - 6);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(-8, -CFG.carWidth / 2 + 3, 12, CFG.carWidth - 6);
  // Headlights.
  ctx.fillStyle = '#ffe9a8';
  ctx.fillRect(CFG.carLength / 2 - 3, -CFG.carWidth / 2 + 2, 3, 5);
  ctx.fillRect(CFG.carLength / 2 - 3, CFG.carWidth / 2 - 7, 3, 5);
  ctx.fillStyle = '#c0392b';
  ctx.fillRect(-CFG.carLength / 2, -CFG.carWidth / 2 + 2, 3, 5);
  ctx.fillRect(-CFG.carLength / 2, CFG.carWidth / 2 - 7, 3, 5);
  ctx.restore();

  if (car.kind === 'police') {
    // Flashing light bar.
    const on = Math.floor(time * 6) % 2 === 0;
    ctx.fillStyle = on ? '#ff2d2d' : '#2d6bff';
    ctx.beginPath();
    ctx.arc(car.x - 4, car.y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = on ? '#2d6bff' : '#ff2d2d';
    ctx.beginPath();
    ctx.arc(car.x + 4, car.y, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  if (isPlayer) {
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(car.x, car.y, 34, 0, Math.PI * 2);
    ctx.stroke();
  }
}

export function drawPed(ctx, ped, time) {
  const bob = Math.sin(time * 8 + ped.id) * 1.5;
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(ped.x + 2, ped.y + 3, 8, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = ped.shirt;
  ctx.beginPath();
  ctx.arc(ped.x, ped.y + bob * 0.3, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = ped.skin;
  ctx.beginPath();
  ctx.arc(ped.x + Math.cos(ped.angle) * 3, ped.y + Math.sin(ped.angle) * 3 + bob * 0.3, 5.5, 0, Math.PI * 2);
  ctx.fill();
}

export function drawPlayer(ctx, player, time) {
  const bob = player.speed > 0 ? Math.sin(time * 12) * 2 : 0;
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(player.x + 2, player.y + 4, 10, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  // Body and head, facing the movement / aim direction.
  ctx.fillStyle = '#2e86c1';
  ctx.beginPath();
  ctx.arc(player.x, player.y + bob * 0.3, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f0c8a0';
  ctx.beginPath();
  ctx.arc(player.x + Math.cos(player.angle) * 4, player.y + Math.sin(player.angle) * 4 + bob * 0.3, 6.5, 0, Math.PI * 2);
  ctx.fill();
  // Gun in hand when aiming.
  ctx.strokeStyle = '#222';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(player.x + Math.cos(player.angle) * 8, player.y + Math.sin(player.angle) * 8);
  ctx.lineTo(player.x + Math.cos(player.angle) * 18, player.y + Math.sin(player.angle) * 18);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(player.x, player.y, 20, 0, Math.PI * 2);
  ctx.stroke();
}

export function drawObjectiveMarker(ctx, point, time) {
  if (!point) return;
  const pulse = 1 + Math.sin(time * 4) * 0.12;
  ctx.save();
  ctx.translate(point.x, point.y);
  ctx.strokeStyle = '#ffd23f';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(0, 0, point.radius * pulse, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,210,63,0.18)';
  ctx.beginPath();
  ctx.arc(0, 0, point.radius * pulse, 0, Math.PI * 2);
  ctx.fill();
  // Downward beacon arrow.
  const bob = Math.sin(time * 3) * 6;
  ctx.fillStyle = '#ffd23f';
  ctx.beginPath();
  ctx.moveTo(0, -58 + bob);
  ctx.lineTo(-12, -78 + bob);
  ctx.lineTo(12, -78 + bob);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function drawBullets(ctx, bullets) {
  ctx.strokeStyle = '#ffe9a8';
  ctx.lineWidth = 3;
  for (const b of bullets) {
    ctx.beginPath();
    ctx.moveTo(b.x - Math.cos(b.angle) * 12, b.y - Math.sin(b.angle) * 12);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
}

export function drawParticles(ctx, particles) {
  for (const p of particles) {
    ctx.globalAlpha = clamp(p.life / p.maxLife, 0, 1);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// --- HUD ------------------------------------------------------------------

export function drawHUD(ctx, game, viewW, viewH) {
  const { player, police, missions } = game;
  ctx.save();
  ctx.textBaseline = 'top';

  // Top-left: health bar, money, wanted stars.
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  roundRect(ctx, 14, 12, 250, 86, 10);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.fillText(`$${player.money}`, 28, 22);
  ctx.fillStyle = '#e74c3c';
  ctx.fillRect(28, 52, 150, 12);
  ctx.fillStyle = '#2ecc71';
  ctx.fillRect(28, 52, 150 * clamp(player.health / 100, 0, 1), 12);
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.strokeRect(28, 52, 150, 12);
  ctx.fillStyle = '#fff';
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillText('HEALTH', 186, 52);

  // Wanted stars.
  ctx.font = '26px system-ui, sans-serif';
  for (let i = 0; i < CFG.maxWanted; i++) {
    ctx.fillStyle = i < police.wanted ? '#ffd23f' : 'rgba(255,255,255,0.25)';
    ctx.fillText('★', 28 + i * 30, 68);
  }

  // Mission objective bar (top centre). The timer rides inside the
  // bar so it never collides with the minimap.
  const obj = currentObjective(missions);
  if (obj) {
    let label = `${obj.mission.title}: ${obj.step.text}`;
    if (obj.timer > 0) label += `  —  ${Math.ceil(obj.timer)}s`;
    ctx.font = 'bold 16px system-ui, sans-serif';
    const w = ctx.measureText(label).width + 28;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    roundRect(ctx, (viewW - w) / 2, 12, w, 34, 10);
    ctx.fill();
    ctx.fillStyle = '#ffd23f';
    ctx.fillText(label, (viewW - w) / 2 + 14, 20);
  }

  // Banner (mission complete / next step).
  if (missions.banner && game.time < missions.banner.until) {
    ctx.font = 'bold 22px system-ui, sans-serif';
    const bw = ctx.measureText(missions.banner.text).width + 36;
    ctx.fillStyle = 'rgba(20,90,40,0.85)';
    roundRect(ctx, (viewW - bw) / 2, 60, bw, 40, 10);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillText(missions.banner.text, (viewW - bw) / 2 + 18, 70);
  }

  // Speedometer when driving.
  if (player.inCar) {
    const kmh = Math.round(Math.abs(player.inCar.speed) * 0.55);
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    roundRect(ctx, viewW - 130, viewH - 76, 116, 62, 10);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 30px system-ui, sans-serif';
    ctx.fillText(String(kmh), viewW - 116, viewH - 68);
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillText('km/h', viewW - 62, viewH - 56);
  }

  // Context hint.
  if (game.hint) {
    ctx.font = '15px system-ui, sans-serif';
    const hw = ctx.measureText(game.hint).width + 24;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    roundRect(ctx, (viewW - hw) / 2, viewH - 44, hw, 30, 8);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillText(game.hint, (viewW - hw) / 2 + 12, viewH - 36);
  }

  // "BUSTED" / "WASTED" flash handled by the end screen, but a red
  // vignette warns the player while hurt.
  if (player.hurtFlash > 0) {
    ctx.fillStyle = `rgba(200,0,0,${clamp(player.hurtFlash, 0, 0.35)})`;
    ctx.fillRect(0, 0, viewW, viewH);
  }
  ctx.restore();
}

// --- Minimap --------------------------------------------------------------

export function drawMinimap(ctx, game, viewW) {
  const size = CFG.minimapSize;
  const x = viewW - size - 14;
  const y = 14;
  const scale = size / game.city.size;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  roundRect(ctx, x - 6, y - 6, size + 12, size + 12, 10);
  ctx.fill();
  ctx.beginPath();
  ctx.rect(x, y, size, size);
  ctx.clip();
  ctx.fillStyle = '#a9cf8a';
  ctx.fillRect(x, y, size, size);
  // Water.
  ctx.fillStyle = PALETTE.water;
  ctx.fillRect(x, y + size - 12, size, 12);
  // Roads.
  ctx.strokeStyle = '#3d3d46';
  ctx.lineWidth = Math.max(2, CFG.roadWidth * scale);
  for (const line of game.city.lines) {
    ctx.beginPath();
    ctx.moveTo(x, y + line * scale);
    ctx.lineTo(x + size, y + line * scale);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + line * scale, y);
    ctx.lineTo(x + line * scale, y + size);
    ctx.stroke();
  }
  // Buildings.
  ctx.fillStyle = 'rgba(70,70,84,0.85)';
  for (const b of game.city.buildings) {
    ctx.fillRect(x + b.x * scale, y + b.y * scale, Math.max(1, b.w * scale), Math.max(1, b.h * scale));
  }
  // Objective marker.
  const point = objectivePoint(game.missions);
  if (point) {
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath();
    ctx.arc(x + point.x * scale, y + point.y * scale, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffd23f';
    ctx.beginPath();
    ctx.arc(x + point.x * scale, y + point.y * scale, 8 + Math.sin(game.time * 4) * 2, 0, Math.PI * 2);
    ctx.stroke();
  }
  // Police.
  const flash = Math.floor(game.time * 6) % 2 === 0;
  ctx.fillStyle = flash ? '#ff2d2d' : '#2d6bff';
  for (const c of game.police.cars) {
    ctx.beginPath();
    ctx.arc(x + c.x * scale, y + c.y * scale, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const f of game.police.foot) {
    ctx.beginPath();
    ctx.arc(x + f.x * scale, y + f.y * scale, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // Player: white dot with a black ring.
  const px = game.player.inCar ? game.player.inCar.x : game.player.x;
  const py = game.player.inCar ? game.player.inCar.y : game.player.y;
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(x + px * scale, y + py * scale, 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(x + px * scale, y + py * scale, 4.5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillText('SOLMARA', x, y + size + 20);
}

// --- Screens --------------------------------------------------------------

function panel(ctx, viewW, viewH, w, h) {
  ctx.fillStyle = 'rgba(8,14,24,0.82)';
  roundRect(ctx, (viewW - w) / 2, (viewH - h) / 2, w, h, 16);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,210,63,0.6)';
  ctx.lineWidth = 2;
  roundRect(ctx, (viewW - w) / 2, (viewH - h) / 2, w, h, 16);
  ctx.stroke();
}

export function drawTitle(ctx, game, viewW, viewH, saveExists) {
  ctx.save();
  // Sunset gradient over the live city behind.
  const grad = ctx.createLinearGradient(0, 0, 0, viewH);
  grad.addColorStop(0, 'rgba(255,140,60,0.25)');
  grad.addColorStop(0.55, 'rgba(20,20,40,0.15)');
  grad.addColorStop(1, 'rgba(10,10,30,0.55)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, viewW, viewH);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd23f';
  ctx.font = 'bold 92px system-ui, sans-serif';
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = 18;
  ctx.fillText('SOLMARA', viewW / 2, 150);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#fff';
  ctx.font = '22px system-ui, sans-serif';
  ctx.fillText('A sun-soaked open-world crime story — an original game', viewW / 2, 195);
  ctx.font = '15px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.fillText('Steal cars. Outrun the law. Run jobs for Rico. Own the city.', viewW / 2, 224);

  const options = saveExists
    ? ['Continue', 'New Game', 'How to Play']
    : ['New Game', 'How to Play'];
  const startY = 300;
  options.forEach((opt, i) => {
    const selected = game.menuIndex === i;
    ctx.font = selected ? 'bold 26px system-ui, sans-serif' : '24px system-ui, sans-serif';
    ctx.fillStyle = selected ? '#ffd23f' : '#fff';
    ctx.fillText(`${selected ? '▶ ' : ''}${opt}`, viewW / 2, startY + i * 46);
  });

  if (game.showHelp) {
    panel(ctx, viewW, viewH, 560, 330);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.fillText('HOW TO PLAY', viewW / 2, viewH / 2 - 130);
    ctx.font = '16px system-ui, sans-serif';
    ctx.textAlign = 'left';
    CONTROLS.forEach((c, i) => {
      ctx.fillStyle = '#ffd23f';
      ctx.fillText(c[0], viewW / 2 - 240, viewH / 2 - 92 + i * 30);
      ctx.fillStyle = '#fff';
      ctx.fillText(c[1], viewW / 2 - 60, viewH / 2 - 92 + i * 30);
    });
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = '14px system-ui, sans-serif';
    ctx.fillText('Press Esc or Enter to close', viewW / 2, viewH / 2 + 140);
  } else {
    ctx.font = '14px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.fillText('WASD to move · E to enter a car · Mouse to aim · Enter to select', viewW / 2, viewH - 40);
  }
  ctx.restore();
}

export function drawPause(ctx, viewW, viewH) {
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(0, 0, viewW, viewH);
  panel(ctx, viewW, viewH, 420, 300);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd23f';
  ctx.font = 'bold 36px system-ui, sans-serif';
  ctx.fillText('PAUSED', viewW / 2, viewH / 2 - 90);
  ctx.fillStyle = '#fff';
  ctx.font = '18px system-ui, sans-serif';
  ctx.fillText('P / Esc — resume', viewW / 2, viewH / 2 - 30);
  ctx.fillText('M — mute sound', viewW / 2, viewH / 2 + 4);
  ctx.fillText('S — save game', viewW / 2, viewH / 2 + 38);
  ctx.fillText('Q — quit to title', viewW / 2, viewH / 2 + 72);
  ctx.restore();
}

export function drawEnd(ctx, viewW, viewH, kind, detail) {
  ctx.save();
  ctx.fillStyle = kind === 'busted' ? 'rgba(20,40,120,0.6)' : 'rgba(120,20,20,0.6)';
  ctx.fillRect(0, 0, viewW, viewH);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 84px system-ui, sans-serif';
  ctx.shadowColor = 'rgba(0,0,0,0.7)';
  ctx.shadowBlur = 16;
  ctx.fillText(kind === 'busted' ? 'BUSTED' : 'WASTED', viewW / 2, viewH / 2 - 20);
  ctx.shadowBlur = 0;
  ctx.font = '20px system-ui, sans-serif';
  ctx.fillText(detail || '', viewW / 2, viewH / 2 + 30);
  ctx.font = '17px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillText('Press R to try again — your missions and money are kept', viewW / 2, viewH / 2 + 80);
  ctx.restore();
}

export function drawMissionIntro(ctx, viewW, viewH, def) {
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(0, 0, viewW, viewH);
  panel(ctx, viewW, viewH, 640, 300);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd23f';
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.fillText(`RICO — NEW JOB`, viewW / 2, viewH / 2 - 110);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 34px system-ui, sans-serif';
  ctx.fillText(def.title, viewW / 2, viewH / 2 - 66);
  ctx.font = '17px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  wrapText(ctx, def.brief, viewW / 2, viewH / 2 - 28, 560, 26);
  ctx.fillStyle = '#2ecc71';
  ctx.font = 'bold 18px system-ui, sans-serif';
  ctx.fillText(`Reward: $${def.reward}`, viewW / 2, viewH / 2 + 92);
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = '15px system-ui, sans-serif';
  ctx.fillText('Press Enter to start', viewW / 2, viewH / 2 + 126);
  ctx.restore();
}

function wrapText(ctx, text, cx, y, maxW, lineH) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  lines.forEach((l, i) => ctx.fillText(l, cx, y + i * lineH));
}
