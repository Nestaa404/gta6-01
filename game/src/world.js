// Solmara — the city itself. Builds a deterministic road grid, the
// buildings that fill its blocks, a beach, a marina and a park, and
// answers the questions gameplay needs: is this point on a road, does
// this circle hit a building, where can a car or a pedestrian spawn.

import { CFG, PALETTE } from './config.js';
import { makeRng, pick, range, intRange, circleHitsRect } from './util.js';

export function buildCity(seed) {
  const rng = makeRng(seed);
  const size = CFG.worldSize;
  const spacing = CFG.roadSpacing;
  const halfRoad = CFG.roadWidth / 2;

  // Road centre lines run every `spacing` pixels, starting half a
  // spacing in from each edge, so the outer ring is parkland and beach.
  const lines = [];
  for (let p = spacing / 2; p < size - spacing / 2 + 1; p += spacing) lines.push(p);

  const buildings = [];
  const trees = [];
  const parks = [];
  const parkingSpots = [];

  // Each block between four roads gets one or two buildings, or a park.
  for (let ix = 0; ix < lines.length - 1; ix++) {
    for (let iy = 0; iy < lines.length - 1; iy++) {
      const x0 = lines[ix] + halfRoad + CFG.sidewalk + 8;
      const y0 = lines[iy] + halfRoad + CFG.sidewalk + 8;
      const x1 = lines[ix + 1] - halfRoad - CFG.sidewalk - 8;
      const y1 = lines[iy + 1] - halfRoad - CFG.sidewalk - 8;
      const w = x1 - x0;
      const h = y1 - y0;
      if (w < 60 || h < 60) continue;
      // The south-west block is the city park; the south strip is beach.
      if (ix === 0 && iy === lines.length - 2) {
        parks.push({ x: x0, y: y0, w, h });
        for (let t = 0; t < 14; t++) {
          trees.push({ x: range(rng, x0 + 14, x1 - 14), y: range(rng, y0 + 14, y1 - 14), r: range(rng, 9, 15) });
        }
        continue;
      }
      const roll = rng();
      if (roll < 0.12) {
        // Empty lot with a couple of trees and a parked car.
        trees.push({ x: range(rng, x0 + 20, x1 - 20), y: range(rng, y0 + 20, y1 - 20), r: 12 });
        parkingSpots.push({ x: x0 + w / 2, y: y0 + h / 2, angle: rng() < 0.5 ? 0 : Math.PI / 2 });
        continue;
      }
      if (roll < 0.55) {
        // One big building filling most of the block.
        buildings.push(makeBuilding(rng, x0, y0, w, h));
      } else {
        // Two smaller buildings side by side.
        const split = rng() < 0.5;
        if (split) {
          const mid = x0 + w * range(rng, 0.42, 0.58);
          buildings.push(makeBuilding(rng, x0, y0, mid - x0 - 12, h));
          buildings.push(makeBuilding(rng, mid + 12, y0, x1 - mid - 12, h));
        } else {
          const mid = y0 + h * range(rng, 0.42, 0.58);
          buildings.push(makeBuilding(rng, x0, y0, w, mid - y0 - 12));
          buildings.push(makeBuilding(rng, x0, mid + 12, w, y1 - mid - 12));
        }
      }
    }
  }

  // Parked cars along the roads: spots just off the kerb.
  for (const line of lines) {
    for (let i = 0; i < 5; i++) {
      const along = range(rng, 300, size - 300);
      const side = rng() < 0.5 ? -1 : 1;
      if (rng() < 0.5) {
        parkingSpots.push({ x: along, y: line + side * (halfRoad - 16), angle: 0 });
      } else {
        parkingSpots.push({ x: line + side * (halfRoad - 16), y: along, angle: Math.PI / 2 });
      }
    }
  }

  // Named places the missions and the HUD refer to.
  const places = {
    safehouse: { x: lines[1], y: lines[1], label: 'Safehouse' },
    marina: { x: size - 260, y: lines[lines.length - 2], label: 'Marina' },
    warehouse: { x: lines[lines.length - 2], y: lines[1], label: 'Warehouse' },
    park: { x: lines[0] + 200, y: lines[lines.length - 2], label: 'Palm Park' },
    beach: { x: size / 2, y: size - 90, label: 'Solmara Beach' },
    downtown: { x: lines[3], y: lines[3], label: 'Downtown' },
  };

  return { size, lines, buildings, trees, parks, parkingSpots, places, rngSeed: seed };
}

function makeBuilding(rng, x, y, w, h) {
  return {
    x, y, w, h,
    roof: pick(rng, PALETTE.buildingRoof),
    height: intRange(rng, 1, 3),
    windows: intRange(rng, 2, 5),
  };
}

// Is the point on drivable road (or the beach strip)?
export function isOnRoad(city, x, y) {
  const half = CFG.roadWidth / 2;
  for (const line of city.lines) {
    if (Math.abs(y - line) <= half && x >= 0 && x <= city.size) return true;
    if (Math.abs(x - line) <= half && y >= 0 && y <= city.size) return true;
  }
  return false;
}

// Nearest road centre line to a point, and which axis it runs on.
export function nearestRoad(city, x, y) {
  let best = { d: Infinity, line: 0, axis: 'x' };
  for (const line of city.lines) {
    const dy = Math.abs(y - line);
    if (dy < best.d) best = { d: dy, line, axis: 'x' };
    const dx = Math.abs(x - line);
    if (dx < best.d) best = { d: dx, line, axis: 'y' };
  }
  return best;
}

// Does a circle at (x, y) with radius r overlap any building?
export function hitsBuilding(city, x, y, r) {
  for (const b of city.buildings) {
    if (circleHitsRect(x, y, r, b.x, b.y, b.w, b.h)) return b;
  }
  return null;
}

// Push a circle out of every building it overlaps. Returns true if it
// was pushed (a collision happened).
export function resolveBuildingCollision(city, pos, r) {
  let hit = false;
  for (const b of city.buildings) {
    const nx = Math.max(b.x, Math.min(pos.x, b.x + b.w));
    const ny = Math.max(b.y, Math.min(pos.y, b.y + b.h));
    const dx = pos.x - nx;
    const dy = pos.y - ny;
    const d2 = dx * dx + dy * dy;
    if (d2 < r * r && d2 > 0.0001) {
      const d = Math.sqrt(d2);
      pos.x = nx + (dx / d) * r;
      pos.y = ny + (dy / d) * r;
      hit = true;
    } else if (d2 <= 0.0001) {
      // Centre inside the building: push out along the smallest axis.
      const left = pos.x - b.x;
      const right = b.x + b.w - pos.x;
      const top = pos.y - b.y;
      const bottom = b.y + b.h - pos.y;
      const m = Math.min(left, right, top, bottom);
      if (m === left) pos.x = b.x - r;
      else if (m === right) pos.x = b.x + b.w + r;
      else if (m === top) pos.y = b.y - r;
      else pos.y = b.y + b.h + r;
      hit = true;
    }
  }
  return hit;
}

export function clampToWorld(city, pos, margin) {
  pos.x = Math.max(margin, Math.min(city.size - margin, pos.x));
  pos.y = Math.max(margin, Math.min(city.size - margin, pos.y));
}
