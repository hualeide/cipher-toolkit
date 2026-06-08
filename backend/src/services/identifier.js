import * as E from '../ciphers/engine.js';

import { registry, formatParams, cipherMap } from '../ciphers/registry.js';

import * as M from '../ciphers/cryptoModern.js';

import * as U from '../ciphers/unicodeCipher.js';

import { getLangSupport } from '../ciphers/langSupport.js';
import { isBiblePlaintext } from '../ciphers/bibleCorpus.js';
import { isClassicPlaintext } from '../ciphers/classicCorpus.js';
import { isCorpusPlaintext } from '../ciphers/exampleCorpus.js';

import { cipherRequiresKey } from '../ciphers/cipherMeta.js';

import {

  scoreDecryptCandidate, collapseByPlaintextResult, calibrateConfidence, scoreReadableText,
  verifyRoundtrip, compareIdentifyHits, looksLikeMorseInput, isMeaningfulShortCjkPlain,
  normalizeIdentifyInput, isLikelyMixedPlaintext,

} from './identifyScore.js';

import { rerankIdentifyCandidates, isLlmRerankEnabled } from './identifyLlmRerank.js';
import { scoreZhNaturalness } from '../ciphers/zhFreqCorpus.js';



const MAX_ATTEMPTS = 2500;



const CIPHER_PRIORITY = {

  morse: 12, 'gf-caesar3': 18,   caesar: 16, rot13: 14, rot47: 12, rot5: 12, rot18: 12, 'rot-all': 11, atbash: 11,
  scytale: 10, columnar: 9, 'rail-fence': 9, reverse: 11, 'even-odd-split': 12,

  'unicode-cp-caesar': 18, 'unicode-cp-vigenere': 14, 'unicode-cp-affine': 13, 'unicode-cp-decimal': 11,

  'gf-a1z26': 10, a1z26: 10, 'gf-author': 9, 'gf-bill': 9,

  vigenere: 8, 'gf-vigenere-pines': 7, affine: 6, beaufort: 6, 'keyword-sub': 6, 'rail-fence': 7,

  base64: 10, 'gzip-base64': 11, hex: 9, binary: 8, url: 9, decimal: 7, pigpen: 8,

};

const TRIVIAL_CIPHER_IDS = new Set(['swap-case', 'reverse', 'bubble', 'fullwidth']);

const LOOSE_STREAM_IDS = new Set(['rc4', 'xor']);

const LOOSE_KEY_ON_MIXED_IDS = new Set([
  'autokey', 'running-key', 'enigma-simple', 'keyword-sub', 'hill', 'rc4', 'xor',
  'gronsfeld', 'vigenere', 'beaufort', 'playfair', 'bifid', 'trifid', 'four-square', 'leet',
]);

const ENCODING_CIPHER_IDS = new Set([
  'hex', 'base64', 'binary', 'octal', 'decimal', 'unicode-cp-decimal', 'url',
  'unicode-escape', 'quoted-printable', 'ascii85', 'uuencode', 'gzip-base64',
  'base32', 'base58', 'jwt', 'html-entities', 'unicode-escape',
]);

/** 编码层密文形态 — 流密码 rc4/xor 不应抢答 */
function looksLikeEncodingCiphertext(text) {
  const t = text.trim();
  if (/\\u[0-9a-fA-F]{4}/.test(t)) return true;
  if (/=([0-9A-Fa-f]{2})/.test(t) && !/^https?:\/\//i.test(t)) return true;
  if (/^(\d{1,5})(\s+\d{1,5})+$/.test(t)) return true;
  if (/^(0?[0-7]+)(?:\s+0?[0-7]+)+$/.test(t)) return true;
  if (/^eyJ[A-Za-z0-9_-]+\./.test(t)) return true;
  if (/^begin\s+\d+\s/mi.test(t)) return true;
  if (/^[0-9a-fA-F]{2,4}(?:\s+[0-9a-fA-F]{2,4})+$/.test(t)) return true;
  if (/^[A-Za-z0-9+/=]{8,}$/.test(t) && (t.includes('=') || t.length % 4 === 0)) return true;
  if (/^[01\s]{8,}$/.test(t)) return true;
  return false;
}

function normalizeIdentifyPlain(cipherId, result) {
  if (cipherId === 'jwt' && result) {
    try {
      const parsed = JSON.parse(result);
      if (typeof parsed.payload === 'string') return parsed.payload;
      if (parsed.payload != null) return JSON.stringify(parsed.payload);
    } catch { /* keep */ }
  }
  return result;
}

/** 乱汉字密文上易误报、且不应与码点族竞争的算法（不含 rot13 / 换位 — 中文正当用法） */
const CJK_GARBLED_SKIP_IDS = new Set([
  'caesar', 'rot18', 'rot5', 'rot47',
  'upside-down', 'leet', 'pig-latin', 'swap-case', 'bubble',
  'keyboard-shift',
]);



const ZH_VIG_KEYS = [

  '密钥', '密码', '中文', 'KEY', 'SECRET', 'PASSWORD', 'CIPHER', 'CRYPTO', 'CODE',

  '我爱你', '爱你', '520', '1314', 'hello', 'world', 'test', 'love', '密码学', '工具',

];



function buildHit(cipher, { params, result, id }, scored, input, extra = {}) {

  const priority = CIPHER_PRIORITY[id || cipher.id] || 0;

  const total = scored.score + priority;

  return {

    id: id || cipher.id,

    name: cipher.name,

    category: cipher.category,

    langSupport: getLangSupport(id || cipher.id),

    requiresKey: cipherRequiresKey(cipher),

    params: params || {},

    paramsLabel: formatParams(cipher, params || {}),

    result,

    explanation: cipher.description,

    usage: `本次识别：${input.slice(0, 24)}${input.length > 24 ? '…' : ''} → ${result}`,

    history: cipher.history,

    reversible: true,

    score: total,

    rawScore: scored.score,

    readable: scored.readable,

    verified: scored.verified,

    confidence: calibrateConfidence({ rawScore: scored.score, verified: scored.verified }, 0),

    ...extra,

  };

}



function buildPlaintextResult(text) {

  return finalizeIdentifyResults([{

    id: 'plaintext',

    name: '已是明文',

    category: '无需解密',

    params: {},

    paramsLabel: '—',

    result: text,

    explanation: `「${text}」本身是可读文本/常用词，不是加密密文。无需解密操作。`,

    usage: '若你期望得到其他内容，请确认是否粘贴了正确的密文。',

    reversible: false,

    alreadyPlaintext: true,

    score: 100,

    rawScore: 100,

    confidence: 99,

    verified: true,

  }]);

}



/** 为识别结果附加置信度分级与候选差距 */

export function finalizeIdentifyResults(results) {

  if (!results.length) return [];

  const top = results[0];

  const second = results.find((r, i) => i > 0 && !r.alreadyPlaintext && r.result);

  const gap = second && !top.alreadyPlaintext ? top.score - second.score : 99;



  return results.map((r, i) => {

    const confidence = calibrateConfidence(r, i === 0 ? gap : Math.max(0, gap - i * 3));

    const base = { ...r, rank: i + 1, confidence };

    if (i > 0) return base;

    let confidenceLevel = 'high';

    if (!top.alreadyPlaintext) {

      if (confidence < 72 || gap < 10 || (!top.verified && confidence < 82)) confidenceLevel = 'low';

      else if (confidence < 88 || gap < 20) confidenceLevel = 'medium';

    }

    if (top.verified && gap >= 12) confidenceLevel = 'high';

    return {

      ...base,

      confidenceLevel,

      scoreGap: Math.round(gap),

      alternativeCount: results.filter((x) => !x.alreadyPlaintext && x.result).length - 1,

    };

  });

}



export function identify(text, options = {}) {

  const { limit = 15, minScore = 30, extraKeys = [] } = options;

  const trimmed = normalizeIdentifyInput(text);

  if (!trimmed) return [];



  if (E.isLikelyPlaintext(trimmed)) {

    return buildPlaintextResult(trimmed);

  }



  const patternHits = detectPatterns(trimmed);

  if (looksLikeMorseInput(trimmed)) {
    const morseHit = detectMorse(trimmed);
    if (morseHit?.scored?.score >= 32) {
      const c = cipherMap.morse;
      return finalizeIdentifyResults([buildHit(c, {
        params: { variant: morseHit.variant },
        result: morseHit.result,
        id: 'morse',
      }, morseHit.scored, trimmed)].slice(0, limit));
    }
  }

  const definiteIds = new Set([
    'base64', 'url', 'unicode-cp-decimal', 'gf-a1z26', 'a1z26', 'morse', 'hex', 'binary', 'jwt',
    'unicode-escape', 'quoted-printable', 'decimal', 'octal', 'uuencode', 'ascii85',
    'md5', 'sha1', 'sha256', 'sha512', 'crc32',
    'base32', 'base58', 'bacon', 'braille', 'gzip-base64', 'uuencode', 'url', 'phone-keypad',
    'tap-code', 'polybius', 'nato', 'pigpen', 'discord-spoiler', 'meme-binary',
    'bubble', 'small-caps', 'emoji', 'scp-redact', 'adler32', 'rot5', 'uuencode', 'periodic-table',
    'swap-case', 'rot47', 'fullwidth', 'bubble', 'leet', 'pig-latin', 'upside-down', 'jcuken', 'url', 'xor', 'rc4', 'bifid', 'trifid', 'four-square',
  ]);

  const definite = patternHits.filter((h) => definiteIds.has(h.id));

  if (definite.length) return finalizeIdentifyResults(definite.slice(0, limit));



  const inputScore = scoreReadableText(trimmed);

  const results = [];

  const seen = new Set();

  let attempts = 0;



  const push = (entry) => {

    const dedupeKey = `${entry.id}:${entry.paramsLabel}:${entry.result || ''}`;

    if (seen.has(dedupeKey)) return;

    seen.add(dedupeKey);

    results.push(entry);

  };



  for (const hit of patternHits) push(hit);

  const mixedKeyHits = detectMixedKeyCiphers(trimmed);
  for (const hit of mixedKeyHits || []) push(hit);



  const hashHit = M.detectHashType(trimmed);

  if (hashHit) {

    push({

      id: hashHit.type,

      name: hashHit.name,

      category: '哈希/摘要',

      params: {},

      paramsLabel: '—',

      result: null,

      explanation: `${hashHit.name} 是单向哈希，无法还原原文。`,

      usage: '哈希不可逆，对候选明文计算哈希后比对。',

      reversible: false,

      confidence: 95,

      score: 95,

      rawScore: 95,

    });

  }



  const allKeys = [...new Set([...extraKeys, ...ZH_VIG_KEYS])];



  for (const cipher of registry) {

    if (cipher.identifiable === false || cipher.reversible === false) continue;

    if (U.looksLikeUnicodeCipherText(trimmed) && (CJK_GARBLED_SKIP_IDS.has(cipher.id) || cipher.id === 'reverse')) {
      continue;
    }

    if (cipher.id.startsWith('unicode-cp-')) {
      const chars = [...trimmed];
      const asciiRatio = chars.filter((ch) => (ch.codePointAt(0) || 0) < 0x300).length / Math.max(chars.length, 1);
      const cyrRatio = chars.filter((ch) => /[\u0400-\u04FF]/.test(ch)).length / Math.max(chars.length, 1);
      if (asciiRatio > 0.88 && !U.looksLikeUnicodeCipherText(trimmed)) continue;
      if (cyrRatio > 0.65) continue;
    }

    if (TRIVIAL_CIPHER_IDS.has(cipher.id) && inputScore >= 50) continue;

    if (looksLikeMorseInput(trimmed) && LOOSE_STREAM_IDS.has(cipher.id)) continue;

    if (LOOSE_STREAM_IDS.has(cipher.id) && looksLikeEncodingCiphertext(trimmed)) continue;

    if (LOOSE_KEY_ON_MIXED_IDS.has(cipher.id) && (hasLatinAndCjk(trimmed) || /X/.test(trimmed))) continue;

    if (hasLatinAndCjk(trimmed) && (cipher.id === 'keyboard-shift' || cipher.id === 'caesar')) continue;



    let paramSets = cipher.getIdentifyParams ? cipher.getIdentifyParams() : [{}];



    const needsKey = cipher.params?.some((p) => p.name === 'key' || p.name === 'keyword');

    if (needsKey) {

      const field = cipher.params.find((p) => p.name === 'key' || p.name === 'keyword')?.name;

      const existing = new Set(paramSets.map((p) => p[field]));

      for (const k of allKeys) {

        if (!existing.has(k)) paramSets.push({ [field]: k });

      }

    }



    if (paramSets.length > 80) paramSets = paramSets.slice(0, 80);



    for (const params of paramSets) {

      if (++attempts > MAX_ATTEMPTS) break;

      try {

        const result = normalizeIdentifyPlain(cipher.id, cipher.decrypt(trimmed, params));

        if (!result || result === trimmed) continue;



        const scored = scoreDecryptCandidate(trimmed, result, { cipherId: cipher.id, params });

        if (!E.isMeaningfulDecrypt(trimmed, result)) {

          const allowed = scored.delta >= 12

            || (U.looksLikeUnicodeCipherText(trimmed) && scored.readable >= 48)

            || (cipher.id.startsWith('unicode-cp-') && scored.readable >= 45)

            || (scored.verified && isMeaningfulShortCjkPlain(result, scored.readable));

          if (!allowed) continue;

        }



        if (scored.score < minScore) continue;



        push(buildHit(cipher, { params, result, id: cipher.id }, scored, trimmed));

      } catch { /* skip */ }

    }

    if (attempts > MAX_ATTEMPTS) break;

  }



  results.sort(compareIdentifyHits);



  const byCipher = new Map();

  for (const r of results) {

    const ex = byCipher.get(r.id);

    if (!ex || compareIdentifyHits(r, ex) < 0) byCipher.set(r.id, r);

  }



  const merged = collapseByPlaintextResult([...byCipher.values()]);

  return finalizeIdentifyResults(merged.slice(0, limit));

}

/** 异步识别 — 可选 LLM 重排（IDENTIFY_LLM_RERANK=1 或 options.llmRerank） */
export async function identifyAsync(text, options = {}) {
  const { llmRerank = isLlmRerankEnabled(), limit = 15, ...rest } = options;
  let results = identify(text, { limit, ...rest });
  if (!llmRerank || results.length < 2 || results[0]?.alreadyPlaintext) return results;
  const reranked = await rerankIdentifyCandidates(text.trim(), results);
  if (reranked === results) return results;
  return finalizeIdentifyResults(reranked.slice(0, limit));
}



function tryQuickHit(cipherId, text, params = {}, minScore = 50) {
  const c = cipherMap[cipherId];
  if (!c) return null;
  try {
    let result = normalizeIdentifyPlain(cipherId, c.decrypt(text, params));
    if (!result || result === text) return null;
    const scored = scoreDecryptCandidate(text, result, { cipherId, params });
    if (scored.score < minScore && !scored.verified) return null;
    return buildHit(c, { params, result, id: cipherId }, scored, text);
  } catch {
    return null;
  }
}

function tryEncodingHit(cipherId, text, params = {}) {
  const c = cipherMap[cipherId];
  if (!c) return null;
  try {
    let result = normalizeIdentifyPlain(cipherId, c.decrypt(text, params));
    if (!result || result === text) return null;
    const scored = scoreDecryptCandidate(text, result, { cipherId, params });
    const ok = scored.verified
      || (isMeaningfulShortCjkPlain(result, scored.readable) && scored.readable >= 18)
      || (scored.score >= 35 && scoreReadableText(result) >= 20);
    if (!ok) return null;
    const boosted = {
      ...scored,
      verified: scored.verified,
      score: Math.max(scored.score, scored.verified ? 85 : 78),
    };
    return buildHit(c, { params, result, id: cipherId }, boosted, text);
  } catch {
    return null;
  }
}

/** 编码层早检：须在 rc4/xor 与 unicode 快检之前 */
function detectTextEncodings(text) {
  const t = text.trim();

  if (/^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/.test(t)) {
    const h = tryEncodingHit('jwt', text);
    if (h) return [h];
  }

  if (/\\u[0-9a-fA-F]{4}/.test(t)) {
    const h = tryEncodingHit('unicode-escape', text);
    if (h) return [h];
  }

  if (/=([0-9A-Fa-f]{2})/.test(t) && !/^https?:\/\//i.test(t)) {
    const h = tryEncodingHit('quoted-printable', text);
    if (h) return [h];
  }

  if (/^(\d{1,5})(\s+\d{1,5})+$/.test(t)) {
    const nums = t.split(/\s+/).map(Number);
    const hasUnicodeCp = nums.some((n) => n > 127);
    if (hasUnicodeCp) {
      const hCp = tryEncodingHit('unicode-cp-decimal', text);
      if (hCp) return [hCp];
    }
    const hDec = tryEncodingHit('decimal', text);
    if (hDec) return [hDec];
    const hCp = tryEncodingHit('unicode-cp-decimal', text);
    if (hCp) return [hCp];
  }

  if (/^(0?[0-7]+)(?:\s+0?[0-7]+)+$/.test(t)) {
    const h = tryEncodingHit('octal', text);
    if (h) return [h];
  }

  if (/^[01\s]{8,}$/.test(t)) {
    const h = tryEncodingHit('binary', text);
    if (h) return [h];
  }

  if (/^H4sI[A-Za-z0-9+/=]+/.test(t)) {
    const h = tryEncodingHit('gzip-base64', text);
    if (h) return [h];
  }

  if (/^[A-Z2-7=]{8,}$/i.test(t) && !/[+/]/.test(t)) {
    const canB64 = /^[A-Za-z0-9+/=]{8,}$/.test(t)
      && (t.includes('=') || t.includes('+') || t.includes('/') || t.length % 4 === 0);
    const h64 = canB64 ? tryEncodingHit('base64', text) : null;
    if (h64?.verified) return [h64];
    const h32 = tryEncodingHit('base32', text);
    if (h32?.verified) return [h32];
    if (!canB64 && h32) return [h32];
    if (h64) return [h64];
  }

  if (/^[A-Za-z0-9+/=]{8,}$/.test(t) && (t.includes('=') || t.includes('+') || t.includes('/') || t.length % 4 === 0)) {
    const h = tryEncodingHit('base64', text);
    if (h) return [h];
  }

  const hexClean = t.replace(/\s/g, '');
  if (/^[0-9a-fA-F]+$/.test(hexClean) && hexClean.length >= 4 && hexClean.length % 2 === 0) {
    const h = tryEncodingHit('hex', text);
    if (h?.verified || h?.rawScore >= 40) return [h];
  }

  if (/^(\d{1,2})([-\s]\d{1,2})+$/.test(t)) {
    for (const id of ['gf-a1z26', 'a1z26']) {
      const h = tryEncodingHit(id, text, {});
      if (h?.verified || (h?.rawScore ?? 0) >= 40) return [h];
    }
  }

  if (/^begin\s+\d+\s/mi.test(t) || (/^[`!-o][`!-~]{3,}/.test(t) && !/^(\d{1,2})([-\s]\d{1,2})+$/.test(t)
    && !/^[01\s]+$/.test(t) && !/^[0-9a-fA-F\s]+$/.test(t)
    && !/^[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]+$/.test(t))) {
    const h = tryEncodingHit('uuencode', text);
    if (h) return [h];
  }

  if (t.startsWith('<~') && t.endsWith('~>')) {
    const h = tryEncodingHit('ascii85', text);
    if (h) return [h];
  }

  if (/^[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]{4,}$/.test(t)) {
    const h = tryEncodingHit('base58', text);
    if (h) return [h];
  }

  return null;
}

const TRANSPOSE_COL_KEYS = ['CIPHER', 'KEY', 'SECRET', '密码', '密钥', '中文'];

function hasLatinAndCjk(text) {
  return /[A-Za-z]/.test(text) && /[\u4e00-\u9fff]/.test(text);
}

function identifyKeysForCipher(cipherId) {
  const keys = [...ZH_VIG_KEYS];
  const c = cipherMap[cipherId];
  if (c?.getIdentifyParams) {
    for (const p of c.getIdentifyParams()) {
      const k = p.key ?? p.keyword;
      if (k && !keys.includes(k)) keys.push(k);
    }
  }
  for (const param of c?.params || []) {
    if ((param.name === 'key' || param.name === 'keyword') && param.default && !keys.includes(param.default)) {
      keys.push(param.default);
    }
  }
  return keys;
}

/** 中英混排带密钥替换 — autokey / running-key 等（全库扫描会跳过以防误报） */
function detectMixedKeyCiphers(text) {
  if (!hasLatinAndCjk(text)) return null;
  const hits = [];
  const tries = [
    ['autokey', 'key'], ['running-key', 'key'],
    ['gronsfeld', 'key'], ['vigenere', 'key'], ['beaufort', 'key'],
  ];
  for (const [id, field] of tries) {
    for (const key of identifyKeysForCipher(id)) {
      const hit = tryQuickHit(id, text, { [field]: key }, 32);
      if (!hit?.verified) continue;
      if (isLikelyMixedPlaintext(hit.result) || isMeaningfulShortCjkPlain(hit.result, hit.readable ?? 0)) {
        hits.push(hit);
      }
    }
  }
  if (!hits.length) return null;
  hits.sort(compareIdentifyHits);
  const byId = new Map();
  for (const h of hits) {
    const ex = byId.get(h.id);
    if (!ex || compareIdentifyHits(h, ex) < 0) byId.set(h.id, h);
  }
  return [...byId.values()];
}

/** 中英混排替换类早检 — rot13/caesar/仿射 等，避免 swap-case 独占 */
function detectMixedLatinSubst(text) {
  const t = text.trim();
  if (!/[A-Za-z]{2,}/.test(t)) return null;
  const hits = [];
  const tries = [
    ['rot13', {}], ['rot-all', {}], ['rot18', {}], ['rot47', {}], ['atbash', {}],
    ['gf-caesar3', {}], ['caesar', { shift: 13 }], ['caesar', { shift: 3 }],
    ['affine', { a: 5, b: 8 }], ['unicode-cp-caesar', { shift: 13 }],
    ['unicode-cp-affine', { a: 5, b: 8 }], ['beaufort', { key: 'KEY' }],
    ['vigenere', { key: 'KEY' }],
  ];
  for (const [id, params] of tries) {
    const hit = tryQuickHit(id, text, params, 35);
    if (hit?.verified && (hit.readable ?? 0) >= 42) hits.push(hit);
  }
  if (!hits.length) return null;
  hits.sort(compareIdentifyHits);
  return hits;
}

function shouldTryTransposeCjk(text) {
  const t = text.trim();
  if (U.looksLikeUnicodeCipherText(t)) return true;
  if (hasLatinAndCjk(t) || (/[A-Za-z]/.test(t) && /X/.test(t))) return true;
  const chars = [...t];
  const cjk = chars.filter((c) => /[\u4e00-\u9fff]/.test(c)).length;
  if (cjk >= 3 && cjk / Math.max(chars.length, 1) >= 0.4 && !U.isKnownChinesePhrase(t)) {
    return U.scorePlaintextMultilingual(t) < 52 || /X/.test(t);
  }
  return false;
}

function transposeCjkRank(text, id, result, scored, params) {
  const trimmed = text.trim();
  let rank = scored.readable * 1.5 + scoreZhNaturalness(result);
  if (U.isKnownChinesePhrase(result)) rank += 35;
  if (isCorpusPlaintext(result) || isClassicPlaintext(result)) rank += 28;
  if (isBiblePlaintext(result)) rank += 30;
  if (scored.verified) rank += 12;
  if (id === 'reverse' && trimmed === [...result].reverse().join('')) rank += 100;
  else if (id === 'even-odd-split' && E.evenOddSplit(result) === trimmed) rank += 55;
  else if (id === 'columnar' && cipherMap.columnar?.encrypt?.(result, params || {}) === trimmed) {
    rank += 48;
    if (params?.key === 'CIPHER') rank += 15;
  }
  else if (id === 'rail-fence' && cipherMap['rail-fence']?.encrypt?.(result, params || {}) === trimmed) rank += 40;
  else if (id !== 'reverse') rank += 8;
  else rank -= 12;
  return rank;
}

function transposeHitScore(id, trimmed, result, params, scored) {
  let raw = Math.max(scored.score, 84);
  if (id === 'reverse' && trimmed === [...result].reverse().join('')) raw = Math.max(raw, 102);
  else if (id === 'even-odd-split' && E.evenOddSplit(result) === trimmed) raw = Math.max(raw, 100);
  else if (id === 'columnar' && cipherMap.columnar?.encrypt?.(result, params || {}) === trimmed) raw = Math.max(raw, 97);
  else if (id === 'rail-fence' && cipherMap['rail-fence']?.encrypt?.(result, params || {}) === trimmed) raw = Math.max(raw, 94);
  else if (id === 'scytale' && cipherMap.scytale?.encrypt?.(result, params || {}) === trimmed) raw = Math.max(raw, 96);
  return raw;
}

/** 中文换位早检 — 乱序汉字仍是 CJK，不应被 reverse / 码点仿射误抢 */
function detectTransposeCjk(text) {
  if (!shouldTryTransposeCjk(text)) return null;
  const trimmed = text.trim();
  const len = [...trimmed].length;
  if (len < 2 || len > 48) return null;

  const candidates = [];
  const tryAdd = (id, params, result, scored) => {
    const plainOk = isMeaningfulShortCjkPlain(result, scored.readable)
      || isLikelyMixedPlaintext(result)
      || (scored.verified && scoreReadableText(result) >= 52);
    if (!scored.verified || !plainOk) return;
    if (id === 'reverse' && trimmed !== [...result].reverse().join('')) return;
    const c = cipherMap[id];
    if (!c) return;
    candidates.push({
      rank: transposeCjkRank(trimmed, id, result, scored, params),
      hit: buildHit(c, { params, result, id }, {
        ...scored,
        score: transposeHitScore(id, trimmed, result, params, scored),
      }, text),
    });
  };

  for (const id of ['rail-fence', 'even-odd-split', 'scytale', 'columnar', 'reverse']) {
    const c = cipherMap[id];
    if (!c) continue;
    try {
      if (id === 'rail-fence') {
        for (let rails = 2; rails <= Math.min(20, len); rails++) {
          const params = { rails };
          const result = c.decrypt(trimmed, params);
          if (!result || result === trimmed || c.encrypt(result, params) !== trimmed) continue;
          tryAdd(id, params, result, scoreDecryptCandidate(text, result, { cipherId: id, params }));
        }
        continue;
      }
      if (id === 'even-odd-split') {
        const params = {};
        const result = c.decrypt(trimmed, params);
        if (!result || result === trimmed || c.encrypt(result, params) !== trimmed) continue;
        tryAdd(id, params, result, scoreDecryptCandidate(text, result, { cipherId: id, params }));
        continue;
      }
      if (id === 'scytale') {
        for (let diameter = 2; diameter <= Math.min(20, len); diameter++) {
          const params = { diameter };
          const result = c.decrypt(trimmed, params);
          if (!result || result === trimmed || c.encrypt(result, params) !== trimmed) continue;
          tryAdd(id, params, result, scoreDecryptCandidate(text, result, { cipherId: id, params }));
        }
        continue;
      }
      if (id === 'columnar') {
        for (const key of TRANSPOSE_COL_KEYS) {
          const params = { key };
          const result = c.decrypt(trimmed, params);
          if (!result || result === trimmed || c.encrypt(result, params) !== trimmed) continue;
          tryAdd(id, params, result, scoreDecryptCandidate(text, result, { cipherId: id, params }));
        }
        continue;
      }
      if (id === 'reverse') {
        const params = {};
        const result = c.decrypt(trimmed, params);
        if (!result || result === trimmed) continue;
        tryAdd(id, params, result, scoreDecryptCandidate(text, result, { cipherId: id, params }));
      }
    } catch { /* skip */ }
  }

  if (!candidates.length) return null;
  candidates.sort((a, b) => b.rank - a.rank);
  const seen = new Set();
  const out = [];
  for (const c of candidates) {
    const key = `${c.hit.id}:${c.hit.paramsLabel}:${c.hit.result}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c.hit);
  }
  return out.slice(0, 8);
}



function detectAdler32(text) {
  const t = text.trim();
  if (!/^\d{5,12}$/.test(t)) return null;
  const val = Number(t);
  const words = ['hello', 'HELLO', 'world', 'test', 'secret', 'password', '你好', 'cipher'];
  for (const w of words) {
    if (E.adler32(w) === val) {
      return { type: 'adler32', name: 'Adler-32 校验', sample: w };
    }
  }
  return { type: 'adler32', name: 'Adler-32 校验' };
}



function detectStructuredEncodings(text) {
  const t = text.trim();

  if (/^[A-Z]{5,}$/.test(t) && t.length <= 40) {
    for (const spec of [
      { key1: 'KEYWORD', key2: 'SECRET' },
      { key1: 'SECRET', key2: 'KEYWORD' },
      { key1: 'CIPHER', key2: 'SECRET' },
      { key1: 'KEYWORD', key2: 'KEY' },
    ]) {
      const fs = tryQuickHit('four-square', text, spec, 42);
      if (fs?.verified) return [fs];
    }
    for (const key of ['KEYWORD', 'SECRET', 'CIPHER', 'KEY']) {
      const hit = tryQuickHit('bifid', text, { key }, 42);
      if (hit?.verified) return [hit];
      const tri = tryQuickHit('trifid', text, { key }, 55);
      if (tri?.verified) return [tri];
    }
  }

  if (/^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/.test(t)) {
    const c = cipherMap.jwt;
    if (c) {
      try {
        const result = c.decrypt(text, {});
        if (result) {
          const scored = scoreDecryptCandidate(text, result, { cipherId: 'jwt', params: {} });
          if (scored.verified || scored.score >= 40) {
            return [buildHit(c, { params: {}, result, id: 'jwt' }, { ...scored, verified: true, score: Math.max(scored.score, 88) }, text)];
          }
        }
      } catch { /* skip */ }
    }
  }

  if (t.length <= 24 && !looksLikeEncodingCiphertext(t) && !looksLikeMorseInput(t)) {
    const nonPrint = [...t].filter((ch) => {
      const cp = ch.codePointAt(0) || 0;
      return cp < 0x20 || cp > 0x7e;
    }).length;
    if (nonPrint / Math.max(t.length, 1) >= 0.3) {
      for (const spec of [
        { id: 'xor', params: { keyByte: 66 } },
        { id: 'rc4', params: { key: 'secret' } },
      ]) {
        const hit = tryQuickHit(spec.id, text, spec.params, 40);
        if (hit?.verified) return [hit];
      }
    }
  }

  if (/^[\x21-\x7e]+$/.test(t) && /[{~@|`\^]/.test(t) && !/[a-zA-Z]{4,}/.test(t)) {
    const hit = tryQuickHit('rot47', text, {}, 45);
    if (hit?.verified) return [hit];
  }

  if (/^[\u0400-\u04FF]+$/.test(t) && t.length >= 4) {
    for (let shift = 1; shift <= 5; shift++) {
      const hit = tryQuickHit('jcuken', text, { shift }, 35);
      if (hit?.verified) return [hit];
    }
  }

  if (/^[A-Z][a-z].*\d/.test(t) && !/%/.test(t)) {
    const c = cipherMap.rot5;
    if (c) {
      try {
        const result = c.decrypt(text, {});
        if (result && result !== text && verifyRoundtrip('rot5', result, text, {})) {
          const scored = scoreDecryptCandidate(text, result, { cipherId: 'rot5', params: {} });
          if (scored.verified || scored.score >= 45) {
            return [buildHit(c, { params: {}, result, id: 'rot5' }, { ...scored, verified: true, score: Math.max(scored.score, 90) }, text)];
          }
        }
      } catch { /* skip */ }
    }
  }

  if (/^([A-Z][a-z]{0,2}-){1,}[A-Z][a-z]{0,2}$/.test(t)) {
    const hit = tryQuickHit('periodic-table', text, {}, 40);
    if (hit?.verified) return [hit];
  }

  if (/^[A-Z]{2,}$/.test(t) && t.length <= 12) {
    const hit = tryQuickHit('affine', text, { a: 5, b: 7 }, 40);
    if (hit?.verified) return [hit];
  }

  if (t.startsWith('<~') && t.endsWith('~>')) {
    const hit = tryQuickHit('ascii85', text, {}, 40);
    if (hit?.verified) return [hit];
  }

  if (t.startsWith('H4sI')) {
    const hit = tryQuickHit('gzip-base64', text, {}, 40);
    if (hit?.verified) return [hit];
  }

  if (/^(\d\d\s+)+\d\d$/.test(t)) {
    for (const id of ['tap-code', 'polybius']) {
      const hit = tryQuickHit(id, text, {}, 40);
      if (hit?.verified) return [hit];
    }
  }

  if (/\b(Alpha|Bravo|Charlie|Delta|Echo|Foxtrot|Golf|Hotel|India|Juliet|Kilo|Lima|Mike|November|Oscar|Papa|Quebec|Romeo|Sierra|Tango|Uniform|Victor|Whiskey|X-ray|Yankee|Zulu)\b/i.test(t)) {
    const hit = tryQuickHit('nato', text, {}, 40);
    if (hit?.verified) return [hit];
  }

  if (/^([A-I][1-3]\s*)+$/i.test(t)) {
    const hit = tryQuickHit('pigpen', text, {}, 40);
    if (hit?.verified) return [hit];
  }

  if (/\|\|[^|]+\|\|/.test(t)) {
    const hit = tryQuickHit('discord-spoiler', text, {}, 35);
    if (hit?.verified) return [hit];
  }

  if (/\(\d{7,8}\)/.test(t)) {
    const hit = tryQuickHit('meme-binary', text, {}, 40);
    if (hit?.verified) return [hit];
  }

  if (/[\u{1D400}-\u{1D419}]/u.test(t)) {
    const hit = tryQuickHit('bubble', text, {}, 40);
    if (hit?.verified) return [hit];
  }

  if (/[\u{1D00}-\u{1D1A}]/u.test(t)) {
    const hit = tryQuickHit('small-caps', text, {}, 40);
    if (hit?.verified) return [hit];
  }

  if (/^[🔴🟠🟡🟢🔵🟣⚫⚪🟤🔶🔷🔸🔹🔺🔻💠⭐🌙☀️🌈🔥💧🌿🍀🎵]+$/u.test(t)) {
    const hit = tryQuickHit('emoji', text, {}, 35);
    if (hit?.verified) return [hit];
  }

  if (/^[\u{1F534}\u{1F7E0}\u{1F7E1}\u{1F7E2}\u{1F535}\u{1F7E3}\u{26AB}\u{26AA}]/u.test(t)) {
    const hit = tryQuickHit('emoji', text, {}, 30);
    if (hit) return [hit];
  }

  if (/^[2-9][2-9\s]*$/.test(t) && t.replace(/\s/g, '').length >= 3) {
    const hit = tryQuickHit('phone-keypad', text, {}, 40);
    if (hit?.verified) return [hit];
  }

  if (/^[a-z]+$/.test(t) && t.length >= 4) {
    for (const shift of [1, 2, 3, 4, 5]) {
      const hit = tryQuickHit('keyboard-shift', text, { shift }, 40);
      if (hit?.verified) return [hit];
    }
  }

  if (/^![\x20-\x7e]+/.test(t) || /^M/.test(t) || /\\/.test(t)) {
    const hit = tryQuickHit('uuencode', text, {}, 35);
    if (hit?.verified) return [hit];
  }

  if (/\d/.test(t) && /[A-Za-z]/.test(t) && !/%/.test(t) && !/^<~/.test(t) && !/[a-z].*[A-Z]|[A-Z].*[a-z]/.test(t.replace(/[^A-Za-z]/g, ''))) {
    const hexLike = /^([0-9a-fA-F]{2,4})(\s+[0-9a-fA-F]{2,4})+$/.test(t)
      || /^[0-9a-fA-F]{8,}$/.test(t.replace(/\s/g, ''));
    if (!hexLike) {
      const rot5Hit = tryQuickHit('rot5', text, {}, 45);
      if (rot5Hit?.verified) return [rot5Hit];
    }
  }

  if (/^[\u2580-\u259F█▓░#*]+$/.test(t) && t.length >= 3) {
    return [{
      id: 'scp-redact',
      name: 'SCP 涂黑',
      category: '网络/迷因',
      params: {},
      paramsLabel: '—',
      result: null,
      explanation: 'SCP 风格涂黑文本，原文不可逆还原。',
      usage: '仅可识别为涂黑格式，无法解密。',
      reversible: false,
      score: 90,
      rawScore: 90,
      confidence: 88,
    }];
  }

  const adler = detectAdler32(text);
  if (adler) {
    return [{
      id: 'adler32',
      name: adler.name,
      category: '哈希/摘要',
      params: {},
      paramsLabel: '—',
      result: adler.sample || null,
      explanation: 'Adler-32 校验和，不可逆。',
      usage: adler.sample ? `示例明文「${adler.sample}」校验值匹配。` : '对候选明文计算 Adler-32 后比对。',
      reversible: false,
      score: 92,
      rawScore: 92,
      confidence: 90,
    }];
  }

  return null;
}



function detectEncodingAndTrivial(text) {
  const t = text.trim();
  if (/%[0-9A-Fa-f]{2}/.test(t)) return null;
  if (/^[A-Z2-7=]+$/i.test(t)) return null;
  if (/^[01\s]{8,}$/.test(t)) return null;
  if (/^(\d{1,2})([-\s]\d{1,2})+$/.test(t)) return null;
  if (/^(\d{1,3})(\s+\d{1,3})+$/.test(t)) return null;
  if (/^(\d{2,6})(\s+\d{2,6})+$/.test(t)) return null;
  if (/^[2-9]+$/.test(t)) return null;
  if (/^[A-Za-z0-9+/=]+$/.test(t) && (t.includes('=') || t.length % 4 === 0)) return null;

  if (/^[abAB\s]+$/.test(t) && t.replace(/\s/g, '').length >= 5) {
    const hit = tryQuickHit('bacon', text);
    if (hit?.verified) return [hit];
  }

  if (/^[A-Z2-7=]+$/i.test(t) && t.length >= 4) {
    const hit = tryQuickHit('base32', text);
    if (hit?.verified) return [hit];
  }

  if (/^[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]+$/.test(t) && t.length >= 4) {
    const hit = tryQuickHit('base58', text);
    if (hit?.verified) return [hit];
  }

  if (/[\u2800-\u28ff]/.test(t)) {
    const hit = tryQuickHit('braille', text);
    if (hit?.verified) return [hit];
  }

  if (/^begin\s+\d+\s/mi.test(t) || t.startsWith('M')) {
    const hit = tryQuickHit('uuencode', text);
    if (hit?.verified) return [hit];
  }

  if (/^[A-Za-z0-9+/=]+$/.test(t) && t.length >= 12) {
    const hit = tryQuickHit('gzip-base64', text);
    if (hit?.verified) return [hit];
  }

  if (!U.looksLikeUnicodeCipherText(text) && !hasLatinAndCjk(text)) {
    for (const id of ['swap-case', 'reverse', 'fullwidth', 'bubble', 'leet', 'pig-latin', 'upside-down', 'rot47']) {
      const hit = tryQuickHit(id, text, {}, 45);
      if (hit?.verified) return [hit];
    }
  }

  return null;
}

/** 中文码点密文快检 — 须在 leet/upside-down 等之前执行 */
function detectUnicodeCpCjk(text) {
  if (!U.looksLikeUnicodeCipherText(text)) return null;

  const hits = [];
  const affineHit = U.bruteUnicodeCpAffine(text);
  const caesarHit = U.bruteUnicodeCpCaesar(text, 200);
  const vigHit = U.tryUnicodeCpVigenere(text, [...new Set(ZH_VIG_KEYS)]);
  const vigBrute = U.bruteUnicodeCpVigenereShort(text);
  const candidates = [];

  if (affineHit) {
    candidates.push({ id: 'affine', params: { a: affineHit.a, b: affineHit.b }, result: affineHit.result });
    candidates.push({ id: 'unicode-cp-affine', params: { a: affineHit.a, b: affineHit.b }, result: affineHit.result });
    if (affineHit.a === 1 && affineHit.b === 13) {
      candidates.push({ id: 'rot13', params: {}, result: affineHit.result });
    }
  }
  if (caesarHit) {
    candidates.push({ id: 'unicode-cp-caesar', params: { shift: caesarHit.shift }, result: caesarHit.result });
    if (!U.looksLikeUnicodeCipherText(text)) {
      candidates.push({ id: 'caesar', params: { shift: caesarHit.shift }, result: caesarHit.result });
    }
    if (caesarHit.shift === 13) {
      candidates.push({ id: 'rot13', params: {}, result: caesarHit.result });
    }
  }
  if (vigHit) candidates.push({ id: 'unicode-cp-vigenere', params: { key: vigHit.key }, result: vigHit.result });
  if (vigBrute && vigBrute.key !== vigHit?.key) {
    candidates.push({ id: 'unicode-cp-vigenere', params: { key: vigBrute.key }, result: vigBrute.result });
  }

  for (const pick of candidates) {
    const c = cipherMap[pick.id];
    if (!c) continue;
    const scored = scoreDecryptCandidate(text, pick.result, { cipherId: pick.id, params: pick.params });
    const pureShortCjk = pick.result && [...pick.result].length <= 10 && /^[\u4e00-\u9fff]+$/.test(pick.result);
    const isAffinePick = pick.id === 'affine' || pick.id === 'unicode-cp-affine';
    const isCaesarPick = pick.id === 'unicode-cp-caesar' || pick.id === 'caesar';
    const ok = scored.verified && (
      (scored.readable >= 48 && isMeaningfulShortCjkPlain(pick.result, scored.readable))
      || ((isAffinePick || isCaesarPick) && pureShortCjk && scored.readable >= 20
        && isMeaningfulShortCjkPlain(pick.result, scored.readable))
    ) || (scored.score >= 50 && scored.readable >= 42);
    if (ok) hits.push(buildHit(c, pick, scored, text));
  }

  if (!hits.length) return null;
  hits.sort(compareIdentifyHits);
  return hits;
}



function detectMorse(text) {

  const t = text.trim();

  const morseBody = t.replace(/\[\?[^\]]*\]/g, '');

  if (!looksLikeMorseInput(t)) return null;

  let best = null;

  const variantOrder = { auto: 3, zh: 2, intl: 1 };

  const beatsMorse = (scored, variant, result, prev) => {
    if (!prev) return true;
    if (scored.verified !== prev.scored.verified) return scored.verified && !prev.scored.verified;
    if (scored.score !== prev.scored.score) return scored.score > prev.scored.score;
    if (variant !== prev.variant) {
      return (variantOrder[variant] ?? 0) > (variantOrder[prev.variant] ?? 0);
    }
    if ((scored.readable ?? 0) !== (prev.scored.readable ?? 0)) {
      return (scored.readable ?? 0) > (prev.scored.readable ?? 0);
    }
    return false;
  };

  for (const variant of ['auto', 'zh', 'intl']) {

    try {

      const result = E.morseDecode(t, variant);

      if (!result || result === t) continue;

      const scored = scoreDecryptCandidate(t, result, { cipherId: 'morse', params: { variant } });

      if (scored.score >= 32 && beatsMorse(scored, variant, result, best)) {
        best = { result, variant, scored };
      }

    } catch { /* skip */ }

  }

  return best;

}



function detectPatterns(text) {

  const hits = [];



  const hashHit = M.detectHashType(text);

  if (hashHit) {

    hits.push({

      id: hashHit.type,

      name: hashHit.name,

      category: '哈希/摘要',

      params: {},

      paramsLabel: '—',

      result: null,

      explanation: `${hashHit.name} 是单向哈希，无法还原原文。`,

      usage: '哈希不可逆，对候选明文计算哈希后比对。',

      reversible: false,

      confidence: 95,

      score: 95,

      rawScore: 95,

    });

    return hits;

  }



  if (/%[0-9A-Fa-f]{2}/.test(text)) {

    try {

      const result = cipherMap.url.decrypt(text);

      if (result && result !== text) {

        const scored = scoreDecryptCandidate(text, result, { cipherId: 'url', params: {} });

        if (scored.verified || scored.score >= 45) {

          hits.push(buildHit(cipherMap.url, { params: {}, result, id: 'url' }, scored, text));

          return hits;

        }

      }

    } catch { /* skip */ }

  }



  const textEncHits = detectTextEncodings(text);
  if (textEncHits?.length) return textEncHits;

  const structured = detectStructuredEncodings(text);

  if (structured?.length) return structured;

  const hexCleanEarly = text.trim().replace(/\s/g, '');
  if (/^[0-9a-fA-F]+$/.test(hexCleanEarly) && hexCleanEarly.length >= 4 && hexCleanEarly.length % 2 === 0) {
    try {
      const result = E.hexDecode(text);
      const scored = scoreDecryptCandidate(text, result, { cipherId: 'hex', params: {} });
      if (scored.verified || (scored.score >= 35 && scoreReadableText(result) >= 20)) {
        return [buildHit(cipherMap.hex, { params: {}, result, id: 'hex' }, scored, text)];
      }
    } catch { /* skip */ }
  }

  const transposeHits = detectTransposeCjk(text);
  if (transposeHits?.length) return transposeHits;

  const unicodeCpHits = detectUnicodeCpCjk(text);
  if (unicodeCpHits?.length) return unicodeCpHits;

  const mixedSubstHits = detectMixedLatinSubst(text);
  if (mixedSubstHits?.length) return mixedSubstHits;

  const encodingHits = detectEncodingAndTrivial(text);

  if (encodingHits?.length) return encodingHits;



  if (/%[0-9A-Fa-f]{2}/.test(text)) {

    try {

      const result = cipherMap.url.decrypt(text);

      if (result && result !== text) {

        const scored = scoreDecryptCandidate(text, result, { cipherId: 'url', params: {} });

        if (scored.score >= 45) {

          hits.push(buildHit(cipherMap.url, { params: {}, result, id: 'url' }, scored, text));

          return hits;

        }

      }

    } catch { /* skip */ }

  }



  if (/^[2-9]+$/.test(text.trim()) && text.trim().length >= 3) {

    const hit = tryQuickHit('phone-keypad', text);

    if (hit?.verified) return [hit];

  }



  const morseHit = detectMorse(text);

  if (morseHit) {

    const c = cipherMap.morse;

    hits.push(buildHit(c, {

      params: { variant: morseHit.variant },

      result: morseHit.result,

      id: 'morse',

    }, morseHit.scored, text));

    return hits;

  }



  if (/^(\d{1,2})([-\s]\d{1,2})+$/.test(text.trim())) {

    for (const id of ['gf-a1z26', 'a1z26']) {

      const c = cipherMap[id];

      const result = c.decrypt(text, {});

      const scored = scoreDecryptCandidate(text, result, { cipherId: id, params: {} });

      hits.push(buildHit(c, { params: {}, result, id }, { ...scored, score: Math.max(scored.score, 88) }, text));

    }

    return hits;

  }



  const hexClean = text.trim().replace(/\s/g, '');
  if (/^[0-9a-fA-F]+$/.test(hexClean) && hexClean.length >= 4 && hexClean.length % 2 === 0) {

    try {

      const result = E.hexDecode(text);

      const scored = scoreDecryptCandidate(text, result, { cipherId: 'hex', params: {} });

      if (scored.verified || (scored.score >= 35 && scoreReadableText(result) >= 20)) {

        hits.push(buildHit(cipherMap.hex, { params: {}, result, id: 'hex' }, scored, text));

        return hits;

      }

    } catch { /* skip */ }

  }



  if (/^[01\s]{8,}$/.test(text.trim())) {

    try {

      const result = E.binaryDecode(text);

      const scored = scoreDecryptCandidate(text, result, { cipherId: 'binary', params: {} });

      if (scored.score >= 35) {

        hits.push(buildHit(cipherMap.binary, { params: {}, result, id: 'binary' }, scored, text));

        return hits;

      }

    } catch { /* skip */ }

  }



  if (/^[A-Za-z0-9+/=]{8,}$/.test(text.trim()) && (/[+/=]/.test(text) || text.length % 4 === 0)) {

    try {

      const result = E.base64Decode(text);

      const scored = scoreDecryptCandidate(text, result, { cipherId: 'base64', params: {} });

      if (scored.score >= 38) {

        hits.push(buildHit(cipherMap.base64, { params: {}, result, id: 'base64' }, scored, text));

        return hits;

      }

    } catch { /* skip */ }

  }



  if (/%[0-9A-Fa-f]{2}/.test(text)) {

    try {

      const result = cipherMap.url.decrypt(text);

      if (result && result !== text) {

        const scored = scoreDecryptCandidate(text, result, { cipherId: 'url', params: {} });

        if (scored.score >= 45) {

          hits.push(buildHit(cipherMap.url, { params: {}, result, id: 'url' }, scored, text));

          return hits;

        }

      }

    } catch { /* skip */ }

  }



  if (/^(\d{1,3})(\s+\d{1,3})+$/.test(text.trim())) {
    const nums = text.trim().split(/\s+/).map(Number);
    if (Math.max(...nums) <= 127) {
      try {
        const result = cipherMap.decimal.decrypt(text);
        const scored = scoreDecryptCandidate(text, result, { cipherId: 'decimal', params: {} });
        if (scored.verified || (scored.score >= 35 && isMeaningfulShortCjkPlain(result, scored.readable))) {
          hits.push(buildHit(cipherMap.decimal, { params: {}, result, id: 'decimal' }, scored, text));
          return hits;
        }
      } catch { /* skip */ }
    }
  }

  if (/^(\d{2,6})(\s+\d{2,6})+$/.test(text.trim())) {

    try {

      const result = U.unicodeCpDecimalDecode(text);

      const scored = scoreDecryptCandidate(text, result, { cipherId: 'unicode-cp-decimal', params: {} });

      if (scored.score >= 38) {

        hits.push(buildHit(cipherMap['unicode-cp-decimal'], { params: {}, result, id: 'unicode-cp-decimal' }, scored, text));

        return hits;

      }

    } catch { /* skip */ }

  }



  if (U.looksLikeUnicodeCipherText(text)) {

    const caesarHit = U.bruteUnicodeCpCaesar(text, 200);

    const vigHit = U.tryUnicodeCpVigenere(text, [...new Set(ZH_VIG_KEYS)]);

    const vigBrute = U.bruteUnicodeCpVigenereShort(text);



    const candidates = [];

    if (caesarHit) {
      candidates.push({ id: 'unicode-cp-caesar', params: { shift: caesarHit.shift }, result: caesarHit.result });
      if (!U.looksLikeUnicodeCipherText(text)) {
        try {
          const latin = cipherMap.caesar.decrypt(text, { shift: caesarHit.shift });
          if (latin === caesarHit.result) {
            candidates.push({ id: 'caesar', params: { shift: caesarHit.shift }, result: latin });
          }
        } catch { /* skip */ }
      }
    }

    if (vigHit) candidates.push({ id: 'vigenere', params: { key: vigHit.key }, result: vigHit.result });

    if (vigBrute && vigBrute.key !== vigHit?.key) {

      candidates.push({ id: 'vigenere', params: { key: vigBrute.key }, result: vigBrute.result });

    }



    for (const pick of candidates) {

      const c = cipherMap[pick.id];

      if (!c) continue;

      const scored = scoreDecryptCandidate(text, pick.result, { cipherId: pick.id, params: pick.params });

      if (scored.score >= 35) hits.push(buildHit(c, pick, scored, text));

    }

    hits.sort(compareIdentifyHits);

  }



  return hits;

}


