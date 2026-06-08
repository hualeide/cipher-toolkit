/**
 * 解析四大名著 → classicCorpus.zh.txt（每句一行）
 * node scripts/parse-classics-zh.mjs
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.join(__dir, '../data/classics');
const outPath = path.join(__dir, '../src/ciphers/classicCorpus.zh.txt');

const NOVEL_FILES = ['honglou.txt', 'xiyou.txt', 'shuihu.txt', 'sanguo.txt'];

function splitSentences(text) {
  return text
    .replace(/\r/g, '')
    .replace(/[ \t]+/g, '')
    .split(/(?<=[。！？；\n])/)
    .map((s) => s.replace(/\n+/g, '').trim())
    .filter((s) => s.length >= 6 && s.length <= 120 && /[\u4e00-\u9fff]/.test(s));
}

if (!existsSync(srcDir)) {
  console.error('缺少 backend/data/classics，请先运行: node scripts/fetch-classics-zh.mjs');
  process.exit(1);
}

const seen = new Set();
const lines = [];

for (const file of NOVEL_FILES) {
  const fp = path.join(srcDir, file);
  if (!existsSync(fp)) {
    console.warn(`跳过缺失: ${file}`);
    continue;
  }
  const raw = readFileSync(fp, 'utf8');
  for (const s of splitSentences(raw)) {
    if (seen.has(s)) continue;
    seen.add(s);
    lines.push(s);
  }
  console.log(`${file}: 累计 ${lines.length} 句`);
}

if (!lines.length) {
  const avail = readdirSync(srcDir).join(', ');
  console.error(`未解析到句子，目录内容: ${avail}`);
  process.exit(1);
}

writeFileSync(outPath, lines.join('\n'), 'utf8');
console.log(`四大名著: ${lines.length} 句 → ${outPath}`);
