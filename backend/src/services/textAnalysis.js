/**
 * 密文文本统计分析（灵感：CriptoFEP IC / DecryptionToolkeet 熵分析）
 */

const ENGLISH_FREQ = {
  E: 12.7, T: 9.1, A: 8.2, O: 7.5, I: 7.0, N: 6.7, S: 6.3, H: 6.1, R: 6.0,
  D: 4.3, L: 4.0, C: 2.8, U: 2.8, M: 2.4, W: 2.4, F: 2.2, G: 2.0, Y: 2.0,
  P: 1.9, B: 1.5, V: 1.0, K: 0.8, J: 0.15, X: 0.15, Q: 0.10, Z: 0.07,
};

/** Shannon 熵 (bits per char) */
export function shannonEntropy(text) {
  if (!text) return 0;
  const counts = new Map();
  for (const ch of text) counts.set(ch, (counts.get(ch) || 0) + 1);
  const n = text.length;
  let h = 0;
  for (const c of counts.values()) {
    const p = c / n;
    h -= p * Math.log2(p);
  }
  return Math.round(h * 1000) / 1000;
}

/** 重合指数 Index of Coincidence（拉丁字母） */
export function indexOfCoincidence(text) {
  const letters = text.replace(/[^a-zA-Z]/g, '').toUpperCase();
  const n = letters.length;
  if (n < 2) return null;
  const counts = new Map();
  for (const ch of letters) counts.set(ch, (counts.get(ch) || 0) + 1);
  let sum = 0;
  for (const f of counts.values()) sum += f * (f - 1);
  return Math.round((sum / (n * (n - 1))) * 10000) / 10000;
}

/** 英文字母频率分布 */
export function letterFrequency(text) {
  const letters = text.replace(/[^a-zA-Z]/g, '').toUpperCase();
  const total = letters.length || 1;
  const counts = {};
  for (const ch of letters) counts[ch] = (counts[ch] || 0) + 1;
  return Object.keys(counts)
    .sort()
    .map((ch) => ({
      char: ch,
      count: counts[ch],
      pct: Math.round((counts[ch] / total) * 1000) / 10,
      expected: ENGLISH_FREQ[ch] ?? 0,
    }))
    .sort((a, b) => b.count - a.count);
}

function detectCharset(text) {
  const t = text.trim();
  const flags = [];
  if (/^[\x20-\x7e]+$/.test(t)) flags.push('ascii');
  if (/[\u4e00-\u9fff]/.test(t)) flags.push('cjk');
  if (/^[0-9a-fA-F\s]+$/.test(t) && t.replace(/\s/g, '').length % 2 === 0) flags.push('hex');
  if (/^[01\s]+$/.test(t)) flags.push('binary');
  if (/^[A-Za-z0-9+/=]+$/.test(t)) flags.push('base64');
  if (/^eyJ[A-Za-z0-9_-]+\.eyJ/.test(t)) flags.push('jwt');
  if (/^[.\-/\s[\]?]+$/.test(t.replace(/\[\?[^\]]*\]/g, ''))) flags.push('morse');
  if (/%[0-9A-Fa-f]{2}/.test(t)) flags.push('url-encoded');
  if (/^<~.+~>$/.test(t)) flags.push('ascii85');
  return flags;
}

/** Kasiski / 弗里德曼：推测多表替换密钥长度 */
export function kasiskiKeyLengths(text, maxPeriod = 20) {
  const letters = text.replace(/[^a-zA-Z]/g, '').toUpperCase();
  if (letters.length < 16) return [];

  const results = [];
  for (let period = 2; period <= maxPeriod; period++) {
    const groups = Array.from({ length: period }, () => '');
    for (let i = 0; i < letters.length; i++) {
      groups[i % period] += letters[i];
    }
    const ics = groups.map((g) => indexOfCoincidence(g)).filter((v) => v != null);
    if (!ics.length) continue;
    const avg = ics.reduce((a, b) => a + b, 0) / ics.length;
    results.push({ period, avgIc: Math.round(avg * 10000) / 10000 });
  }
  return results.sort((a, b) => b.avgIc - a.avgIc).slice(0, 6);
}

function buildHints(text, { ic, entropy, charset, kasiski }) {
  const hints = [];
  const t = text.trim();

  if (charset.includes('jwt')) {
    hints.push({ type: 'jwt', label: 'JWT 令牌', detail: 'eyJ 开头三段 Base64URL，可尝试 JWT 解析' });
  }
  if (charset.includes('morse')) {
    hints.push({ type: 'morse', label: '摩斯电码', detail: '点划与空格组成，优先尝试摩斯解码' });
  }
  if (charset.includes('base64') && entropy > 4.5) {
    hints.push({ type: 'base64', label: 'Base64', detail: '字符集符合 Base64，熵值偏高' });
  }
  if (charset.includes('hex')) {
    hints.push({ type: 'hex', label: '十六进制', detail: '偶数位 hex 字符，可尝试 Hex 解码' });
  }
  if (charset.includes('binary')) {
    hints.push({ type: 'binary', label: '二进制', detail: '0/1 序列，可尝试 Binary 解码' });
  }
  if (ic != null) {
    if (ic >= 0.065) {
      hints.push({ type: 'mono', label: '单表替换', detail: `IC≈${ic}（英文约 0.067），可能是凯撒/仿射/Atbash` });
    } else if (ic >= 0.045 && ic < 0.065) {
      const kas = kasiski?.[0];
      const kasDetail = kas ? `，Kasiski 推测密钥长度 ${kas.period}（IC≈${kas.avgIc}）` : '';
      hints.push({ type: 'poly', label: '多表替换', detail: `IC≈${ic}，可能是维吉尼亚/Bifid/Autokey${kasDetail}` });
    } else if (ic < 0.042) {
      hints.push({ type: 'random', label: '高随机性', detail: `IC≈${ic} 偏低，可能是压缩/加密/哈希或多层编码` });
    }
  }
  if (entropy >= 5.5 && !charset.includes('jwt')) {
    hints.push({ type: 'entropy', label: '高熵文本', detail: `熵 ${entropy} bit/字符，建议试 XOR/RC4 或多层链解密` });
  }
  if (/^[A-Z2-7=]+$/i.test(t) && t.length >= 8) {
    hints.push({ type: 'base32', label: 'Base32', detail: '字符集符合 Base32 (RFC 4648)' });
  }
  if (/^(\d{1,2})([-\s]\d{1,2})+$/.test(t)) {
    hints.push({ type: 'a1z26', label: 'A1Z26', detail: '数字序列可能是字母序号编码' });
  }

  return hints.slice(0, 6);
}

/** 综合文本分析 */
export function analyzeText(text) {
  const trimmed = text ?? '';
  const sample = trimmed.slice(0, 8000);
  const entropy = shannonEntropy(sample);
  const ic = indexOfCoincidence(sample);
  const frequencies = letterFrequency(sample);
  const charset = detectCharset(sample);
  const kasiski = kasiskiKeyLengths(sample);
  const hints = buildHints(sample, { ic, entropy, charset, kasiski });

  const letterCount = sample.replace(/[^a-zA-Z]/g, '').length;
  const digitCount = (sample.match(/\d/g) || []).length;
  const punctCount = sample.length - letterCount - digitCount - (sample.match(/\s/g) || []).length;

  return {
    length: trimmed.length,
    entropy,
    indexOfCoincidence: ic,
    letterCount,
    digitCount,
    charset,
    hints,
    kasiski,
    frequencies: frequencies.slice(0, 12),
    truncated: trimmed.length > 8000,
  };
}
