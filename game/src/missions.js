// Solmara — the story. Four missions, each a short chain of steps
// (go somewhere, drive somewhere, pick something up, lose the cops),
// told through a contact named Rico and the player's own rise from
// wheelman to the crew's driver. Completing one pays out, unlocks the
// next, and saves the game.

import { CFG } from './config.js';
import { dist } from './util.js';

export const MISSION_DEFS = [
  {
    id: 'first-wheels',
    title: 'First Wheels',
    giver: 'Rico',
    reward: 150,
    brief: 'Rico needs a driver. Grab any car on the street and bring it to the Marina. Walk up to a car and press E.',
    steps: [
      { type: 'getCar', text: 'Steal a car (walk up to one and press E)' },
      { type: 'goto', x: null, y: null, place: 'marina', radius: 90, text: 'Drive to the Marina' },
    ],
  },
  {
    id: 'sunset-delivery',
    title: 'Sunset Delivery',
    giver: 'Rico',
    reward: 300,
    brief: 'A package for the Warehouse, and the buyer does not wait. Drive it across town before the timer runs out — and try not to scratch the paint.',
    timeLimit: 75,
    steps: [
      { type: 'getCar', text: 'Get a car first' },
      { type: 'goto', x: null, y: null, place: 'warehouse', radius: 90, text: 'Deliver the package to the Warehouse', timed: true },
    ],
  },
  {
    id: 'hot-pursuit',
    title: 'Hot Pursuit',
    giver: 'Rico',
    reward: 450,
    brief: 'The cops saw the drop. Lose them — get your wanted level back to zero, then slip home to the Safehouse. Do not get caught.',
    steps: [
      { type: 'wanted', text: 'You are wanted — lose the cops (wanted level must hit 0)' },
      { type: 'goto', x: null, y: null, place: 'safehouse', radius: 90, text: 'Reach the Safehouse' },
    ],
  },
  {
    id: 'marina-job',
    title: 'The Marina Job',
    giver: 'Rico',
    reward: 800,
    brief: 'One last job: the case is waiting on foot at the Marina. Park, grab it, and bring it home to the Safehouse. The whole town will be watching.',
    steps: [
      { type: 'goto', x: null, y: null, place: 'marina', radius: 80, text: 'Go to the Marina on foot', onFoot: true },
      { type: 'grab', x: null, y: null, place: 'marina', radius: 46, text: 'Grab the case (walk over it)' },
      { type: 'goto', x: null, y: null, place: 'safehouse', radius: 90, text: 'Bring the case to the Safehouse' },
    ],
  },
];

export function createMissions(city) {
  // Resolve each step's place name into concrete coordinates.
  const defs = MISSION_DEFS.map((def) => ({
    ...def,
    steps: def.steps.map((s) => {
      if (s.place && city.places[s.place]) {
        return { ...s, x: city.places[s.place].x, y: city.places[s.place].y };
      }
      return { ...s };
    }),
  }));
  return {
    defs,
    activeIndex: -1, // -1: none started; otherwise index into defs
    stepIndex: 0,
    timer: 0,
    completed: [], // ids of finished missions
    banner: null, // { text, until } transient message
    failed: null,
  };
}

export function startMission(missions, index) {
  const def = missions.defs[index];
  if (!def) return null;
  missions.activeIndex = index;
  missions.stepIndex = 0;
  missions.timer = def.timeLimit || 0;
  missions.failed = null;
  return def;
}

export function currentMission(missions) {
  if (missions.activeIndex < 0) return null;
  return missions.defs[missions.activeIndex];
}

export function currentStep(missions) {
  const def = currentMission(missions);
  if (!def) return null;
  return def.steps[missions.stepIndex] || null;
}

export function currentObjective(missions) {
  const def = currentMission(missions);
  if (!def) return null;
  const step = currentStep(missions);
  if (!step) return null;
  return { mission: def, step, timer: missions.timer };
}

// Advance the mission state machine. Returns an event string:
// 'step' when a step completes, 'done' when the mission ends,
// 'failed' when a timer runs out, or null.
export function updateMissions(missions, dt, game) {
  const def = currentMission(missions);
  if (!def) return null;
  const step = currentStep(missions);
  if (!step) return null;

  const player = game.player;
  const px = player.inCar ? player.inCar.x : player.x;
  const py = player.inCar ? player.inCar.y : player.y;

  if (def.timeLimit) {
    missions.timer -= dt;
    if (missions.timer <= 0) {
      missions.failed = 'Out of time — the buyer walked away.';
      missions.activeIndex = -1;
      return 'failed';
    }
  }

  let done = false;
  if (step.type === 'getCar') {
    done = !!player.inCar;
  } else if (step.type === 'goto' || step.type === 'grab') {
    if (step.onFoot && player.inCar) done = false;
    else done = dist(px, py, step.x, step.y) < step.radius;
  } else if (step.type === 'wanted') {
    done = game.police.wanted === 0;
  }

  if (!done) return null;

  missions.stepIndex += 1;
  if (missions.stepIndex >= def.steps.length) {
    missions.completed.push(def.id);
    missions.activeIndex = -1;
    missions.stepIndex = 0;
    player.money += def.reward;
    missions.banner = { text: `Mission complete: ${def.title}  +$${def.reward}`, until: game.time + 4 };
    return 'done';
  }
  missions.banner = { text: `Next: ${def.steps[missions.stepIndex].text}`, until: game.time + 3.5 };
  return 'step';
}

// The next mission the player has not finished yet.
export function nextMissionIndex(missions) {
  for (let i = 0; i < missions.defs.length; i++) {
    if (!missions.completed.includes(missions.defs[i].id)) return i;
  }
  return -1;
}

// Where the current objective marker sits, for the HUD and minimap.
export function objectivePoint(missions) {
  const step = currentStep(missions);
  if (!step || step.x === undefined || step.x === null) return null;
  return { x: step.x, y: step.y, radius: step.radius || 80 };
}
