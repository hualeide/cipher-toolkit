import { identify } from './src/services/identifier.js';
import * as S from './src/ciphers/specialCiphers.js';
import * as E from './src/ciphers/engine.js';
import * as U from './src/ciphers/unicodeCipher.js';
import { encrypt, decrypt } from './src/ciphers/registry.js';
import assert from 'assert';

/** 手工用例 + 网上/CTF 常见密文 */
const cases = [
  { input: 'english', expectId: 'plaintext' },
  { input: 'pmmtwe', expectId: 'caesar', expectResult: 'heelow' },
  { input: 'KHOOR', expectIdAny: ['caesar', 'gf-caesar3'], expectResult: 'HELLO' },
  { input: 'aGVsbG8=', expectId: 'base64', expectResult: 'hello' },
  { input: '10-15-21-18-14-1-12', expectId: 'gf-a1z26', expectResult: 'JOURNAL' },
  { input: 'GIFHG ML LMV', expectId: 'atbash', expectResult: 'TRUST NO ONE' },
  { input: 'PHHW PH', expectIdAny: ['caesar', 'gf-caesar3'], expectResult: 'MEET ME' },
  { input: 'URYYB JBEYQ', expectIdAny: ['rot13', 'caesar'], expectResult: 'HELLO WORLD' },
  { input: '68656c6c6f', expectId: 'hex', expectResult: 'hello' },
  { input: '.... . .-.. .-.. ---', expectId: 'morse', expectResult: 'HELLO' },
  { input: '01001000 01000101 01001100 01001100 01001111', expectId: 'binary', expectResult: 'HELLO' },
  { input: 'hello%20world', expectId: 'url', expectResult: 'hello world' },
  { input: 'HLOEL', expectIdAny: ['rail-fence', 'columnar', 'even-odd-split'], expectResult: 'HELLO' },
  { input: 'RIJVS', expectIdAny: ['vigenere', 'gf-vigenere-pines', 'unicode-cp-vigenere'], expectResult: 'HELLO' },
  { input: 'w6==@', expectId: 'rot47', expectResult: 'Hello' },
  { input: '∇⟨⟨∓', expectIdAny: ['gf-author'], expectResult: 'MEET' },
  { input: '5L2g5aW9', expectId: 'base64', expectResultContains: '你好' },
  { input: 'h3ll0', expectAnyResultContains: 'hello', expectAnyId: ['leet', 'caesar'] },
  { input: '72 101 108 108 111', expectId: 'decimal', expectResult: 'Hello' },
  { input: '憇熳似', expectIdAny: ['unicode-cp-vigenere', 'vigenere'], expectResult: '我爱你' },
];

// Unicode 码点密码 — 动态生成密文
const UNICODE_SAMPLES = [
  { plain: '你好世界', shift: 88, id: 'unicode-cp-caesar' },
  { plain: '繁體中文測試', shift: 120, id: 'unicode-cp-caesar' },
  { plain: 'Hello中国', shift: 42, id: 'unicode-cp-caesar' },
  { plain: '代码，轻而易举啊', shift: 5, id: 'unicode-cp-caesar' },
  { plain: '密码工具', key: '密钥', id: 'unicode-cp-vigenere' },
  { plain: '混合test文本', key: 'PASSWORD', id: 'vigenere' },
];

for (const s of UNICODE_SAMPLES) {
  const cipher = s.key
    ? encrypt(s.id, s.plain, { key: s.key })
    : encrypt(s.id, s.plain, { shift: s.shift });
  cases.push({
    input: cipher,
    expectIdAny: [s.id, 'vigenere', 'unicode-cp-caesar', 'unicode-cp-vigenere', 'caesar'],
    expectResult: s.plain,
  });
}

cases.push({
  input: U.unicodeCpDecimalEncode('你好'),
  expectId: 'unicode-cp-decimal',
  expectResult: '你好',
});

let passed = 0;
let failed = 0;

for (const c of cases) {
  const results = identify(c.input, { limit: 10 });
  const r = c.expectAnyResultContains
    ? results.find((x) => (x.result || '').toLowerCase().includes(c.expectAnyResultContains.toLowerCase()))
    : (c.expectResult && results.find((x) => x.result === c.expectResult)) || results[0];
  try {
    assert.ok(r, `no result for ${String(c.input).slice(0, 30)}`);
    if (c.expectAnyId) {
      assert.ok(c.expectAnyId.includes(r.id), `${String(c.input).slice(0, 20)}: got ${r.id}`);
    } else if (c.expectIdAny) {
      assert.ok(c.expectIdAny.includes(r.id), `${String(c.input).slice(0, 20)}: got ${r.id}, want ${c.expectIdAny.join('|')}`);
    } else if (c.expectId) {
      assert.strictEqual(r.id, c.expectId, `${String(c.input).slice(0, 20)}: got ${r?.id}`);
    }
    if (c.expectResult) {
      assert.strictEqual(r.result, c.expectResult);
    }
    if (c.expectResultContains) {
      assert.ok(
        (r.result || '').toUpperCase().includes(c.expectResultContains.toUpperCase()),
        `expected contains ${c.expectResultContains}, got ${r.result}`,
      );
    }
    console.log('PASS', String(c.input).slice(0, 36), '→', r.name, (r.result || '').slice(0, 24));
    passed++;
  } catch (e) {
    console.error('FAIL', String(c.input).slice(0, 36), '→', r?.name, r?.result, e.message);
    failed++;
  }
}

// roundtrip
assert.strictEqual(S.a1z26Decode(S.a1z26Encode('JOURNAL', '-')), 'JOURNAL');
assert.strictEqual(E.atbash('GIFHG ML LMV'), 'TRUST NO ONE');
assert.strictEqual(E.caesar('PHHW PH', -3), 'MEET ME');
assert.strictEqual(E.caesar('URYYB', -13), 'HELLO');
assert.strictEqual(E.hexDecode('68656c6c6f'), 'hello');
assert.strictEqual(decrypt('unicode-cp-caesar', encrypt('unicode-cp-caesar', '你好', { shift: 200 }), { shift: 200 }), '你好');
assert.strictEqual(decrypt('unicode-cp-vigenere', encrypt('unicode-cp-vigenere', '测试', { key: '密钥' }), { key: '密钥' }), '测试');
assert.strictEqual(U.unicodeCpDecimalDecode(U.unicodeCpDecimalEncode('日本語')), '日本語');
console.log('PASS roundtrips + unicode');
passed++;

console.log(`\n${passed}/${cases.length + 1} passed${failed ? ` (${failed} failed)` : ''}`);
process.exit(failed === 0 ? 0 : 1);
