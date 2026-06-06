/**
 * 中文短句识别词库 — 自动从名言库抽片段 + 少量内置口语，无需手填
 * slangCorpus.zh.txt 仅作可选补充（可留空或删掉）
 */
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { corpusFragmentsForLength } from './exampleCorpus.js';
import { bibleFragmentsForLength } from './bibleCorpus.js';

const __dir = path.dirname(fileURLToPath(import.meta.url));

/** 名言库里少见的网络口语，保留极小硬编码集 */
const CORE_SLANG = [
  '几把', '卧槽', '牛逼', '特么', '扯淡', '破防', '躺平', '内卷', '摆烂', '离谱', '绝了', '无语', '服了',
  '吃瓜', '打卡', '真香', '打脸', '上头', '下头', '裂开', '麻了', '醉了', '笑死', '气死', '爱了', '刀了',
  '楼主', '贴吧', '社死', '尬聊', '蚌埠住了', '芭比Q', '栓Q', 'yyds', '绝绝子', '破大防', '我裂开了',
  '就这', '啊这', '好家伙', '离大谱', '笑死我了', '气死我了', '爱了爱了', '磕到了', '好甜', '好虐',
  '男主', '女主', '穿越', '系统', '金手指', '开挂', '无敌', '秒杀', '碾压', '稳了', '凉了', '炸了',
  '别骂了', '别打了', '真的假的', '不会吧', '不至于', '好家伙', '懂哥', '菜鸡', '冲冲冲', '干就完了',
];

function loadUserFile() {
  try {
    const file = path.join(__dir, 'slangCorpus.zh.txt');
    const raw = readFileSync(file, 'utf8');
    return raw.split(/\r?\n/)
      .map((l) => l.replace(/^\s*#.*$/, '').trim())
      .filter((l) => l && !l.startsWith('#'));
  } catch {
    return [];
  }
}

function buildPhraseSet() {
  const set = new Set(CORE_SLANG);
  for (const len of [2, 3, 4, 5, 6, 7, 8, 9, 10]) {
    for (const frag of corpusFragmentsForLength(len, 5000)) set.add(frag);
    for (const frag of bibleFragmentsForLength(len, 3000)) set.add(frag);
  }
  for (const w of loadUserFile()) set.add(w);
  return set;
}

const SLANG_SET = buildPhraseSet();

const byLenCache = new Map();

function phrasesForLength(len) {
  if (byLenCache.has(len)) return byLenCache.get(len);
  const out = [];
  for (const w of SLANG_SET) {
    if ([...w].length === len) out.push(w);
  }
  byLenCache.set(len, out);
  return out;
}

export function slangSize() {
  return SLANG_SET.size;
}

export function isKnownChinesePhrase(text) {
  if (!text) return false;
  const t = text.trim();
  if (SLANG_SET.has(t)) return true;
  if (t.length <= 12) {
    for (const w of phrasesForLength(2)) {
      if (t.includes(w)) return true;
    }
    for (const w of phrasesForLength(3)) {
      if (t.includes(w)) return true;
    }
  }
  return false;
}

export function slangCandidatesForLength(len, max = 800) {
  return phrasesForLength(len).slice(0, max);
}

export { SLANG_SET };
