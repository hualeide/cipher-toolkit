/**
 * 自动识别专用评分与校验
 */
import * as E from '../ciphers/engine.js';
import * as U from '../ciphers/unicodeCipher.js';
import { scoreZhNaturalness, isModernCorpusPlaintext } from '../ciphers/zhFreqCorpus.js';
import { isCorpusPlaintext } from '../ciphers/exampleCorpus.js';
import { isBiblePlaintext } from '../ciphers/bibleCorpus.js';
import { isClassicPlaintext } from '../ciphers/classicCorpus.js';
import { cipherMap } from '../ciphers/registry.js';

/** 短句纯汉字（仿射/码点族解密结果常见形态） */
function isPureShortCjk(text, maxLen = 10) {
  return Boolean(text && [...text].length <= maxLen && /^[\u4e00-\u9fff]+$/.test(text));
}

/** 短纯中文解密结果是否像真实语句（防码点凯撒乱移位误报） */
export function isMeaningfulShortCjkPlain(output, readable) {
  if (!output || ![...output].every((c) => /[\u4e00-\u9fff]/.test(c))) return false;
  if (U.isKnownChinesePhrase(output)) return true;
  if (isCorpusPlaintext(output) || isBiblePlaintext(output) || isClassicPlaintext(output)) return true;
  const zhNat = scoreZhNaturalness(output);
  const len = [...output].length;
  if (len <= 10 && readable >= 18 && U.hasCommonChineseChars(output, 1)) return true;
  if (zhNat >= 32 && readable >= 15) return true;
  return readable >= 52;
}

/** 识别输入规范化 — 仅剥 ASCII 空白，保留 nbsp 等可能是密文字符 */
export function normalizeIdentifyInput(text) {
  if (text == null) return '';
  return String(text).replace(/^[\t\n\r ]+|[\t\n\r ]+$/g, '');
}

/** 加密后再比对密文，验证候选解密 */
export function verifyRoundtrip(cipherId, plaintext, ciphertext, params) {
  const cipher = cipherMap[cipherId];
  if (!cipher?.encrypt || !plaintext || !ciphertext) return false;
  const norm = (t) => {
    const s = normalizeIdentifyInput(t);
    if (cipherId === 'morse') {
      return s.replace(/[，。！？、；：,\.!?;\s]/g, '');
    }
    return s;
  };
  try {
    if (cipherId === 'jwt') {
      const decoded = E.jwtDecode(ciphertext);
      const parsed = JSON.parse(decoded);
      const payload = String(parsed.payload ?? '');
      return norm(payload) === norm(plaintext);
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
  let score = Math.max(E.scorePlaintext(text), U.scorePlaintextMultilingual(text));
  if (/[\u4e00-\u9fff]/.test(text)) {
    const zhNat = scoreZhNaturalness(text);
    score = Math.max(score, Math.round(score * 0.82 + zhNat * 0.18));
  }
  return score;
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
const MIXED_LOOSE_SUBST_IDS = new Set([
  'caesar', 'rot13', 'rot-all', 'rot18', 'rot47', 'gf-caesar3', 'atbash', 'affine',
  'gronsfeld', 'vigenere', 'beaufort', 'keyboard-shift', 'leet',
]);
const LATIN_CAESAR_IDS = new Set([
  'caesar', 'rot13', 'rot-all', 'rot18', 'gf-caesar3', 'atbash', 'affine', 'beaufort', 'vigenere',
]);

function isPureLatinText(text) {
  const t = String(text || '').trim();
  return /^[A-Za-z0-9\s.,!?;:'"()-]+$/.test(t) && !/[\u4e00-\u9fff]/.test(t);
}

function hasLatinAndCjk(text) {
  return /[A-Za-z]/.test(text) && /[\u4e00-\u9fff]/.test(text);
}

/** 对单个解密候选打分 */
export function scoreDecryptCandidate(input, output, { cipherId, params } = {}) {
  if (!output || output === input) return { score: 0, verified: false, readable: 0 };

  let score = scoreReadableText(output);
  let readable = score;
  const inScore = scoreReadableText(input);

  const cpSubstId = cipherId?.startsWith('unicode-cp-')
    || ['caesar', 'rot13', 'rot-all', 'atbash', 'affine', 'vigenere'].includes(cipherId);
  if (U.looksLikeUnicodeCipherText(output) && !U.isKnownChinesePhrase(output)
    && !(cpSubstId && isPureShortCjk(output))) {
    score -= 28;
  }
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

  const inPunct = (input.match(/[，。！？、；：,\.!?;:\s]/g) || []).length;
  const outPunct = (output.match(/[，。！？、；：,\.!?;:\s]/g) || []).length;
  if (inPunct > 0 && outPunct >= inPunct) score += 10;
  if (cipherId === 'morse' && looksLikeMorseInput(input)) score += 18;

  let verified = cipherId ? verifyRoundtrip(cipherId, output, input, params) : false;
  if (cipherId === 'reverse' && verified) {
    verified = input.trim() === [...output.trim()].reverse().join('');
    if (verified && U.looksLikeUnicodeCipherText(input)) {
      const outNat = scoreZhNaturalness(output);
      const inNat = scoreZhNaturalness(input);
      const known = U.isKnownChinesePhrase(output) || isCorpusPlaintext(output)
        || isBiblePlaintext(output) || isClassicPlaintext(output);
      const meaningful = isMeaningfulShortCjkPlain(output, readable);
      if (!known && !meaningful && (outNat < inNat + 12 || outNat < 30)) {
        verified = false;
        score -= 55;
      }
    }
  }
  if (cipherId === 'rail-fence' && verified) {
    const cipher = cipherMap['rail-fence'];
    const rails = params?.rails ?? cipher?.params?.find((p) => p.name === 'rails')?.default ?? 3;
    if (cipher?.encrypt && cipher.encrypt(output, { rails }) !== input.trim()) verified = false;
  }
  if (cipherId === 'even-odd-split' && verified) {
    const cipher = cipherMap['even-odd-split'];
    if (cipher?.encrypt && cipher.encrypt(output, params || {}) !== input.trim()) verified = false;
  }
  if (cipherId === 'scytale' && verified) {
    const cipher = cipherMap['scytale'];
    const diameter = params?.diameter ?? cipher?.params?.find((p) => p.name === 'diameter')?.default ?? 5;
    if (cipher?.encrypt && cipher.encrypt(output, { diameter }) !== input.trim()) verified = false;
  }
  if (cipherId === 'columnar' && verified) {
    const cipher = cipherMap.columnar;
    const key = params?.key ?? cipher?.params?.find((p) => p.name === 'key')?.default ?? 'CIPHER';
    if (cipher?.encrypt && cipher.encrypt(output, { key }) !== input.trim()) verified = false;
  }
  if (delta < 6 && cipherId !== 'morse'
    && !(verified && isMeaningfulShortCjkPlain(output, readable))) score -= 18;
  if (LATIN_CAESAR_IDS.has(cipherId) && isPureLatinText(input) && isPureLatinText(output)) {
    const lex = E.scoreEnglishLexicon(output);
    score += Math.round(lex * 28);
    const unknownLong = (output.match(/[a-zA-Z]{5,}/g) || [])
      .filter((w) => E.scoreEnglishLexicon(w) < 0.45).length;
    if (unknownLong > 0) score -= unknownLong * 24;
    if (lex >= 0.55) readable = Math.max(readable, Math.round(52 + lex * 48));
    else if (lex < 0.3) readable = Math.min(readable, Math.round(readable * 0.72));
  }
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
    if (!caseOnly && readable <= inScore + 8
      && !(cipherId === 'reverse' && isMeaningfulShortCjkPlain(output, readable))) verified = false;
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
    && (cipherId?.startsWith('unicode-cp-') || ['caesar', 'rot13', 'rot-all', 'atbash', 'vigenere', 'affine'].includes(cipherId))
    && isMeaningfulShortCjkPlain(output, readable);
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
    if (!isBiblePlaintext(output) && !isClassicPlaintext(output) && !isCorpusPlaintext(output)
      && !U.isKnownChinesePhrase(output) && readable < 52
      && !isMeaningfulShortCjkPlain(output, readable)) {
      verified = false;
      score -= 45;
    }
    const hangulIn = (input.match(/[\uac00-\ud7af]/g) || []).length;
    if (hangulIn > 0 && !isBiblePlaintext(output) && !isClassicPlaintext(output) && !isCorpusPlaintext(output)
      && !U.isKnownChinesePhrase(output) && readable < 58) {
      verified = false;
      score -= 50;
    }
    if (params?.shift === 1 && !isBiblePlaintext(output) && !isClassicPlaintext(output) && !isCorpusPlaintext(output)
      && !U.isKnownChinesePhrase(output) && readable < 62) {
      verified = false;
      score -= 55;
    }
  }
  const corpusPlainVerified = verified && (isCorpusPlaintext(output) || isBiblePlaintext(output) || isClassicPlaintext(output))
    && (cipherId?.startsWith('unicode-cp-') || ['caesar', 'rot13', 'rot-all', 'atbash', 'affine'].includes(cipherId));
  if (verified && readable < 48 && !(cipherId === 'morse' && /[\u4e00-\u9fff]/.test(output)) && cipherId !== 'jwt'
    && !shortCjkVerified && !corpusPlainVerified
    && !isMeaningfulShortCjkPlain(output, readable)
    && !(LATIN_CAESAR_IDS.has(cipherId) && isPureLatinText(output) && E.scoreEnglishLexicon(output) >= 0.35)) {
    verified = false;
  }
  if (verified) score += 22;
  const mixedNoise = (output.match(/[^a-zA-Z0-9\u4e00-\u9fff\u3040-\u30ff\s，。！？、；：,\.!?'"()-]/g) || []).length;
  if (mixedNoise / Math.max(output.length, 1) > 0.06) {
    score -= 42;
    verified = false;
  }
  if (verified && cipherId === 'enigma-simple' && /^[A-Z]{3,}(\s+[A-Z]{2,})+$/.test(String(input).trim())) {
    score -= 45;
    verified = false;
  }
  if (verified && (params?.key === 'secret' || params?.keyByte === 66)) score += 8;
  if (verified && LOOSE_VERIFY_IDS.has(cipherId) && readable >= 58 && !looksLikeMorseInput(input)) score += 20;
  if (verified && GARBLED_TRANSPOSE_IDS.has(cipherId)) {
    const norm = (s) => s.replace(/\s/g, '').split('').sort().join('');
    if (norm(input) === norm(output)) score += 28;
    if (U.looksLikeUnicodeCipherText(input) && !isBiblePlaintext(output) && !isCorpusPlaintext(output)
      && !isMeaningfulShortCjkPlain(output, readable)) {
      verified = false;
      score -= 50;
    }
  }
  if (verified && GARBLED_TRIVIAL_IDS.has(cipherId) && U.looksLikeUnicodeCipherText(input)
    && !isBiblePlaintext(output) && !isClassicPlaintext(output) && !isCorpusPlaintext(output)
    && !isMeaningfulShortCjkPlain(output, readable)) {
    verified = false;
    score -= 50;
  }
  const TRANSPOSE_IDS = new Set(['rail-fence', 'columnar', 'scytale', 'even-odd-split', 'reverse']);
  if (verified && TRANSPOSE_IDS.has(cipherId) && isMeaningfulShortCjkPlain(output, readable)) {
    score = Math.max(score, 84);
  }
  if (verified && cipherId === 'morse' && /[\u4e00-\u9fff]/.test(output)) score = Math.max(score, 78);
  if (verified && isBiblePlaintext(output)) score = Math.max(score, 96);
  if (verified && isClassicPlaintext(output)) score = Math.max(score, 94);
  if (verified && isCorpusPlaintext(output)) score = Math.max(score, 90);
  if (verified && isModernCorpusPlaintext(output)) score = Math.max(score, 92);
  if (verified && hasLatinAndCjk(input) && MIXED_LOOSE_SUBST_IDS.has(cipherId)
    && !isLikelyMixedPlaintext(output) && !isModernCorpusPlaintext(output)
    && !U.isKnownChinesePhrase(output) && !isCorpusPlaintext(output)) {
    verified = false;
    score -= 48;
  }
  if (verified && /[\u4e00-\u9fff]/.test(output) && readable >= 55) score = Math.max(score, 82);
  const affineShortCjk = verified && ['affine', 'unicode-cp-affine'].includes(cipherId) && isPureShortCjk(output);
  if (verified && ['affine', 'unicode-cp-affine'].includes(cipherId) && U.looksLikeUnicodeCipherText(input)
    && !isMeaningfulShortCjkPlain(output, readable) && !isCorpusPlaintext(output)
    && !isClassicPlaintext(output) && !U.isKnownChinesePhrase(output)) {
    verified = false;
    score -= 45;
  }
  if (verified && affineShortCjk) score = Math.max(score, 78);
  const encShortCjk = verified && ['hex', 'base64', 'binary', 'octal', 'url', 'unicode-escape', 'quoted-printable'].includes(cipherId)
    && isMeaningfulShortCjkPlain(output, readable);
  if (encShortCjk) score = Math.max(score, 76);
  if (verified && U.looksLikeUnicodeCipherText(input) && !isBiblePlaintext(output) && !isCorpusPlaintext(output)
    && ['unicode-cp-caesar', 'unicode-cp-vigenere', 'unicode-cp-affine', 'caesar', 'rot13', 'rot-all'].includes(cipherId)
    && readable < 88 && !isClassicPlaintext(output) && !affineShortCjk
    && !isMeaningfulShortCjkPlain(output, readable)) {
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
  if (isModernCorpusPlaintext(result)) return 3;
  if (isCorpusPlaintext(result)) return 2;
  return 0;
}

/** 识别候选排序：verified → 语料命中 → 可读性 → 分数 */
const TRANSPOSE_IDS = new Set(['rail-fence', 'columnar', 'scytale', 'even-odd-split', 'reverse']);
const CP_GARBLED_IDS = new Set([
  'caesar', 'rot13', 'rot-all', 'atbash', 'affine', 'unicode-cp-caesar', 'unicode-cp-affine', 'unicode-cp-vigenere',
]);
const TRANSPOSE_TIE_PREF = {
  'even-odd-split': 5, 'rail-fence': 4, columnar: 3, scytale: 2, reverse: 1,
};

function transposeTieBreak(a, b) {
  if (!a?.result || a.result !== b?.result) return 0;
  const pa = TRANSPOSE_TIE_PREF[a.id] || 0;
  const pb = TRANSPOSE_TIE_PREF[b.id] || 0;
  return pa !== pb ? pb - pa : 0;
}

export function isLikelyMixedPlaintext(result) {
  if (!result) return false;
  if (isModernCorpusPlaintext(result)) return true;
  const noise = (result.match(/[^a-zA-Z0-9\u4e00-\u9fff，。！？、；：,\.!?'"()\s]/g) || []).length;
  return /[A-Za-z]{2,}/.test(result) && /[\u4e00-\u9fff]/.test(result) && noise <= 1;
}

export function compareIdentifyHits(a, b) {
  if (!b) return -1;
  if (!a) return 1;
  if (Boolean(a.alreadyPlaintext) !== Boolean(b.alreadyPlaintext)) {
    return (b.alreadyPlaintext ? 1 : 0) - (a.alreadyPlaintext ? 1 : 0);
  }
  if (Boolean(a.verified) !== Boolean(b.verified)) {
    return (b.verified ? 1 : 0) - (a.verified ? 1 : 0);
  }
  if (a.verified && b.verified && a.result !== b.result) {
    const la = isLikelyMixedPlaintext(a.result);
    const lb = isLikelyMixedPlaintext(b.result);
    if (la !== lb) return lb ? 1 : -1;
    const ta = corpusMatchTier(a.result);
    const tb = corpusMatchTier(b.result);
    if (tb !== ta) return tb - ta;
    if (isPureLatinText(a.result) && isPureLatinText(b.result)
      && (LATIN_CAESAR_IDS.has(a.id) || LATIN_CAESAR_IDS.has(b.id))) {
      const ex = E.scoreEnglishLexicon(a.result);
      const ey = E.scoreEnglishLexicon(b.result);
      if (ey - ex >= 0.12) return 1;
      if (ex - ey >= 0.12) return -1;
    }
    const ra = a.readable ?? scoreReadableText(a.result);
    const rb = b.readable ?? scoreReadableText(b.result);
    if (rb - ra >= 10) return 1;
    if (ra - rb >= 10) return -1;
  }
  if (a.verified && b.verified && TRANSPOSE_IDS.has(a.id) && CP_GARBLED_IDS.has(b.id)) {
    const readDiff = (b.readable ?? 0) - (a.readable ?? 0);
    if (readDiff >= 8) return 1;
    if (readDiff <= -8) return -1;
  }
  if (a.verified && b.verified && TRANSPOSE_IDS.has(b.id) && CP_GARBLED_IDS.has(a.id)) {
    const readDiff = (a.readable ?? 0) - (b.readable ?? 0);
    if (readDiff >= 8) return -1;
    if (readDiff <= -8) return 1;
  }
  if (a.verified && b.verified && TRANSPOSE_IDS.has(a.id) && !TRANSPOSE_IDS.has(b.id) && !CP_GARBLED_IDS.has(b.id)) return -1;
  if (a.verified && b.verified && TRANSPOSE_IDS.has(b.id) && !TRANSPOSE_IDS.has(a.id) && !CP_GARBLED_IDS.has(a.id)) return 1;
  if (a.id === b.id && a.result !== b.result && a.verified && b.verified) {
    const natDiff = scoreZhNaturalness(b.result) - scoreZhNaturalness(a.result);
    if (Math.abs(natDiff) >= 4) return natDiff;
  }
  const tierDiff = corpusMatchTier(b.result) - corpusMatchTier(a.result);
  if (tierDiff) return tierDiff;
  const transTie = transposeTieBreak(a, b);
  if (transTie) return transTie;
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
  'rail-fence': 9, columnar: 8, 'even-odd-split': 10, scytale: 7, bacon: 8, braille: 8, leet: 7,
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
  if (a.result === b.result) {
    const tie = transposeTieBreak(a, b);
    if (tie !== 0) return tie < 0 ? a : b;
  }
  if (a.result === b.result && /[\u4e00-\u9fff]/.test(a.result || '')) {
    const userRot = new Set(['rot13', 'rot-all', 'rot18', 'gf-caesar3']);
    const cpFamily = new Set(['unicode-cp-caesar', 'caesar', 'affine', 'unicode-cp-affine']);
    const aff = new Set(['affine', 'unicode-cp-affine']);
    if (a.id === 'rot13' && (b.id === 'unicode-cp-caesar' || aff.has(b.id))) return a;
    if (b.id === 'rot13' && (a.id === 'unicode-cp-caesar' || aff.has(a.id))) return b;
    if (userRot.has(a.id) && cpFamily.has(b.id)) {
      return (b.score ?? 0) >= (a.score ?? 0) ? b : a;
    }
    if (userRot.has(b.id) && cpFamily.has(a.id)) {
      return (a.score ?? 0) >= (b.score ?? 0) ? a : b;
    }
    const trans = new Set(['scytale', 'rail-fence', 'columnar', 'even-odd-split']);
    if (trans.has(a.id) && !trans.has(b.id)) return a;
    if (trans.has(b.id) && !trans.has(a.id)) return b;
  }
  if (a.verified && b.verified && a.result === b.result) {
    const trans = new Set(['scytale', 'rail-fence', 'columnar', 'even-odd-split']);
    if (trans.has(a.id) && !trans.has(b.id)) return a;
    if (trans.has(b.id) && !trans.has(a.id)) return b;
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
