// Saving for Solmara: the whole progress (position, health, money, mission) is
// one small JSON object in localStorage. Reads and writes never throw — a
// browser with storage off just plays without saving.
//
// Version 2 saves carry the run's stats (kills, cars stolen) as well; version 1
// saves from an older build still load, with stats starting at zero.
import { BEST_KEY, SAVE_KEY } from './config.js';

export const SAVE_VERSION = 2;

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
  if (save.version !== 1 && save.version !== SAVE_VERSION) return null; // An unknown save is not trusted.
  return {
    x: save.x, y: save.y,
    health: typeof save.health === 'number' ? save.health : 100,
    money: typeof save.money === 'number' ? save.money : 250,
    missionIndex: save.missionIndex,
    missionsDone: typeof save.missionsDone === 'number' ? save.missionsDone : 0,
    kills: typeof save.kills === 'number' ? save.kills : 0,
    carsStolen: typeof save.carsStolen === 'number' ? save.carsStolen : 0,
  };
}

export function storeSave(save) {
  return write(SAVE_KEY, { ...save, version: SAVE_VERSION, savedAt: Date.now() });
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
