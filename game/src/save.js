// Solmara — saving and loading. Progress lives in localStorage under
// one key: money, finished missions, the player's position and health.
// Nothing else is persisted; traffic and police are rebuilt fresh on
// every load so a save can never go stale.

import { CFG } from './config.js';

export function hasSave() {
  try {
    return !!window.localStorage.getItem(CFG.saveKey);
  } catch {
    return false;
  }
}

export function saveGame(game) {
  try {
    const data = {
      version: 1,
      money: game.player.money,
      completed: game.missions.completed.slice(),
      activeIndex: game.missions.activeIndex,
      stepIndex: game.missions.stepIndex,
      player: {
        x: game.player.x,
        y: game.player.y,
        health: game.player.health,
      },
      savedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(CFG.saveKey, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(CFG.saveKey);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== 1) return null;
    return data;
  } catch {
    return null;
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(CFG.saveKey);
  } catch {
    // Storage unavailable: nothing to clear.
  }
}
