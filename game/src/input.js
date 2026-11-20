// Solmara — keyboard and mouse input. Tracks held keys by their
// physical code (so WASD works on any layout), mouse position in
// screen space, and edge-triggered presses the game loop consumes
// once per frame.

export function createInput(canvas) {
  const input = {
    keys: new Set(),
    pressed: new Set(),
    mouseX: 0,
    mouseY: 0,
    mouseDown: false,
    mouseClicked: false,

    isDown(code) {
      return this.keys.has(code);
    },

    // True only on the frame the key went down; consumed by the game.
    wasPressed(code) {
      return this.pressed.has(code);
    },

    axis(positive, negative) {
      let v = 0;
      if (this.keys.has(positive)) v += 1;
      if (this.keys.has(negative)) v -= 1;
      return v;
    },

    endFrame() {
      this.pressed.clear();
      this.mouseClicked = false;
    },
  };

  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    input.keys.add(e.code);
    input.pressed.add(e.code);
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
      e.preventDefault();
    }
  });
  window.addEventListener('keyup', (e) => input.keys.delete(e.code));
  window.addEventListener('blur', () => input.keys.clear());

  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    input.mouseX = e.clientX - rect.left;
    input.mouseY = e.clientY - rect.top;
  });
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) {
      input.mouseDown = true;
      input.mouseClicked = true;
    }
  });
  window.addEventListener('mouseup', () => { input.mouseDown = false; });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  return input;
}

// The controls the title screen and pause menu show.
export const CONTROLS = [
  ['W A S D / Arrows', 'Move / drive'],
  ['Shift', 'Run'],
  ['E', 'Enter / exit car'],
  ['Mouse + Click / F', 'Aim and shoot'],
  ['Space', 'Handbrake'],
  ['P / Esc', 'Pause'],
  ['M', 'Mute sound'],
  ['R', 'Restart after busted / wasted'],
];
