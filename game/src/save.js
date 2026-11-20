// Saving for Solmara: the whole progress (position, health, money, mission) is
// one small JSON object in localStorage. Reads and writes never throw — a
// browser with storage off just plays without saving.
import { BEST_KEY, SAVE_KEY } from './config.js';

function read(key) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function write(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function loadSave() {
  const save = read(SAVE_KEY);
  if (!save || typeof save.x !== 'number' || typeof save.missionIndex !== 'number') return null;
  return save;
}

export function storeSave(save) {
  return write(SAVE_KEY, save);
}

export function clearSave() {
  try { window.localStorage.removeItem(SAVE_KEY); } catch { /* storage off */ }
}

export function readBestMoney() {
  const value = read(BEST_KEY);
  return typeof value === 'number' ? value : 0;
}

export function storeBestMoney(money) {
  if (money > readBestMoney()) write(BEST_KEY, money);
}
