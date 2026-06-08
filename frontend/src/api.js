import { apiUrl } from './api/base.js';

export async function fetchCiphers() {
  const res = await fetch(apiUrl('/api/ciphers'));
  if (!res.ok) throw new Error('加载失败');
  return res.json();
}

export async function encrypt(id, text, params) {
  const res = await fetch(apiUrl('/api/ciphers/encrypt'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, text, params }),
  });
  const data = await res.json();
  if (!res.ok) {
    const err = new Error(data.error || '加密失败');
    err.code = data.code;
    err.scripts = data.scripts;
    throw err;
  }
  return data.result;
}

export async function decrypt(id, text, params) {
  const res = await fetch(apiUrl('/api/ciphers/decrypt'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, text, params }),
  });
  const data = await res.json();
  if (!res.ok) {
    const err = new Error(data.error || '解密失败');
    err.code = data.code;
    err.scripts = data.scripts;
    throw err;
  }
  return data.result;
}

export async function identify(text, limit = 15, minScore = 30, extraKeys = []) {
  const res = await fetch(apiUrl('/api/ciphers/identify'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, limit, minScore, extraKeys }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || '识别失败');
  return data.matches;
}

export async function analyzeText(text) {
  const res = await fetch(apiUrl('/api/ciphers/analyze'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || '分析失败');
  return data;
}
