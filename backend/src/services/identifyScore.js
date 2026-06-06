/**
 * 自动识别专用评分与校验
 */
import * as E from '../ciphers/engine.js';
import * as U from '../ciphers/unicodeCipher.js';
import { isCorpusPlaintext } from '../ciphers/exampleCorpus.js';
import { isBiblePlaintext } from '../ciphers/bibleCorpus.js';
import { isClassicPlaintext } from '../ciphers/classicCorpus.js';
import { cipherMap } from '../ciphers/registry.js';

/** 加密后再比对密文，验证候选解密 */
export function verifyRoundtrip(cipherId, plaintext, ciphertext, params) {
  const cipher = cipherMap[cipherId];
  if (!cipher?.encrypt || !plaintext || !ciphertext) return false;
  const norm = (t) => {
    const s = String(t).trim();
    if (cipherId === 'morse') {
      return s.replace(/[，。！？、；：,\.!?;\s]/g, '');
    }
    return s;
  };
  try {
    if (cipherId === 'jwt') {
      const decoded = E.jwtDecode(ciphertext);
      return Boolean(decoded && plaintext);
    }
    if (cipherId === 'morse') {
      return E.morsePlainEqual(plaintext, cipher.decrypt(ciphertext, params || {}));
    }
    return norm(cipher.encrypt(norm(plaintext), params || {})) === norm(ciphertext);
  } catch {
    return false;
  }
}

/** 解密结果综合可读性（中英） */
export function scoreReadableText(text) {
  if (!text) return 0;
  return Math.max(E.scorePlaintext(text), U.scorePlaintextMultilingual(text));
}

/** 流密码/异或：任意同长度明文都可往返，须结合可读性 */
const LOOSE_VERIFY_IDS = new Set(['rc4', 'xor']);
const INVOLUTION_IDS = new Set(['swap-case', 'reverse', 'rot47', 'fullwidth', 'bubble']);

/** 密文是否呈摩斯形态（点划为主；中文摩斯可混少量无电报码汉字） */
export function looksLikeMorseInput(text) {
  const t = String(text || '').trim().replace(/\[\?[^\]]*\]/g, '');
  if (t.length < 3 || !/[.\-]/.test(t)) return false;
  if (/^[\.\-\s\/，]+$/.test(t)) return true;
  const morseSym = (t.match(/[\.\-\/]/g) || []).length;
  const compact = t.replace(/\s/g, '');
  if (morseSym < 6) return false;
  return morseSym / Math.max(compact.length, 1) >= 0.5 || morseSym / t.length >= 0.12;
}
const GARBLED_TRIVIAL_IDS = new Set([
  'upside-down', 'leet', 'pig-latin', 'reverse', 'swap-case', 'bubble', 'fullwidth', 'rot47', 'keyboard-shift',
]);
const GARBLED_TRANSPOSE_IDS = new Set(['scytale', 'rail-fence', 'columnar', 'even-odd-split']);

/** 对单个解密候选打分 */
export function scoreDecryptCandidate(input, output, { cipherId, params } = {}) {
  if (!output || output === input) return { score: 0, verified: false, readable: 0 };

  let score = scoreReadableText(output);
  const readable = score;
  const inScore = scoreReadableText(input);

  if (U.looksLikeUnicodeCipherText(output) && !U.isKnownChinesePhrase(output)) score -= 28;
  if (U.looksLikeUnicodeCipherText(input)) {
    const knownPlain = isBiblePlaintext(output) || isClassicPlaintext(output) || isCorpusPlaintext(output);
    if (GARBLED_TRIVIAL_IDS.has(cipherId) && !knownPlain) {
      score -= 55;
    }
    if (GARBLED_TRANSPOSE_IDS.has(cipherId) && !knownPlain) {
      score -= 45;
    }
  }
  if (/(.)\1{3,}/.test(output) && score < 60) score -= 10;

  const delta = score - inScore;
  if (delta >= 20) score += 12;
  else if (delta >= 10) score += 6;
  else if (delta < 6 && cipherId !== 'morse') score -= 18;

  const inPunct = (input.match(/[，。！？、；：,\.!?;:\s]/g) || []).length;
  const outPunct = (output.match(/[，。！？、；：,\.!?;:\s]/g) || []).length;
  if (inPunct > 0 && outPunct >= inPunct) score += 10;
  if (cipherId === 'morse' && looksLikeMorseInput(input)) score += 18;

  let verified = cipherId ? verifyRoundtrip(cipherId, output, input, params) : false;
  if (LOOSE_VERIFY_IDS.has(cipherId) && looksLikeMorseInput(input)) {
    verified = false;
    score -= 60;
  }
  if (cipherId?.startsWith('unicode-cp-')) {
    const asciiIn = [...input].every((ch) => (ch.codePointAt(0) || 0) < 0x300);
    const cjkOut = /[\u4e00-\u9fff]/.test(output);
    if (asciiIn && !U.looksLikeUnicodeCipherText(input) && !cjkOut) {
      score -= 50;
      verified = false;
    }
  }
  if (cipherId === 'morse' && /^[\d\s(),]+$/.test(output) && !/[\u4e00-\u9fff]/.test(output)) {
    score -= 45;
    verified = false;
  }
  if (cipherId === 'rot5' && verified) {
    if (input.replace(/\d/g, '') !== output.replace(/\d/g, '')) verified = false;
    else if (/[a-z]/.test(output) && /[A-Z]/.test(output) && input.toLowerCase() === output.toLowerCase()) {
      score -= 40;
      verified = false;
    }
  }
  if (cipherId === 'rot47' && verified) {
    const letters = (output.match(/[a-zA-Z]/g) || []).length;
    const benign = (output.match(/[\s.,!?'"()-]/g) || []).length;
    const special = output.length - letters - benign;
    if (letters / Math.max(output.length, 1) < 0.45 || special / Math.max(output.length, 1) > 0.12) {
      verified = false;
      score -= 50;
    }
  }
  if (cipherId === 'ascii85' && verified && !String(input).trim().startsWith('<~')) {
    verified = false;
    score -= 45;
  }
  if (cipherId === 'ascii85' && verified && scoreReadableText(output) < 52) {
    verified = false;
    score -= 40;
  }
  if (cipherId === 'trifid' && verified) {
    const natural = /^[A-Z]{3,}$/.test(output.replace(/\./g, ''));
    if (!natural || readable < 72 || /\./.test(output)) {
      verified = false;
      score -= 45;
    }
  }
  if (verified && INVOLUTION_IDS.has(cipherId)) {
    const caseOnly = cipherId === 'swap-case'
      && input.toLowerCase() === output.toLowerCase() && input !== output;
    if (!caseOnly && readable <= inScore + 8) verified = false;
  }
  if (cipherId === 'swap-case' && verified && /\d/.test(input)) {
    const rotCipher = cipherMap['rot5'];
    if (rotCipher?.decrypt) {
      try {
        const rotOut = rotCipher.decrypt(input, {});
        const natural = /^[A-Z][a-z]/.test(rotOut) && !/[a-z][A-Z]/.test(rotOut.replace(/[^A-Za-z]/g, '').slice(0, 8));
        if (verifyRoundtrip('rot5', rotOut, input, {}) && natural && scoreReadableText(rotOut) > readable + 5) {
          verified = false;
          score -= 50;
        }
      } catch { /* skip */ }
    }
  }
  if (cipherId === 'vigenere' && verified && /^[\.\-\s\/\[\]?，]+$/.test(input.replace(/\[\?[^\]]*\]/g, ''))) {
    verified = false;
    score -= 55;
  }
  if (verified && LOOSE_VERIFY_IDS.has(cipherId) && readable < 58) verified = false;
  const shortCjkVerified = verified && [...output].length <= 8 && /^[\u4e00-\u9fff]+$/.test(output)
    && (cipherId?.startsWith('unicode-cp-') || ['caesar', 'rot13', 'rot-all', 'atbash', 'vigenere'].includes(cipherId));
  if (cipherId === 'unicode-cp-caesar' && verified && U.looksLikeUnicodeCipherText(input)) {
    const hangul = (output.match(/[\uac00-\ud7af]/g) || []).length;
    const cjkOut = (output.match(/[\u4e00-\u9fff]/g) || []).length;
    const cjkIn = (input.match(/[\u4e00-\u9fff]/g) || []).length;
    if (cjkIn / Math.max(input.length, 1) > 0.35 && hangul / Math.max(output.length, 1) > 0.15
      && cjkOut / Math.max(output.length, 1) < 0.2
      && !isBiblePlaintext(output) && !isClassicPlaintext(output) && !isCorpusPlaintext(output)) {
      verified = false;
      score -= 55;
    }
  }
  const corpusPlainVerified = verified && (isCorpusPlaintext(output) || isBiblePlaintext(output) || isClassicPlaintext(output))
    && (cipherId?.startsWith('unicode-cp-') || ['caesar', 'rot13', 'rot-all', 'atbash', 'affine'].includes(cipherId));
  if (verified && readable < 48 && !(cipherId === 'morse' && /[\u4e00-\u9fff]/.test(output)) && cipherId !== 'jwt'
    && !shortCjkVerified && !corpusPlainVerified) verified = false;
  if (verified) score += 22;
  if (verified && (params?.key === 'secret' || params?.keyByte === 66)) score += 8;
  if (verified && LOOSE_VERIFY_IDS.has(cipherId) && readable >= 58 && !looksLikeMorseInput(input)) score += 20;
  if (verified && GARBLED_TRANSPOSE_IDS.has(cipherId)) {
    const norm = (s) => s.replace(/\s/g, '').split('').sort().join('');
    if (norm(input) === norm(output)) score += 28;
    if (U.looksLikeUnicodeCipherText(input) && !isBiblePlaintext(output) && !isCorpusPlaintext(output)) {
      verified = false;
      score -= 50;
    }
  }
  if (verified && GARBLED_TRIVIAL_IDS.has(cipherId) && U.looksLikeUnicodeCipherText(input)
    && !isBiblePlaintext(output) && !isClassicPlaintext(output) && !isCorpusPlaintext(output)) {
    verified = false;
    score -= 50;
  }
  if (verified && cipherId === 'morse' && /[\u4e00-\u9fff]/.test(output)) score = Math.max(score, 78);
  if (verified && isBiblePlaintext(output)) score = Math.max(score, 96);
  if (verified && isClassicPlaintext(output)) score = Math.max(score, 94);
  if (verified && isCorpusPlaintext(output)) score = Math.max(score, 90);
  if (verified && /[\u4e00-\u9fff]/.test(output)) score = Math.max(score, 82);
  if (verified && U.looksLikeUnicodeCipherText(input) && !isBiblePlaintext(output) && !isCorpusPlaintext(output)
    && ['unicode-cp-caesar', 'unicode-cp-vigenere', 'unicode-cp-affine', 'caesar', 'rot13', 'rot-all'].includes(cipherId)
    && readable < 88 && !isClassicPlaintext(output)) {
    score -= 35;
  }
  if (verified && cipherId === 'jcuken' && /[\u0400-\u04FF]/.test(output)) score += 25;
  if (verified && cipherId === 'jwt') score = Math.max(score, 85);
  if (verified && ['scytale', 'rail-fence', 'columnar', 'even-odd-split'].includes(cipherId) && /^eyJ[A-Za-z0-9_-]+\./.test(String(input))) {
    verified = false;
    score -= 55;
  }
  if (!verified) score = Math.min(score, 84);

  return {
    score: Math.max(0, Math.min(Math.round(score), 100)),
    verified,
    readable,
    delta,
  };
}

/** 语料命中层级：和合本 > 名著/诗词 > 无 */
export function corpusMatchTier(result) {
  if (!result) return 0;
  if (isBiblePlaintext(result)) return 4;
  if (isClassicPlaintext(result)) return 3;
  if (isCorpusPlaintext(result)) return 2;
  return 0;
}

/** 识别候选排序：verified → 语料命中 → 可读性 → 分数 */
export function compareIdentifyHits(a, b) {
  if (!b) return -1;
  if (!a) return 1;
  if (Boolean(a.alreadyPlaintext) !== Boolean(b.alreadyPlaintext)) {
    return (b.alreadyPlaintext ? 1 : 0) - (a.alreadyPlaintext ? 1 : 0);
  }
  if (Boolean(a.verified) !== Boolean(b.verified)) {
    return (b.verified ? 1 : 0) - (a.verified ? 1 : 0);
  }
  const tierDiff = corpusMatchTier(b.result) - corpusMatchTier(a.result);
  if (tierDiff) return tierDiff;
  if (a.verified && b.verified) {
    const readDiff = (b.readable ?? 0) - (a.readable ?? 0);
    if (Math.abs(readDiff) >= 8) return readDiff;
  }
  return b.score - a.score;
}

/** 同明文结果时优先更简单/常见的算法 */
const CIPHER_SIMPLICITY = {
  caesar: 10, rot13: 9, atbash: 8, 'unicode-cp-caesar': 7,
  vigenere: 6, 'unicode-cp-vigenere': 5, morse: 8, base64: 9, hex: 8,
  binary: 7, url: 8, 'unicode-cp-decimal': 7,
  'rail-fence': 9, columnar: 8, 'even-odd-split': 7, scytale: 9, bacon: 8, braille: 8, leet: 7,
};

export function pickPreferredResult(a, b) {
  if (!b) return a;
  if (!a) return b;
  const tierDiff = corpusMatchTier(b.result) - corpusMatchTier(a.result);
  if (tierDiff) return tierDiff > 0 ? b : a;
  const scoreDiff = b.score - a.score;
  if (Math.abs(scoreDiff) > 6) return scoreDiff > 0 ? b : a;
  if (a.verified && !b.verified) return a;
  if (a.verified && b.verified && (b.readable ?? 0) - (a.readable ?? 0) >= 10) return b;
  if (a.verified && b.verified && (a.readable ?? 0) - (b.readable ?? 0) >= 10) return a;
  if (a.verified && b.verified && a.result === b.result) {
    const trans = new Set(['scytale', 'rail-fence', 'columnar', 'even-odd-split']);
    if (trans.has(a.id) && !trans.has(b.id)) return a;
    if (trans.has(b.id) && !trans.has(a.id)) return b;
  }
  if (a.result === b.result && /[\u4e00-\u9fff]/.test(a.result || '')) {
    const rotIds = new Set(['rot13', 'rot-all', 'caesar', 'gf-caesar3', 'unicode-cp-caesar']);
    if (rotIds.has(a.id) && !rotIds.has(b.id)) return a;
    if (rotIds.has(b.id) && !rotIds.has(a.id)) return b;
    if (a.id === 'unicode-cp-caesar' && b.id === 'rot13') return b;
    if (b.id === 'unicode-cp-caesar' && a.id === 'rot13') return a;
  }
  const sa = CIPHER_SIMPLICITY[a.id] || 0;
  const sb = CIPHER_SIMPLICITY[b.id] || 0;
  if (sb !== sa) return sb > sa ? b : a;
  return b.score >= a.score ? b : a;
}

/** 合并相同解密结果的候选，保留最优 */
export function collapseByPlaintextResult(list) {
  const map = new Map();
  for (const r of list) {
    if (!r.result) {
      map.set(`__noresult__:${r.id}:${r.paramsLabel}`, r);
      continue;
    }
    const key = r.result;
    const ex = map.get(key);
    map.set(key, ex ? pickPreferredResult(ex, r) : r);
  }
  return [...map.values()].sort(compareIdentifyHits);
}

/** 校准展示用置信度 */
export function calibrateConfidence(entry, scoreGap = 99) {
  if (entry.alreadyPlaintext) return 99;
  let c = entry.rawScore ?? entry.score ?? 0;
  if (entry.verified) c += 8;
  if (entry.verified && corpusMatchTier(entry.result) >= 4) c += 14;
  else if (entry.verified && corpusMatchTier(entry.result) >= 3) c += 10;
  else if (entry.verified && corpusMatchTier(entry.result) >= 2) c += 8;
  if (entry.verified && /[\u4e00-\u9fff]/.test(entry.result || '')) c += 12;
  if (entry.verified && (entry.result?.length ?? 0) <= 12) c += 5;
  if (scoreGap >= 30) c += 6;
  else if (scoreGap >= 15) c += 3;
  else if (scoreGap < 8) c -= 8;
  return Math.max(40, Math.min(Math.round(c), 99));
}
