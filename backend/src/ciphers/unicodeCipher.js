/**
 * Unicode 码点密码：多语言字符 → 码点数字域加密 → 再映射为字符输出
 * 支持中文（简繁）、拉丁、标点等 BMP 字符
 */
import { scoreCorpusMatch, CORPUS_ZH, corpusFragmentsForLength, isCorpusPlaintext } from './exampleCorpus.js';
import { scoreBibleMatch, bibleFragmentsForLength, isBiblePlaintext } from './bibleCorpus.js';
import { scoreClassicMatch, classicFragmentsForLength, isClassicPlaintext } from './classicCorpus.js';
import { isKnownChinesePhrase, slangCandidatesForLength } from './slangCorpus.js';
import { scoreZhNaturalness, isShuffledCjkPlaintext, isModernCorpusPlaintext } from './zhFreqCorpus.js';

export const CP_MIN = 32;
export const CP_MAX = 0xd7af;
export const CP_SPAN = CP_MAX - CP_MIN + 1;

const SURROGATE_LO = 0xd800;
const SURROGATE_HI = 0xdfff;

/** CJK / 假名 / 韩文 / 全角 — 与 engine.caesar 扩展一致 */
export function isMultilingualLetter(cp) {
  return (cp >= 0x4e00 && cp <= 0x9fff)
    || (cp >= 0x3400 && cp <= 0x4dbf)
    || (cp >= 0x3040 && cp <= 0x30ff)
    || (cp >= 0xac00 && cp <= 0xd7af)
    || (cp >= 0xff00 && cp <= 0xffef);
}

export function isEncodableCodePoint(cp) {
  return cp >= CP_MIN && cp <= CP_MAX && !(cp >= SURROGATE_LO && cp <= SURROGATE_HI);
}

/** 在码点域做循环移位（凯撒） */
export function shiftCodePoint(cp, delta) {
  if (!isEncodableCodePoint(cp)) return cp;
  let n = cp - CP_MIN;
  n = ((n + delta) % CP_SPAN + CP_SPAN) % CP_SPAN;
  return n + CP_MIN;
}

export function toCodePoints(text) {
  return [...text].map((ch) => ch.codePointAt(0));
}

/** 码点十进制展示（编码层） */
export function unicodeCpDecimalEncode(text) {
  return toCodePoints(text).join(' ');
}

export function unicodeCpDecimalDecode(text) {
  return text.trim().split(/\s+/).map((n) => String.fromCodePoint(Number(n))).join('');
}

/** 码点凯撒 — 对所有可编码字符移位 */
export function unicodeCpCaesar(text, shift, decrypt = false) {
  let delta = decrypt ? -Number(shift || 0) : Number(shift || 0);
  if (!Number.isFinite(delta) || delta === 0) delta = decrypt ? -88 : 88;
  return [...text].map((ch) => {
    const cp = ch.codePointAt(0);
    if (cp > 0xffff || !isEncodableCodePoint(cp)) return ch;
    return String.fromCodePoint(shiftCodePoint(cp, delta));
  }).join('');
}

/** 码点维吉尼亚 — 密钥字符码点驱动移位（拉丁 + 多语言统一密钥流） */
export function unicodeCpVigenere(text, key, decrypt = false) {
  const k = [...(key || '密钥')].filter(Boolean);
  if (!k.length) return text;
  let ki = 0;
  const dir = decrypt ? -1 : 1;
  return [...text].map((ch) => {
    const cp = ch.codePointAt(0);
    if (/[a-zA-Z]/.test(ch)) {
      const keyChar = k[ki++ % k.length];
      const upper = ch <= 'Z';
      const p = ch.toUpperCase().charCodeAt(0) - 65;
      const kv = /[a-zA-Z]/.test(keyChar) ? keyChar.toUpperCase().charCodeAt(0) - 65 : ((keyChar.codePointAt(0) % 997) + 1) % 26;
      const c = String.fromCharCode(((p + kv * dir + 2600) % 26) + 65);
      return upper ? c : c.toLowerCase();
    }
    if (cp > 0xffff || !isEncodableCodePoint(cp) || cp === 32) return ch;
    const keyChar = k[ki++ % k.length];
    const mag = (keyChar.codePointAt(0) % 997) + 1;
    const delta = decrypt ? mag : -mag;
    return String.fromCodePoint(shiftCodePoint(cp, delta));
  }).join('');
}

/** 码点仿射 (a·x+b) mod SPAN — 增强版 */
export function unicodeCpAffine(text, a, b, decrypt = false) {
  const mul = Number(a) || 5;
  let add = Number(b) || 7;
  if (decrypt) {
    const inv = modInverse(mul, CP_SPAN);
    if (inv < 0) return text;
    return [...text].map((ch) => {
      const cp = ch.codePointAt(0);
      if (cp > 0xffff || !isEncodableCodePoint(cp)) return ch;
      const x = cp - CP_MIN;
      const y = ((inv * (x - add + CP_SPAN)) % CP_SPAN + CP_SPAN) % CP_SPAN;
      return String.fromCodePoint(y + CP_MIN);
    }).join('');
  }
  return [...text].map((ch) => {
    const cp = ch.codePointAt(0);
    if (cp > 0xffff || !isEncodableCodePoint(cp)) return ch;
    const x = cp - CP_MIN;
    const y = (mul * x + add) % CP_SPAN;
    return String.fromCodePoint(y + CP_MIN);
  }).join('');
}

function modInverse(a, m) {
  let [t, newT] = [0, 1];
  let [r, newR] = [m, a % m];
  while (newR !== 0) {
    const q = Math.floor(r / newR);
    [t, newT] = [newT, t - q * newT];
    [r, newR] = [newR, r - q * newR];
  }
  if (r > 1) return -1;
  return t < 0 ? t + m : t;
}

/** 全角拉丁/数字（非码点凯撒乱码） */
function isFullwidthLatinLike(text) {
  const chars = [...text.trim()].filter((c) => c.trim() || c === ' ');
  if (!chars.length) return false;
  const fw = chars.filter((c) => {
    const cp = c.codePointAt(0);
    return (cp >= 0xff01 && cp <= 0xff5e) || (cp >= 0xff10 && cp <= 0xff19) || cp === 0x3000;
  });
  return fw.length / chars.length >= 0.55;
}

/** 是否像「多语言码点密文」（高 CJK/假名/韩文占比但不像正常语句） */
export function looksLikeUnicodeCipherText(text) {
  const chars = [...text.trim()];
  if (chars.length < 2) return false;
  if (isShuffledCjkPlaintext(text)) return true;
  if (/X/.test(text) && /[\u4e00-\u9fff]/.test(text) && !isKnownChinesePhrase(text.replace(/X/g, ''))) {
    const core = text.replace(/X/g, '');
    if (scorePlaintextMultilingual(core) >= 40 && scoreZhNaturalness(core) < scorePlaintextMultilingual(text) * 0.55) return true;
  }
  if (isKnownChinesePhrase(text)) return false;
  if (isFullwidthLatinLike(text)) return false;
  const eastAsian = chars.filter((c) => /[\u4e00-\u9fff\u3400-\u4dbf\u3040-\u30ff\uac00-\ud7af\uff00-\uffef]/.test(c)).length;
  if (eastAsian / chars.length < 0.55) return false;
  return scorePlaintextMultilingual(text) < 55;
}

export { isKnownChinesePhrase };

const CN_WORDS = [
  '你好', '世界', '你好世界', '中国', '中文', '日本', '韩国', '谢谢', '密码', '加密', '解密', '测试', '測試',
  '我爱你', '爱你', '想你', '喜欢', '亲爱', '秘密', '我们', '他们', '可以', '什么', '没有', '这个', '那个', '今天', '明天', '学习',
  '繁体', '繁體', '简体', '簡體', '台湾', '臺灣', '香港', '工具',
  '代码', '程序', '软件', '开发', '容易', '轻而易举', '问题', '回答', '知道', '觉得', '怎么', '为什么',
  '工具', '密码学', '明文', '密文', '消息', '信息', '工作', '生活', '时间', '朋友',
  '开播', '康神', '程序员', '写代码', '天气',
  '几把', '卧槽', '牛逼', '特么', '扯淡', '楼主', '贴吧', '破防', '躺平', '内卷', '摆烂', '离谱', '绝了', '无语', '服了',
  '吃瓜', '打卡', '真香', '打脸', '上头', '下头', '裂开', '麻了', '醉了', '笑死', '气死', '爱了', '刀了', '发糖',
  '男主', '女主', '穿越', '系统', '金手指', '开挂', '无敌', '秒杀', '碾压', '稳了', '凉了', '炸了',
];

const CN_COMMON_CHARS = '的一是不了人我在有他这为之大来以个中上们到说国和地也子时道出而要于就下得可你年生自会那后能对着事其里所去行过家十用发天如然作方成者多日都三小么经文体测试验語语國广東與為說時會對代码轻而举易啊吗呢吧了嘛把被给让几卧牛槽特么扯楼贴破躺卷摆谱绝无语服瓜打卡香脸头裂麻醉笑气爱刀糖主穿越统挂敌杀碾稳凉炸';

/** 含常用汉字（口语/语料表） */
export function hasCommonChineseChars(text, min = 1) {
  return [...(text || '')].filter((c) => CN_COMMON_CHARS.includes(c)).length >= min;
}

/** 非日常用字（卦象、扩展区等）—— 解密结果含此类则降权 */
export function isRareCjkChar(ch) {
  const cp = ch.codePointAt(0);
  if (cp >= 0x4de0 && cp <= 0x4dff) return true;
  if (cp >= 0x3400 && cp <= 0x4dbf) return true;
  if (cp >= 0xf900 && cp <= 0xfaff) return true;
  if (cp > 0x9fff && cp <= 0xffff) return true;
  return false;
}

function scoreChineseReadability(text) {
  const cjk = [...text].filter((c) => /[\u4e00-\u9fff]/.test(c));
  if (!cjk.length) return 0;
  let s = 0;
  for (const c of cjk) {
    if (CN_COMMON_CHARS.includes(c)) s += 4;
    else if (isRareCjkChar(c)) s -= 12;
    else s += 1;
  }
  return s;
}

/** 常用字占比（0–1），短密文无词库命中时兜底 */
function chineseCommonCharRatio(text) {
  const cjk = [...text].filter((c) => /[\u4e00-\u9fff]/.test(c));
  if (!cjk.length) return 0;
  const common = cjk.filter((c) => CN_COMMON_CHARS.includes(c)).length;
  return common / cjk.length;
}

/** 多语言明文评分（中/日/韩/英） */
export function scorePlaintextMultilingual(text) {
  if (!text || text.length < 1) return 0;
  let score = 0;

  for (const w of CN_WORDS) {
    if (text === w) score += 50;
    else if (text.includes(w)) score += 18;
  }
  if (isKnownChinesePhrase(text)) score = Math.max(score, text.length <= 4 ? 58 : 52);
  if (isBiblePlaintext(text)) score = Math.max(score, 62);
  if (isClassicPlaintext(text)) score = Math.max(score, 60);

  const cjk = [...text].filter((c) => /[\u4e00-\u9fff]/.test(c)).length;
  if (cjk > 0) {
    const common = [...text].filter((c) => CN_COMMON_CHARS.includes(c)).length;
    score += Math.min((common / cjk) * 40, 35);
    score += Math.min(scoreChineseReadability(text), 45);
    score += scoreCorpusMatch(text);
    score += scoreBibleMatch(text);
    score += scoreClassicMatch(text);
  }

  const jp = [...text].filter((c) => /[\u3040-\u30ff]/.test(c)).length;
  if (jp / text.length > 0.4) score += 20;

  const kr = [...text].filter((c) => /[\uac00-\ud7af]/.test(c)).length;
  if (kr / text.length > 0.4) score += 20;

  const cyr = [...text].filter((c) => /[\u0400-\u04FF]/.test(c)).length;
  if (cyr / text.length > 0.5) score += Math.min(50, cyr * 10);

  if (/^[a-zA-Z\s.,!?]+$/.test(text) && text.length >= 3) score += 15;

  const latinWords = text.toLowerCase().match(/[a-z]{3,}/g) || [];
  if (latinWords.length >= 1) score += Math.min(latinWords.length * 8, 24);

  if (/^[\u4e00-\u9fff，。！？、；：""''（）\s]+$/.test(text) && text.length <= 8) {
    if (CN_WORDS.some((w) => text.includes(w))) score += 25;
  }

  const allCjk = [...text].every((c) => /[\u4e00-\u9fff]/.test(c));
  const len = [...text].length;
  if (allCjk && len >= 2 && len <= 10) {
    const ratio = chineseCommonCharRatio(text);
    if (![...text].some((c) => isRareCjkChar(c))) {
      score = Math.max(score, ratio >= 0.35 ? 28 + Math.round(ratio * 18) : 26);
    }
  }

  if (cjk > 0 && cjk / [...text].length >= 0.35) {
    const zhNat = scoreZhNaturalness(text);
    const blended = Math.round(score * 0.55 + zhNat * 0.45);
    score = Math.max(score, blended);
  }

  return Math.max(0, Math.min(Math.round(score), 100));
}

const PREFERRED_SHIFTS = [13, 3, 25, 5, 8, 88];

/** 快速识别：候选明文反推 + 暴力移位（口语/名言优先，避免小移位误杀） */
export function bruteUnicodeCpCaesar(text, maxShift = 200) {
  const len = [...text.trim()].length;
  if (len >= 2 && len <= 10) {
    const guided = tryUnicodeCpCaesarFromCandidates(text, plainCandidatesForLength(len));
    if (guided && guided.score >= 40) return guided;
  }

  let best = null;
  const tryShift = (shift) => {
    const result = unicodeCpCaesar(text, shift, true);
    if (result === text) return;
    if (unicodeCpCaesar(result, shift, false) !== text) return;
    let score = scorePlaintextMultilingual(result);
    if (isKnownChinesePhrase(result)) score += 18;
    const allCjk = [...result].every((c) => /[\u4e00-\u9fff]/.test(c));
    const rlen = [...result].length;
    const ratio = chineseCommonCharRatio(result);
    if (allCjk && ratio >= 0.85) score += 22;
    else if (allCjk && ratio >= 0.6) score += 12;
    if (allCjk && rlen >= 2 && rlen <= 10) score += 22;
    if (allCjk && rlen <= 10 && ![...result].some((c) => isRareCjkChar(c))) score = Math.max(score, 38);
    if ([...result].some((c) => isRareCjkChar(c))) score -= 18;
    const hangul = [...result].filter((c) => /[\uac00-\ud7af]/.test(c)).length;
    const cjk = [...result].filter((c) => /[\u4e00-\u9fff]/.test(c)).length;
    if (hangul > cjk && hangul / Math.max(result.length, 1) > 0.2) score -= 40;
    if (isBiblePlaintext(result)) score += 28;
    if (isModernCorpusPlaintext(result)) score += 35;
    if (PREFERRED_SHIFTS.includes(shift)) score += 5;
    const candidate = { shift, result, score, ratio };
    const bestRatio = best ? chineseCommonCharRatio(best.result) : 0;
    if (!best || score > best.score
      || (score === best.score && ratio > bestRatio)
      || (score === best.score && ratio === bestRatio && PREFERRED_SHIFTS.indexOf(shift) >= 0 && PREFERRED_SHIFTS.indexOf(best.shift) < 0)
      || (score === best.score && shift === 3 && best.shift === 88)) {
      best = candidate;
    }
  };

  for (const shift of PREFERRED_SHIFTS) tryShift(shift);
  for (let shift = 1; shift <= maxShift; shift++) {
    if (PREFERRED_SHIFTS.includes(shift)) continue;
    tryShift(shift);
  }
  if (best && best.score < 28) return null;
  return best;
}

const AFFINE_PARAM_SETS = [
  { a: 5, b: 7 }, { a: 5, b: 8 }, { a: 7, b: 3 }, { a: 11, b: 17 }, { a: 13, b: 9 },
];

const AFFINE_A = [1, 3, 5, 7, 9, 11, 15, 17, 19, 21, 23, 25];

/** 码点仿射快检 — 穷举 a×b（中文仿射密文识别） */
export function bruteUnicodeCpAffine(text) {
  let best = null;
  const tryPair = (a, b) => {
    const result = unicodeCpAffine(text, a, b, true);
    if (result === text) return;
    if (unicodeCpAffine(result, a, b, false) !== text) return;
    let score = scorePlaintextMultilingual(result);
    if (isKnownChinesePhrase(result)) score += 18;
    if (isBiblePlaintext(result)) score += 32;
    if (isClassicPlaintext(result)) score += 28;
    if (isCorpusPlaintext(result)) score += 24;
    const allCjk = [...result].every((c) => /[\u4e00-\u9fff]/.test(c));
    const ratio = chineseCommonCharRatio(result);
    const len = [...result].length;
    if (allCjk && ratio >= 0.85) score += 22;
    else if (allCjk && ratio >= 0.6) score += 15;
    else if (allCjk && len >= 2 && len <= 10) score += 22;
    if (allCjk && len <= 10 && ![...result].some((c) => isRareCjkChar(c))) score = Math.max(score, 38);
    if (allCjk && len <= 10 && !hasCommonChineseChars(result, 1)
      && !isKnownChinesePhrase(result) && !isCorpusPlaintext(result)) score -= 30;
    if ([...result].some((c) => isRareCjkChar(c))) score -= 15;
    const candidate = { a, b, result, score };
    if (!best || score > best.score
      || (score === best.score && a === 5 && (b === 8 || b === 7))) {
      best = candidate;
    }
  };

  for (const { a, b } of AFFINE_PARAM_SETS) tryPair(a, b);
  for (const a of AFFINE_A) {
    for (let b = 0; b < 26; b++) tryPair(a, b);
  }
  if (best && best.score < 45 && !isKnownChinesePhrase(best.result) && !isCorpusPlaintext(best.result)) return null;
  if (best && !hasCommonChineseChars(best.result, 1) && !isKnownChinesePhrase(best.result) && !isCorpusPlaintext(best.result)) return null;
  return best;
}

function vigenereCandidateScore(text, key, result) {
  if (unicodeCpVigenere(result, key, false) !== text) return 0;
  let score = scorePlaintextMultilingual(result);
  if (key.length <= 6 && /^[\u4e00-\u9fffA-Za-z0-9]+$/.test(key)) score += 6;
  return score;
}

function plainCandidatesForLength(len, maxExtra = 800) {
  const seen = new Set();
  const out = [];
  const add = (w) => {
    if (!w || seen.has(w) || [...w].length !== len) return;
    seen.add(w);
    out.push(w);
  };
  for (const w of CN_WORDS) add(w);
  for (const w of slangCandidatesForLength(len, maxExtra)) add(w);
  for (const w of corpusFragmentsForLength(len, maxExtra)) add(w);
  for (const w of bibleFragmentsForLength(len, maxExtra)) add(w);
  for (const w of classicFragmentsForLength(len, maxExtra)) add(w);
  for (const line of CORPUS_ZH) add(line);
  return out.slice(0, maxExtra);
}

function requiredCaesarDecryptShift(cipherCp, plainCp) {
  for (let shift = 1; shift <= CP_SPAN; shift++) {
    if (shiftCodePoint(cipherCp, shift) === plainCp) return shift;
  }
  return null;
}

/** 短密文：用口语/名言候选反推码点凯撒移位 */
export function tryUnicodeCpCaesarFromCandidates(text, plainCandidates) {
  const cipherChars = [...text.trim()];
  const len = cipherChars.length;
  if (len < 2 || len > 10) return null;

  let best = null;
  for (const plain of plainCandidates) {
    if ([...plain].length !== len) continue;
    const plainChars = [...plain];
    let shift = null;
    let ok = true;
    for (let i = 0; i < len; i++) {
      const s = requiredCaesarDecryptShift(cipherChars[i].codePointAt(0), plainChars[i].codePointAt(0));
      if (s == null) { ok = false; break; }
      if (shift === null) shift = s;
      else if (shift !== s) { ok = false; break; }
    }
    if (!ok || !shift) continue;
    const result = unicodeCpCaesar(text, shift, true);
    if (result !== plain) continue;
    if (unicodeCpCaesar(result, shift, false) !== text) continue;
    let score = scorePlaintextMultilingual(result);
    if (isKnownChinesePhrase(result)) score += 20;
    if (shift === 88) score += 6;
    if (!best || score > best.score || (score === best.score && shift === 88)) {
      best = { shift, result, score };
    }
  }
  return best;
}

/** 快速识别：常见密钥维吉尼亚 */
export function tryUnicodeCpVigenere(text, keys) {
  let best = null;
  for (const key of keys) {
    const result = unicodeCpVigenere(text, key, true);
    if (result === text) continue;
    const score = vigenereCandidateScore(text, key, result);
    if (score >= 40 && (!best || score > best.score)) {
      best = { key, result, score };
    }
  }
  return best;
}

function findKeyCharForMag(mag) {
  for (let cp = CP_MIN; cp <= CP_MAX; cp++) {
    if (!isEncodableCodePoint(cp)) continue;
    if (((cp % 997) + 1) === mag) return String.fromCodePoint(cp);
  }
  return null;
}

function requiredDecryptMag(cipherCp, plainCp) {
  for (let mag = 1; mag <= 998; mag++) {
    if (shiftCodePoint(cipherCp, mag) === plainCp) return mag;
  }
  return null;
}

/** 用候选明文反推维吉尼亚密钥（短密文） */
export function tryUnicodeCpVigenereFromCandidates(text, plainCandidates) {
  const cipherChars = [...text.trim()];
  const len = cipherChars.length;
  if (len < 2 || len > 10) return null;

  let best = null;
  for (const plain of plainCandidates) {
    if ([...plain].length !== len) continue;
    const plainChars = [...plain];
    const keyChars = [];
    let ok = true;
    for (let i = 0; i < len; i++) {
      const mag = requiredDecryptMag(cipherChars[i].codePointAt(0), plainChars[i].codePointAt(0));
      if (!mag) { ok = false; break; }
      const kc = findKeyCharForMag(mag);
      if (!kc) { ok = false; break; }
      keyChars.push(kc);
    }
    if (!ok) continue;
    const key = keyChars.join('');
    const result = unicodeCpVigenere(text, key, true);
    if (result !== plain) continue;
    const score = vigenereCandidateScore(text, key, result);
    if (!best || score > best.score) best = { key, result, score };
  }
  return best;
}

/** 短密文暴力：ASCII 密钥（长度 = 密文字符数，最多 6 字） */
export function bruteUnicodeCpVigenereShort(text) {
  const len = [...text.trim()].length;
  if (len < 2 || len > 6) return null;

  const guided = tryUnicodeCpVigenereFromCandidates(text, plainCandidatesForLength(len));
  if (guided) return guided;
  if (len > 2) return null;

  let best = null;
  const tryKey = (key) => {
    const result = unicodeCpVigenere(text, key, true);
    if (result === text) return;
    const score = vigenereCandidateScore(text, key, result);
    if (score >= 40 && (!best || score > best.score)) {
      best = { key, result, score };
    }
  };

  const build = (prefix, depth) => {
    if (depth === len) {
      tryKey(prefix);
      return;
    }
    for (let cp = 32; cp <= 126; cp++) build(prefix + String.fromCharCode(cp), depth + 1);
  };
  build('', 0);
  return best;
}

export function describeScriptMix(text) {
  const chars = [...text];
  const n = chars.length || 1;
  const zh = chars.filter((c) => /[\u4e00-\u9fff]/.test(c)).length / n;
  const jp = chars.filter((c) => /[\u3040-\u30ff]/.test(c)).length / n;
  const kr = chars.filter((c) => /[\uac00-\ud7af]/.test(c)).length / n;
  const latin = chars.filter((c) => /[A-Za-z]/.test(c)).length / n;
  const parts = [];
  if (zh > 0.2) parts.push(`中文 ${Math.round(zh * 100)}%`);
  if (jp > 0.2) parts.push(`日文 ${Math.round(jp * 100)}%`);
  if (kr > 0.2) parts.push(`韩文 ${Math.round(kr * 100)}%`);
  if (latin > 0.2) parts.push(`拉丁 ${Math.round(latin * 100)}%`);
  return parts.join(' · ') || '混合字符';
}
