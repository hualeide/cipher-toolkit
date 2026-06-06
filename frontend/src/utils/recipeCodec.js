const STORAGE_KEY = 'cipher-toolkit-recipes';
const RECIPE_VERSION = 1;

export function createRecipe({ name = '', steps = [] }) {
  return {
    v: RECIPE_VERSION,
    name: name.trim() || 'Untitled',
    steps: steps.map((s) => ({ id: s.id, params: s.params || {} })),
    created: new Date().toISOString(),
  };
}

export function encodeRecipe(recipe) {
  const json = JSON.stringify(recipe);
  const b64 = btoa(unescape(encodeURIComponent(json)));
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeRecipe(encoded) {
  if (!encoded?.trim()) throw new Error('empty recipe');
  let b64 = encoded.trim().replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4) b64 += '=';
  const json = decodeURIComponent(escape(atob(b64)));
  const recipe = JSON.parse(json);
  if (!recipe?.steps?.length) throw new Error('invalid recipe');
  return recipe;
}

export function buildShareUrl(recipe) {
  const hash = `recipe=${encodeRecipe(recipe)}`;
  const base = `${window.location.origin}${window.location.pathname}`;
  return `${base}#${hash}`;
}

export function parseRecipeFromHash() {
  const raw = window.location.hash.replace(/^#/, '');
  if (!raw.startsWith('recipe=')) return null;
  try {
    return decodeRecipe(decodeURIComponent(raw.slice(7)));
  } catch {
    return null;
  }
}

export function loadSavedRecipes() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveRecipeToStorage(recipe) {
  const list = loadSavedRecipes();
  const entry = { ...recipe, id: recipe.id || `r_${Date.now()}`, updated: new Date().toISOString() };
  const idx = list.findIndex((r) => r.id === entry.id);
  if (idx >= 0) list[idx] = entry;
  else list.unshift(entry);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, 30)));
  return entry;
}

export function deleteRecipeFromStorage(id) {
  const list = loadSavedRecipes().filter((r) => r.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  return list;
}
