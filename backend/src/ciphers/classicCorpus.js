/**
 * 四大名著语料 — 识别评分与候选反推
 * 源文件: classicCorpus.zh.txt（由 scripts/parse-classics-zh.mjs 生成）
 */
import { readFileSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const CORPUS_FILE = path.join(__dir, 'classicCorpus.zh.txt');

function loadLines() {
  if (!existsSync(CORPUS_FILE)) return [];
  const raw = readFileSync(CORPUS_FILE, 'utf8');
  return raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
}

const CLASSIC_ZH = loadLines();
const CLASSIC_SET = new Set(CLASSIC_ZH);

let fragmentsByLen = null;

function cleanLine(line) {
  return line.replace(/[；，、：""''（）\s]/g, '');
}

function buildFragmentsByLen() {
  if (fragmentsByLen) return fragmentsByLen;
  fragmentsByLen = new Map();
  for (const line of CLASSIC_ZH) {
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

export function classicSize() {
  return CLASSIC_ZH.length;
}

export function isClassicPlaintext(text) {
  return Boolean(text && CLASSIC_SET.has(text.trim()));
}

export function classicFragmentsForLength(len, max = 800) {
  const set = buildFragmentsByLen().get(len);
  if (!set) return [];
  return [...set].slice(0, max);
}

export function scoreClassicMatch(text) {
  if (!text || !/[\u4e00-\u9fff]/.test(text)) return 0;
  if (CLASSIC_SET.has(text.trim())) return 52;
  const frags = buildFragmentsByLen();
  let hits = 0;
  for (let len = 3; len <= 8; len++) {
    const set = frags.get(len);
    if (!set) continue;
    for (let i = 0; i + len <= text.length; i++) {
      if (set.has(text.slice(i, i + len))) hits++;
    }
  }
  return Math.min(hits * 2, 38);
}

export { CLASSIC_ZH, CLASSIC_SET };
