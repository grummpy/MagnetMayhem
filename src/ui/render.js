/** Canvas drawing for every screen. Reads game state; never mutates it. */

import {
  ARENA,
  PLAYER_COLORS,
  POLARITY_NEG,
  POLARITY_POS,
  VIEW_H,
  VIEW_W,
} from '../core/constants.js';
import { ACTION_FIELDS, FIELD_LABELS, codeLabel } from '../core/inputmap.js';
import { createRng } from '../core/rng.js';

const FONT = '"Trebuchet MS", "Segoe UI", "DejaVu Sans", "Liberation Sans", sans-serif';

const debris = (() => {
  const rng = createRng(20261101);
  const bits = [];
  for (let i = 0; i < 56; i++) {
    bits.push({
      x: rng.range(ARENA.x + 10, ARENA.x + ARENA.w - 10),
      y: rng.range(ARENA.y + 10, ARENA.y + ARENA.h - 10),
      w: rng.range(4, 14),
      h: rng.range(2, 6),
      rot: rng.range(0, Math.PI),
      shade: rng.range(0.15, 0.4),
    });
  }
  return bits;
})();

function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function panel(ctx, x, y, w, h) {
  ctx.save();
  ctx.fillStyle = 'rgba(16, 12, 9, 0.92)';
  ctx.strokeStyle = '#e0b23a';
  ctx.lineWidth = 3;
  roundRect(ctx, x, y, w, h, 14);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = 'rgba(90, 64, 48, 0.9)';
  ctx.lineWidth = 1;
  roundRect(ctx, x + 7, y + 7, w - 14, h - 14, 10);
  ctx.stroke();
  ctx.restore();
}

function polarityColor(polarity) {
  return polarity > 0 ? POLARITY_POS : POLARITY_NEG;
}

function drawImageCover(ctx, img, x, y, w, h) {
  if (!img || !img.complete || !img.naturalWidth) return false;
  const ir = img.naturalWidth / img.naturalHeight;
  const r = w / h;
  let sx = 0;
  let sy = 0;
  let sw = img.naturalWidth;
  let sh = img.naturalHeight;
  if (ir > r) {
    sw = sh * r;
    sx = (img.naturalWidth - sw) / 2;
  } else {
    sh = sw / r;
    sy = (img.naturalHeight - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
  return true;
}

function drawHazards(ctx, now) {
  const { x, y, w, h } = ARENA;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x - 18, y - 18, w + 36, h + 36);
  ctx.rect(x, y, w, h);
  ctx.clip('evenodd');
  const stripe = 12;
  const shift = (now / 70) % (stripe * 2);
  for (let i = -4; i < w / stripe + 8; i++) {
    ctx.fillStyle = i % 2 === 0 ? '#f2c014' : '#161616';
    ctx.fillRect(x - 22 + i * stripe + shift, y - 20, stripe + 0.5, h + 40);
  }
  ctx.restore();
  ctx.strokeStyle = '#3a2c22';
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
}

function drawArena(ctx, now) {
  ctx.fillStyle = '#1a140f';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  drawHazards(ctx, now);
  const floor = ctx.createLinearGradient(0, ARENA.y, 0, ARENA.y + ARENA.h);
  floor.addColorStop(0, '#3d362c');
  floor.addColorStop(0.5, '#2a241c');
  floor.addColorStop(1, '#1c1814');
  ctx.fillStyle = floor;
  ctx.fillRect(ARENA.x, ARENA.y, ARENA.w, ARENA.h);

  ctx.strokeStyle = 'rgba(0, 0, 0, 0.22)';
  ctx.lineWidth = 1;
  for (let x = ARENA.x + 40; x < ARENA.x + ARENA.w; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, ARENA.y);
    ctx.lineTo(x, ARENA.y + ARENA.h);
    ctx.stroke();
  }
  for (let y = ARENA.y + 40; y < ARENA.y + ARENA.h; y += 40) {
    ctx.beginPath();
    ctx.moveTo(ARENA.x, y);
    ctx.lineTo(ARENA.x + ARENA.w, y);
    ctx.stroke();
  }

  ctx.save();
  ctx.beginPath();
  ctx.rect(ARENA.x, ARENA.y, ARENA.w, ARENA.h);
  ctx.clip();
  for (const bit of debris) {
    ctx.save();
    ctx.translate(bit.x, bit.y);
    ctx.rotate(bit.rot);
    ctx.fillStyle = `rgba(70, 60, 48, ${bit.shade})`;
    ctx.fillRect(-bit.w / 2, -bit.h / 2, bit.w, bit.h);
    ctx.restore();
  }
  ctx.restore();
}

function drawScrap(ctx, scrap, tick) {
  const color = polarityColor(scrap.polarity);
  ctx.save();
  ctx.translate(scrap.x, scrap.y);
  const spin = scrap.orbiting != null ? scrap.orbitAngle : tick * 0.04 + scrap.id;
  ctx.rotate(spin);
  ctx.fillStyle = color;
  ctx.strokeStyle = '#1a120c';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  if (scrap.id % 3 === 0) {
    ctx.moveTo(0, -7);
    ctx.lineTo(6, 0);
    ctx.lineTo(0, 7);
    ctx.lineTo(-6, 0);
  } else if (scrap.id % 3 === 1) {
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI * 2 * i) / 6 - Math.PI / 2;
      const rad = i % 2 === 0 ? 7 : 4;
      const px = Math.cos(a) * rad;
      const py = Math.sin(a) * rad;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
  } else {
    ctx.rect(-6, -3.5, 12, 7);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fillRect(-2, -2, 2, 2);
  ctx.restore();

  const speed = Math.hypot(scrap.vx, scrap.vy);
  if (speed > 180 && scrap.orbiting == null) {
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.45;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(scrap.x, scrap.y);
    ctx.lineTo(scrap.x - scrap.vx * 0.04, scrap.y - scrap.vy * 0.04);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

function drawRobot(ctx, robot, holding) {
  ctx.save();
  ctx.translate(robot.x, robot.y);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.beginPath();
  ctx.ellipse(2, 6, robot.radius * 0.9, robot.radius * 0.45, 0, 0, Math.PI * 2);
  ctx.fill();

  if (!robot.alive) ctx.globalAlpha = 0.45;
  ctx.rotate(robot.facing);

  if (holding || robot.orbit.length) {
    ctx.save();
    ctx.rotate(-robot.facing);
    ctx.strokeStyle = polarityColor(robot.polarity);
    ctx.globalAlpha = robot.alive ? 0.35 : 0.15;
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, 36, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    ctx.globalAlpha = robot.alive ? 1 : 0.45;
  }

  const body = robot.alive ? PLAYER_COLORS[robot.id] : '#6d675f';
  ctx.fillStyle = body;
  ctx.strokeStyle = '#1a120c';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, robot.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.arc(-2, -2, robot.radius * 0.62, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#ffe27a';
  ctx.beginPath();
  ctx.arc(5, -4.5, 2.3, 0, Math.PI * 2);
  ctx.arc(5, 4.5, 2.3, 0, Math.PI * 2);
  ctx.fill();

  const color = polarityColor(robot.polarity);
  ctx.strokeStyle = color;
  ctx.lineWidth = 4.5;
  ctx.lineCap = 'round';
  const mx = 18;
  const a1 = -0.8;
  const a2 = 0.8;
  ctx.beginPath();
  ctx.arc(mx, 0, 8, a1, a2, true);
  ctx.stroke();
  ctx.beginPath();
  const tip = (angle) => [mx + Math.cos(angle) * 8, Math.sin(angle) * 8];
  const [x1, y1] = tip(a1);
  const [x2, y2] = tip(a2);
  ctx.moveTo(x1, y1);
  ctx.lineTo(x1 + 7, y1);
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 + 7, y2);
  ctx.stroke();

  ctx.rotate(-robot.facing);
  ctx.fillStyle = '#140e0b';
  ctx.font = `700 11px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(robot.polarity > 0 ? '+' : '−', 0, 0);
  ctx.restore();

  const barW = 34;
  const barX = robot.x - barW / 2;
  const barY = robot.y - robot.radius - 12;
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(barX, barY, barW, 5);
  const pct = Math.max(0, robot.hp / 100);
  ctx.fillStyle = pct > 0.55 ? '#7dce4a' : pct > 0.28 ? '#e0b23a' : '#e23b3b';
  ctx.fillRect(barX, barY, barW * pct, 5);
  ctx.strokeStyle = 'rgba(0,0,0,0.6)';
  ctx.strokeRect(barX + 0.5, barY + 0.5, barW - 1, 4);
}

function drawPadIcon(ctx, x, y, on) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = on ? '#f2c014' : '#5c5348';
  ctx.fillStyle = on ? 'rgba(242, 192, 20, 0.2)' : 'rgba(0,0,0,0.2)';
  ctx.lineWidth = 1.5;
  roundRect(ctx, 0, 0, 18, 12, 3);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = on ? '#fff4c8' : '#6a6156';
  ctx.fillRect(4, 5, 2, 2);
  ctx.fillRect(7, 5, 2, 2);
  ctx.beginPath();
  ctx.arc(13, 6, 1.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawHud(ctx, state) {
  const { match, join, players } = state;
  ctx.fillStyle = '#120e0b';
  ctx.fillRect(0, 0, VIEW_W, 58);
  ctx.fillStyle = '#e0b23a';
  ctx.fillRect(0, 58, VIEW_W, 2);

  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.font = `700 16px ${FONT}`;
  ctx.fillStyle = '#f4efe4';
  ctx.fillText(match ? `ROUND ${match.round}` : 'ROUND', 16, 20);
  ctx.font = `600 12px ${FONT}`;
  ctx.fillStyle = '#b7aa98';
  ctx.fillText(`first to ${match ? match.roundsToWin : state.roundsToWin}`, 16, 40);

  for (let i = 0; i < 4; i++) {
    const x = 168 + i * 196;
    const robot = match ? match.robots.find((r) => r.id === i) : null;
    const slot = join[i];
    const input = players[i];
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    roundRect(ctx, x, 8, 184, 42, 8);
    ctx.fill();
    ctx.fillStyle = PLAYER_COLORS[i];
    ctx.fillRect(x, 8, 6, 42);
    ctx.font = `700 13px ${FONT}`;
    ctx.fillStyle = '#f4efe4';
    ctx.textAlign = 'left';
    ctx.fillText(`P${i + 1}`, x + 14, 22);
    let tag = 'OFF';
    if (slot.control !== 'off') {
      if (input && input.padConnected) tag = 'PAD';
      else if (slot.control === 'human') tag = 'YOU';
      else tag = 'BOT';
    }
    ctx.font = `700 11px ${FONT}`;
    ctx.fillStyle = tag === 'OFF' ? '#7a7166' : '#f2c014';
    ctx.fillText(tag, x + 42, 22);
    drawPadIcon(ctx, x + 78, 14, !!(input && input.padConnected));
    if (robot) {
      ctx.font = `700 13px ${FONT}`;
      ctx.fillStyle = polarityColor(robot.polarity);
      ctx.fillText(robot.polarity > 0 ? '+' : '−', x + 104, 22);
      const pct = robot.alive ? robot.hp / 100 : 0;
      ctx.fillStyle = '#2a241c';
      ctx.fillRect(x + 120, 16, 52, 8);
      ctx.fillStyle = pct > 0.55 ? '#7dce4a' : pct > 0.28 ? '#e0b23a' : '#e23b3b';
      ctx.fillRect(x + 120, 16, 52 * pct, 8);
    }
    const rounds = match ? match.roundsToWin : state.roundsToWin;
    const score = match ? match.scores[i] : 0;
    for (let p = 0; p < rounds; p++) {
      ctx.beginPath();
      ctx.arc(x + 16 + p * 12, 40, 4, 0, Math.PI * 2);
      ctx.fillStyle = p < score ? PLAYER_COLORS[i] : '#3a332b';
      ctx.fill();
    }
  }
}

function drawParticles(ctx, particles) {
  for (const p of particles) {
    const alpha = Math.max(0, p.life / p.max);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color;
    if (p.text) {
      ctx.font = `700 ${p.size}px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText(p.text, p.x, p.y);
    } else {
      ctx.fillRect(p.x, p.y, p.size, p.size);
    }
  }
  ctx.globalAlpha = 1;
}

function drawBanner(ctx, text, sub) {
  panel(ctx, 230, 210, 500, 120);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#f2c014';
  ctx.font = `800 32px ${FONT}`;
  ctx.fillText(text, VIEW_W / 2, 258);
  if (sub) {
    ctx.fillStyle = '#f4efe4';
    ctx.font = `600 16px ${FONT}`;
    ctx.fillText(sub, VIEW_W / 2, 294);
  }
}

function fallbackTitle(ctx) {
  ctx.fillStyle = '#1a2744';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.fillStyle = '#d6453d';
  ctx.font = `800 72px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText('MAGNET', VIEW_W / 2, 230);
  ctx.fillStyle = '#e0b23a';
  ctx.fillText('MAYHEM', VIEW_W / 2, 310);
}

function drawTitle(ctx, state) {
  if (!drawImageCover(ctx, state.cover, 0, 0, VIEW_W, VIEW_H)) fallbackTitle(ctx);
  const fade = ctx.createLinearGradient(0, 360, 0, VIEW_H);
  fade.addColorStop(0, 'rgba(10, 8, 6, 0)');
  fade.addColorStop(1, 'rgba(10, 8, 6, 0.88)');
  ctx.fillStyle = fade;
  ctx.fillRect(0, 360, VIEW_W, VIEW_H - 360);
  const blink = Math.sin(state.now / 220) > -0.15;
  if (blink) {
    ctx.fillStyle = '#f4efe4';
    ctx.font = `800 22px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('PRESS ENTER  /  START', VIEW_W / 2, 470);
  }
  ctx.fillStyle = '#f2c014';
  ctx.font = `600 14px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText('TAB  SETTINGS     ·     M  MUTE', VIEW_W / 2, 504);
}

function compactCode(code) {
  if (code === 'NumpadEnter') return 'NumEnter';
  if (code && code.startsWith('Numpad')) return code.slice(6);
  return codeLabel(code);
}

function seatBlurb(binding) {
  const move = [binding.up, binding.left, binding.down, binding.right].map(compactCode).join(' ');
  return `${move}  ${compactCode(binding.action)} grab  ${compactCode(binding.secondary)} flip`;
}

function drawJoin(ctx, state) {
  ctx.fillStyle = '#16110e';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#f2c014';
  ctx.font = `800 36px ${FONT}`;
  ctx.fillText('CHOOSE FIGHTERS', VIEW_W / 2, 64);
  ctx.fillStyle = '#cbbfae';
  ctx.font = `600 14px ${FONT}`;
  ctx.fillText('Action joins  ·  Secondary cycles bot / off  ·  Empty seats can stay bots', VIEW_W / 2, 96);

  state.join.forEach((slot, i) => {
    const x = 48 + (i % 4) * 228;
    const y = 140;
    panel(ctx, x, y, 210, 230);
    ctx.fillStyle = PLAYER_COLORS[i];
    ctx.fillRect(x + 16, y + 18, 178, 8);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#f4efe4';
    ctx.font = `800 28px ${FONT}`;
    ctx.fillText(`P${i + 1}`, x + 18, y + 68);
    const label = slot.control === 'human' ? 'HUMAN' : slot.control === 'bot' ? 'BOT' : 'OFF';
    ctx.fillStyle = slot.control === 'off' ? '#7d7468' : '#f2c014';
    ctx.font = `800 20px ${FONT}`;
    ctx.fillText(label, x + 18, y + 104);
    drawPadIcon(ctx, x + 160, y + 48, !!state.players[i].padConnected);
    ctx.fillStyle = '#d9d0c4';
    ctx.font = `600 13px ${FONT}`;
    const lines = seatBlurb(state.bindings[i]).split('  ');
    lines.forEach((line, li) => ctx.fillText(line, x + 18, y + 146 + li * 20));
    ctx.fillStyle = '#8d8274';
    ctx.font = `600 12px ${FONT}`;
    ctx.fillText(state.players[i].padConnected ? 'A join · B cycle' : 'Action / secondary', x + 18, y + 200);
  });

  const active = state.join.filter((s) => s.control !== 'off').length;
  ctx.textAlign = 'center';
  ctx.font = `700 16px ${FONT}`;
  if (active < 2) {
    ctx.fillStyle = '#e23b3b';
    ctx.fillText('Need 2 fighters. Turn a seat back on.', VIEW_W / 2, 430);
  } else {
    ctx.fillStyle = '#f4efe4';
    ctx.fillText('ENTER or START to fight', VIEW_W / 2, 430);
  }
  ctx.fillStyle = '#b7aa98';
  ctx.font = `600 13px ${FONT}`;
  ctx.fillText('ESC title    ·    TAB settings    ·    Gamepads replace that seat\'s keys while plugged in', VIEW_W / 2, 490);
}

function drawRows(ctx, title, rows, index, x, y, w, rowH = 40) {
  const h = 70 + rows.length * rowH;
  panel(ctx, x, y, w, h);
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#f2c014';
  ctx.font = `800 26px ${FONT}`;
  ctx.fillText(title, x + w / 2, y + 38);
  rows.forEach((row, i) => {
    const ry = y + 68 + i * rowH;
    if (i === index) {
      ctx.fillStyle = 'rgba(242, 192, 20, 0.16)';
      ctx.fillRect(x + 16, ry - rowH * 0.65, w - 32, rowH - 6);
    }
    ctx.textAlign = 'left';
    ctx.font = `600 18px ${FONT}`;
    ctx.fillStyle = i === index ? '#fff8e4' : '#d9d0c4';
    ctx.fillText(row.label, x + 28, ry);
    if (row.value != null) {
      ctx.textAlign = 'right';
      ctx.fillStyle = '#f2c014';
      ctx.fillText(String(row.value), x + w - 28, ry);
    }
  });
  return h;
}

function drawSettings(ctx, state) {
  ctx.fillStyle = '#16110e';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  const rows = [
    { label: 'Volume', value: `${Math.round(state.settings.volume * 100)}%` },
    { label: 'Rounds to win', value: state.settings.roundsToWin },
    { label: 'Controls', value: 'remap' },
    { label: 'Back', value: '' },
  ];
  drawRows(ctx, 'SETTINGS', rows, state.menuIndex, 250, 120, 460);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#b7aa98';
  ctx.font = `600 14px ${FONT}`;
  ctx.fillText('Up / down to choose    ·    Left / right to change    ·    Enter to open', VIEW_W / 2, 470);
  ctx.fillText(state.settings.muted ? 'Muted (M)' : 'M mutes', VIEW_W / 2, 496);
}

function drawControls(ctx, state) {
  ctx.fillStyle = '#16110e';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#f2c014';
  ctx.font = `800 28px ${FONT}`;
  ctx.fillText('CONTROLS', VIEW_W / 2, 48);
  for (let i = 0; i < 4; i++) {
    const x = 70 + i * 220;
    ctx.fillStyle = i === state.controlPlayer ? PLAYER_COLORS[i] : '#6a6156';
    ctx.font = `800 16px ${FONT}`;
    ctx.fillText(`P${i + 1}`, x, 84);
  }
  const binding = state.bindings[state.controlPlayer];
  const rows = ACTION_FIELDS.map((field) => ({
    label: FIELD_LABELS[field],
    value: codeLabel(binding[field]),
    field,
  }));
  rows.push({ label: 'Reset this seat', value: '' });
  rows.push({ label: 'Reset everyone', value: '' });
  rows.push({ label: 'Back', value: '' });
  drawRows(ctx, `P${state.controlPlayer + 1}`, rows, state.menuIndex, 250, 96, 460, 32);
  ctx.textAlign = 'center';
  ctx.fillStyle = state.rebinding ? '#f2c014' : '#b7aa98';
  ctx.font = `600 15px ${FONT}`;
  ctx.fillText(
    state.rebinding ? 'Press a key…  ESC cancels' : 'Left / right change seat    ·    Enter rebinds the highlighted row',
    VIEW_W / 2,
    520,
  );
}

function drawPause(ctx, state) {
  const rows = [
    { label: 'Resume', value: '' },
    { label: 'Settings', value: '' },
    { label: 'Quit to title', value: '' },
  ];
  drawRows(ctx, 'PAUSED', rows, state.menuIndex, 280, 150, 400);
}

function winnerName(id) {
  return id == null ? 'DRAW' : `P${id + 1}`;
}

function drawMatchOverlays(ctx, state) {
  const match = state.match;
  if (!match) return;
  if (match.phase === 'countdown') {
    const n = Math.max(1, Math.ceil(match.phaseTimer - 1e-4));
    ctx.textAlign = 'center';
    ctx.font = `800 92px ${FONT}`;
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillText(String(n), VIEW_W / 2 + 3, 300);
    ctx.fillStyle = '#f4efe4';
    ctx.fillText(String(n), VIEW_W / 2, 296);
  } else if (state.goTimer > 0) {
    ctx.textAlign = 'center';
    ctx.font = `800 80px ${FONT}`;
    ctx.fillStyle = '#f2c014';
    ctx.fillText('GO', VIEW_W / 2, 300);
  }
  if (match.phase === 'roundEnd') {
    const title = match.roundWinner == null ? 'DRAW' : `${winnerName(match.roundWinner)} TAKES THE ROUND`;
    const sub = match.pendingMatchEnd ? 'Match point' : 'Next round incoming';
    drawBanner(ctx, title, sub);
  }
  if (match.phase === 'matchEnd') {
    const order = [0, 1, 2, 3].slice().sort((a, b) => match.scores[b] - match.scores[a] || a - b);
    panel(ctx, 250, 120, 460, 320);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#f2c014';
    ctx.font = `800 28px ${FONT}`;
    ctx.fillText(`${winnerName(match.matchWinner)} WINS THE MATCH`, VIEW_W / 2, 164);
    order.forEach((id, rank) => {
      const y = 214 + rank * 36;
      ctx.textAlign = 'left';
      ctx.fillStyle = PLAYER_COLORS[id];
      ctx.font = `700 18px ${FONT}`;
      ctx.fillText(`${rank + 1}.  P${id + 1}`, 300, y);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#f4efe4';
      ctx.fillText(`${match.scores[id]} round${match.scores[id] === 1 ? '' : 's'}`, 660, y);
    });
    ctx.textAlign = 'center';
    ctx.fillStyle = '#b7aa98';
    ctx.font = `600 14px ${FONT}`;
    ctx.fillText('ENTER rematch     ·     ESC title', VIEW_W / 2, 410);
  }
}

function fit(ctx, canvas) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.max(1, Math.floor(canvas.clientWidth * dpr));
  const h = Math.max(1, Math.floor(canvas.clientHeight * dpr));
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#100c09';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const scale = Math.min(canvas.width / VIEW_W, canvas.height / VIEW_H);
  const ox = (canvas.width - VIEW_W * scale) / 2;
  const oy = (canvas.height - VIEW_H * scale) / 2;
  ctx.setTransform(scale, 0, 0, scale, ox, oy);
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  return {
    draw(state) {
      fit(ctx, canvas);
      const screen = state.screen;
      if (screen === 'title') {
        drawTitle(ctx, state);
        return;
      }
      if (screen === 'join') {
        drawJoin(ctx, state);
        return;
      }
      if (screen === 'settings') {
        drawSettings(ctx, state);
        return;
      }
      if (screen === 'controls') {
        drawControls(ctx, state);
        return;
      }

      ctx.save();
      const mag = state.shake || 0;
      ctx.translate(Math.sin(state.now / 18) * mag, Math.cos(state.now / 15) * mag);
      drawArena(ctx, state.now);
      if (state.match) {
        const ordered = state.match.scraps.slice().sort((a, b) => a.y - b.y);
        for (const scrap of ordered) drawScrap(ctx, scrap, state.match.tick);
        const bots = state.match.robots.slice().sort((a, b) => a.y - b.y);
        for (const robot of bots) drawRobot(ctx, robot, !!(robot.actionPrev || robot.orbit.length));
      }
      drawParticles(ctx, state.particles);
      ctx.restore();
      drawHud(ctx, state);
      drawMatchOverlays(ctx, state);
      if (state.paused) {
        ctx.fillStyle = 'rgba(8, 6, 4, 0.55)';
        ctx.fillRect(0, 0, VIEW_W, VIEW_H);
        drawPause(ctx, state);
      }
      ctx.fillStyle = '#120e0b';
      ctx.fillRect(0, VIEW_H - 22, VIEW_W, 22);
      ctx.fillStyle = '#e0b23a';
      ctx.fillRect(0, VIEW_H - 22, VIEW_W, 2);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.font = `600 12px ${FONT}`;
      ctx.fillStyle = '#d9d0c4';
      ctx.fillText('ESC pause    ·    M mute    ·    Hold action to grab, release to fling', 16, VIEW_H - 11);
    },
  };
}
