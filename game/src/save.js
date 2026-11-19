// Save / load: one localStorage slot, written every AUTOSAVE_SECONDS and
// on every mission payout. Stores money, mission progress, health and
// position — enough that Continue drops the player back where they were.
import { SAVE_KEY } from './config.js';

export function saveGame(G) {
  try {
    const data = {
      version: 1,
      money: G.money,
      missionIndex: G.mission.index,
      missionStep: G.mission.step,
      health: Math.round(G.player.health),
      x: Math.round(G.player.pos.x),
      z: Math.round(G.player.pos.z),
      heading: G.player.heading,
      time: Date.now(),
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    G.lastSaveAt = G.time;
    return true;
  } catch (e) {
    return false;
  }
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (d.version !== 1) return null;
    return d;
  } catch (e) {
    return null;
  }
}

export function hasSave() {
  return loadSave() !== null;
}

export function applySave(G, d) {
  G.money = d.money || 0;
  G.mission.index = Math.min(d.missionIndex || 0, 5);
  G.mission.step = 0;
  G.mission.kills = 0;
  G.mission.holdT = 0;
  G.player.health = d.health || 100;
  G.player.pos.set(d.x == null ? -60 : d.x, 0, d.z == null ? 88 : d.z);
  G.player.heading = d.heading || 0;
  G.player.camYaw = d.heading || 0;
  G.player.mesh.position.copy(G.player.pos);
}
