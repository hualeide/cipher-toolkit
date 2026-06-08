/**
 * 中文标准电报码（四位数字 ↔ 汉字），数据来自 Unicode Unihan kMainlandTelegraph
 */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const CJK_RE = /[\u4e00-\u9fff\u3400-\u4dbf\uff00-\uffef]/;

let c2t = null;
let t2c = null;
let tradToSimp = null;

function load() {
  if (c2t) return;
  const dir = path.dirname(fileURLToPath(import.meta.url));
  const data = JSON.parse(readFileSync(path.join(dir, 'telegraphCode.json'), 'utf8'));
  c2t = data.c2t;
  t2c = data.t2c;
  try {
    tradToSimp = JSON.parse(readFileSync(path.join(dir, 'tradToSimp.json'), 'utf8'));
  } catch {
    tradToSimp = {};
  }
}

/** 摩斯/电报比对：繁体归一为简体 */
export function normalizeTradSimp(text) {
  load();
  if (!text) return '';
  return [...text].map((ch) => tradToSimp[ch] || ch).join('');
}

export function isTelegraphChar(ch) {
  load();
  return Boolean(c2t[ch]);
}

export function charToTelecode(ch) {
  load();
  if (c2t[ch]) return c2t[ch];
  const simp = tradToSimp[ch];
  if (simp && c2t[simp]) return c2t[simp];
  return null;
}

export function telecodeToChar(code) {
  load();
  const c = String(code).padStart(4, '0');
  return t2c[c] || null;
}

export function hasCjk(text) {
  return CJK_RE.test(text);
}

export { CJK_RE };
