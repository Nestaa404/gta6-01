// Boot and the one loop for Solmara: input is read every frame, the world
// advances in fixed 1/60 s steps, the renderer paints what is there. The game
// moves between title, play, paused, help, busted, wasted and end screens.
//
// ?seed=N fixes the city and the traffic. ?shot=start|play|chase|mission (with
// &seed=N) stages that scene instead of running the loop, paints it twice and
// sets window.__shotReady for a screenshot.
import { STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_BUSTED, EVENT_CRIME, EVENT_MISSION_DONE, EVENT_PICKUP, EVENT_PUNCH, EVENT_SHOT, EVENT_SKID, EVENT_WASTED } from './world.js';
import { ACTION_CONFIRM, ACTION_CONTINUE, ACTION_ENTER_CAR, ACTION_MUTE, ACTION_PAUSE, ACTION_SAVE, ACTION_WEAPON, createInput } from './input.js';
import { createRenderer, SCREEN_BUSTED, SCREEN_END, SCREEN_HELP, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WASTED } from './render.js';
import { createAudio } from './audio.js';
import { clearSave, loadSave, readBestMoney, storeBestMoney, storeSave } from './save.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall is dropped. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

function runShot(name) {
  const scene = stageShot(name, world);
  const ui = { hasSave: false, best: scene.best, mouse: { x: 640, y: 360 } };
  let painted = 0;
  function paint() {
    renderer.draw(world.state, world.city, world.missions, scene.screen, ui);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBestMoney();
  let save = loadSave();
  let accumulator = 0;
  let last = performance.now();

  function announce(message) {
    status.textContent = message;
  }

  function saveGame() {
    const data = world.toSave();
    if (storeSave(data)) {
      world.showMessage('Progress saved.');
      announce('Progress saved.');
    } else {
      world.showMessage('Could not save in this browser.');
    }
  }

  function startGame(fresh) {
    audio.unlock();
    if (fresh) {
      clearSave();
      save = null;
      world.reset();
    } else if (save) {
      world.loadSave(save);
    } else {
      world.reset();
    }
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce('Playing Solmara. Follow the yellow marker.');
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      audio.setMuted(!audio.isMuted());
      world.showMessage(audio.isMuted() ? 'Sound off (M to turn on)' : 'Sound on');
    }
    if (screen === SCREEN_TITLE) {
      if (actions & ACTION_CONFIRM) startGame(true);
      else if (actions & ACTION_CONTINUE) {
        // C loads the save when there is one.
        if (save) startGame(false);
      }
      return;
    }
    if (screen === SCREEN_BUSTED || screen === SCREEN_WASTED || screen === SCREEN_END) {
      if (actions & ACTION_CONFIRM) {
        world.reset();
        screen = SCREEN_PLAY;
      }
      return;
    }
    if (screen === SCREEN_PAUSED) {
      if (actions & ACTION_PAUSE || actions & ACTION_CONFIRM) screen = SCREEN_PLAY;
      else if (actions & ACTION_SAVE) saveGame();
      return;
    }
    if (screen === SCREEN_HELP) {
      if (actions & ACTION_PAUSE || actions & ACTION_CONFIRM) screen = SCREEN_PAUSED;
      return;
    }
    // SCREEN_PLAY
    if (actions & ACTION_PAUSE) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & ACTION_SAVE) {
      saveGame();
    } else if (actions & ACTION_ENTER_CAR) {
      const result = world.enterExitCar();
      if (result === 'enter') audio.click();
    } else if (actions & ACTION_WEAPON) {
      world.switchWeapon();
      audio.click();
    }
  }

  function aimAngle() {
    const p = world.player;
    const mouse = input.mouse();
    // Mouse is already in 1280x720 view space; the camera centres on the
    // player, clamped to the city, so invert that transform to reach the world.
    const camX = Math.max(0, Math.min(3600 - 1280, p.x - 640));
    const camY = Math.max(0, Math.min(2800 - 720, p.y - 360));
    return Math.atan2(camY + mouse.y - p.y, camX + mouse.x - p.x);
  }

  function step() {
    const keys = input.keys;
    const mouse = input.mouse();
    if (screen === SCREEN_TITLE) {
      world.step(STEP, { up: false, down: false, left: false, right: false, run: false, handbrake: false });
      return;
    }
    if (screen !== SCREEN_PLAY) return;
    const p = world.player;
    if (!p.inCar) p.angle = aimAngle();
    if (mouse.down && !p.inCar) world.playerAttack(p.angle);
    const events = world.step(STEP, keys);
    if (events & EVENT_SHOT) audio.shoot();
    if (events & EVENT_PUNCH) audio.punch();
    if (events & EVENT_PICKUP) audio.pickup();
    if (events & EVENT_CRIME) audio.crime();
    if (events & EVENT_SKID) audio.skid();
    if (events & EVENT_MISSION_DONE) {
      audio.mission();
      storeBestMoney(p.money);
      best = readBestMoney();
      if (world.missions.state.index >= 5) screen = SCREEN_END;
    }
    if (events & EVENT_BUSTED) {
      audio.busted();
      screen = SCREEN_BUSTED;
      announce('Busted. Press Enter to continue.');
    } else if (events & EVENT_WASTED) {
      audio.busted();
      screen = SCREEN_WASTED;
      announce('Wasted. Press Enter to continue.');
    }
    audio.update(world.player.inCar ? Math.abs(world.player.inCar.speed) : 0, world.state.wanted, world.state.elapsed);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, world.city, world.missions, screen, { hasSave: !!save, best, mouse: input.mouse() });
  }

  // Leaving the tab pauses a running game rather than letting the city run on.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  // H shows the how-to-play screen from the pause menu.
  window.addEventListener('keydown', (event) => {
    if (event.code === 'KeyH' && screen === SCREEN_PAUSED) screen = SCREEN_HELP;
  });

  announce('Solmara. Press Enter to start the story, C to continue.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
