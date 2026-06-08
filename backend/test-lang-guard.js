import assert from 'assert';
import { encrypt, decrypt } from './src/ciphers/registry.js';
import { LangNotSupportedError } from './src/ciphers/langSupport.js';

const ZH = '你好';
const JA = 'こんにちは';
const KO = '안녕';

const MUST_REJECT = ['playfair', 'rot47', 'a1z26', 'leet'];
const MUST_ALLOW = ['caesar', 'rot13', 'base64', 'aes-256-cbc', 'rail-fence', 'reverse', 'morse'];

let passed = 0;

for (const id of MUST_REJECT) {
  try {
    encrypt(id, ZH, {});
    assert.fail(`${id} should reject Chinese`);
  } catch (e) {
    assert.ok(e instanceof LangNotSupportedError, `${id}: ${e.message}`);
    passed++;
    console.log('PASS reject zh →', id);
  }
}

for (const id of MUST_ALLOW) {
  assert.doesNotThrow(() => encrypt(id, ZH, {}), id);
  passed++;
  console.log('PASS allow zh →', id);
}

assert.throws(() => encrypt('morse', JA, {}), LangNotSupportedError);
assert.throws(() => encrypt('morse', KO, {}), LangNotSupportedError);
passed += 2;
console.log('PASS reject ja/ko → morse');

const enc = encrypt('caesar', ZH, { shift: 3 });
assert.strictEqual(decrypt('caesar', enc, { shift: 3 }), ZH);
passed++;
console.log('PASS caesar roundtrip after guard');

const morseZh = encrypt('morse', '你好', {});
assert.ok(morseZh.includes(' / '), 'morse zh uses segment separator');
assert.strictEqual(decrypt('morse', morseZh, {}), '你好');
passed++;
console.log('PASS morse zh telegraph roundtrip:', morseZh.slice(0, 40) + '…');

console.log(`\n语言校验自测: ${passed} 通过`);
