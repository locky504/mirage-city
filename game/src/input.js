// Keyboard + mouse input: one shared state object, edge-triggered "pressed"
// events for actions (enter car, steal, interact) and a drag accumulator
// for the third-person camera orbit.
export function createInput() {
  const input = {
    keys: new Set(),
    pressed: new Set(),   // keys pressed since last consume (edge trigger)
    mouseDX: 0,           // accumulated drag deltas, consumed each frame
    mouseDY: 0,
    mouseDown: false,
    clicked: false,       // left-click edge (shoot)
    dragging: false,
    lastX: 0,
    lastY: 0,
  };

  window.addEventListener('keydown', (e) => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    if (!e.repeat) input.pressed.add(e.code);
    input.keys.add(e.code);
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => input.keys.delete(e.code));
  window.addEventListener('blur', () => { input.keys.clear(); input.mouseDown = false; });

  window.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    input.mouseDown = true;
    input.dragging = true;
    input.lastX = e.clientX;
    input.lastY = e.clientY;
    input.clicked = true;
  });
  window.addEventListener('mouseup', (e) => {
    if (e.button !== 0) return;
    input.mouseDown = false;
    input.dragging = false;
  });
  window.addEventListener('mousemove', (e) => {
    if (!input.dragging) return;
    input.mouseDX += e.clientX - input.lastX;
    input.mouseDY += e.clientY - input.lastY;
    input.lastX = e.clientX;
    input.lastY = e.clientY;
  });

  return input;
}

export function wasPressed(input, code) {
  return input.pressed.has(code);
}

// Call once per frame after the game has read the input.
export function endFrameInput(input) {
  input.pressed.clear();
  input.mouseDX = 0;
  input.mouseDY = 0;
  input.clicked = false;
}

export function axis(input, negative, positive) {
  return (input.keys.has(positive) ? 1 : 0) - (input.keys.has(negative) ? 1 : 0);
}
