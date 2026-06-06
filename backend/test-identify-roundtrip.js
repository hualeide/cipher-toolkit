/**
 * 全可识别算法 × 10 轮：加密 → 智能识别 → 校验 + 置信度 ≥95（严格档）
 */
import { registry, encrypt } from './src/ciphers/registry.js';
import { identify } from './src/services/identifier.js';
import { getLangSupport } from './src/ciphers/langSupport.js';
import { pickCorpusPlaintext, rotationSeed } from './src/ciphers/exampleCorpus.js';

const ROUNDS = 10;
const MIN_CONFIDENCE = 95;

const ID_ALIASES = {
  caesar: ['caesar', 'gf-caesar3', 'unicode-cp-caesar'],
  rot13: ['rot13', 'caesar', 'gf-caesar3', 'unicode-cp-caesar', 'rot-all'],
  'gf-caesar3': ['gf-caesar3', 'caesar', 'rot13', 'unicode-cp-caesar'],
  'rot-all': ['rot-all', 'unicode-cp-caesar', 'caesar', 'rot13'],
  rot5: ['rot5'],
  rot18: ['rot18', 'rot13', 'caesar', 'unicode-cp-caesar'],
  rot47: ['rot47', 'unicode-cp-caesar'],
  vigenere: ['vigenere', 'gf-vigenere-pines', 'unicode-cp-vigenere', 'beaufort'],
  beaufort: ['beaufort', 'vigenere', 'unicode-cp-vigenere'],
  'unicode-cp-caesar': ['unicode-cp-caesar', 'caesar', 'rot13', 'rot-all', 'gf-caesar3'],
  'unicode-cp-vigenere': ['unicode-cp-vigenere', 'vigenere'],
  'gf-vigenere-pines': ['gf-vigenere-pines', 'vigenere', 'unicode-cp-vigenere'],
  'rail-fence': ['rail-fence', 'columnar', 'even-odd-split', 'scytale'],
  columnar: ['columnar', 'rail-fence', 'even-odd-split'],
  'even-odd-split': ['even-odd-split', 'rail-fence', 'columnar'],
  scytale: ['scytale', 'rail-fence', 'columnar'],
  a1z26: ['a1z26', 'gf-a1z26'],
  'gf-a1z26': ['gf-a1z26', 'a1z26'],
  sha256: ['sha256', 'sha3-256', 'hmac-sha256', 'pbkdf2'],
  'sha3-256': ['sha3-256', 'sha256', 'hmac-sha256', 'pbkdf2'],
  'hmac-sha256': ['hmac-sha256', 'sha256', 'sha3-256', 'pbkdf2'],
  pbkdf2: ['pbkdf2', 'sha256', 'sha3-256', 'hmac-sha256'],
  bacon: ['bacon'],
  braille: ['braille'],
  leet: ['leet'],
  'enigma-simple': ['enigma-simple', 'caesar', 'affine'],
  'keyword-sub': ['keyword-sub', 'caesar', 'affine'],
  'periodic-table': ['periodic-table', 'caesar'],
  'meme-binary': ['meme-binary'],
  nato: ['nato', 'rail-fence'],
  adler32: ['adler32'],
  'unicode-cp-decimal': ['unicode-cp-decimal'],
  polybius: ['polybius', 'tap-code'],
  'tap-code': ['tap-code', 'polybius'],
  morse: ['morse'],
  affine: ['affine', 'unicode-cp-affine'],
  'keyboard-shift': ['keyboard-shift'],
  'swap-case': ['swap-case'],
  autokey: ['autokey', 'vigenere'],
};

const SKIP_IDS = new Set(['des', '3des', 'rsa', 'scp-redact']);

const NEED_RICH_PLAIN = new Set([
  'url', 'html-entities', 'unicode-escape', 'quoted-printable',
  'rot5', 'swap-case', 'reverse', 'bubble', 'fullwidth',
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

function pickPlain(cipher, round) {
  const seed = rotationSeed() + round;
  if (cipher.id === 'autokey') return 'hello';
  if (cipher.id === 'jwt') return 'hello';
  if (cipher.id === 'scytale') return 'helloworld';
  if (cipher.id === 'affine') return 'HELLO';
  if (cipher.id === 'bifid' || cipher.id === 'trifid') return 'HELLO';
  if (cipher.id === 'four-square') return 'HELLO';
  if (cipher.id === 'playfair' || cipher.id === 'hill') return 'WORLD';
  if (cipher.id === 'jcuken') return 'привет';
  if (getLangSupport(cipher.id)) return pickCorpusPlaintext(cipher.id, seed);
  if (NEED_RICH_PLAIN.has(cipher.id)) return 'Hello, World! 2024';
  if (cipher.category === '编码/表示' || cipher.category === '哈希/摘要') return 'hello';
  if (cipher.category === '对称加密') return 'secret';
  return 'HELLO';
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
  if (cipher.id === 'jwt') {
    try {
      const parsed = JSON.parse(a);
      return String(parsed.payload ?? '') === b;
    } catch { return false; }
  }
  if (/^[a-zA-Z0-9\s.,!?'"()-]+$/.test(a) && /^[a-zA-Z0-9\s.,!?'"()-]+$/.test(b)) {
    return a.toLowerCase() === b.toLowerCase();
  }
  return false;
}

function checkIdentify(cipher, plain, cipherText) {
  const results = identify(cipherText, { limit: 12 });
  if (!results.length) return { ok: false, reason: 'no_results', top: null, rank: -1, confidence: 0 };

  const top = results[0];
  if (top.alreadyPlaintext) {
    return { ok: false, reason: 'misclassified_plaintext', top, rank: -1, confidence: top.confidence ?? 0 };
  }

  if (cipher.reversible === false) {
    const aliases = acceptableIds(cipher.id);
    const hit = results.find((r) => aliases.has(r.id));
    const conf = hit?.confidence ?? top.confidence ?? 0;
    if (!hit) return { ok: false, reason: 'wrong_hash_id', top, rank: -1, confidence: conf };
    if (results.indexOf(hit) !== 0) {
      return { ok: false, reason: 'wrong_top_correct_later', top, rank: results.indexOf(hit), correct: hit, confidence: conf };
    }
    if (conf < MIN_CONFIDENCE) return { ok: false, reason: 'low_confidence', top: hit, rank: 0, confidence: conf };
    return { ok: true, reason: 'ok', top: hit, rank: 0, confidence: conf };
  }

  const aliases = acceptableIds(cipher.id);
  const aliasIdx = results.findIndex((r) => aliases.has(r.id) && matchPlain(cipher, r.result, plain));
  if (aliasIdx < 0) {
    const anyPlain = results.findIndex((r) => matchPlain(cipher, r.result, plain));
    if (anyPlain >= 0) {
      return {
        ok: false, reason: 'correct_plain_wrong_id', top, rank: anyPlain,
        correct: results[anyPlain], confidence: results[anyPlain].confidence ?? 0,
      };
    }
    return { ok: false, reason: 'no_correct_decrypt', top, rank: -1, confidence: top.confidence ?? 0 };
  }

  const hit = results[aliasIdx];
  const conf = hit.confidence ?? 0;
  if (aliasIdx > 0) {
    return {
      ok: false, reason: 'wrong_top_correct_later', top, rank: aliasIdx,
      correct: hit, confidence: conf,
    };
  }
  if (conf < MIN_CONFIDENCE) {
    return { ok: false, reason: 'low_confidence', top: hit, rank: 0, confidence: conf };
  }
  return { ok: true, reason: 'ok', top: hit, rank: 0, confidence: conf };
}

const failures = [];
const confSum = {};
const confCount = {};
let total = 0;
let passed = 0;
let skipped = 0;

console.log(`全算法识别回环 × ${ROUNDS} 轮（置信度 ≥${MIN_CONFIDENCE}）\n`);

for (let round = 0; round < ROUNDS; round++) {
  for (const cipher of registry) {
    if (cipher.identifiable === false || SKIP_IDS.has(cipher.id)) continue;

    const params = defaultParams(cipher);
    const plain = pickPlain(cipher, round);

    let cipherText;
    try {
      cipherText = encrypt(cipher.id, plain, params);
    } catch (e) {
      failures.push({ round, id: cipher.id, reason: `encrypt_fail: ${e.message}` });
      total++;
      continue;
    }

    if (cipher.reversible !== false && (!cipherText || cipherText === plain)) {
      skipped++;
      continue;
    }

    total++;
    const check = checkIdentify(cipher, plain, cipherText);
    confSum[cipher.id] = (confSum[cipher.id] || 0) + (check.confidence || 0);
    confCount[cipher.id] = (confCount[cipher.id] || 0) + 1;

    if (check.ok) {
      passed++;
      continue;
    }

    failures.push({
      round,
      id: cipher.id,
      plain: plain.slice(0, 24),
      reason: check.reason,
      topId: check.top?.id,
      topResult: check.top?.result?.slice(0, 24),
      rank: check.rank,
      correctId: check.correct?.id,
      confidence: check.confidence,
    });
  }
}

console.log(`${passed}/${total} 通过, ${skipped} 跳过 (${ROUNDS} 轮)`);

const STRICT_CONFIDENCE = 95;
const strictLow = Object.entries(confSum)
  .map(([id, sum]) => ({ id, avg: Math.round(sum / confCount[id]) }))
  .filter((x) => x.avg < STRICT_CONFIDENCE)
  .sort((a, b) => a.avg - b.avg);

if (strictLow.length) {
  console.log(`\n[严格档 ≥${STRICT_CONFIDENCE}] 平均置信度偏低 (${strictLow.length} 种):`);
  for (const x of strictLow) console.log(`  ${x.id}: ${x.avg}`);
}

const lowConf = Object.entries(confSum)
  .map(([id, sum]) => ({ id, avg: Math.round(sum / confCount[id]) }))
  .filter((x) => x.avg < MIN_CONFIDENCE)
  .sort((a, b) => a.avg - b.avg);

if (lowConf.length) {
  console.log(`\n平均置信度 <${MIN_CONFIDENCE}:`);
  for (const x of lowConf) console.log(`  ${x.id}: ${x.avg}`);
}

if (failures.length) {
  const byReason = {};
  for (const f of failures) byReason[f.reason] = (byReason[f.reason] || 0) + 1;
  console.log('\n失败分布:', byReason);

  const byCipher = {};
  for (const f of failures) byCipher[f.id] = (byCipher[f.id] || 0) + 1;
  console.log('\n按算法:');
  for (const [id, n] of Object.entries(byCipher).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${id}: ${n}次`);
  }

  console.log('\n样例 (前 20):');
  for (const f of failures.slice(0, 20)) {
    console.log(
      `  [R${f.round}] ${f.id}: ${f.reason} conf=${f.confidence ?? '?'}`
      + (f.topId ? ` | top=${f.topId}→${f.topResult ?? '—'}` : '')
      + (f.correctId ? ` | want≈${f.correctId}@#${f.rank}` : ''),
    );
  }
  process.exit(1);
}

if (strictLow.length) {
  console.log(`\n严格档未达标：${strictLow.length} 种算法平均置信度 <${STRICT_CONFIDENCE}`);
  process.exit(1);
}

console.log(`全部通过，严格档置信度 ≥${STRICT_CONFIDENCE} 全绿`);
