# Magnet Mayhem — Build Sheet

Repo: https://github.com/grummpy/MagnetMayhem  (public). Already contains `assets/cover.jpg` (cover art) and `assets/icon.jpg` (app icon), plus this sheet at `docs/BUILD.md`.

## Concept (from Daily Idea Pack, Nov 1 2026)
Flip polarity to grab and fling scrap; last bot standing.

## Rules
Top-down junkyard arena. Each player is a robot with a polarity (red + / blue -), toggled with secondary. Scrap pieces lying around also have polarity; robots attract opposite-polarity scrap and repel same polarity within a radius. Holding action pulls nearby attractable scrap into an orbit (max 3 pieces); releasing flings them in the facing direction. Flipping polarity while scrap orbits launches it outward in a burst. Robots also attract/repel each other by polarity. Scrap hits deal damage by speed; robots have 100 HP; arena edges are crusher walls (contact damage). Scrap respawns periodically. Last robot standing wins the round; first to 3 rounds wins.

Default port: 8815 (falls back to next free port).

## Players and input
- Exactly 4 local players on one shared screen, all versus each other (free-for-all unless the rules above add a team mode).
- Keyboard split (works with no gamepads):
  - P1: W A S D move, F action, G secondary
  - P2: Arrow keys move, `/` action, `.` secondary
  - P3: I J K L move, `;` action, `'` secondary
  - P4: Numpad 8 4 5 6 move, Numpad 0 action, Numpad Enter secondary
- Gamepads via the browser Gamepad API: pads 0-3 map to P1-P4 (left stick/D-pad move, A action, B secondary, Start pause) and override that player's keyboard bindings when connected. Show connected-pad icons on the HUD and hot-plug support.
- Remappable controls screen; save to localStorage.
- Bots: any empty player slot can be filled by a simple AI so the game is playable solo.

## Tech
- Plain HTML5 `<canvas>` + vanilla JavaScript ES modules, no build step, no external CDN (works offline).
- Fixed-timestep game loop (60 Hz update) separated from rendering.
- Core game logic in pure modules under `src/core/` (no DOM, no canvas) so it can be tested headlessly; rendering/input/audio in `src/ui/`.
- Seeded RNG for all randomness (deterministic tests and replays).
- Tiny local server: `server.py` (Python 3 stdlib `http.server`) on 127.0.0.1, default port picked per game (see arcade.json), falls back to the next free port, opens the default browser.

## Screens and flow
- Title screen using `assets/cover.jpg` as the backdrop, game logo text, "Press Start / Enter" prompt.
- Player join screen (each player presses action to join; empty slots = bot or off).
- Round/score system: round counter, per-player scores on the HUD, round-win banner, match-win screen with standings, rematch / back to title.
- Pause menu (Start / Esc), settings (volume, controls, round count).

## Sound
- All audio synthesized live with the Web Audio API (oscillators, noise bursts, envelopes): hits, pickups, KOs, countdown, round win, and a short looping chiptune theme. No audio files needed. Mute toggle (M).

## One-click launchers
- `launch-mac.command` (chmod +x), `launch-windows.bat`, `launch-linux.sh` (chmod +x): each starts `server.py` and opens the browser. Detect Python 3 and print a friendly message if missing.

## Arcade OS manifest
`arcade.json` at repo root:
```json
{
  "name": "Magnet Mayhem",
  "id": "magnetmayhem",
  "icon": "assets/icon.jpg",
  "cover": "assets/cover.jpg",
  "launch": { "mac": "./launch-mac.command", "windows": "launch-windows.bat", "linux": "./launch-linux.sh", "web": "index.html" },
  "players": 4,
  "port": 8815,
  "minPlayers": 1,
  "input": ["keyboard", "gamepad"],
  "version": "1.0.0"
}
```

## Tests
- Headless tests of core logic with Node's built-in test runner (`node --test tests/`), no dependencies. Cover: movement/collision, scoring and round/match win conditions, elimination, power-ups/specials specific to this game, seeded RNG determinism, input mapping (keyboard + mocked gamepad state to player actions), and that arcade.json is valid and points to existing files.
- Also a Python smoke test that `server.py` serves index.html.
- Add a GitHub Actions workflow running the tests.

## README
Cover image at top, pitch, how to launch (one-click per OS), controls table for all 4 players + gamepad, rules, scoring, arcade.json description, how to run tests, license (MIT).

## Constraints
- Synthetic content only; no real personal data, names, or secrets.
- Work on a feature branch, open a PR into main, make sure tests pass, then merge to main.
