// Save and load via localStorage. Nothing leaves the player's browser.
const SAVE_KEY = 'portvireo-save-v1';

export function saveGame(world) {
  try {
    const data = {
      money: world.money,
      health: world.player.health,
      missionIndex: world.missions.index,
      missionsDone: world.missions.done,
      tokensCollected: world.missions.tokensCollected,
      stats: world.stats,
      savedAt: Date.now(),
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    return false;
  }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data.money !== 'number') return null;
    return data;
  } catch (e) {
    return null;
  }
}

export function hasSave() {
  try { return localStorage.getItem(SAVE_KEY) !== null; } catch (e) { return false; }
}

export function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ }
}
