// Solmara — configuration for the open-world crime game.
// Every tuning number the game uses lives here so the other modules
// stay free of magic constants. All names, places and story are original.

export const CFG = {
  // World size in pixels. The city is a road grid with a beach on its
  // south edge and a marina on its east edge.
  worldSize: 3200,
  roadSpacing: 400,
  roadWidth: 96,
  sidewalk: 14,

  // Player on foot.
  walkSpeed: 170,
  runSpeed: 265,
  playerRadius: 13,
  playerHealth: 100,

  // Driving.
  carLength: 52,
  carWidth: 26,
  carAccel: 520,
  carBrake: 700,
  carReverseMax: 150,
  carMaxSpeed: 460,
  carTurnRate: 2.6,
  carGrip: 0.92,

  // Traffic.
  trafficCount: 26,
  trafficSpeedMin: 110,
  trafficSpeedMax: 190,
  pedCount: 34,

  // Police and wanted.
  maxWanted: 5,
  policeCarSpeed: 470,
  policeFootSpeed: 205,
  // Seconds the player must stay unseen by police to lose one star.
  wantedCoolDown: 14,
  bustHoldSeconds: 1.4,

  // Combat.
  bulletSpeed: 780,
  bulletRange: 520,
  shootCooldown: 0.22,
  gunDamage: 34,

  // Camera and view.
  viewWidth: 1280,
  viewHeight: 720,
  minimapSize: 190,

  // Save slot.
  saveKey: 'solmara-save-v1',
};

// Palette for the sun-soaked coastal city. Warm asphalt, pale sand,
// terracotta roofs and turquoise water.
export const PALETTE = {
  grass: '#7fae62',
  grassDry: '#93bd6d',
  sand: '#e8d39a',
  water: '#2f9db4',
  waterDeep: '#1f7f9c',
  road: '#3d3d46',
  roadLine: '#e8d44f',
  sidewalk: '#b9b3a4',
  buildingRoof: ['#c96f4a', '#d99a5b', '#b8574f', '#8fa8bf', '#a8825f', '#7d8f6a'],
  buildingEdge: '#00000033',
  park: '#5d9b4a',
  tree: '#2f6b2e',
  treeLight: '#4c8f3d',
};

export const CAR_COLORS = [
  '#d94f3d', '#3d7bd9', '#e8c832', '#e8e8e8', '#2b2b33',
  '#7ec8c0', '#c07ec8', '#e88a2e', '#4f9d4f', '#8a5a2e',
];

export const PED_COLORS = [
  '#e8b88a', '#c98d5f', '#8a5a3b', '#f0c8a0', '#6b4a2f', '#d9a06b',
];

export const SHIRT_COLORS = [
  '#e84a5f', '#3d7bd9', '#f2e6c9', '#4f9d4f', '#8a5fc0',
  '#e8c832', '#2b2b33', '#c07ec8', '#7ec8c0', '#e88a2e',
];
