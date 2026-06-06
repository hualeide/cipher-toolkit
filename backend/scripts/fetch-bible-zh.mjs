/**
 * 下载和合本 JSON 并生成 bibleCorpus.zh.txt
 * node scripts/fetch-bible-zh.mjs
 */
import { existsSync, mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dir, '../data');
const jsonPath = path.join(dataDir, 'zh_cuv.json');

mkdirSync(dataDir, { recursive: true });

if (!existsSync(jsonPath)) {
  const url = 'https://raw.githubusercontent.com/thiagobodruk/bible/master/json/zh_cuv.json';
  console.log('下载', url);
  execSync(
    `powershell -NoProfile -Command "Invoke-WebRequest -Uri '${url}' -OutFile '${jsonPath}' -UseBasicParsing"`,
    { stdio: 'inherit' },
  );
}

execSync('node scripts/parse-bible-zh.mjs', { cwd: path.join(__dir, '..'), stdio: 'inherit' });
