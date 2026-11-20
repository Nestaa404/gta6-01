// The story of Solmara and its missions. Marco Solis, a wheelman for hire, takes
// jobs from Lena Voss while Silas Kade's syndicate squeezes the city. Each
// mission is a list of steps; the mission manager runs one at a time, tracks its
// objective marker and pays out on completion. Nothing here draws or listens.
import { MONEY } from './config.js';
import { PLACES } from './city.js';

export const STORY = {
  hero: 'Marco Solis',
  fixer: 'Lena Voss',
  villain: 'Silas Kade',
  city: 'Solmara',
  intro: 'Solmara — sun, sea, and Silas Kade owning every street. Lena Voss needs a wheelman. That is you.',
};

/** How many missions the story holds; the HUD and the end screen read this. */
export const MISSION_COUNT = 5;

function stepGoto(place, label, hint) {
  return { type: 'goto', x: place.x, y: place.y, label, hint: hint ?? `Head to ${place.name}.` };
}

export const MISSIONS = [
  {
    id: 'first-wheels',
    title: '1 · First Wheels',
    brief: 'Lena: "Borrow a car — any car — and bring it to my garage. Try not to make it a thing."',
    reward: MONEY.missionReward[0],
    steps: [
      { type: 'steal', label: 'Steal a car', hint: 'Walk up to a parked or stopped car and press E.' },
      stepGoto(PLACES.garage, "Drive to Lena's Garage", 'Drive the car to the yellow marker.'),
    ],
  },
  {
    id: 'the-pickup',
    title: '2 · The Pickup',
    brief: 'Lena: "A package is waiting at the docks. Collect it, drop it at Club Mirada. Kade\'s boys watch the docks — keep it quiet."',
    reward: MONEY.missionReward[1],
    steps: [
      stepGoto(PLACES.docks, 'Collect the package at the docks'),
      { type: 'collect', x: PLACES.docks.x, y: PLACES.docks.y, label: 'Pick up the package', hint: 'Walk into the glowing crate.' },
      stepGoto(PLACES.club, 'Deliver to Club Mirada'),
    ],
  },
  {
    id: 'payback',
    title: '3 · Payback',
    brief: 'Lena: "Kade torched my cousin\'s shop. His crew is holed up in the warehouse. Go remind them who runs these streets."',
    reward: MONEY.missionReward[2],
    steps: [
      stepGoto(PLACES.warehouse, 'Reach the Kade warehouse'),
      { type: 'fight', x: PLACES.warehouse.x, y: PLACES.warehouse.y, count: 4, label: "Deal with Kade's crew (0/4)", hint: 'Aim with the mouse, click to shoot, F to punch.' },
      stepGoto(PLACES.safehouse, 'Lay low at the safehouse'),
    ],
  },
  {
    id: 'the-getaway',
    title: '4 · The Getaway',
    brief: 'Lena: "The cops are onto the drop. Grab the car, lose the heat, and get to the safehouse before they box you in."',
    reward: MONEY.missionReward[3],
    wantedOnStart: 2,
    steps: [
      { type: 'steal', label: 'Steal a getaway car', hint: 'Any car will do. Press E beside one.' },
      { type: 'evade', label: 'Lose the cops — get your wanted level to zero', hint: 'Outrun them, then lie low out of sight until the stars fade.' },
      stepGoto(PLACES.safehouse, 'Reach the safehouse', 'The heat is off. Now slip away quietly.'),
    ],
  },
  {
    id: 'king-of-solmara',
    title: '5 · King of Solmara',
    brief: 'Lena: "It ends tonight. Kade is at Marina Tower with his whole crew. Take the tower, take the city."',
    reward: MONEY.missionReward[4],
    steps: [
      stepGoto(PLACES.marina, 'Reach Marina Tower'),
      { type: 'fight', x: PLACES.marina.x, y: PLACES.marina.y, count: 6, label: "Take down Kade's crew (0/6)", hint: 'Use cover. Health kits glow green.' },
      { type: 'fight', x: PLACES.marina.x, y: PLACES.marina.y + 60, count: 1, boss: true, label: 'Face Silas Kade', hint: 'Kade hits hard. Keep moving.' },
      stepGoto(PLACES.plaza, 'Walk free through Plaza Mayor'),
    ],
  },
];

export function createMissionManager() {
  const state = {
    index: 0,
    step: 0,
    active: false,
    done: false,
    kills: 0,
    banner: '',
    bannerTimer: 0,
    startedAt: 0,
  };

  function current() {
    return state.index < MISSIONS.length ? MISSIONS[state.index] : null;
  }

  function currentStep() {
    const m = current();
    return m ? m.steps[state.step] ?? null : null;
  }

  function start(index) {
    state.index = index;
    state.step = 0;
    state.active = true;
    state.done = false;
    state.kills = 0;
    const m = current();
    if (m) {
      state.banner = m.title;
      state.bannerTimer = 3.2;
    }
    return current();
  }

  function advance() {
    state.step += 1;
    state.kills = 0;
    const m = current();
    if (!m || state.step >= m.steps.length) {
      state.active = false;
      state.done = true;
      return null;
    }
    return currentStep();
  }

  /** Mark one kill on a fight step; returns true when the step is cleared. */
  function registerKill() {
    const s = currentStep();
    if (!s || s.type !== 'fight') return false;
    state.kills += 1;
    if (state.kills >= s.count) {
      advance();
      return true;
    }
    return false;
  }

  function complete() {
    const m = current();
    state.active = false;
    state.done = true;
    state.banner = `Mission complete — $${m ? m.reward : 0}`;
    state.bannerTimer = 3.5;
    state.index += 1;
    state.step = 0;
    state.kills = 0;
  }

  function objectiveLabel() {
    const s = currentStep();
    if (!s) return state.index >= MISSIONS.length ? 'All missions complete — Solmara is yours.' : '';
    if (s.type === 'fight') return s.label.replace(/\(\d+\/\d+\)/, `(${state.kills}/${s.count})`);
    return s.label;
  }

  function objectiveTarget() {
    const s = currentStep();
    if (!s) return null;
    if (s.type === 'steal' || s.type === 'evade') return null;
    return { x: s.x, y: s.y };
  }

  return {
    state, current, currentStep, start, advance, registerKill, complete,
    objectiveLabel, objectiveTarget,
  };
}
