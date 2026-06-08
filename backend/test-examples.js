/**
 * 全部算法示例生成检查（含句库/占位/往返）
 */
import { getCipherMeta, cipherMap } from './src/ciphers/registry.js';
import { getLangSupport } from './src/ciphers/langSupport.js';
import { corpusSize, isExamplePlaceholder, isCorpusPlaintext } from './src/ciphers/exampleCorpus.js';

const meta = getCipherMeta();
let missing = 0;
let langBad = 0;
let roundtripBad = 0;

function defaultParams(cipher) {
  const p = {};
  for (const param of cipher.params || []) {
    if (param.default !== undefined) p[param.name] = param.default;
    else if (param.type === 'number') p[param.name] = param.min ?? 0;
    else p[param.name] = '';
  }
  return p;
}

console.log(`句库规模: ${corpusSize()} 条\n`);

for (const c of meta) {
  if (!c.examplePlain || !c.exampleCipher) {
    console.log(`MISSING ${c.id}: plain=${!!c.examplePlain} cipher=${!!c.exampleCipher}`);
    missing++;
    continue;
  }

  const langs = getLangSupport(c.id);
  if (langs?.includes('zh')) {
    if (isExamplePlaceholder(c.examplePlain)) {
      console.log(`PLACEHOLDER ${c.id}: plain=${c.examplePlain}`);
      langBad++;
    }
    if (!isCorpusPlaintext(c.examplePlain)) {
      console.log(`NOT_CORPUS ${c.id}: plain=${c.examplePlain.slice(0, 48)}`);
      langBad++;
    }
    if (!/[\u4e00-\u9fff]/.test(c.examplePlain)) {
      console.log(`NO_CJK ${c.id}: plain=${c.examplePlain.slice(0, 40)}`);
      langBad++;
    }
    if (!/[。！？；]$/.test(c.examplePlain)) {
      console.log(`NOT_SENTENCE ${c.id}: plain=${c.examplePlain.slice(0, 40)}`);
      langBad++;
    }
    if (/^(有人说|古人云|记得|那年|（\d+）)/.test(c.examplePlain) || /（\d+）$/.test(c.examplePlain)) {
      console.log(`JUNK_CORPUS ${c.id}: plain=${c.examplePlain.slice(0, 40)}`);
      langBad++;
    }
    const lenPreserving = c.reversible !== false && !c.id.startsWith('unicode-cp-') && c.id !== 'morse';
    if (lenPreserving) {
      const pl = [...c.examplePlain].length;
      const cl = [...c.exampleCipher].length;
      if (pl !== cl) {
        console.log(`LEN_MISMATCH ${c.id}: plain=${pl} cipher=${cl}`);
        langBad++;
      }
    }
  }

  const engine = cipherMap[c.id];
  const skipRoundtrip = new Set(['morse', 'jwt']);
  if (engine?.decrypt && c.reversible !== false && langs?.includes('zh') && !skipRoundtrip.has(c.id)) {
    try {
      const params = defaultParams(engine);
      const back = engine.decrypt(c.exampleCipher, params);
      const norm = (s) => s?.replace(/\s/g, '');
      if (norm(back) !== norm(c.examplePlain) && back !== c.examplePlain) {
        console.log(`ROUNDTRIP ${c.id}: back=${String(back).slice(0, 32)} want=${c.examplePlain.slice(0, 32)}`);
        roundtripBad++;
      }
    } catch (e) {
      console.log(`ROUNDTRIP_ERR ${c.id}: ${e.message}`);
      roundtripBad++;
    }
  }
}

const bad = missing + langBad + roundtripBad;
console.log(`\n${meta.length - bad}/${meta.length} 算法示例通过检查`);
if (langBad) console.log(`  句库/占位: ${langBad} 失败`);
if (roundtripBad) console.log(`  往返: ${roundtripBad} 失败`);
if (missing) console.log(`  缺失: ${missing}`);
if (bad) process.exit(1);
