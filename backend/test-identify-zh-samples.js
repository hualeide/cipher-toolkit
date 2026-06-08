/**
 * 中文样本 × 可识别算法：加密 → 自动识别 → 统计成功率
 * 运行: node test-identify-zh-samples.js
 * 可选: ZH_SAMPLES=3 MIN_CONF=72 node test-identify-zh-samples.js
 */
import { registry, encrypt } from './src/ciphers/registry.js';
import { identify } from './src/services/identifier.js';
import * as E from './src/ciphers/engine.js';
import { getLangSupport, isUnicodeSafeCipher } from './src/ciphers/langSupport.js';

const MIN_CONF = Number(process.env.MIN_CONF || 72);
const SAMPLE_LIMIT = Number(process.env.ZH_SAMPLES || 0);

const SENTENCES = [
  '康神开播了',
  '今天天气真不错',
  '程序员正在写代码',
  '我爱你中国',
  'Hello，世界！2024',
  '密钥测试一二三',
  '摩斯电报中文',
  '仿射密码真有趣',
];

const ID_ALIASES = {
  caesar: ['caesar', 'gf-caesar3', 'unicode-cp-caesar', 'unicode-cp-affine'],
  rot13: ['rot13', 'caesar', 'gf-caesar3', 'unicode-cp-caesar', 'rot-all'],
  'gf-caesar3': ['gf-caesar3', 'caesar', 'rot13', 'unicode-cp-caesar', 'unicode-cp-affine'],
  'rot-all': ['rot-all', 'unicode-cp-caesar', 'caesar', 'rot13'],
  rot18: ['rot18', 'rot13', 'caesar', 'unicode-cp-caesar'],
  rot47: ['rot47', 'unicode-cp-caesar'],
  vigenere: ['vigenere', 'gf-vigenere-pines', 'unicode-cp-vigenere', 'beaufort'],
  beaufort: ['beaufort', 'vigenere', 'unicode-cp-vigenere'],
  'unicode-cp-caesar': ['unicode-cp-caesar', 'caesar', 'rot13', 'rot-all', 'gf-caesar3'],
  'unicode-cp-vigenere': ['unicode-cp-vigenere', 'vigenere', 'gf-vigenere-pines'],
  'gf-vigenere-pines': ['gf-vigenere-pines', 'vigenere', 'unicode-cp-vigenere'],
  affine: ['affine', 'unicode-cp-affine'],
  'unicode-cp-affine': ['unicode-cp-affine', 'affine'],
  'rail-fence': ['rail-fence', 'columnar', 'even-odd-split', 'scytale'],
  columnar: ['columnar', 'rail-fence', 'even-odd-split'],
  'even-odd-split': ['even-odd-split', 'rail-fence', 'columnar'],
  scytale: ['scytale', 'rail-fence', 'columnar'],
  morse: ['morse'],
  jwt: ['jwt'],
  'unicode-escape': ['unicode-escape'],
  'quoted-printable': ['quoted-printable'],
  decimal: ['decimal', 'unicode-cp-decimal'],
  octal: ['octal'],
  uuencode: ['uuencode'],
  reverse: ['reverse'],
  autokey: ['autokey', 'vigenere'],
  gronsfeld: ['gronsfeld', 'vigenere'],
  'running-key': ['running-key', 'vigenere'],
  base64: ['base64'],
  hex: ['hex'],
  url: ['url'],
  reverse: ['reverse'],
};

const SKIP_IDS = new Set(['des', '3des', 'rsa', 'scp-redact', 'unicode-cp-decimal']);

const ANY_CHAR = new Set([
  'rail-fence', 'columnar', 'scytale', 'reverse', 'even-odd-split', 'acrostic',
]);

function defaultParams(cipher) {
  const p = {};
  for (const param of cipher.params || []) {
    if (param.default !== undefined) p[param.name] = param.default;
    else if (param.type === 'number') p[param.name] = param.min ?? 0;
    else p[param.name] = '';
  }
  return p;
}

function zhCompatible(cipher) {
  if (cipher.identifiable === false || SKIP_IDS.has(cipher.id)) return false;
  if (getLangSupport(cipher.id)) return true;
  if (ANY_CHAR.has(cipher.id)) return true;
  if (isUnicodeSafeCipher(cipher.id, cipher.category) && cipher.reversible !== false) {
    return ['编码/表示'].includes(cipher.category);
  }
  return false;
}

function acceptableIds(id) {
  return new Set(ID_ALIASES[id] || [id]);
}

function matchPlain(cipher, a, b) {
  if (!a || !b) return false;
  if (a === b) return true;
  if (cipher.id === 'morse') {
    return a.replace(/[，。！？、；：,\.!?;\s()（）]/g, '') === b.replace(/[，。！？、；：,\.!?;\s()（）]/g, '')
      || E.morsePlainEqual(a, b);
  }
  if (cipher.id === 'jwt') {
    try {
      const parsed = JSON.parse(a);
      return String(parsed.payload ?? '') === b;
    } catch { return a === b; }
  }
  return false;
}

function check(cipher, plain, ct) {
  const results = identify(ct, { limit: 12, minScore: 30 });
  if (!results.length) return { ok: false, reason: 'no_results' };
  const aliases = acceptableIds(cipher.id);
  const idx = results.findIndex((r) => aliases.has(r.id) && matchPlain(cipher, r.result, plain));
  if (idx < 0) {
    const plainIdx = results.findIndex((r) => matchPlain(cipher, r.result, plain));
    if (plainIdx >= 0) {
      return {
        ok: false, reason: 'wrong_id', top: results[0], rank: plainIdx, hit: results[plainIdx],
      };
    }
    return { ok: false, reason: 'no_plain', top: results[0] };
  }
  const hit = results[idx];
  if (idx > 0) return { ok: false, reason: 'wrong_rank', top: results[0], rank: idx, hit };
  if ((hit.confidence ?? 0) < MIN_CONF) return { ok: false, reason: 'low_conf', hit };
  return { ok: true, hit };
}

const sentences = SAMPLE_LIMIT > 0 ? SENTENCES.slice(0, SAMPLE_LIMIT) : SENTENCES;
const ciphers = registry.filter(zhCompatible);

console.log(`中文识别压测: ${sentences.length} 句 × ${ciphers.length} 算法 (conf≥${MIN_CONF})\n`);

const failures = [];
let total = 0;
let passed = 0;
let t0 = Date.now();

for (const plain of sentences) {
  for (const cipher of ciphers) {
    const params = defaultParams(cipher);
    let ct;
    try {
      ct = encrypt(cipher.id, plain, params);
    } catch (e) {
      failures.push({ plain, id: cipher.id, reason: `encrypt:${e.message}` });
      total++;
      continue;
    }
    if (cipher.reversible !== false && (!ct || ct === plain)) continue;
    total++;
    const r = check(cipher, plain, ct);
    if (r.ok) {
      passed++;
    } else {
      failures.push({
        plain: plain.slice(0, 16),
        id: cipher.id,
        reason: r.reason,
        topId: r.top?.id,
        topResult: r.top?.result?.slice(0, 16),
        wantId: r.hit?.id,
        conf: r.hit?.confidence ?? r.top?.confidence,
        rank: r.rank,
      });
    }
    if (total % 10 === 0) {
      process.stderr.write(`\r  ${total} 完成, ${passed} 通过 (${Math.round((Date.now() - t0) / 1000)}s)`);
    }
  }
}

const pct = total ? Math.round((passed / total) * 1000) / 10 : 0;
console.log(`\n\n结果: ${passed}/${total} = ${pct}%`);
console.log(`耗时: ${Math.round((Date.now() - t0) / 1000)}s`);

if (failures.length) {
  const byReason = {};
  const byCipher = {};
  for (const f of failures) {
    byReason[f.reason] = (byReason[f.reason] || 0) + 1;
    byCipher[f.id] = (byCipher[f.id] || 0) + 1;
  }
  console.log('\n失败原因:', byReason);
  console.log('\n失败算法:');
  for (const [id, n] of Object.entries(byCipher).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${id}: ${n}`);
  }
  console.log('\n样例:');
  for (const f of failures.slice(0, 25)) {
    console.log(`  [${f.plain}] ${f.id}: ${f.reason}`
      + (f.topId ? ` top=${f.topId}→${f.topResult}` : '')
      + (f.wantId ? ` want=${f.wantId}@#${f.rank}` : '')
      + (f.conf != null ? ` conf=${f.conf}` : ''));
  }
  process.exit(1);
}

console.log('\n全部通过');
