import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function read(rel) {
  return readFileSync(join(root, rel), 'utf8');
}

describe('arcade.json', () => {
  it('matches the arcade manifest and points at real files', () => {
    const arcade = JSON.parse(read('arcade.json'));
    assert.equal(arcade.name, 'Magnet Mayhem');
    assert.equal(arcade.id, 'magnetmayhem');
    assert.equal(arcade.players, 4);
    assert.equal(arcade.minPlayers, 1);
    assert.equal(arcade.port, 8815);
    assert.equal(arcade.version, '1.0.0');
    assert.deepEqual(arcade.input, ['keyboard', 'gamepad']);
    for (const rel of [arcade.icon, arcade.cover, arcade.launch.web]) {
      assert.equal(existsSync(join(root, rel)), true, rel);
    }
    assert.equal(existsSync(join(root, arcade.launch.mac)), true);
    assert.equal(existsSync(join(root, arcade.launch.windows)), true);
    assert.equal(existsSync(join(root, arcade.launch.linux)), true);
    const icon = readFileSync(join(root, arcade.icon));
    const cover = readFileSync(join(root, arcade.cover));
    assert.ok(icon.length > 1000);
    assert.ok(cover.length > 1000);
  });
});

describe('project layout', () => {
  it('keeps core logic free of DOM and canvas', () => {
    const files = readdirSync(join(root, 'src/core')).filter((name) => name.endsWith('.js'));
    assert.ok(files.length >= 4);
    for (const name of files) {
      const text = read(join('src/core', name));
      assert.doesNotMatch(text, /\b(document|window|localStorage|HTMLCanvasElement|canvas)\b/);
      assert.doesNotMatch(text, /Math\.random/);
    }
  });

  it('ships an offline canvas page', () => {
    const html = read('index.html');
    assert.match(html, /<canvas/);
    assert.match(html, /src\/ui\/main\.js/);
    assert.match(html, /Magnet Mayhem/);
    assert.doesNotMatch(html, /https?:\/\//);
    assert.equal(existsSync(join(root, 'src/ui/main.js')), true);
    assert.equal(existsSync(join(root, 'src/core/game.js')), true);
  });

  it('launchers start server.py and explain a missing Python', () => {
    for (const rel of ['launch-linux.sh', 'launch-mac.command']) {
      const text = read(rel);
      assert.match(text, /python3/);
      assert.match(text, /server\.py/);
      assert.match(text, /Python 3/);
    }
    const bat = read('launch-windows.bat');
    assert.match(bat, /server\.py/);
    assert.match(bat, /Python 3/);
  });
});
