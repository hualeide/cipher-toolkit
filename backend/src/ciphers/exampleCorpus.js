/**
 * 多语言算法示例明文库：诗词、名著、名言
 * 按 cipherId + 日种子哈希轮选；句库见 exampleCorpus.zh.txt
 */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

function hashId(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const __dir = path.dirname(fileURLToPath(import.meta.url));
export const MAX_SENTENCE_LEN = 48;

/** 文件缺失时的兜底句 */
const FALLBACK_ZH = [
  '人生若只如初见，何事秋风悲画扇。',
  '落红不是无情物，化作春泥更护花。',
  '海内存知己，天涯若比邻。',
  '会当凌绝顶，一览众山小。',
  '天生我材必有用，千金散尽还复来。',
];

function loadCorpusFile() {
  try {
    const file = path.join(__dir, 'exampleCorpus.zh.txt');
    const raw = readFileSync(file, 'utf8');
    return raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  } catch {
    return [];
  }
}

function isCleanExampleSentence(s) {
  if (s.length < 8 || s.length > MAX_SENTENCE_LEN) return false;
  if (!/[\u4e00-\u9fff]/.test(s)) return false;
  if (!/[。！？；]$/.test(s)) return false;
  if (/（\d+）$/.test(s)) return false;
  if (/^(有人说|古人云|记得|那年|后来才明白)/.test(s)) return false;
  if (/——这话说得真好|让人久久难忘|至今读来仍觉心动/.test(s)) return false;
  if (/。[，,]/.test(s)) return false;
  return true;
}

function dedupe(list) {
  const seen = new Set();
  const out = [];
  for (const line of list) {
    const s = line.trim();
    if (!s || seen.has(s)) continue;
    if (!isCleanExampleSentence(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

const CORPUS_ZH = dedupe([...loadCorpusFile(), ...FALLBACK_ZH]);

/** 每日轮换种子，同一天内各算法示例稳定 */
export function rotationSeed() {
  return Math.floor(Date.now() / 86_400_000);
}

export function pickCorpusPlaintext(cipherId, seed = rotationSeed()) {
  if (!CORPUS_ZH.length) return FALLBACK_ZH[0];
  const idx = hashId(`${cipherId}:${seed}`) % CORPUS_ZH.length;
  return CORPUS_ZH[idx];
}

export function corpusSize() {
  return CORPUS_ZH.length;
}

let fragmentSet = null;
let fragmentsByLen = null;

function cleanCorpusLine(line) {
  return line.replace(/[。！？；，、：""''（）\s]/g, '');
}

function buildFragmentsByLen() {
  if (fragmentsByLen) return fragmentsByLen;
  fragmentsByLen = new Map();
  for (const line of CORPUS_ZH) {
    const clean = cleanCorpusLine(line);
    for (let len = 2; len <= 10; len++) {
      for (let i = 0; i + len <= clean.length; i++) {
        const frag = clean.slice(i, i + len);
        if (!/^[\u4e00-\u9fff]+$/.test(frag)) continue;
        if (!fragmentsByLen.has(len)) fragmentsByLen.set(len, new Set());
        fragmentsByLen.get(len).add(frag);
      }
    }
  }
  return fragmentsByLen;
}

function buildFragments() {
  if (fragmentSet) return fragmentSet;
  fragmentSet = new Set();
  for (const [, set] of buildFragmentsByLen()) {
    for (const frag of set) fragmentSet.add(frag);
  }
  return fragmentSet;
}

/** 按字数从名言库自动抽词（识别候选，无需手填） */
export function corpusFragmentsForLength(len, max = 800) {
  const set = buildFragmentsByLen().get(len);
  if (!set) return [];
  return [...set].slice(0, max);
}

/** 与句库片段重合度（用于识别评分） */
export function scoreCorpusMatch(text) {
  if (!text || !/[\u4e00-\u9fff]/.test(text)) return 0;
  const frags = buildFragments();
  let hits = 0;
  for (let len = 4; len <= 8; len++) {
    for (let i = 0; i + len <= text.length; i++) {
      if (frags.has(text.slice(i, i + len))) hits++;
    }
  }
  return Math.min(hits * 2, 35);
}

const CORPUS_SET = new Set(CORPUS_ZH);

/** 旧占位 / 混排示例，不得出现在多语言算法 API 示例中 */
export function isExamplePlaceholder(plain) {
  if (!plain) return true;
  if (['你好', '测试', '你好世界', '中文'].includes(plain)) return true;
  if (/\b(HELLO|ATTACK|Hello|Hello123)\b/i.test(plain)) return true;
  if (plain.includes(' / ') || /\b中文\b/.test(plain)) return true;
  if (/（[^）]*）/.test(plain) && plain.length < 24) return true;
  return false;
}

/** 明文必须来自句库（名言/诗词） */
export function isCorpusPlaintext(plain) {
  return CORPUS_SET.has(plain);
}

export { CORPUS_ZH };
