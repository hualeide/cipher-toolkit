/**
 * 文本格式互转 — 供 CLI/API/组合链使用
 */
import * as E from '../ciphers/engine.js';

const FORMATS = new Set(['text', 'hex', 'base64', 'binary']);

function decodeFormat(value, format) {
  const f = String(format || 'text').toLowerCase();
  if (f === 'text') return String(value);
  if (f === 'hex') {
    const clean = String(value).replace(/\s+/g, '');
    if (clean.length % 2 === 0 && /^[0-9a-fA-F]+$/.test(clean)) {
      return Buffer.from(clean, 'hex').toString('utf8');
    }
    return E.hexDecode(String(value));
  }
  if (f === 'base64') return E.base64Decode(String(value));
  if (f === 'binary') return E.binaryDecode(String(value));
  throw new Error(`不支持的源格式: ${format}`);
}

function encodeFormat(value, format) {
  const f = String(format || 'text').toLowerCase();
  if (f === 'text') return String(value);
  if (f === 'hex') {
    return Buffer.from(String(value), 'utf8').toString('hex').replace(/(..)/g, '$1 ').trim();
  }
  if (f === 'base64') return E.base64Encode(String(value));
  if (f === 'binary') return E.binaryEncode(String(value));
  throw new Error(`不支持的目标格式: ${format}`);
}

export function listFormats() {
  return [...FORMATS];
}

export function formatConvert(input, fromFormat = 'text', toFormat = 'hex') {
  const from = String(fromFormat).toLowerCase();
  const to = String(toFormat).toLowerCase();
  if (!FORMATS.has(from) || !FORMATS.has(to)) {
    throw new Error(`格式须为 ${[...FORMATS].join('/')}`);
  }
  const text = decodeFormat(input, from);
  return encodeFormat(text, to);
}
