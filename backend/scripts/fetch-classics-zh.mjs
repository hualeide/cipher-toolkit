/**
 * 下载四大名著原始文本 → backend/data/classics/*.txt
 * node scripts/fetch-classics-zh.mjs
 */
import { mkdirSync, writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dir, '../data/classics');

const BASE = 'https://raw.githubusercontent.com/hankinghu/literature-books/master';
const NOVELS = [
  { id: 'honglou', name: '红楼梦', url: `${BASE}/%E7%BA%A2%E6%A5%BC%E6%A2%A6.txt` },
  { id: 'xiyou', name: '西游记', url: `${BASE}/%E8%A5%BF%E6%B8%B8%E8%AE%B0.txt` },
  { id: 'shuihu', name: '水浒传', url: `${BASE}/%E6%B0%B4%E6%B5%92%E4%BC%A0.txt` },
  { id: 'sanguo', name: '三国演义', url: `${BASE}/%E4%B8%89%E5%9B%BD%E6%BC%94%E4%B9%89.txt` },
];

mkdirSync(outDir, { recursive: true });

for (const novel of NOVELS) {
  const dest = path.join(outDir, `${novel.id}.txt`);
  console.log(`下载 ${novel.name}…`);
  const res = await fetch(novel.url);
  if (!res.ok) throw new Error(`${novel.name} 下载失败: ${res.status}`);
  const text = await res.text();
  writeFileSync(dest, text, 'utf8');
  console.log(`  → ${dest} (${text.length} 字)`);
}

execSync('node scripts/parse-classics-zh.mjs', { cwd: path.join(__dir, '..'), stdio: 'inherit' });
