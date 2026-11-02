/**
 * Maps keyboard codes and a mocked/real gamepad snapshot to player actions.
 * No DOM. Gamepad standard mapping: A=0, B=1, Start=9, D-pad=12..15, left stick axes 0 and 1.
 */

export const ACTION_FIELDS = ['up', 'down', 'left', 'right', 'action', 'secondary'];

export const FIELD_LABELS = Object.freeze({
  up: 'Up',
  down: 'Down',
  left: 'Left',
  right: 'Right',
  action: 'Action',
  secondary: 'Polarity',
});

export const DEFAULT_BINDINGS = Object.freeze([
  Object.freeze({ name: 'P1', up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', action: 'KeyF', secondary: 'KeyG' }),
  Object.freeze({ name: 'P2', up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', action: 'Slash', secondary: 'Period' }),
  Object.freeze({ name: 'P3', up: 'KeyI', down: 'KeyK', left: 'KeyJ', right: 'KeyL', action: 'Semicolon', secondary: 'Quote' }),
  Object.freeze({ name: 'P4', up: 'Numpad8', down: 'Numpad5', left: 'Numpad4', right: 'Numpad6', action: 'Numpad0', secondary: 'NumpadEnter' }),
]);

const CODE_LABELS = {
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
  Slash: '/',
  Period: '.',
  Semicolon: ';',
  Quote: "'",
  Numpad0: 'Num 0',
  Numpad1: 'Num 1',
  Numpad2: 'Num 2',
  Numpad3: 'Num 3',
  Numpad4: 'Num 4',
  Numpad5: 'Num 5',
  Numpad6: 'Num 6',
  Numpad7: 'Num 7',
  Numpad8: 'Num 8',
  Numpad9: 'Num 9',
  NumpadEnter: 'Num Enter',
  Space: 'Space',
  Enter: 'Enter',
  Escape: 'Esc',
  Backquote: '`',
};

export const STICK_DEADZONE = 0.28;

export function cloneBindings(bindings = DEFAULT_BINDINGS) {
  return bindings.map((b) => ({ ...b }));
}

export function codeLabel(code) {
  if (!code) return '—';
  if (CODE_LABELS[code]) return CODE_LABELS[code];
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  return code;
}

export function isPauseCode(code) {
  return code === 'Escape';
}

export function sanitizeBindings(raw) {
  const next = cloneBindings();
  if (!Array.isArray(raw) || raw.length !== 4) return next;
  for (let i = 0; i < 4; i++) {
    const src = raw[i];
    if (!src || typeof src !== 'object') continue;
    for (const field of ACTION_FIELDS) {
      if (typeof src[field] === 'string' && src[field].length > 0) next[i][field] = src[field];
    }
    if (typeof src.name === 'string') next[i].name = src.name;
  }
  return next;
}

/** If `code` is already used by another action on this seat, swap so nothing is lost. */
export function assignBinding(binding, field, code) {
  for (const other of ACTION_FIELDS) {
    if (other !== field && binding[other] === code) binding[other] = binding[field];
  }
  binding[field] = code;
  return binding;
}

function asSet(codesDown) {
  if (!codesDown) return new Set();
  if (codesDown instanceof Set) return codesDown;
  return new Set(codesDown);
}

export function actionsFromKeys(codesDown, binding) {
  const down = asSet(codesDown);
  let x = 0;
  let y = 0;
  if (down.has(binding.left)) x -= 1;
  if (down.has(binding.right)) x += 1;
  if (down.has(binding.up)) y -= 1;
  if (down.has(binding.down)) y += 1;
  if (x !== 0 && y !== 0) {
    x *= Math.SQRT1_2;
    y *= Math.SQRT1_2;
  }
  return {
    moveX: x,
    moveY: y,
    action: down.has(binding.action),
    secondary: down.has(binding.secondary),
    pause: false,
  };
}

function buttonPressed(buttons, index) {
  const b = buttons && buttons[index];
  if (!b) return false;
  if (b === true) return true;
  return !!b.pressed;
}

export function actionsFromGamepad(pad) {
  if (!pad || !pad.connected) return null;
  const buttons = pad.buttons || [];
  const axes = pad.axes || [];
  let x = Math.abs(axes[0] || 0) > STICK_DEADZONE ? axes[0] : 0;
  let y = Math.abs(axes[1] || 0) > STICK_DEADZONE ? axes[1] : 0;
  if (buttonPressed(buttons, 14)) x = -1;
  if (buttonPressed(buttons, 15)) x = 1;
  if (buttonPressed(buttons, 12)) y = -1;
  if (buttonPressed(buttons, 13)) y = 1;
  const l = Math.hypot(x, y);
  if (l > 1) {
    x /= l;
    y /= l;
  }
  return {
    moveX: x,
    moveY: y,
    action: buttonPressed(buttons, 0),
    secondary: buttonPressed(buttons, 1),
    pause: buttonPressed(buttons, 9),
  };
}

/**
 * A connected pad replaces that seat's keyboard entirely, even if the stick is neutral.
 */
export function resolvePlayerActions(keyboardActions, pad) {
  if (pad && pad.connected) return actionsFromGamepad(pad);
  return {
    moveX: keyboardActions?.moveX || 0,
    moveY: keyboardActions?.moveY || 0,
    action: !!keyboardActions?.action,
    secondary: !!keyboardActions?.secondary,
    pause: !!keyboardActions?.pause,
  };
}
