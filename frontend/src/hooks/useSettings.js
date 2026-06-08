import { useState } from 'react';

const MAX_HISTORY = 50;

const DEFAULTS = {
  autoTransform: true,
  identifyMinScore: 30,
  identifyDebounce: 600,
  extraKeys: 'KEY,SECRET,PASSWORD,密钥,密码',
  theme: 'dark',
  locale: 'zh',
  favoriteIds: [],
  transformHistory: [],
};

export function loadSettings() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem('cipher-settings') || '{}') };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(settings) {
  localStorage.setItem('cipher-settings', JSON.stringify(settings));
}

export function addTransformHistory(entry) {
  const s = loadSettings();
  const item = { ...entry, at: new Date().toISOString() };
  const transformHistory = [item, ...(s.transformHistory || [])].slice(0, MAX_HISTORY);
  saveSettings({ ...s, transformHistory });
  return transformHistory;
}

export function clearTransformHistory() {
  const s = loadSettings();
  saveSettings({ ...s, transformHistory: [] });
  return [];
}

export function toggleFavoriteCipher(id) {
  const s = loadSettings();
  const set = new Set(s.favoriteIds || []);
  if (set.has(id)) set.delete(id);
  else set.add(id);
  const favoriteIds = [...set];
  saveSettings({ ...s, favoriteIds });
  return favoriteIds;
}

export function useSettings() {
  const [settings, setSettingsState] = useState(loadSettings);

  const setSettings = (patch) => {
    setSettingsState((prev) => {
      const next = { ...prev, ...patch };
      saveSettings(next);
      return next;
    });
  };

  const resetSettings = () => {
    saveSettings(DEFAULTS);
    setSettingsState({ ...DEFAULTS });
  };

  const refreshSettings = () => setSettingsState(loadSettings());

  return {
    settings, setSettings, resetSettings, refreshSettings, DEFAULTS,
    addHistory: (entry) => {
      const history = addTransformHistory(entry);
      setSettingsState((prev) => ({ ...prev, transformHistory: history }));
    },
    clearHistory: () => {
      clearTransformHistory();
      setSettingsState((prev) => ({ ...prev, transformHistory: [] }));
    },
    toggleFavorite: (id) => {
      const favoriteIds = toggleFavoriteCipher(id);
      setSettingsState((prev) => ({ ...prev, favoriteIds }));
      return favoriteIds;
    },
  };
}
