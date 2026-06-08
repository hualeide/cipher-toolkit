/**
 * 从 Unihan kSimplifiedVariant 生成繁→简映射 + 扩充电报码繁体字条目
 * 运行: node scripts/build-trad-simp.mjs
 */
import { readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.dirname(fileURLToPath(import.meta.url));
const variants = path.join(root, 'Unihan/Unihan_Variants.txt');
const telegraphPath = path.join(root, '../src/ciphers/telegraphCode.json');
const tradOut = path.join(root, '../src/ciphers/tradToSimp.json');

const tradToSimp = {};

for (const line of readFileSync(variants, 'utf8').split('\n')) {
  if (!line.includes('kSimplifiedVariant')) continue;
  const [u, , val] = line.split('\t');
  if (!u?.startsWith('U+') || !val) continue;
  const trad = String.fromCodePoint(parseInt(u.slice(2), 16));
  const target = val.split(/\s+/).find((v) => v.startsWith('U+'));
  if (!target) continue;
  const simp = String.fromCodePoint(parseInt(target.slice(2).split('<')[0], 16));
  if (trad !== simp && !tradToSimp[trad]) tradToSimp[trad] = simp;
}

writeFileSync(tradOut, JSON.stringify(tradToSimp), 'utf8');

const tele = JSON.parse(readFileSync(telegraphPath, 'utf8'));
let added = 0;
for (const [trad, simp] of Object.entries(tradToSimp)) {
  if (tele.c2t[simp] && !tele.c2t[trad]) {
    tele.c2t[trad] = tele.c2t[simp];
    added++;
  }
}
writeFileSync(telegraphPath, JSON.stringify(tele), 'utf8');

console.log(`trad→simp: ${Object.keys(tradToSimp).length} → ${tradOut}`);
console.log(`telegraphCode 增补繁体: ${added} 字`);
