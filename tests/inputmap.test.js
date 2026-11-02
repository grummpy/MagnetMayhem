import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DEFAULT_BINDINGS,
  STICK_DEADZONE,
  actionsFromGamepad,
  actionsFromKeys,
  assignBinding,
  cloneBindings,
  isPauseCode,
  resolvePlayerActions,
  sanitizeBindings,
} from '../src/core/inputmap.js';

function pad(partial = {}) {
  const buttons = Array.from({ length: 16 }, () => ({ pressed: false }));
  for (const index of partial.pressed || []) buttons[index] = { pressed: true };
  return {
    connected: partial.connected !== false,
    axes: partial.axes || [0, 0, 0, 0],
    buttons,
  };
}

describe('keyboard bindings', () => {
  it('matches the four-player layout', () => {
    assert.deepEqual(
      [DEFAULT_BINDINGS[0].up, DEFAULT_BINDINGS[0].left, DEFAULT_BINDINGS[0].down, DEFAULT_BINDINGS[0].right, DEFAULT_BINDINGS[0].action, DEFAULT_BINDINGS[0].secondary],
      ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG'],
    );
    assert.equal(DEFAULT_BINDINGS[1].action, 'Slash');
    assert.equal(DEFAULT_BINDINGS[1].secondary, 'Period');
    assert.equal(DEFAULT_BINDINGS[1].up, 'ArrowUp');
    assert.equal(DEFAULT_BINDINGS[2].action, 'Semicolon');
    assert.equal(DEFAULT_BINDINGS[2].secondary, 'Quote');
    assert.equal(DEFAULT_BINDINGS[2].left, 'KeyJ');
    assert.equal(DEFAULT_BINDINGS[3].up, 'Numpad8');
    assert.equal(DEFAULT_BINDINGS[3].left, 'Numpad4');
    assert.equal(DEFAULT_BINDINGS[3].down, 'Numpad5');
    assert.equal(DEFAULT_BINDINGS[3].right, 'Numpad6');
    assert.equal(DEFAULT_BINDINGS[3].action, 'Numpad0');
    assert.equal(DEFAULT_BINDINGS[3].secondary, 'NumpadEnter');
  });

  it('maps held keys to move, action, and polarity', () => {
    const p1 = actionsFromKeys(['KeyW', 'KeyD', 'KeyF'], DEFAULT_BINDINGS[0]);
    assert.ok(p1.moveY < 0);
    assert.ok(p1.moveX > 0);
    assert.equal(p1.action, true);
    assert.equal(p1.secondary, false);
    const diag = Math.hypot(p1.moveX, p1.moveY);
    assert.ok(Math.abs(diag - 1) < 1e-9);

    const p2 = actionsFromKeys(['ArrowLeft', 'Period'], DEFAULT_BINDINGS[1]);
    assert.equal(p2.moveX, -1);
    assert.equal(p2.moveY, 0);
    assert.equal(p2.secondary, true);
    assert.equal(p2.action, false);
  });

  it('uses a custom binding when the player remaps', () => {
    const binding = { ...DEFAULT_BINDINGS[0], action: 'KeyQ' };
    const actions = actionsFromKeys(['KeyQ'], binding);
    assert.equal(actions.action, true);
    assert.equal(actionsFromKeys(['KeyF'], binding).action, false);
  });

  it('swaps duplicate keys inside one seat', () => {
    const binding = cloneBindings()[0];
    assignBinding(binding, 'action', 'KeyW');
    assert.equal(binding.action, 'KeyW');
    assert.equal(binding.up, 'KeyF');
  });

  it('falls back when saved bindings are garbage', () => {
    const cleaned = sanitizeBindings([{ up: 'KeyZ' }, null, 4, {}]);
    assert.equal(cleaned[0].up, 'KeyZ');
    assert.equal(cleaned[0].action, DEFAULT_BINDINGS[0].action);
    assert.equal(cleaned[2].left, DEFAULT_BINDINGS[2].left);
    assert.equal(sanitizeBindings(null)[3].action, 'Numpad0');
  });

  it('treats Escape as the pause key', () => {
    assert.equal(isPauseCode('Escape'), true);
    assert.equal(isPauseCode('KeyG'), false);
  });
});

describe('gamepad', () => {
  it('maps stick, A, B, and Start', () => {
    const actions = actionsFromGamepad(pad({ axes: [0.8, -0.5], pressed: [0, 9] }));
    assert.equal(actions.moveX, 0.8);
    assert.equal(actions.moveY, -0.5);
    assert.equal(actions.action, true);
    assert.equal(actions.secondary, false);
    assert.equal(actions.pause, true);
  });

  it('applies a stick deadzone and lets the D-pad override', () => {
    const idle = actionsFromGamepad(pad({ axes: [STICK_DEADZONE - 0.05, 0.1] }));
    assert.equal(idle.moveX, 0);
    assert.equal(idle.moveY, 0);
    const dpad = actionsFromGamepad(pad({ axes: [1, 0], pressed: [12, 14, 1] }));
    assert.ok(Math.abs(dpad.moveX - -Math.SQRT1_2) < 1e-9);
    assert.ok(Math.abs(dpad.moveY - -Math.SQRT1_2) < 1e-9);
    assert.equal(dpad.secondary, true);
  });

  it('overrides that seat\'s keyboard while the pad is connected', () => {
    const kb = actionsFromKeys(['KeyW', 'KeyF'], DEFAULT_BINDINGS[0]);
    const overridden = resolvePlayerActions(kb, pad({ axes: [1, 0], pressed: [1] }));
    assert.equal(overridden.moveX, 1);
    assert.equal(overridden.moveY, 0);
    assert.equal(overridden.action, false);
    assert.equal(overridden.secondary, true);

    const disconnected = resolvePlayerActions(kb, pad({ connected: false, axes: [1, 0] }));
    assert.equal(disconnected.moveY < 0, true);
    assert.equal(disconnected.action, true);
  });

  it('accepts boolean button arrays from tests and mocks', () => {
    const actions = actionsFromGamepad({
      connected: true,
      axes: [0, 0],
      buttons: [true, false, false, false, false, false, false, false, false, true],
    });
    assert.equal(actions.action, true);
    assert.equal(actions.pause, true);
  });
});
