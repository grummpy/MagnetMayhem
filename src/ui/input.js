/** DOM keyboard + Gamepad API polling. Hot-plug is just the next poll. */

import { actionsFromKeys, resolvePlayerActions } from '../core/inputmap.js';

const BLOCKED = new Set([
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab',
]);

function shouldPrevent(code) {
  return BLOCKED.has(code) || code.startsWith('Numpad');
}

function snapshotPad(pad) {
  if (!pad || !pad.connected) return null;
  return {
    connected: true,
    axes: [pad.axes[0] || 0, pad.axes[1] || 0, pad.axes[2] || 0, pad.axes[3] || 0],
    buttons: Array.from(pad.buttons || [], (button) => ({
      pressed: !!(button && button.pressed),
      value: button ? button.value || 0 : 0,
    })),
  };
}

export function createInput(getBindings) {
  const down = new Set();
  const pressed = new Set();

  const onKeyDown = (event) => {
    if (shouldPrevent(event.code)) event.preventDefault();
    if (!down.has(event.code)) pressed.add(event.code);
    down.add(event.code);
  };
  const onKeyUp = (event) => {
    down.delete(event.code);
  };
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', () => down.clear());

  // Touch the connection events so a pad that arrives mid-frame is queried on the next poll.
  window.addEventListener('gamepadconnected', () => {});
  window.addEventListener('gamepaddisconnected', () => {});

  function readPads() {
    const source = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : [];
    return [0, 1, 2, 3].map((index) => snapshotPad(source && source[index]));
  }

  return {
    poll() {
      const bindings = getBindings();
      const pads = readPads();
      const players = [0, 1, 2, 3].map((index) => {
        const keyboard = actionsFromKeys(down, bindings[index] || bindings[0]);
        const actions = resolvePlayerActions(keyboard, pads[index]);
        return { ...actions, padConnected: !!(pads[index] && pads[index].connected) };
      });
      return {
        players,
        pressed: new Set(pressed),
        enterPressed: pressed.has('Enter'),
        tabPressed: pressed.has('Tab'),
        escapePressed: pressed.has('Escape'),
        mutePressed: pressed.has('KeyM'),
      };
    },
    endFrame() {
      pressed.clear();
    },
  };
}
