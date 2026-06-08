/**
 * 和合本全文语料 — 识别评分与候选反推
 * 源文件: bibleCorpus.zh.txt（由 scripts/parse-bible-zh.mjs 生成）
 */
import { readFileSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const CORPUS_FILE = path.join(__dir, 'bibleCorpus.zh.txt');

function loadVerses() {
  if (!existsSync(CORPUS_FILE)) return [];
  const raw = readFileSync(CORPUS_FILE, 'utf8');
  return raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
}

const BIBLE_ZH = loadVerses();
const BIBLE_SET = new Set(BIBLE_ZH);

let fragmentsByLen = null;

function cleanLine(line) {
  return line.replace(/[；，、：""''（）\s]/g, '');
}

function buildFragmentsByLen() {
  if (fragmentsByLen) return fragmentsByLen;
  fragmentsByLen = new Map();
  for (const line of BIBLE_ZH) {
    const clean = cleanLine(line);
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

export function bibleSize() {
  return BIBLE_ZH.length;
}

export function isBiblePlaintext(text) {
  return Boolean(text && BIBLE_SET.has(text.trim()));
}

export function bibleFragmentsForLength(len, max = 800) {
  const set = buildFragmentsByLen().get(len);
  if (!set) return [];
  return [...set].slice(0, max);
}

/** 与经节/片段重合度 */
export function scoreBibleMatch(text) {
  if (!text || !/[\u4e00-\u9fff]/.test(text)) return 0;
  if (BIBLE_SET.has(text.trim())) return 55;
  const frags = buildFragmentsByLen();
  let hits = 0;
  for (let len = 3; len <= 8; len++) {
    const set = frags.get(len);
    if (!set) continue;
    for (let i = 0; i + len <= text.length; i++) {
      if (set.has(text.slice(i, i + len))) hits++;
    }
  }
  return Math.min(hits * 2, 40);
}

export { BIBLE_ZH, BIBLE_SET };
