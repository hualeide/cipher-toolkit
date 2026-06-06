export async function fetchCiphers() {
  const res = await fetch('/api/ciphers');
  if (!res.ok) throw new Error('加载失败');
  return res.json();
}

export async function encrypt(id, text, params) {
  const res = await fetch('/api/ciphers/encrypt', {
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
  const res = await fetch('/api/ciphers/decrypt', {
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
  const res = await fetch('/api/ciphers/identify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, limit, minScore, extraKeys }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || '识别失败');
  return data.matches;
}

export async function analyzeText(text) {
  const res = await fetch('/api/ciphers/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || '分析失败');
  return data;
}

export async function autoChain(text) {
  const res = await fetch('/api/ciphers/auto-chain', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, maxDepth: 2 }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || '组合解密失败');
  return data.chains;
}

export async function chainDecrypt(text, steps) {
  const res = await fetch('/api/ciphers/chain-decrypt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, steps }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || '链解密失败');
  return data;
}
