import {
  scorePlaintextMultilingual, looksLikeUnicodeCipherText, shiftCodePoint, isEncodableCodePoint,
  isMultilingualLetter, unicodeCpAffine, unicodeCpVigenere, CP_SPAN, CP_MIN,
} from './unicodeCipher.js';
import { charToTelecode, telecodeToChar, CJK_RE, normalizeTradSimp } from './chineseTelegraphCode.js';

const MORSE = {
  A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.', H: '....',
  I: '..', J: '.---', K: '-.-', L: '.-..', M: '--', N: '-.', O: '---', P: '.--.',
  Q: '--.-', R: '.-.', S: '...', T: '-', U: '..-', V: '...-', W: '.--', X: '-..-',
  Y: '-.--', Z: '--..', 0: '-----', 1: '.----', 2: '..---', 3: '...--', 4: '....-',
  5: '.....', 6: '-....', 7: '--...', 8: '---..', 9: '----.',
};
const MORSE_REV = Object.fromEntries(Object.entries(MORSE).map(([k, v]) => [v, k]));
const MORSE_DIGIT = new Set('0123456789'.split(''));

function morseOne(ch) {
  return MORSE[ch.toUpperCase?.() ? ch.toUpperCase() : ch] || null;
}

function isDigitMorseToken(token) {
  const d = MORSE_REV[token];
  return d !== undefined && MORSE_DIGIT.has(d);
}

function encodeLatinMorse(text) {
  return [...text.toUpperCase()].map((ch) => morseOne(ch) || ch).join(' ');
}

function encodeTelegraphChar(ch) {
  const code = charToTelecode(ch);
  if (!code) return `[?${ch}]`;
  return [...code].map((d) => MORSE[d]).join(' ');
}

const ZH_MORSE_PUNCT = /[，。！？、；：,\.!?;\s]/;

function tokenizeMorseUnits(text) {
  const units = [];
  let latin = '';
  for (const ch of text) {
    if (ZH_MORSE_PUNCT.test(ch)) {
      if (latin) { units.push({ type: 'latin', text: latin }); latin = ''; }
      continue;
    }
    if (ch === ' ') {
      if (latin) { units.push({ type: 'latin', text: latin }); latin = ''; }
      units.push({ type: 'space' });
    } else if (CJK_RE.test(ch)) {
      if (latin) { units.push({ type: 'latin', text: latin }); latin = ''; }
      units.push({ type: 'cjk', text: ch });
    } else {
      latin += ch;
    }
  }
  if (latin) units.push({ type: 'latin', text: latin });
  return units;
}

function decodeMorseSegment(segment, mode) {
  const seg = segment.trim();
  const literal = /^\[\?(.)\]$/.exec(seg);
  if (literal) return literal[1];

  const tokens = seg.split(/\s+/).filter(Boolean);
  if (!tokens.length) return '';

  const allDigits = tokens.every(isDigitMorseToken);
  if (mode === 'zh' || (mode === 'auto' && allDigits)) {
    const digits = tokens.map((t) => MORSE_REV[t]).join('');
    let out = '';
    for (let i = 0; i + 4 <= digits.length; i += 4) {
      const ch = telecodeToChar(digits.slice(i, i + 4));
      out += ch || `(${digits.slice(i, i + 4)})`;
    }
    return out;
  }

  return tokens.map((t) => {
    if (t === '/') return ' ';
    return MORSE_REV[t] || t;
  }).join('');
}

export function morseEncode(text, variant = 'auto') {
  const mode = variant || 'auto';
  const useZh = mode === 'zh' || (mode === 'auto' && CJK_RE.test(text));

  if (!useZh) {
    return text.toUpperCase().split('').map((ch) => {
      if (ch === ' ') return '/';
      return MORSE[ch] || ch;
    }).join(' ');
  }

  const parts = [];
  for (const u of tokenizeMorseUnits(text)) {
    if (u.type === 'space') continue;
    if (u.type === 'cjk') parts.push(encodeTelegraphChar(u.text));
    else parts.push(encodeLatinMorse(u.text));
  }
  return parts.join(' / ');
}

export function morseDecode(text, variant = 'auto') {
  const mode = variant || 'auto';
  const trimmed = text.trim();
  if (!trimmed) return '';

  if (mode === 'intl') {
    return trimmed.split(/\s+/).map((token) => {
      if (token === '/') return ' ';
      return MORSE_REV[token] || token;
    }).join('');
  }

  if (trimmed.includes(' / ')) {
    return polishMorsePlaintext(trimmed.split(' / ').map((seg) => decodeMorseSegment(seg, mode)).join(''));
  }

  return polishMorsePlaintext(decodeMorseSegment(trimmed, mode));
}

function polishMorsePlaintext(text) {
  let s = String(text);
  s = s.replace(/\((\d+)\)/g, '$1');
  return s;
}

/** 摩斯明文比对（标点归一 + 繁简归一 + 拉丁大小写不敏感） */
export function morsePlainEqual(a, b) {
  const norm = (s) => normalizeTradSimp(String(s).replace(/[，。！？、；：,\.!?;\s()（）]/g, '')).toLowerCase();
  return norm(a) === norm(b);
}

const NATO = {
  A: 'Alpha', B: 'Bravo', C: 'Charlie', D: 'Delta', E: 'Echo', F: 'Foxtrot',
  G: 'Golf', H: 'Hotel', I: 'India', J: 'Juliet', K: 'Kilo', L: 'Lima', M: 'Mike',
  N: 'November', O: 'Oscar', P: 'Papa', Q: 'Quebec', R: 'Romeo', S: 'Sierra',
  T: 'Tango', U: 'Uniform', V: 'Victor', W: 'Whiskey', X: 'X-ray', Y: 'Yankee', Z: 'Zulu',
};
const NATO_REV = Object.fromEntries(Object.entries(NATO).map(([k, v]) => [v.toLowerCase(), k]));

const KEYPAD = {
  2: 'ABC', 3: 'DEF', 4: 'GHI', 5: 'JKL', 6: 'MNO', 7: 'PQRS', 8: 'TUV', 9: 'WXYZ',
};
const KEYPAD_REV = {};
for (const [d, letters] of Object.entries(KEYPAD)) {
  for (const c of letters) KEYPAD_REV[c] = d;
}

const POLYBIUS = 'ABCDEFGHIKLMNOPQRSTUVWXYZ';
const POLYBIUS_MAP = {};
for (let i = 0; i < POLYBIUS.length; i++) {
  POLYBIUS_MAP[POLYBIUS[i]] = `${Math.floor(i / 5) + 1}${(i % 5) + 1}`;
}
const POLYBIUS_REV = Object.fromEntries(
  Object.entries(POLYBIUS_MAP).map(([k, v]) => [v, k === 'I' ? 'J' : k])
);

const BACON_A = { A: 'aaaaa', B: 'aaaab', C: 'aaaba', D: 'aaabb', E: 'aabaa', F: 'aabab',
  G: 'aabba', H: 'aabbb', I: 'abaab', J: 'ababa', K: 'ababb', L: 'abbab', M: 'abbba',
  N: 'abbbb', O: 'baaaa', P: 'baaab', Q: 'baaba', R: 'baabb', S: 'babaa', T: 'babab',
  U: 'babba', V: 'babbb', W: 'bbaaa', X: 'bbaab', Y: 'bbaba', Z: 'bbabb' };

const LEET = { a: '4', e: '3', i: '1', o: '0', s: '5', t: '7', l: '1', g: '9', b: '8' };
const LEET_REV = Object.fromEntries(Object.entries(LEET).map(([k, v]) => [v, k]));

const BRAILLE = {
  A: '⠁', B: '⠃', C: '⠉', D: '⠙', E: '⠑', F: '⠋', G: '⠛', H: '⠓', I: '⠊', J: '⠚',
  K: '⠅', L: '⠇', M: '⠍', N: '⠝', O: '⠕', P: '⠏', Q: '⠟', R: '⠗', S: '⠎', T: '⠞',
  U: '⠥', V: '⠧', W: '⠺', X: '⠭', Y: '⠽', Z: '⠵',
};
const BRAILLE_REV = Object.fromEntries(Object.entries(BRAILLE).map(([k, v]) => [v, k]));

/** 各 Unicode 块内 Atbash 对称反射 */
function atbashMultilingualCp(cp) {
  if (cp >= 0x4e00 && cp <= 0x9fff) return 0x4e00 + 0x9fff - cp;
  if (cp >= 0x3400 && cp <= 0x4dbf) return 0x3400 + 0x4dbf - cp;
  if (cp >= 0x3040 && cp <= 0x30ff) return 0x3040 + 0x30ff - cp;
  if (cp >= 0xac00 && cp <= 0xd7af) return 0xac00 + 0xd7af - cp;
  if (cp >= 0xff00 && cp <= 0xffef) return 0xff00 + 0xffef - cp;
  return cp;
}

function expandKeyChars(key) {
  const k = [...(key || 'KEY')];
  return k.length ? k : ['K'];
}

function keyDelta(keyChar, decrypt, latinMod = 26) {
  if (/[a-zA-Z]/.test(keyChar)) {
    const v = keyChar.toUpperCase().charCodeAt(0) - 65;
    return (decrypt ? -v : v);
  }
  return ((keyChar.codePointAt(0) % 997) + 1) * (decrypt ? -1 : 1);
}

export function rot13(text) {
  return caesar(text, 13);
}

export function caesar(text, shift) {
  const n = Number(shift);
  const delta = Number.isFinite(n) && n !== 0 ? n : 3;
  const useUnified = [...text].some((ch) => isMultilingualLetter(ch.codePointAt(0)));
  return [...text].map((ch) => {
    const cp = ch.codePointAt(0);
    if (useUnified && cp <= 0xffff && isEncodableCodePoint(cp)) {
      return String.fromCodePoint(shiftCodePoint(cp, delta));
    }
    if (/[a-zA-Z]/.test(ch)) {
      const base = ch <= 'Z' ? 65 : 97;
      return String.fromCharCode(((ch.charCodeAt(0) - base + delta + 26000) % 26) + base);
    }
    if (cp <= 0xffff && isMultilingualLetter(cp) && isEncodableCodePoint(cp)) {
      return String.fromCodePoint(shiftCodePoint(cp, delta));
    }
    return ch;
  }).join('');
}

export function rot47(text, dir = 1) {
  return text.replace(/[!-~]/g, (ch) => {
    const c = ch.charCodeAt(0);
    const off = ((c - 33 + dir * 47 + 9400) % 94) + 33;
    return String.fromCharCode(off);
  });
}

export function rot5(text, dir = 1) {
  return text.replace(/\d/g, (d) => String((Number(d) + dir * 5 + 10) % 10));
}

export function atbash(text) {
  return [...text].map((ch) => {
    if (/[a-zA-Z]/.test(ch)) {
      const base = ch <= 'Z' ? 65 : 97;
      return String.fromCharCode(base + 25 - (ch.charCodeAt(0) - base));
    }
    const cp = ch.codePointAt(0);
    if (cp <= 0xffff && isMultilingualLetter(cp)) {
      return String.fromCodePoint(atbashMultilingualCp(cp));
    }
    return ch;
  }).join('');
}

export function affine(text, a, b, decrypt = false) {
  if ([...text].some((ch) => isMultilingualLetter(ch.codePointAt(0)))) {
    return unicodeCpAffine(text, a, b, decrypt);
  }
  const modInv = (x) => {
    for (let i = 1; i < 26; i++) if ((a * i) % 26 === 1) return i;
    return 1;
  };
  const inv = decrypt ? modInv(a) : a;
  const add = decrypt ? (-b * modInv(a) + 26000) % 26 : b;
  return text.replace(/[a-zA-Z]/g, (ch) => {
    const upper = ch <= 'Z';
    const x = (ch.toUpperCase().charCodeAt(0) - 65);
    const y = decrypt ? (inv * (x - b + 2600) % 26) : (inv * x + add) % 26;
    const c = String.fromCharCode(y + 65);
    return upper ? c : c.toLowerCase();
  });
}

export function vigenere(text, key, decrypt = false) {
  return unicodeCpVigenere(text, key, decrypt);
}

export function beaufort(text, key) {
  const k = expandKeyChars(key);
  let ki = 0;
  return [...text].map((ch) => {
    if (/[a-zA-Z]/.test(ch)) {
      const upper = ch <= 'Z';
      const p = ch.toUpperCase().charCodeAt(0) - 65;
      const keyChar = k[ki++ % k.length];
      const kv = /[a-zA-Z]/.test(keyChar) ? keyChar.toUpperCase().charCodeAt(0) - 65 : ((keyChar.codePointAt(0) % 997) + 1) % 26;
      const c = String.fromCharCode(((kv - p + 2600) % 26) + 65);
      return upper ? c : c.toLowerCase();
    }
    const cp = ch.codePointAt(0);
    if (cp <= 0xffff && isMultilingualLetter(cp)) {
      const keyChar = k[ki++ % k.length];
      const blockBeaufort = (lo, hi) => {
        const size = hi - lo + 1;
        const pivot = lo + (keyChar.codePointAt(0) % size);
        const n = cp - lo;
        const p = pivot - lo;
        return lo + ((2 * p - n + size * 2) % size);
      };
      if (cp >= 0x4e00 && cp <= 0x9fff) return String.fromCodePoint(blockBeaufort(0x4e00, 0x9fff));
      if (cp >= 0x3400 && cp <= 0x4dbf) return String.fromCodePoint(blockBeaufort(0x3400, 0x4dbf));
      if (cp >= 0x3040 && cp <= 0x30ff) return String.fromCodePoint(blockBeaufort(0x3040, 0x30ff));
      if (cp >= 0xac00 && cp <= 0xd7af) return String.fromCodePoint(blockBeaufort(0xac00, 0xd7af));
      if (cp >= 0xff00 && cp <= 0xffef) return String.fromCodePoint(blockBeaufort(0xff00, 0xffef));
    }
    return ch;
  }).join('');
}

export function autokey(text, key, decrypt = false) {
  const k = expandKeyChars(key);
  const stream = k.map((c) => (/[a-zA-Z]/.test(c) ? c.toUpperCase() : c));
  const out = [];
  let keyIndex = 0;
  const isShiftedCipherChar = (p) => !isMultilingualLetter(p) && p >= 0xa000 && p <= 0xd7af;

  for (const ch of text) {
    if (/[a-zA-Z]/.test(ch)) {
      const upper = ch <= 'Z';
      const p = ch.toUpperCase().charCodeAt(0) - 65;
      const keyChar = stream[keyIndex % stream.length];
      keyIndex++;
      const shift = /[a-zA-Z]/.test(keyChar) ? keyChar.charCodeAt(0) - 65 : ((keyChar.codePointAt(0) % 997) + 1) % 26;
      const plain = decrypt ? ((p - shift + 2600) % 26) : ((p + shift) % 26);
      const c = String.fromCharCode(plain + 65);
      const result = upper ? c : c.toLowerCase();
      out.push(result);
      if (!decrypt) stream.push(ch.toUpperCase());
      else stream.push(result.toUpperCase());
      continue;
    }
    const cp = ch.codePointAt(0);
    if (cp <= 0xffff && isEncodableCodePoint(cp)
      && (isMultilingualLetter(cp) || (decrypt && isShiftedCipherChar(cp)))) {
      const keyChar = stream[keyIndex % stream.length];
      keyIndex++;
      const delta = keyDelta(keyChar, decrypt);
      const result = String.fromCodePoint(shiftCodePoint(cp, delta));
      out.push(result);
      if (!decrypt) stream.push(ch);
      else stream.push(result);
      continue;
    }
    out.push(ch);
  }
  return out.join('');
}

export function keywordSub(text, keyword, decrypt = false) {
  const kw = [...new Set(keyword.toUpperCase().replace(/[^A-Z]/g, ''))];
  const alpha = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const rest = alpha.split('').filter((c) => !kw.includes(c));
  const cipherAlpha = [...kw, ...rest];
  const plainAlpha = alpha.split('');
  const map = decrypt
    ? Object.fromEntries(cipherAlpha.map((c, i) => [c, plainAlpha[i]]))
    : Object.fromEntries(plainAlpha.map((c, i) => [c, cipherAlpha[i]]));
  return text.replace(/[a-zA-Z]/g, (ch) => {
    const u = ch.toUpperCase();
    const r = map[u] || u;
    return ch <= 'Z' ? r : r.toLowerCase();
  });
}

export function railFence(text, rails, decrypt = false) {
  if (rails < 2) return text;
  if (!decrypt) {
    const fence = Array.from({ length: rails }, () => []);
    let rail = 0, dir = 1;
    for (const ch of text) {
      fence[rail].push(ch);
      if (rail === 0) dir = 1;
      else if (rail === rails - 1) dir = -1;
      rail += dir;
    }
    return fence.flat().join('');
  }
  const len = text.length;
  const fence = Array.from({ length: rails }, () => []);
  const pattern = [];
  let rail = 0, dir = 1;
  for (let i = 0; i < len; i++) {
    pattern.push(rail);
    if (rail === 0) dir = 1;
    else if (rail === rails - 1) dir = -1;
    rail += dir;
  }
  const counts = Array(rails).fill(0);
  for (const r of pattern) counts[r]++;
  let idx = 0;
  const rows = Array.from({ length: rails }, () => []);
  for (let r = 0; r < rails; r++) {
    rows[r] = text.slice(idx, idx + counts[r]).split('');
    idx += counts[r];
  }
  const pointers = Array(rails).fill(0);
  let out = '';
  for (const r of pattern) out += rows[r][pointers[r]++];
  return out;
}

export function columnarTransposition(text, key, decrypt = false) {
  const k = key.toUpperCase().replace(/[^A-Z]/g, '');
  if (!k) return text;
  const order = [...k].map((c, i) => [c, i]).sort((a, b) => a[0].localeCompare(b[0]) || a[1] - b[1]).map((x) => x[1]);
  const cols = k.length;
  const rows = Math.ceil(text.length / cols);
  const grid = Array.from({ length: rows }, () => Array(cols).fill(''));
  if (!decrypt) {
    let i = 0;
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++)
        grid[r][c] = text[i++] || 'X';
    return order.map((c) => grid.map((row) => row[c]).join('')).join('');
  }
  const chunkLen = rows;
  const chunks = Array(cols).fill('');
  for (let i = 0; i < cols; i++) {
    chunks[order[i]] = text.slice(i * chunkLen, (i + 1) * chunkLen);
  }
  let out = '';
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) out += chunks[c][r] || '';
  return out.replace(/X+$/, '');
}

export function reverseText(text) {
  return [...text].reverse().join('');
}

export function swapCase(text) {
  return text.replace(/./g, (ch) => (ch === ch.toUpperCase() ? ch.toLowerCase() : ch.toUpperCase()));
}

export function binaryEncode(text) {
  return [...text].map((ch) => ch.charCodeAt(0).toString(2).padStart(8, '0')).join(' ');
}

export function binaryDecode(text) {
  return text.trim().split(/\s+/).map((b) => String.fromCharCode(parseInt(b, 2))).join('');
}

export function hexEncode(text) {
  return [...text].map((ch) => {
    const cp = ch.codePointAt(0);
    return cp.toString(16).padStart(cp <= 0xff ? 2 : 4, '0');
  }).join(' ');
}

export function hexDecode(text) {
  const parts = text.trim().split(/\s+/).filter(Boolean);
  if (parts.length > 1 && parts.every((p) => /^[0-9a-fA-F]{1,4}$/.test(p))) {
    return parts.map((p) => String.fromCodePoint(parseInt(p, 16))).join('');
  }
  if (parts.length && parts.every((p) => /^[0-9a-fA-F]{3,4}$/.test(p))) {
    return parts.map((p) => String.fromCodePoint(parseInt(p, 16))).join('');
  }
  const clean = text.replace(/\s+/g, '');
  let out = '';
  for (let i = 0; i < clean.length; i += 2) {
    out += String.fromCharCode(parseInt(clean.slice(i, i + 2), 16));
  }
  return out;
}

export function octalEncode(text) {
  return [...text].map((ch) => ch.charCodeAt(0).toString(8)).join(' ');
}

export function octalDecode(text) {
  return text.trim().split(/\s+/).map((o) => String.fromCharCode(parseInt(o, 8))).join('');
}

export function base64Encode(text) {
  return Buffer.from(text, 'utf8').toString('base64');
}

export function base64Decode(text) {
  try { return Buffer.from(text.trim(), 'base64').toString('utf8'); } catch { return text; }
}

export function base32Encode(text) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const bytes = Buffer.from(text, 'utf8');
  let bits = '';
  for (const b of bytes) bits += b.toString(2).padStart(8, '0');
  let out = '';
  for (let i = 0; i < bits.length; i += 5) {
    const chunk = bits.slice(i, i + 5).padEnd(5, '0');
    out += alphabet[parseInt(chunk, 2)];
  }
  while (out.length % 8) out += '=';
  return out;
}

export function base32Decode(text) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const clean = text.toUpperCase().replace(/=+$/, '');
  let bits = '';
  for (const ch of clean) {
    const idx = alphabet.indexOf(ch);
    if (idx >= 0) bits += idx.toString(2).padStart(5, '0');
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return Buffer.from(bytes).toString('utf8');
}

export function urlEncode(text) {
  return encodeURIComponent(text);
}

export function urlDecode(text) {
  try { return decodeURIComponent(text); } catch { return text; }
}

function b64urlDecode(str) {
  const pad = str.length % 4 === 0 ? '' : '='.repeat(4 - (str.length % 4));
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/') + pad;
  return Buffer.from(b64, 'base64').toString('utf8');
}

/** JWT 解码（不验证签名，灵感：svelo / CyberChef） */
export function jwtDecode(token) {
  const t = token.trim().replace(/^Bearer\s+/i, '');
  const parts = t.split('.');
  if (parts.length < 2) throw new Error('无效 JWT：需要 header.payload[.signature]');
  const parseJson = (seg) => {
    try { return JSON.parse(b64urlDecode(seg)); } catch { return b64urlDecode(seg); }
  };
  const out = {
    header: parseJson(parts[0]),
    payload: parseJson(parts[1]),
  };
  if (parts[2]) out.signature = parts[2];
  return JSON.stringify(out, null, 2);
}

export function jwtEncode(text, _params) {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(text).toString('base64url');
  return `${header}.${payload}.`;
}

export function htmlEntitiesEncode(text) {
  return text.replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]));
}

export function htmlEntitiesDecode(text) {
  return text
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

export function unicodeEscapeEncode(text) {
  return [...text].map((ch) => {
    const c = ch.codePointAt(0);
    return c > 127 ? `\\u${c.toString(16).padStart(4, '0')}` : ch;
  }).join('');
}

export function unicodeEscapeDecode(text) {
  return text.replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

export function baconEncode(text, style = 'A') {
  const map = BACON_A;
  return text.toUpperCase().replace(/[^A-Z]/g, '').split('').map((c) => map[c] || '').join('');
}

export function baconDecode(text) {
  const clean = text.toLowerCase().replace(/[^ab]/g, '');
  const rev = Object.fromEntries(Object.entries(BACON_A).map(([k, v]) => [v, k]));
  let out = '';
  for (let i = 0; i + 5 <= clean.length; i += 5) {
    const chunk = clean.slice(i, i + 5);
    out += rev[chunk] || '?';
  }
  return out;
}

export function tapCodeEncode(text) {
  const grid = 'ABCDEFGHIKLMNOPQRSTUVWXYZ';
  return text.toUpperCase().split('').map((ch) => {
    if (ch === ' ') return '  ';
    const c = ch === 'J' ? 'I' : ch;
    const idx = grid.indexOf(c);
    if (idx < 0) return ch;
    const r = Math.floor(idx / 5) + 1;
    const col = (idx % 5) + 1;
    return `${r}${col}`;
  }).join(' ');
}

export function tapCodeDecode(text) {
  const grid = 'ABCDEFGHIKLMNOPQRSTUVWXYZ';
  return text.trim().split(/\s+/).map((pair) => {
    if (pair.length !== 2) return pair;
    const r = Number(pair[0]) - 1;
    const c = Number(pair[1]) - 1;
    return grid[r * 5 + c] || pair;
  }).join('');
}

export function phoneKeypadEncode(text) {
  const parts = text.toUpperCase().split('').map((ch) => {
    if (ch === ' ') return '0';
    for (const [d, letters] of Object.entries(KEYPAD)) {
      const idx = letters.indexOf(ch);
      if (idx >= 0) return d.repeat(idx + 1);
    }
    return ch;
  });
  return parts.join(' ');
}

export function phoneKeypadDecode(text) {
  return text.trim().split(/\s+/).map((group) => {
    if (!group || group === '0') return ' ';
    const d = group[0];
    const count = group.length;
    const letters = KEYPAD[d];
    return letters ? letters[(count - 1) % letters.length] : group;
  }).join('');
}

export function polybiusEncode(text) {
  return text.toUpperCase().split('').map((ch) => {
    if (ch === ' ') return '  ';
    const c = ch === 'J' ? 'I' : ch;
    return POLYBIUS_MAP[c] || ch;
  }).join(' ');
}

export function polybiusDecode(text) {
  return text.trim().split(/\s+/).map((pair) => POLYBIUS_REV[pair] || pair).join('');
}

export function natoEncode(text) {
  return text.toUpperCase().split(/\s*/).filter(Boolean).map((ch) => NATO[ch] || ch).join(' ');
}

export function natoDecode(text) {
  return text.split(/\s+/).map((w) => NATO_REV[w.toLowerCase()] || w[0]?.toUpperCase() || '').join('');
}

export function leetEncode(text) {
  return text.toLowerCase().split('').map((ch) => LEET[ch] || ch).join('');
}

export function leetDecode(text) {
  return text.split('').map((ch) => LEET_REV[ch] || ch).join('');
}

export function pigLatinEncode(text) {
  return text.split(/(\s+)/).map((word) => {
    if (!/^[a-zA-Z]+$/.test(word)) return word;
    const lower = word.toLowerCase();
    if (/^[aeiou]/.test(lower)) return word + 'way';
    const m = lower.match(/^([^aeiou]+)(.*)$/);
    return m ? m[2] + m[1] + 'ay' : word;
  }).join('');
}

export function pigLatinDecode(text) {
  return text.split(/(\s+)/).map((word) => {
    if (!/^[a-zA-Z]+$/.test(word)) return word;
    const lower = word.toLowerCase();
    if (lower.endsWith('way')) return lower.slice(0, -3);
    if (lower.endsWith('ay')) {
      const stem = lower.slice(0, -2);
      const m = stem.match(/^([a-z]*?)([b-df-hj-np-tv-z]+)$/i);
      if (m) return m[2] + m[1];
    }
    return word;
  }).join('');
}

export function xorCipher(text, keyByte) {
  return [...text].map((ch) => String.fromCharCode(ch.charCodeAt(0) ^ keyByte)).join('');
}

export function rot18(text, decrypt = false) {
  let s = text;
  s = caesar(s, decrypt ? -13 : 13);
  s = rot5(s, decrypt ? -1 : 1);
  return s;
}

export function keyboardShift(text, shift = 1) {
  const rows = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
  const map = {};
  for (const row of rows) {
    for (let i = 0; i < row.length; i++) {
      map[row[i]] = row[(i + shift + 100) % row.length];
    }
  }
  return text.split('').map((ch) => {
    const l = ch.toLowerCase();
    const m = map[l];
    if (!m) return ch;
    return ch <= 'Z' ? m.toUpperCase() : m;
  }).join('');
}

export function keyboardShiftDecode(text, shift = 1) {
  const rows = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
  const rev = {};
  for (const row of rows) {
    for (let i = 0; i < row.length; i++) {
      rev[row[(i + shift + 100) % row.length]] = row[i];
    }
  }
  return text.split('').map((ch) => {
    const l = ch.toLowerCase();
    const m = rev[l];
    if (!m) return ch;
    return ch <= 'Z' ? m.toUpperCase() : m;
  }).join('');
}

export function zigzagEncode(text, rails = 3) {
  return railFence(text, rails, false);
}

export function zigzagDecode(text, rails = 3) {
  return railFence(text, rails, true);
}

export function evenOddSplit(text) {
  const even = [], odd = [];
  [...text].forEach((ch, i) => (i % 2 === 0 ? even : odd).push(ch));
  return even.join('') + odd.join('');
}

export function evenOddMerge(text) {
  const mid = Math.ceil(text.length / 2);
  const even = text.slice(0, mid).split('');
  const odd = text.slice(mid).split('');
  let out = '';
  for (let i = 0; i < text.length; i++) {
    out += i % 2 === 0 ? (even.shift() || '') : (odd.shift() || '');
  }
  return out;
}

export function fullwidthEncode(text) {
  return [...text].map((ch) => {
    const c = ch.codePointAt(0);
    if (c >= 33 && c <= 126) return String.fromCodePoint(c + 0xFEE0);
    return ch;
  }).join('');
}

export function fullwidthDecode(text) {
  return [...text].map((ch) => {
    const c = ch.codePointAt(0);
    if (c >= 0xFF01 && c <= 0xFF5E) return String.fromCodePoint(c - 0xFEE0);
    return ch;
  }).join('');
}

export function upsideDown(text) {
  const map = {
    a: 'ɐ', b: 'q', c: 'ɔ', d: 'p', e: 'ǝ', f: 'ɟ', g: 'ƃ', h: 'ɥ', i: 'ᴉ', j: 'ɾ',
    k: 'ʞ', l: 'l', m: 'ɯ', n: 'u', o: 'o', p: 'd', q: 'b', r: 'ɹ', s: 's', t: 'ʇ',
    u: 'n', v: 'ʌ', w: 'ʍ', x: 'x', y: 'ʎ', z: 'z',
  };
  return reverseText(text.toLowerCase().split('').map((c) => map[c] || c).join(''));
}

export function upsideDownDecode(text) {
  const inv = {
    ɐ: 'a', q: 'b', ɔ: 'c', p: 'd', ǝ: 'e', ɟ: 'f', ƃ: 'g', ɥ: 'h', ᴉ: 'i', ɾ: 'j',
    ʞ: 'k', l: 'l', ɯ: 'm', u: 'n', o: 'o', d: 'p', b: 'q', ɹ: 'r', s: 's', ʇ: 't',
    ʌ: 'v', ʍ: 'w', x: 'x', ʎ: 'y', z: 'z',
  };
  return reverseText([...text].map((c) => inv[c] || c).join(''));
}

export function brailleEncode(text) {
  return text.toUpperCase().split('').map((c) => BRAILLE[c] || c).join('');
}

export function brailleDecode(text) {
  return [...text].map((c) => BRAILLE_REV[c] || c).join('');
}

export function gronsfeld(text, key, decrypt = false) {
  const digits = key.replace(/\D/g, '').split('').map(Number);
  if (!digits.length) return text;
  let di = 0;
  return [...text].map((ch) => {
    const shift = (decrypt ? -1 : 1) * digits[di++ % digits.length];
    if (/[a-zA-Z]/.test(ch)) {
      const base = ch <= 'Z' ? 65 : 97;
      return String.fromCharCode(((ch.charCodeAt(0) - base + shift + 26000) % 26) + base);
    }
    const cp = ch.codePointAt(0);
    if (cp <= 0xffff && isMultilingualLetter(cp) && isEncodableCodePoint(cp)) {
      return String.fromCodePoint(shiftCodePoint(cp, shift));
    }
    return ch;
  }).join('');
}

export function scytale(text, diameter, decrypt = false) {
  const cols = diameter;
  const rows = Math.ceil(text.length / cols);
  const padded = text.padEnd(rows * cols, 'X');
  if (!decrypt) {
    let out = '';
    for (let c = 0; c < cols; c++)
      for (let r = 0; r < rows; r++)
        out += padded[r * cols + c];
    return out.replace(/X+$/, '');
  }
  const grid = [];
  let idx = 0;
  for (let c = 0; c < cols; c++)
    for (let r = 0; r < rows; r++)
      grid[r * cols + c] = padded[idx++];
  return grid.join('').replace(/X+$/, '');
}

export function playfair(text, key, decrypt = false) {
  const buildMatrix = (kw) => {
    const seen = new Set();
    const chars = [];
    const add = (c) => {
      const x = c === 'J' ? 'I' : c;
      if (!seen.has(x) && /[A-Z]/.test(x)) { seen.add(x); chars.push(x); }
    };
    for (const c of kw.toUpperCase()) add(c);
    for (const c of 'ABCDEFGHIKLMNOPQRSTUVWXYZ') add(c);
    const m = [];
    for (let i = 0; i < 5; i++) m.push(chars.slice(i * 5, i * 5 + 5));
    return m;
  };
  const pos = (m, ch) => {
    const c = ch === 'J' ? 'I' : ch;
    for (let r = 0; r < 5; r++)
      for (let c2 = 0; c2 < 5; c2++)
        if (m[r][c2] === c) return [r, c2];
    return [0, 0];
  };
  const m = buildMatrix(key || 'KEYWORD');
  let s = text.toUpperCase().replace(/J/g, 'I').replace(/[^A-Z]/g, '');
  const pairs = [];
  for (let i = 0; i < s.length; i++) {
    const a = s[i];
    if (i + 1 >= s.length) {
      pairs.push([a, 'X']);
      break;
    }
    const b = s[i + 1];
    if (a === b) {
      pairs.push([a, 'X']);
    } else {
      pairs.push([a, b]);
      i++;
    }
  }
  const step = (a, b) => {
    const [r1, c1] = pos(m, a);
    const [r2, c2] = pos(m, b);
    if (r1 === r2) return [m[r1][(c1 + (decrypt ? -1 : 1) + 5) % 5], m[r2][(c2 + (decrypt ? -1 : 1) + 5) % 5]];
    if (c1 === c2) return [m[(r1 + (decrypt ? -1 : 1) + 5) % 5][c1], m[(r2 + (decrypt ? -1 : 1) + 5) % 5][c2]];
    return [m[r1][c2], m[r2][c1]];
  };
  const raw = pairs.map(([a, b]) => step(a, b).join('')).join('');
  if (!decrypt) return raw;
  return raw.replace(/([A-Z])X\1/g, '$1$1').replace(/X$/, '');
}

export function rotAll(text, n, decrypt = false) {
  const dir = decrypt ? -n : n;
  const useUnified = [...text].some((ch) => isMultilingualLetter(ch.codePointAt(0)));
  return [...text].map((ch) => {
    const cp = ch.codePointAt(0);
    if (useUnified && cp <= 0xffff && isEncodableCodePoint(cp)) {
      return String.fromCodePoint(shiftCodePoint(cp, dir));
    }
    const c = ch.charCodeAt(0);
    if (c >= 65 && c <= 90) return String.fromCharCode(((c - 65 + dir + 2600) % 26) + 65);
    if (c >= 97 && c <= 122) return String.fromCharCode(((c - 97 + dir + 2600) % 26) + 97);
    if (c >= 48 && c <= 57) return String.fromCharCode(((c - 48 + dir + 100) % 10) + 48);
    if (cp <= 0xffff && isMultilingualLetter(cp) && isEncodableCodePoint(cp)) {
      return String.fromCodePoint(shiftCodePoint(cp, dir));
    }
    return ch;
  }).join('');
}

export function quotedPrintableEncode(text) {
  const bytes = Buffer.from(text, 'utf8');
  let out = '';
  for (const b of bytes) {
    if (b >= 33 && b <= 126 && b !== 61) out += String.fromCharCode(b);
    else if (b === 32) out += ' ';
    else if (b === 9) out += '\t';
    else if (b === 10) out += '\n';
    else out += `=${b.toString(16).toUpperCase().padStart(2, '0')}`;
  }
  return out;
}

export function quotedPrintableDecode(text) {
  const bytes = [];
  const cleaned = text.replace(/=\r?\n/g, '');
  for (let i = 0; i < cleaned.length; i++) {
    if (cleaned[i] === '=' && /^[0-9A-Fa-f]{2}/.test(cleaned.slice(i + 1, i + 3))) {
      bytes.push(parseInt(cleaned.slice(i + 1, i + 3), 16));
      i += 2;
    } else {
      bytes.push(cleaned.charCodeAt(i));
    }
  }
  return Buffer.from(bytes).toString('utf8');
}

export function ascii85Encode(text) {
  const data = Buffer.from(text, 'utf8');
  let out = '<~';
  for (let i = 0; i < data.length; i += 4) {
    let tuple = 0n;
    let n = 0;
    for (let j = 0; j < 4 && i + j < data.length; j++) {
      tuple = (tuple << 8n) | BigInt(data[i + j]);
      n += 1;
    }
    if (n < 4) tuple <<= BigInt((4 - n) * 8);
    if (tuple === 0n && n === 4) {
      out += 'z';
      continue;
    }
    const digits = [];
    for (let j = 0; j < 5; j++) {
      digits.push(Number(tuple % 85n));
      tuple /= 85n;
    }
    digits.reverse();
    out += digits.slice(0, n + 1).map((x) => String.fromCharCode(x + 33)).join('');
  }
  return `${out}~>`;
}

export function ascii85Decode(text) {
  let s = text.trim().replace(/^<~/, '').replace(/~>$/, '').replace(/\s/g, '');
  const bytes = [];
  for (let i = 0; i < s.length;) {
    if (s[i] === 'z') {
      bytes.push(0, 0, 0, 0);
      i += 1;
      continue;
    }
    const origLen = Math.min(5, s.length - i);
    const chunk = s.slice(i, i + origLen).padEnd(5, 'u');
    i += origLen;
    let tuple = 0n;
    for (const ch of chunk) tuple = tuple * 85n + BigInt(ch.charCodeAt(0) - 33);
    const tupleBytes = [];
    for (let j = 0; j < 4; j++) {
      tupleBytes.push(Number((tuple >> BigInt(8 * (3 - j))) & 0xffn));
    }
    const outCount = origLen === 5 ? 4 : origLen - 1;
    bytes.push(...tupleBytes.slice(0, outCount));
  }
  return Buffer.from(bytes).toString('utf8');
}

export function bubbleText(text) {
  const offset = 0x1D400 - 65;
  return text.toUpperCase().replace(/[A-Z]/g, (c) => String.fromCodePoint(c.charCodeAt(0) + offset));
}

export function bubbleTextDecode(text) {
  const offset = 0x1D400 - 65;
  return [...text].map((ch) => {
    const c = ch.codePointAt(0);
    if (c >= 0x1D400 && c <= 0x1D419) return String.fromCharCode(c - offset);
    return ch;
  }).join('');
}

export function zeroWidthEncode(text) {
  return [...text].map((ch) => {
    const bin = ch.charCodeAt(0).toString(2).padStart(16, '0');
    return bin.split('').map((b) => (b === '0' ? '\u200B' : '\u200C')).join('') + '\u200D';
  }).join('');
}

export function zeroWidthDecode(text) {
  const parts = text.split('\u200D').filter(Boolean);
  return parts.map((part) => {
    const bits = [...part].map((ch) => (ch === '\u200B' ? '0' : '1')).join('');
    return String.fromCharCode(parseInt(bits, 2));
  }).join('');
}

export function scorePlaintext(text) {
  if (!text || text.length < 2) return 0;

  const lower = text.toLowerCase();
  let score = 0;

  const printable = [...text].filter((c) => {
    const n = c.charCodeAt(0);
    return (n >= 32 && n <= 126) || (n >= 0x4e00 && n <= 0x9fff);
  }).length;
  score += (printable / text.length) * 25;

  const COMMON = [
    'the', 'and', 'is', 'to', 'of', 'in', 'a', 'hello', 'hellow', 'heelow', 'world',
    'test', 'you', 'are', 'this', 'that', 'have', 'for', 'not', 'with', 'hi', 'hey',
    'password', 'secret', 'welcome', 'good', 'morning', 'love', 'cat', 'dog', 'yes', 'no',
    '你', '的', '是', '我', '好', '世界',
  ];
  for (const w of COMMON) {
    if (lower === w) score += 45;
    else if (lower.includes(w)) score += 12;
  }

  if (WORD_SET.has(lower)) score += 50;

  const words = lower.match(/[a-z]+/g) || [];
  for (const w of words) {
    if (WORD_SET.has(w)) score += 25;
    else if (w.length >= 3 && fuzzyWordMatch(w)) score += 18;
    else if (w.length >= 3) score -= 12;
  }
  if (words.length >= 2 && words.every((w) => WORD_SET.has(w) || fuzzyWordMatch(w))) score += 25;

  score += englishFreqScore(lower) * 20;

  const vowels = (lower.match(/[aeiou]/g) || []).length;
  const letters = (lower.match(/[a-z]/g) || []).length;
  if (letters > 0) {
    const ratio = vowels / letters;
    if (ratio >= 0.25 && ratio <= 0.55) score += 12;
    if (ratio < 0.15 || ratio > 0.7) score -= 10;
  }

  const spaces = (text.match(/\s/g) || []).length;
  score += Math.min(spaces * 3, 12);

  if (/^[a-zA-Z\s.,!?;:'"\-]+$/.test(text)) score += 8;

  if (/(.)\1{2,}/.test(lower) && !WORD_SET.has(lower)) score -= 8;

  const ml = scorePlaintextMultilingual(text);
  return Math.max(0, Math.min(Math.round(Math.max(score, ml)), 100));
}

/** 英文词典命中率（0–1），用于凯撒等多移位消歧 */
export function scoreEnglishLexicon(text) {
  const words = (String(text || '').toLowerCase().match(/[a-z]+/g) || []);
  if (!words.length) return 0;
  let acc = 0;
  for (const w of words) {
    if (WORD_SET.has(w)) acc += 1;
    else if (w.length >= 4) acc -= 0.65;
    else acc += 0.05;
  }
  return Math.max(0, Math.min(1, acc / words.length));
}

/** 输入本身是否已是可读明文（非密文） */
export function isLikelyPlaintext(text) {
  const t = text.trim();
  if (!t || t.length < 2) return false;

  if (/^[A-Za-z0-9+/=]{8,}$/.test(t) && /[+/=]/.test(t)) return false;
  if (/^[0-9a-f\s]{4,}$/i.test(t) && t.replace(/\s/g, '').length % 2 === 0) return false;
  if (/^[.\-/|\s]{3,}$/.test(t)) return false;
  if (/^[01\s]{8,}$/.test(t)) return false;
  if (/^[0-9\s]{4,}$/.test(t)) return false;

  if (looksLikeUnicodeCipherText(t)) return false;

  if (/[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/.test(t)) {
    if (scorePlaintextMultilingual(t) >= 58) return true;
    return false;
  }

  const lower = t.toLowerCase();
  if (WORD_SET.has(lower)) return true;

  const alphaOnly = /^[a-zA-Z]+$/.test(t);
  if (alphaOnly && t.length >= 3 && scorePlaintext(t) >= 70) return true;

  if (/^[a-zA-Z\s.,!?'"()-]+$/.test(t) && scorePlaintext(t) >= 80) return true;

  return false;
}

/** 解密结果是否只是大小写/ trivial 变换 */
export function isTrivialTransform(input, output) {
  if (!input || !output) return false;
  if (input === output) return true;
  if (input.toLowerCase() === output.toLowerCase()) return true;
  if (input.toUpperCase() === output.toUpperCase()) return true;
  return false;
}

/** 解密是否带来实质改进 */
export function isMeaningfulDecrypt(input, output) {
  if (isTrivialTransform(input, output)) return false;
  const inScore = scorePlaintext(input);
  const outScore = scorePlaintext(output);
  if (outScore < inScore + 8) return false;
  if (inScore >= 70 && outScore - inScore < 15) return false;
  return true;
}

const ENGLISH_FREQ = {
  a: 0.0817, b: 0.0149, c: 0.0278, d: 0.0425, e: 0.1270, f: 0.0223, g: 0.0202,
  h: 0.0609, i: 0.0697, j: 0.0015, k: 0.0077, l: 0.0403, m: 0.0241, n: 0.0675,
  o: 0.0750, p: 0.0193, q: 0.0010, r: 0.0599, s: 0.0633, t: 0.0906, u: 0.0276,
  v: 0.0098, w: 0.0236, x: 0.0015, y: 0.0197, z: 0.0007,
};

const WORD_SET = new Set([
  'a', 'i', 'am', 'an', 'as', 'at', 'be', 'by', 'do', 'go', 'he', 'hi', 'if', 'in', 'is', 'it',
  'me', 'my', 'no', 'of', 'ok', 'on', 'or', 'so', 'to', 'up', 'us', 'we',
  'all', 'and', 'any', 'are', 'bad', 'big', 'boy', 'but', 'can', 'cat', 'day', 'did', 'dog',
  'end', 'eye', 'for', 'get', 'got', 'had', 'has', 'her', 'him', 'his', 'how', 'its', 'let',
  'man', 'may', 'new', 'not', 'now', 'old', 'one', 'our', 'out', 'own', 'put', 'red', 'run',
  'say', 'see', 'she', 'sun', 'ten', 'the', 'too', 'top', 'try', 'two', 'use', 'was', 'way',
  'who', 'why', 'win', 'yes', 'yet', 'you',
  'able', 'also', 'back', 'been', 'best', 'book', 'call', 'came', 'care', 'city', 'come',
  'cool', 'dark', 'does', 'done', 'door', 'down', 'each', 'even', 'ever', 'face', 'fact',
  'fall', 'fast', 'find', 'fine', 'fire', 'first', 'food', 'found', 'free', 'from', 'full',
  'game', 'gave', 'girl', 'give', 'good', 'great', 'group', 'grow', 'hand', 'hard', 'have',
  'head', 'hear', 'help', 'here', 'high', 'hold', 'home', 'hope', 'hour', 'idea', 'into',
  'just', 'keep', 'kind', 'know', 'land', 'last', 'late', 'lead', 'left', 'life', 'like',
  'line', 'list', 'live', 'long', 'look', 'love', 'made', 'make', 'many', 'mean', 'mind',
  'more', 'most', 'move', 'much', 'must', 'name', 'near', 'need', 'next', 'nice', 'night',
  'only', 'open', 'over', 'part', 'pass', 'past', 'plan', 'play', 'read', 'real', 'rest',
  'right', 'room', 'same', 'seem', 'self', 'show', 'side', 'some', 'soon', 'sort', 'such',
  'sure', 'take', 'talk', 'tell', 'than', 'that', 'them', 'then', 'they', 'this', 'time',
  'turn', 'under', 'very', 'want', 'well', 'went', 'were', 'what', 'when', 'will', 'with',
  'word', 'work', 'world', 'year', 'your',
  'meet', 'me', 'trust', 'one', 'journal', 'gravity', 'falls', 'stan', 'dipper', 'mabel',
  'testing', 'mouse', 'keyboard', 'computer', 'china', 'english', 'friend', 'thanks', 'please',
  'sorry', 'happy', 'beautiful', 'people', 'think', 'about', 'after', 'again', 'before',
  'being', 'between', 'could', 'every', 'hello', 'little', 'never', 'other', 'place', 'right',
  'should', 'small', 'something', 'still', 'their', 'there', 'these', 'those', 'through',
  'today', 'together', 'under', 'where', 'which', 'while', 'would', 'write',
  'attack', 'dawn', 'dusk', 'enemy', 'defend', 'message', 'cipher', 'crypto',
  'covert', 'signal', 'command', 'retreat', 'advance', 'midnight', 'alert',
  'agent', 'decode', 'encode', 'plain', 'shift', 'secret', 'hidden', 'strike',
  'quick', 'brown', 'fox', 'lazy', 'jumps', 'dog', 'pack', 'my', 'box',
]);

function englishFreqScore(text) {
  const letters = text.replace(/[^a-z]/g, '');
  if (letters.length < 2) return 0;
  const counts = {};
  for (const ch of letters) counts[ch] = (counts[ch] || 0) + 1;
  let chi = 0;
  for (const [ch, freq] of Object.entries(ENGLISH_FREQ)) {
    const observed = (counts[ch] || 0) / letters.length;
    chi += ((observed - freq) ** 2) / freq;
  }
  return Math.max(0, 1 - chi / 2);
}

function fuzzyWordMatch(word) {
  if (word.length < 4) return false;
  for (const known of ['hello', 'hellow', 'heelow', 'world', 'test', 'password', 'secret']) {
    if (levenshtein(word, known) <= 1) return true;
  }
  return false;
}

function levenshtein(a, b) {
  const dp = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
  }
  return dp[a.length][b.length];
}

export function decimalEncode(text) {
  return [...text].map((ch) => ch.charCodeAt(0)).join(' ');
}

export function decimalDecode(text) {
  return text.trim().split(/\s+/).map((n) => String.fromCharCode(Number(n))).join('');
}

const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

export function base58Encode(text) {
  let num = BigInt('0x' + Buffer.from(text, 'utf8').toString('hex'));
  let out = '';
  while (num > 0n) {
    out = B58[Number(num % 58n)] + out;
    num /= 58n;
  }
  for (const ch of text) { if (ch === '\0') out = '1' + out; else break; }
  return out || '1';
}

export function base58Decode(text) {
  let num = 0n;
  for (const ch of text) num = num * 58n + BigInt(B58.indexOf(ch));
  let hex = num.toString(16);
  if (hex.length % 2) hex = '0' + hex;
  return Buffer.from(hex, 'hex').toString('utf8');
}

export function hillCipher(text, matrixStr, decrypt = false) {
  const nums = (matrixStr || '3,2,5,7').split(',').map(Number);
  if (nums.length !== 4) return text;
  const det = nums[0] * nums[3] - nums[1] * nums[2];
  const modInv = (d) => { for (let i = 1; i < 26; i++) if ((d * i) % 26 === 1) return i; return 1; };
  let mat = nums;
  if (decrypt) {
    const inv = modInv((det % 26 + 26) % 26);
    mat = [inv * nums[3] % 26, (-inv * nums[1] % 26 + 26) % 26, (-inv * nums[2] % 26 + 26) % 26, inv * nums[0] % 26];
  }
  let s = text.toUpperCase().replace(/[^A-Z]/g, '');
  if (s.length % 2) s += 'X';
  let out = '';
  for (let i = 0; i < s.length; i += 2) {
    const x = s.charCodeAt(i) - 65;
    const y = s.charCodeAt(i + 1) - 65;
    out += String.fromCharCode(((mat[0] * x + mat[1] * y) % 26) + 65);
    out += String.fromCharCode(((mat[2] * x + mat[3] * y) % 26) + 65);
  }
  if (decrypt) out = out.replace(/X$/, '');
  return out;
}

export function jcukenShift(text, shift = 1) {
  const ru = 'йцукенгшщзхъфывапролджэячсмитьбю';
  const len = ru.length;
  return text.toLowerCase().split('').map((ch) => {
    const idx = ru.indexOf(ch);
    if (idx < 0) return ch;
    return ru[((idx + shift) % len + len) % len];
  }).join('');
}

export function uuencode(text) {
  const buf = Buffer.from(text, 'utf8');
  let out = '';
  for (let i = 0; i < buf.length; i += 45) {
    const chunk = buf.slice(i, i + 45);
    out += String.fromCharCode(32 + chunk.length);
    for (let j = 0; j < chunk.length; j += 3) {
      const b = [chunk[j], chunk[j + 1] || 0, chunk[j + 2] || 0];
      const v = (b[0] << 16) | (b[1] << 8) | b[2];
      out += String.fromCharCode(32 + ((v >> 18) & 63), 32 + ((v >> 12) & 63), 32 + ((v >> 6) & 63), 32 + (v & 63));
    }
    out += '\n';
  }
  return out.trim();
}

export function uudecode(text) {
  const lines = text.trim().split('\n');
  const bytes = [];
  for (const line of lines) {
    if (!line.length) continue;
    const len = line.charCodeAt(0) - 32;
    const body = line.slice(1);
    for (let i = 0; i < body.length; i += 4) {
      const v = ((body.charCodeAt(i) - 32) << 18) | ((body.charCodeAt(i + 1) - 32) << 12)
        | ((body.charCodeAt(i + 2) - 32) << 6) | (body.charCodeAt(i + 3) - 32);
      bytes.push((v >> 16) & 255, (v >> 8) & 255, v & 255);
    }
    bytes.length = bytes.length - (bytes.length - len > 0 ? bytes.length - len : 0);
  }
  return Buffer.from(bytes).toString('utf8');
}

export function otpEncrypt(text, key) {
  const k = key || 'KEY';
  return [...text].map((ch, i) => String.fromCharCode(ch.charCodeAt(0) ^ k.charCodeAt(i % k.length))).join('');
}

export function adler32(text) {
  let a = 1, b = 0;
  for (let i = 0; i < text.length; i++) {
    a = (a + text.charCodeAt(i)) % 65521;
    b = (b + a) % 65521;
  }
  return ((b << 16) | a) >>> 0;
}

export function enigmaSimple(text, rotorPos = 0, decrypt = false) {
  const alpha = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const rotor = alpha.split('').map((_, i) => alpha[(i + rotorPos + 5) % 26]).join('');
  const map = decrypt
    ? Object.fromEntries([...rotor].map((c, i) => [c, alpha[i]]))
    : Object.fromEntries(alpha.split('').map((c, i) => [c, rotor[i]]));
  return text.replace(/[a-zA-Z]/g, (ch) => {
    const u = ch.toUpperCase();
    const r = map[u] || u;
    return ch <= 'Z' ? r : r.toLowerCase();
  });
}

export function runningKey(text, keyText, decrypt = false) {
  return vigenere(text, keyText || 'THE QUICK BROWN FOX JUMPS OVER THE LAZY DOG', decrypt);
}

function buildPolybius5x5(key = 'KEYWORD') {
  const seen = new Set();
  const chars = [];
  const add = (c) => {
    const x = c === 'J' ? 'I' : c;
    if (!seen.has(x) && /[A-Z]/.test(x)) { seen.add(x); chars.push(x); }
  };
  for (const c of key.toUpperCase()) add(c);
  for (const c of 'ABCDEFGHIKLMNOPQRSTUVWXYZ') add(c);
  const m = [];
  for (let i = 0; i < 5; i++) m.push(chars.slice(i * 5, i * 5 + 5));
  return m;
}

function polybiusPos(m, ch) {
  const c = ch === 'J' ? 'I' : ch;
  for (let r = 0; r < 5; r++) {
    for (let c2 = 0; c2 < 5; c2++) {
      if (m[r][c2] === c) return [r, c2];
    }
  }
  return [0, 0];
}

export function bifidEncode(text, key = 'KEYWORD') {
  const m = buildPolybius5x5(key);
  const s = text.toUpperCase().replace(/J/g, 'I').replace(/[^A-Z]/g, '');
  const rows = [];
  const cols = [];
  for (const ch of s) {
    const [r, c] = polybiusPos(m, ch);
    rows.push(r);
    cols.push(c);
  }
  const stream = [...rows, ...cols];
  let out = '';
  for (let i = 0; i < stream.length; i += 2) {
    const r = stream[i];
    const c = stream[i + 1];
    if (c !== undefined) out += m[r][c];
  }
  return out;
}

export function bifidDecode(text, key = 'KEYWORD') {
  const m = buildPolybius5x5(key);
  const s = text.toUpperCase().replace(/J/g, 'I').replace(/[^A-Z]/g, '');
  const coords = [];
  for (const ch of s) {
    const [r, c] = polybiusPos(m, ch);
    coords.push(r, c);
  }
  const half = coords.length / 2;
  const top = coords.slice(0, half);
  const bottom = coords.slice(half);
  let out = '';
  for (let i = 0; i < half; i++) {
    out += m[top[i]][bottom[i]];
  }
  return out;
}

const TRIFID_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ.';

function buildTrifidCube(key = 'KEYWORD') {
  const seen = new Set();
  const chars = [];
  const add = (c) => {
    const x = c.toUpperCase();
    if (!seen.has(x) && TRIFID_ALPHABET.includes(x)) { seen.add(x); chars.push(x); }
  };
  for (const c of key) add(c);
  for (const c of TRIFID_ALPHABET) add(c);
  const cube = [];
  let idx = 0;
  for (let l = 0; l < 3; l++) {
    const layer = [];
    for (let r = 0; r < 3; r++) {
      const row = [];
      for (let c = 0; c < 3; c++) row.push(chars[idx++]);
      layer.push(row);
    }
    cube.push(layer);
  }
  return cube;
}

function trifidPos(cube, ch) {
  const c = ch.toUpperCase();
  for (let l = 0; l < 3; l++)
    for (let r = 0; r < 3; r++)
      for (let col = 0; col < 3; col++)
        if (cube[l][r][col] === c) return [l, r, col];
  return [0, 0, 0];
}

export function trifidEncode(text, key = 'KEYWORD') {
  const cube = buildTrifidCube(key);
  const s = text.toUpperCase().replace(/[^A-Z.]/g, '');
  const layers = [];
  const rows = [];
  const cols = [];
  for (const ch of s) {
    const [l, r, c] = trifidPos(cube, ch);
    layers.push(l);
    rows.push(r);
    cols.push(c);
  }
  const stream = [...layers, ...rows, ...cols];
  let out = '';
  for (let i = 0; i < stream.length; i += 3) {
    const l = stream[i];
    const r = stream[i + 1];
    const c = stream[i + 2];
    if (c !== undefined) out += cube[l][r][c];
  }
  return out;
}

export function trifidDecode(text, key = 'KEYWORD') {
  const cube = buildTrifidCube(key);
  const s = text.toUpperCase().replace(/[^A-Z.]/g, '');
  const stream = [];
  for (const ch of s) {
    const [l, r, c] = trifidPos(cube, ch);
    stream.push(l, r, c);
  }
  const n = stream.length / 3;
  const layers = stream.slice(0, n);
  const rows = stream.slice(n, n * 2);
  const cols = stream.slice(n * 2);
  let out = '';
  for (let i = 0; i < n; i++) out += cube[layers[i]][rows[i]][cols[i]];
  return out;
}

function buildPlayfairSquare(key = 'KEYWORD') {
  const seen = new Set();
  const chars = [];
  const add = (c) => {
    const x = c === 'J' ? 'I' : c;
    if (!seen.has(x) && /[A-Z]/.test(x)) { seen.add(x); chars.push(x); }
  };
  for (const c of key.toUpperCase()) add(c);
  for (const c of 'ABCDEFGHIKLMNOPQRSTUVWXYZ') add(c);
  const m = [];
  for (let i = 0; i < 5; i++) m.push(chars.slice(i * 5, i * 5 + 5));
  return m;
}

function playfairSquarePos(m, ch) {
  const c = ch === 'J' ? 'I' : ch;
  for (let r = 0; r < 5; r++)
    for (let c2 = 0; c2 < 5; c2++)
      if (m[r][c2] === c) return [r, c2];
  return [0, 0];
}

function playfairPairs(text) {
  let s = text.toUpperCase().replace(/J/g, 'I').replace(/[^A-Z]/g, '');
  const pairs = [];
  for (let i = 0; i < s.length; i++) {
    const a = s[i];
    if (i + 1 >= s.length) { pairs.push([a, 'X']); break; }
    const b = s[i + 1];
    if (a === b) pairs.push([a, 'X']);
    else { pairs.push([a, b]); i++; }
  }
  return pairs;
}

export function fourSquare(text, key1 = 'KEYWORD', key2 = 'SECRET', decrypt = false) {
  const sq1 = buildPlayfairSquare(key1);
  const sq2 = buildPlayfairSquare('');
  const sq3 = buildPlayfairSquare('');
  const sq4 = buildPlayfairSquare(key2);
  const pairs = playfairPairs(text);
  const out = [];
  for (const [a, b] of pairs) {
    if (!decrypt) {
      const [r1, c1] = playfairSquarePos(sq1, a);
      const [r4, c4] = playfairSquarePos(sq4, b);
      out.push(sq2[r1][c4], sq3[r4][c1]);
    } else {
      const [r2, c2] = playfairSquarePos(sq2, a);
      const [r3, c3] = playfairSquarePos(sq3, b);
      out.push(sq1[r2][c3], sq4[r3][c2]);
    }
  }
  const raw = out.join('');
  if (!decrypt) return raw;
  return raw.replace(/([A-Z])X\1/g, '$1$1').replace(/X$/, '');
}
