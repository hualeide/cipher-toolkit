/**
 * 中文字频语料 — 从 classic / slang / example 语料构建，启动时计算
 */
import { readFileSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { CLASSIC_ZH } from './classicCorpus.js';
import { CORPUS_ZH } from './exampleCorpus.js';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const SMOOTH = 0.5;

/** 现代口语 / 常见短句 — 补足名著语料，提升换位与 reverse 判定 */
const MODERN_ZH = [
  '康神开播了', '今天天气真不错', '程序员正在写代码', '我爱你中国',
  '密钥测试一二三', '摩斯电报中文', '仿射密码真有趣',
  'Hello，世界！2024', 'Hello', '世界', '2024',
];

export function isModernCorpusPlaintext(text) {
  const t = String(text || '').trim();
  return MODERN_ZH.includes(t);
}

function isRareCjkChar(ch) {
  const cp = ch.codePointAt(0);
  if (cp >= 0x4de0 && cp <= 0x4dff) return true;
  if (cp >= 0x3400 && cp <= 0x4dbf) return true;
  if (cp >= 0xf900 && cp <= 0xfaff) return true;
  if (cp > 0x9fff && cp <= 0xffff) return true;
  return false;
}

function loadSlangLines() {
  const file = path.join(__dir, 'slangCorpus.zh.txt');
  if (!existsSync(file)) return [];
  return readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*#.*$/, '').trim())
    .filter(Boolean);
}

function cjkOnly(text) {
  return [...text].filter((c) => /[\u4e00-\u9fff]/.test(c));
}

function buildStats() {
  const charFreq = new Map();
  const bigramFreq = new Map();
  const trigramFreq = new Map();
  let totalChars = 0;
  let totalBigrams = 0;
  let totalTrigrams = 0;

  const ingest = (text) => {
    const chars = cjkOnly(text);
    if (!chars.length) return;
    for (const c of chars) {
      charFreq.set(c, (charFreq.get(c) || 0) + 1);
      totalChars++;
    }
    for (let i = 0; i < chars.length - 1; i++) {
      const bg = chars[i] + chars[i + 1];
      bigramFreq.set(bg, (bigramFreq.get(bg) || 0) + 1);
      totalBigrams++;
    }
    for (let i = 0; i < chars.length - 2; i++) {
      const tg = chars[i] + chars[i + 1] + chars[i + 2];
      trigramFreq.set(tg, (trigramFreq.get(tg) || 0) + 1);
      totalTrigrams++;
    }
  };

  for (const line of [...CLASSIC_ZH, ...CORPUS_ZH, ...loadSlangLines()]) ingest(line);
  for (const line of MODERN_ZH) {
    ingest(line);
    ingest(line);
  }

  return {
    charFreq,
    bigramFreq,
    trigramFreq,
    totalChars,
    totalBigrams,
    totalTrigrams,
    charVocab: charFreq.size || 1,
    bigramVocab: bigramFreq.size || 1,
    trigramVocab: trigramFreq.size || 1,
  };
}

const STATS = buildStats();

function logProb(count, total, vocabSize) {
  return Math.log((count + SMOOTH) / (total + SMOOTH * vocabSize));
}

/** 2-gram 对数概率均值（原始分，未映射 0–100） */
export function scoreZhBigrams(text) {
  const chars = cjkOnly(text);
  if (chars.length < 2) return 0;
  let sum = 0;
  for (let i = 0; i < chars.length - 1; i++) {
    const bg = chars[i] + chars[i + 1];
    sum += logProb(STATS.bigramFreq.get(bg) || 0, STATS.totalBigrams, STATS.bigramVocab);
  }
  return sum / (chars.length - 1);
}

function scoreZhTrigrams(text) {
  const chars = cjkOnly(text);
  if (chars.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < chars.length - 2; i++) {
    const tg = chars[i] + chars[i + 1] + chars[i + 2];
    sum += logProb(STATS.trigramFreq.get(tg) || 0, STATS.totalTrigrams, STATS.trigramVocab);
  }
  return sum / (chars.length - 2);
}

/** 中文自然度 0–100：字频 log + 2/3-gram 加成 + 生僻字惩罚 */
export function scoreZhNaturalness(text) {
  const chars = cjkOnly(text);
  if (!chars.length) return 0;

  let charSum = 0;
  let rarePenalty = 0;
  for (const c of chars) {
    charSum += logProb(STATS.charFreq.get(c) || 0, STATS.totalChars, STATS.charVocab);
    if (isRareCjkChar(c)) rarePenalty += 2.2;
  }
  const charScore = charSum / chars.length - rarePenalty / chars.length;
  const bgScore = scoreZhBigrams(text);
  const tgScore = scoreZhTrigrams(text);

  const commonHits = chars.filter((c) => (STATS.charFreq.get(c) || 0) >= 2).length / chars.length;
  const commonBonus = commonHits * 22;

  const combined = charScore * 0.52 + bgScore * 0.28 + tgScore * 0.2;
  return Math.max(0, Math.min(100, Math.round((combined + 7.5) * 11.5 + commonBonus)));
}

const PHRASE_REF = [
  ...MODERN_ZH,
  '我爱你', '中国', '你好', '世界', '今天', '天气', '程序员', '代码',
];

function sortedCjkSig(text) {
  return cjkOnly(text).sort().join('');
}

/** 与已知短句同字 multiset 但语序打乱 — 非明文 */
export function isShuffledCjkPlaintext(text) {
  const t = String(text || '').trim();
  const core = t.replace(/X/g, '');
  if (!core || ![...core].every((c) => /[\u4e00-\u9fff]/.test(c))) return false;
  if (PHRASE_REF.includes(core) || PHRASE_REF.includes(t)) return false;
  const sig = sortedCjkSig(core);
  for (const ref of PHRASE_REF) {
    if ([...ref].length !== [...core].length) continue;
    if (sortedCjkSig(ref) === sig && ref !== core) {
      return scoreZhNaturalness(core) < scoreZhNaturalness(ref) - 2;
    }
  }
  return false;
}
