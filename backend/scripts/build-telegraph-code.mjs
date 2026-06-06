/**
 * 从 Unicode Unihan kMainlandTelegraph 生成 telegraphCode.json
 * 需先解压 Unihan.zip 到 backend/scripts/Unihan/
 * 运行: node backend/scripts/build-telegraph-code.mjs
 */
import { readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.dirname(fileURLToPath(import.meta.url));
const src = path.join(root, 'Unihan/Unihan_OtherMappings.txt');
const out = path.join(root, '../src/ciphers/telegraphCode.json');

const raw = readFileSync(src, 'utf8');
const c2t = {};
const t2c = {};

for (const line of raw.split('\n')) {
  if (!line.startsWith('U+')) continue;
  const [u, field, code] = line.split('\t');
  if (field !== 'kMainlandTelegraph' || !/^\d{4}$/.test(code)) continue;
  const cp = parseInt(u.slice(2), 16);
  const ch = String.fromCodePoint(cp);
  c2t[ch] = code;
  if (!t2c[code]) t2c[code] = ch;
}

writeFileSync(out, JSON.stringify({ c2t, t2c }), 'utf8');
console.log(`chars ${Object.keys(c2t).length}, codes ${Object.keys(t2c).length} → ${out}`);
