/** GitHub Pages 等静态托管时通过 VITE_API_BASE 指向外部后端，如 https://api.example.com */
export const API_BASE = (import.meta.env.VITE_API_BASE || '').replace(/\/$/, '');

export function apiUrl(path) {
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE}${p}`;
}
