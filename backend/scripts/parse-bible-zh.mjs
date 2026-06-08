/**
 * 解析和合本 JSON → bibleCorpus.zh.txt（每节一行）
 * 数据源: thiagobodruk/bible zh_cuv.json (public domain CUV)
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dir, '../data');
const jsonPath = path.join(dataDir, 'zh_cuv.json');
const outPath = path.join(__dir, '../src/ciphers/bibleCorpus.zh.txt');

if (!existsSync(jsonPath)) {
  console.error('缺少 data/zh_cuv.json，请先下载：');
  console.error('  Invoke-WebRequest -Uri https://raw.githubusercontent.com/thiagobodruk/bible/master/json/zh_cuv.json -OutFile backend/data/zh_cuv.json');
  process.exit(1);
}

function loadBibleJson(file) {
  let raw = readFileSync(file, 'utf8');
  if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
  return JSON.parse(raw);
}

/** 和合本 JSON 字间有空格，合并为正常中文 */
function normalizeVerse(text) {
  return String(text || '')
    .replace(/\s+/g, '')
    .replace(/，/g, '，')
    .trim();
}

const bible = loadBibleJson(jsonPath);
const lines = [];
const seen = new Set();

for (const book of bible) {
  for (const chapter of book.chapters || []) {
    for (const verse of chapter) {
      const t = normalizeVerse(verse);
      if (!t || seen.has(t)) continue;
      if (!/[\u4e00-\u9fff]/.test(t)) continue;
      seen.add(t);
      lines.push(t);
    }
  }
}

mkdirSync(path.dirname(outPath), { recursive: true });
writeFileSync(outPath, lines.join('\n') + '\n', 'utf8');
console.log(`和合本: ${bible.length} 卷, ${lines.length} 节 → ${outPath}`);
