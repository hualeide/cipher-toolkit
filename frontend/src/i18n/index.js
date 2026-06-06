import zh from './locales/zh.js';
import en from './locales/en.js';
import ja from './locales/ja.js';
import ko from './locales/ko.js';

export const LOCALES = ['zh', 'en', 'ja', 'ko'];
export const messages = { zh, en, ja, ko };

export function detectLocale() {
  try {
    const saved = JSON.parse(localStorage.getItem('cipher-settings') || '{}').locale;
    if (saved && LOCALES.includes(saved)) return saved;
  } catch { /* ignore */ }
  return 'zh';
}

export function translate(locale, path, vars = {}) {
  const loc = LOCALES.includes(locale) ? locale : 'zh';
  const parts = path.split('.');
  let cur = messages[loc];
  for (const p of parts) {
    cur = cur?.[p];
    if (cur === undefined) break;
  }
  if (cur === undefined) {
    cur = messages.zh;
    for (const p of parts) cur = cur?.[p];
  }
  let str = cur ?? path;
  if (typeof str === 'string' && vars && Object.keys(vars).length) {
    for (const [k, v] of Object.entries(vars)) {
      str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    }
  }
  return str;
}

export function applyDocumentLang(locale) {
  if (typeof document !== 'undefined') {
    document.documentElement.lang = locale === 'zh' ? 'zh-CN' : locale;
  }
}
