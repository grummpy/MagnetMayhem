import { cloneBindings, sanitizeBindings } from '../core/inputmap.js';

const STORAGE_KEY = 'magnetmayhem.settings.v1';

export function defaultSettings() {
  return {
    volume: 0.8,
    muted: false,
    roundsToWin: 3,
    bindings: cloneBindings(),
  };
}

export function loadSettings() {
  const base = defaultSettings();
  let raw = null;
  try {
    raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
  } catch {
    raw = null;
  }
  if (!raw || typeof raw !== 'object') return base;
  if (Number.isFinite(raw.volume)) base.volume = Math.max(0, Math.min(1, raw.volume));
  base.muted = !!raw.muted;
  if (raw.roundsToWin === 1 || raw.roundsToWin === 3 || raw.roundsToWin === 5) base.roundsToWin = raw.roundsToWin;
  base.bindings = sanitizeBindings(raw.bindings);
  return base;
}

export function saveSettings(settings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      volume: settings.volume,
      muted: settings.muted,
      roundsToWin: settings.roundsToWin,
      bindings: settings.bindings,
    }));
  } catch {
    /* Storage can be blocked. The match still runs. */
  }
}
