/**
 * 四大名著 × 中文算法：加密 → 自动识别 压测
 *
 * 准备: node scripts/fetch-classics-zh.mjs
 * 运行: node test-identify-classic-zh.js
 * 可选: CLASSIC_LIMIT=500 CLASSIC_CIPHER=unicode-cp-caesar MIN_CONFIDENCE=90
 */
import { readFileSync } from 'fs';
import { registry, encrypt } from './src/ciphers/registry.js';
import { identify } from './src/services/identifier.js';
import { getLangSupport, isUnicodeSafeCipher, LangNotSupportedError } from './src/ciphers/langSupport.js';
import { classicSize } from './src/ciphers/classicCorpus.js';

const MIN_CONFIDENCE = Number(process.env.MIN_CONFIDENCE || 90);
const CLASSIC_LIMIT = Number(process.env.CLASSIC_LIMIT || 0);
const CLASSIC_CIPHER = process.env.CLASSIC_CIPHER || '';
const CLASSIC_MODE = process.env.CLASSIC_MODE || 'core';
const PROGRESS_EVERY = Number(process.env.PROGRESS_EVERY || 2000);

const ZH_CORE_CIPHER_IDS = new Set([
  'unicode-cp-caesar', 'unicode-cp-vigenere', 'unicode-cp-affine',
  'caesar', 'rot13', 'rot-all', 'atbash', 'affine',
  'vigenere', 'beaufort', 'autokey', 'gronsfeld', 'running-key',
  'morse', 'gf-caesar3', 'gf-vigenere-pines',
]);

const ID_ALIASES = {
  caesar: ['caesar', 'gf-caesar3', 'unicode-cp-caesar'],
  rot13: ['rot13', 'caesar', 'gf-caesar3', 'unicode-cp-caesar', 'rot-all'],
  'gf-caesar3': ['gf-caesar3', 'caesar', 'rot13', 'unicode-cp-caesar'],
  'rot-all': ['rot-all', 'unicode-cp-caesar', 'caesar', 'rot13'],
  vigenere: ['vigenere', 'gf-vigenere-pines', 'unicode-cp-vigenere', 'beaufort'],
  beaufort: ['beaufort', 'vigenere', 'unicode-cp-vigenere'],
  'unicode-cp-caesar': ['unicode-cp-caesar', 'caesar', 'rot13', 'rot-all', 'gf-caesar3'],
  'unicode-cp-vigenere': ['unicode-cp-vigenere', 'vigenere'],
  'gf-vigenere-pines': ['gf-vigenere-pines', 'vigenere', 'unicode-cp-vigenere'],
  'unicode-cp-affine': ['unicode-cp-affine', 'affine'],
  affine: ['affine', 'unicode-cp-affine'],
  morse: ['morse'],
  autokey: ['autokey', 'vigenere'],
  'running-key': ['running-key', 'vigenere'],
};

const SKIP_IDS = new Set(['des', '3des', 'rsa', 'scp-redact']);

function defaultParams(cipher) {
  const p = {};
  for (const param of cipher.params || []) {
    if (param.default !== undefined) p[param.name] = param.default;
    else if (param.type === 'number') p[param.name] = param.min ?? 0;
    else p[param.name] = '';
  }
  return p;
}

function acceptableIds(expectedId) {
  return new Set(ID_ALIASES[expectedId] || [expectedId]);
}

function matchPlain(cipher, a, b) {
  if (!a || !b) return false;
  if (a === b) return true;
  if (cipher.id === 'morse') {
    const norm = (s) => s.replace(/[，。！？、；：,\.!?;\s]/g, '');
    return norm(a) === norm(b);
  }
  return false;
}

function supportsChinese(cipher) {
  if (cipher.identifiable === false || cipher.reversible === false) return false;
  if (SKIP_IDS.has(cipher.id)) return false;
  if (getLangSupport(cipher.id)) return true;
  if (isUnicodeSafeCipher(cipher.id, cipher.category)) return true;
  const sample = '话说天下大势，分久必合，合久必分。';
  const params = defaultParams(cipher);
  try {
    encrypt(cipher.id, sample, params);
    return true;
  } catch (e) {
    return !(e instanceof LangNotSupportedError);
  }
}

function checkIdentify(cipher, plain, cipherText) {
  const results = identify(cipherText, { limit: 12 });
  if (!results.length) return { ok: false, reason: 'no_results', top: null, confidence: 0 };

  const top = results[0];
  if (top.alreadyPlaintext) {
    return { ok: false, reason: 'misclassified_plaintext', top, confidence: top.confidence ?? 0 };
  }

  const aliases = acceptableIds(cipher.id);
  const aliasIdx = results.findIndex((r) => aliases.has(r.id) && matchPlain(cipher, r.result, plain));
  if (aliasIdx < 0) {
    const anyPlain = results.findIndex((r) => matchPlain(cipher, r.result, plain));
    if (anyPlain >= 0) {
      return {
        ok: false, reason: 'correct_plain_wrong_id', top,
        correct: results[anyPlain], confidence: results[anyPlain].confidence ?? 0,
      };
    }
    return { ok: false, reason: 'no_correct_decrypt', top, confidence: top.confidence ?? 0 };
  }

  const hit = results[aliasIdx];
  const conf = hit.confidence ?? 0;
  if (aliasIdx > 0) {
    return { ok: false, reason: 'wrong_top_correct_later', top, correct: hit, confidence: conf };
  }
  if (conf < MIN_CONFIDENCE) {
    return { ok: false, reason: 'low_confidence', top: hit, confidence: conf };
  }
  return { ok: true, reason: 'ok', top: hit, confidence: conf };
}

const verses = readFileSync(new URL('./src/ciphers/classicCorpus.zh.txt', import.meta.url), 'utf8')
  .split(/\r?\n/)
  .map((l) => l.trim())
  .filter(Boolean);

const slice = CLASSIC_LIMIT > 0 ? verses.slice(0, CLASSIC_LIMIT) : verses;
let zhCiphers = registry.filter(supportsChinese);
if (CLASSIC_MODE === 'core') zhCiphers = zhCiphers.filter((c) => ZH_CORE_CIPHER_IDS.has(c.id));
if (CLASSIC_CIPHER) zhCiphers = zhCiphers.filter((c) => c.id === CLASSIC_CIPHER);

console.log(`四大名著压测 [${CLASSIC_MODE}]: ${slice.length}/${classicSize()} 句 × ${zhCiphers.length} 种算法`);
console.log(`置信度门槛 ≥${MIN_CONFIDENCE}\n`);

let total = 0;
let passed = 0;
let skipped = 0;
const failures = [];
const byCipher = {};
const byReason = {};
const t0 = Date.now();

for (const cipher of zhCiphers) {
  const params = defaultParams(cipher);
  let cPass = 0;
  let cTotal = 0;

  for (const plain of slice) {
    let cipherText;
    try {
      cipherText = encrypt(cipher.id, plain, params);
    } catch {
      skipped++;
      continue;
    }
    if (!cipherText || cipherText === plain) {
      skipped++;
      continue;
    }

    total++;
    cTotal++;
    const check = checkIdentify(cipher, plain, cipherText);
    if (check.ok) {
      passed++;
      cPass++;
    } else {
      failures.push({
        cipher: cipher.id,
        plain: plain.slice(0, 36),
        reason: check.reason,
        topId: check.top?.id,
        topResult: check.top?.result?.slice(0, 36),
        confidence: check.confidence,
      });
      byCipher[cipher.id] = (byCipher[cipher.id] || 0) + 1;
      byReason[check.reason] = (byReason[check.reason] || 0) + 1;
    }

    if (total % PROGRESS_EVERY === 0) {
      const elapsed = ((Date.now() - t0) / 1000).toFixed(0);
      const rate = (passed / total * 100).toFixed(2);
      console.log(`  … ${total} 次 (${elapsed}s) 通过率 ${rate}%`);
    }
  }

  const rate = cTotal ? (cPass / cTotal * 100).toFixed(1) : '—';
  console.log(`${cipher.id.padEnd(22)} ${cPass}/${cTotal} (${rate}%)`);
}

const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
const passRate = total ? (passed / total * 100).toFixed(2) : '0';

console.log(`\n总计: ${passed}/${total} 通过 (${passRate}%), 跳过 ${skipped}, 耗时 ${elapsed}s`);

if (Object.keys(byReason).length) {
  console.log('\n失败原因:', byReason);
  console.log('\n失败算法 (前15):');
  for (const [id, n] of Object.entries(byCipher).sort((a, b) => b[1] - a[1]).slice(0, 15)) {
    console.log(`  ${id}: ${n}`);
  }
}

if (passed < total) process.exit(1);
console.log('\n四大名著中文识别压测全绿');
