// Keyboard and mouse input, with edge-triggered "just pressed" keys.
export function createInput() {
  const keys = {};
  const pressed = {};
  const mouse = { x: 0, y: 0, clicked: false, down: false };
  function onKeyDown(e) {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
    if (!keys[e.key]) pressed[e.key] = true;
    keys[e.key] = true;
    // Also track lowercase letters for WASD.
    const k = e.key.toLowerCase();
    if (!keys[k]) pressed[k] = true;
    keys[k] = true;
  }
  function onKeyUp(e) {
    keys[e.key] = false;
    keys[e.key.toLowerCase()] = false;
  }
  function onMouseMove(e) { mouse.x = e.clientX; mouse.y = e.clientY; }
  function onMouseDown(e) { mouse.down = true; mouse.clicked = true; }
  function onMouseUp() { mouse.down = false; }
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);
  return {
    keys, pressed, mouse,
    // True while the key is held.
    down(k) { return !!keys[k]; },
    // True only on the frame the key was pressed.
    justPressed(k) { return !!pressed[k]; },
    // WASD + arrows as a movement vector.
    moveVector() {
      let x = 0, y = 0;
      if (keys['a'] || keys['ArrowLeft']) x -= 1;
      if (keys['d'] || keys['ArrowRight']) x += 1;
      if (keys['w'] || keys['ArrowUp']) y -= 1;
      if (keys['s'] || keys['ArrowDown']) y += 1;
      if (x !== 0 && y !== 0) { x *= 0.7071; y *= 0.7071; }
      return { x, y };
    },
    // Clear edge triggers at the end of each frame.
    endFrame() {
      for (const k of Object.keys(pressed)) pressed[k] = false;
      mouse.clicked = false;
    },
  };
}
