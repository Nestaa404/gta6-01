// The city of Solmara: a deterministic road grid, its blocks, buildings, parks,
// trees and named places. Built once from a seed; the world, the renderer and
// the minimap all read this one structure. Nothing here touches the canvas.
import { DISTRICTS, PALETTE, ROADS, WORLD } from './config.js';

const { avenues, streets, width: ROAD_W, sidewalk: WALK } = ROADS;

/** Named places the story and the missions point at. */
export const PLACES = {
  garage: { name: "Lena's Garage", x: 1200, y: 650, label: 'Garage' },
  docks: { name: 'Solmara Docks', x: 3300, y: 1050, label: 'Docks' },
  club: { name: 'Club Mirada', x: 2100, y: 1050, label: 'Club' },
  warehouse: { name: 'Kade Warehouse', x: 750, y: 250, label: 'Warehouse' },
  safehouse: { name: 'Safehouse', x: 300, y: 2250, label: 'Safehouse' },
  marina: { name: 'Marina Tower', x: 3300, y: 650, label: 'Marina' },
  hospital: { name: 'Solmara General', x: 1650, y: 1850, label: 'Hospital' },
  beach: { name: 'Playa Sol', x: 1800, y: 2620, label: 'Beach' },
  plaza: { name: 'Plaza Mayor', x: 1650, y: 1050, label: 'Plaza' },
};

function districtAt(x, y) {
  const d = DISTRICTS;
  if (y >= d.beachY) return 'beach';
  if (x >= d.downtown.x0 && x <= d.downtown.x1 && y >= d.downtown.y0 && y <= d.downtown.y1) return 'downtown';
  if (x >= d.marina.x0 && y <= d.marina.y1) return 'marina';
  if (x <= d.industrial.x1 && y <= d.industrial.y1) return 'industrial';
  return 'residential';
}

/** The district name the HUD shows for a world position. */
export function districtNameAt(x, y) {
  const key = districtAt(x, y);
  if (key === 'beach') return DISTRICTS.beach.name;
  if (key === 'residential') return DISTRICTS.residential.name;
  return DISTRICTS[key].name;
}

function onRoad(x, y, pad) {
  const p = pad ?? 0;
  for (const ax of avenues) if (Math.abs(x - ax) < ROAD_W / 2 + p) return true;
  for (const sy of streets) if (Math.abs(y - sy) < ROAD_W / 2 + p) return true;
  return false;
}

function nearestRoadPoint(x, y) {
  let best = null;
  let bestDist = Infinity;
  for (const ax of avenues) {
    const d = Math.abs(x - ax);
    if (d < bestDist) { bestDist = d; best = { x: ax, y, vertical: true }; }
  }
  for (const sy of streets) {
    const d = Math.abs(y - sy);
    if (d < bestDist) { bestDist = d; best = { x, y: sy, vertical: false }; }
  }
  return best;
}

export function createCity(random) {
  const buildings = [];
  const trees = [];
  const parks = [];
  const lots = [];
  const containers = [];
  const umbrellas = [];

  // One block sits between two neighbouring avenues and two streets.
  for (let ai = 0; ai < avenues.length - 1; ai += 1) {
    for (let si = 0; si < streets.length - 1; si += 1) {
      const x0 = avenues[ai] + ROAD_W / 2 + WALK;
      const x1 = avenues[ai + 1] - ROAD_W / 2 - WALK;
      const y0 = streets[si] + ROAD_W / 2 + WALK;
      const y1 = streets[si + 1] - ROAD_W / 2 - WALK;
      const cx = (x0 + x1) / 2;
      const cy = (y0 + y1) / 2;
      const district = districtAt(cx, cy);
      if (district === 'beach') continue;
      const roll = random();
      if (roll < 0.16) {
        // A park: grass, trees, a path. Parks also break up the downtown grid
        // so the minimap reads as a city, not a chessboard.
        parks.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
        const count = random.int(6, 10);
        for (let i = 0; i < count; i += 1) {
          trees.push({ x: random.range(x0 + 20, x1 - 20), y: random.range(y0 + 20, y1 - 20), r: random.range(10, 16) });
        }
        continue;
      }
      if (roll < 0.26) {
        // A parking lot with a few parked cars' painted bays.
        lots.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
        continue;
      }
      if (district === 'industrial' && roll < 0.42) {
        // The docks quarter: stacked shipping containers instead of buildings.
        const n = random.int(3, 5);
        for (let i = 0; i < n; i += 1) {
          containers.push({
            x: random.range(x0 + 10, x1 - 90), y: random.range(y0 + 10, y1 - 50),
            w: random.range(70, 110), h: 34,
            color: random.pick(['#b8574e', '#3d7bd9', '#e8c33d', '#7fb069']),
          });
        }
        continue;
      }
      const tall = district === 'downtown';
      const n = tall ? random.int(1, 2) : random.int(2, 4);
      const bw = (x1 - x0) / (n === 1 ? 1 : 2);
      const bh = (y1 - y0) / (n <= 2 ? 1 : 2);
      for (let i = 0; i < n; i += 1) {
        const col = i % 2;
        const row = Math.floor(i / 2);
        const bx = x0 + col * bw + 14;
        const by = y0 + row * bh + 14;
        const w = bw - 28;
        const h = bh - 28;
        if (w < 40 || h < 40) continue;
        const height = tall ? random.range(46, 110) : random.range(14, 42);
        buildings.push({
          x: bx, y: by, w, h, height,
          roof: random.pick(PALETTE.buildingRoof),
          glass: tall && random.chance(0.6),
          district,
        });
      }
      // A tree or two on the block's corners.
      if (random.chance(0.6)) {
        trees.push({ x: x0 + 16, y: y0 + 16, r: random.range(9, 13) });
        trees.push({ x: x1 - 16, y: y1 - 16, r: random.range(9, 13) });
      }
    }
  }

  // Palm trees and umbrellas along the beach promenade.
  for (let x = 200; x < WORLD.width; x += 130) {
    trees.push({ x: x + random.range(-20, 20), y: DISTRICTS.beachY - 60, r: random.range(11, 15), palm: true });
    if (random.chance(0.55)) {
      umbrellas.push({
        x: x + random.range(-30, 30), y: DISTRICTS.beachY + random.range(70, 160),
        color: random.pick(['#d94f3d', '#e8c33d', '#3d7bd9', '#f4f1e8']),
      });
    }
  }

  function collidesBuilding(x, y, radius) {
    for (const b of buildings) {
      if (x + radius > b.x && x - radius < b.x + b.w && y + radius > b.y && y - radius < b.y + b.h) return b;
    }
    for (const c of containers) {
      if (x + radius > c.x && x - radius < c.x + c.w && y + radius > c.y && y - radius < c.y + c.h) return c;
    }
    return null;
  }

  /** Push a circle out of every building it overlaps; returns true on a hit. */
  function resolveCircle(pos, radius) {
    let hit = false;
    const solids = buildings.concat(containers);
    for (const b of solids) {
      const cx = Math.max(b.x, Math.min(pos.x, b.x + b.w));
      const cy = Math.max(b.y, Math.min(pos.y, b.y + b.h));
      const dx = pos.x - cx;
      const dy = pos.y - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 < radius * radius) {
        hit = true;
        if (d2 > 0.01) {
          const d = Math.sqrt(d2);
          pos.x = cx + (dx / d) * radius;
          pos.y = cy + (dy / d) * radius;
        } else {
          pos.x = b.x - radius;
        }
      }
    }
    return hit;
  }

  /** A random point on a road, for spawning traffic and parked cars. */
  function randomRoadPoint() {
    if (random.chance(0.5)) {
      const ax = random.pick(avenues);
      return { x: ax + random.range(-ROAD_W / 4, ROAD_W / 4), y: random.range(120, WORLD.height - 160), vertical: true };
    }
    const sy = random.pick(streets);
    return { x: random.range(120, WORLD.width - 120), y: sy + random.range(-ROAD_W / 4, ROAD_W / 4), vertical: false };
  }

  /** A random sidewalk point, for spawning pedestrians. */
  function randomWalkPoint() {
    const p = randomRoadPoint();
    const off = ROAD_W / 2 + WALK / 2 + random.range(-6, 6);
    if (p.vertical) return { x: p.x + (random.chance(0.5) ? off : -off), y: p.y };
    return { x: p.x, y: p.y + (random.chance(0.5) ? off : -off) };
  }

  return {
    buildings, trees, parks, lots, containers, umbrellas,
    districtAt, districtNameAt, onRoad, nearestRoadPoint, collidesBuilding, resolveCircle,
    randomRoadPoint, randomWalkPoint,
  };
}
