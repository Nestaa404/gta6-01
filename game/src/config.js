// Solmara — an original open-world crime game. Every tuning number and colour
// lives here. The world is a fixed 3600x2800 pixel city; the renderer shows a
// 1280x720 window of it through a camera that follows the player.

export const VIEW = { width: 1280, height: 720 };

export const WORLD = { width: 3600, height: 2800 };

/** The simulation's fixed step, in seconds: 60 updates a second. */
export const STEP = 1 / 60;

/** Road grid: avenues run north-south, streets east-west. */
export const ROADS = {
  width: 92,
  sidewalk: 26,
  avenues: [300, 750, 1200, 1650, 2100, 2550, 3000, 3450],
  streets: [250, 650, 1050, 1450, 1850, 2250, 2650],
};

/** Districts, by block position. The beach is the whole southern strip. */
export const DISTRICTS = {
  downtown: { x0: 1000, x1: 2300, y0: 400, y1: 1600 },
  marina: { x0: 2900, x1: 3600, y0: 400, y1: 2000 },
  industrial: { x0: 0, x1: 900, y0: 0, y1: 900 },
  beachY: 2450,
};

export const PLAYER = {
  radius: 14,
  walkSpeed: 230,
  runSpeed: 330,
  health: 100,
  punchDamage: 25,
  punchRange: 46,
  punchCooldown: 0.38,
};

export const CAR = {
  length: 64,
  width: 30,
  accel: 430,
  brake: 640,
  reverseAccel: 260,
  maxSpeed: 560,
  maxReverse: 180,
  steer: 2.7,
  grip: 3.4,
  stealWanted: 1,
};

export const TRAFFIC = { count: 28, speed: 150, speedJitter: 60 };
export const PEDS = { count: 36, speed: 62, speedJitter: 26 };

export const POLICE = {
  maxCars: 6,
  carSpeed: 540,
  footSpeed: 268,
  arrestRange: 48,
  arrestTime: 2.2,
  spawnInterval: 4,
};

/** Wanted stars 0..5. Crimes add heat; heat fades when the player lies low. */
export const WANTED = {
  max: 5,
  decaySeconds: 26,
  copSightRange: 640,
  crime: { steal: 1, hitPed: 1, shoot: 1, killPed: 2, killCop: 2 },
};

export const WEAPONS = {
  fists: { name: 'Fists', damage: 25, range: 46, cooldown: 0.38, ammo: Infinity },
  pistol: { name: 'Pistol', damage: 34, range: 540, cooldown: 0.24, ammo: 120 },
  shotgun: { name: 'Shotgun', damage: 90, range: 320, cooldown: 0.85, ammo: 24 },
};

export const MONEY = { start: 250, missionReward: [600, 900, 1400, 1800, 3000] };

export const PALETTE = {
  grass: '#7fae5a',
  grassDark: '#6f9c4e',
  sand: '#e8d39a',
  sea: '#2e9db4',
  seaDeep: '#1f7f9c',
  road: '#3d3a38',
  roadEdge: '#2c2a29',
  lane: '#e8d44d',
  sidewalk: '#b9b2a4',
  buildingRoof: ['#c96f4a', '#d99a5b', '#8fa3b8', '#b8574e', '#6b8f71', '#a08bb5', '#c9b458'],
  buildingSide: '#00000033',
  downtownGlass: '#5f7f9e',
  park: '#5d9b4a',
  tree: '#3f7d33',
  treeDark: '#356b2b',
  player: '#f2c94c',
  playerShirt: '#2f6fb2',
  cop: '#2b4c8c',
  copCar: '#e8e8e8',
  hudPanel: '#101418cc',
  hudText: '#f4f1e8',
  hudMuted: '#c9c2b2',
  star: '#ffd23f',
  starEmpty: '#5a5548',
  marker: '#ff5a3c',
  objective: '#ffd23f',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the save lives (this browser only). */
export const SAVE_KEY = 'solmara.save.v1';
export const BEST_KEY = 'solmara.best.v1';
