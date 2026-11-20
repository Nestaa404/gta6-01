// Keyboard and mouse input for Solmara. Held keys give movement and steering;
// one-shot presses (enter car, switch weapon, pause, confirm) are queued as bit
// flags and taken once by the loop, so a press between two frames is never lost.
// The mouse aims on foot: the game reads its screen position each frame.
// Space doubles as the handbrake while driving and as confirm on the menus.
import { VIEW } from './config.js';

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER_CAR = 4;
export const ACTION_WEAPON = 8;
export const ACTION_MUTE = 16;
export const ACTION_SAVE = 32;
export const ACTION_CONTINUE = 64;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const RUN = new Set(['ShiftLeft', 'ShiftRight']);
const HANDBRAKE = new Set(['Space']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const ENTER_CAR = new Set(['KeyE']);
const WEAPON = new Set(['KeyQ', 'Digit1', 'Digit2', 'Digit3']);
const MUTE = new Set(['KeyM']);
const SAVE = new Set(['KeyF']);
const CONTINUE = new Set(['KeyC']);

export function createInput(canvas) {
  const keys = { up: false, down: false, left: false, right: false, run: false, handbrake: false };
  let actions = 0;
  let mouse = { x: VIEW.width / 2, y: VIEW.height / 2, down: false, pressed: false };

  function setKey(code, value) {
    if (UP.has(code)) keys.up = value;
    else if (DOWN.has(code)) keys.down = value;
    else if (LEFT.has(code)) keys.left = value;
    else if (RIGHT.has(code)) keys.right = value;
    else if (RUN.has(code)) keys.run = value;
    else if (HANDBRAKE.has(code)) keys.handbrake = value;
  }

  window.addEventListener('keydown', (event) => {
    if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (ENTER_CAR.has(event.code)) {
      if (!event.repeat) actions |= ACTION_ENTER_CAR;
    } else if (WEAPON.has(event.code)) {
      if (!event.repeat) actions |= ACTION_WEAPON;
    } else if (MUTE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_MUTE;
    } else if (SAVE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_SAVE;
    } else if (CONTINUE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONTINUE;
    } else {
      setKey(event.code, true);
      return;
    }
    setKey(event.code, true);
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => setKey(event.code, false));
  window.addEventListener('blur', () => {
    keys.up = keys.down = keys.left = keys.right = keys.run = keys.handbrake = false;
    mouse.down = false;
  });

  canvas.addEventListener('pointermove', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * VIEW.width;
    mouse.y = ((event.clientY - rect.top) / rect.height) * VIEW.height;
  });
  canvas.addEventListener('pointerdown', (event) => {
    mouse.down = true;
    mouse.pressed = true;
    const rect = canvas.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * VIEW.width;
    mouse.y = ((event.clientY - rect.top) / rect.height) * VIEW.height;
    event.preventDefault();
  });
  window.addEventListener('pointerup', () => { mouse.down = false; });

  return {
    keys,
    /** The mouse position in the 1280x720 view, and whether it is held. */
    mouse() { return mouse; },
    /** True once for each press since the last call. */
    mousePressed() {
      const p = mouse.pressed;
      mouse.pressed = false;
      return p;
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
