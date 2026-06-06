/**
 * 多语言码点加密 — 各移位类算法 roundtrip 自测
 */
import assert from 'assert';
import { encrypt, decrypt } from './src/ciphers/registry.js';
import * as E from './src/ciphers/engine.js';

const PLAINS = [
  '中文', '繁體測試', 'こんにちは', '안녕', 'Hello中国', 'mixed混合text',
];

const CIPHER_CASES = [
  { id: 'caesar', params: { shift: 3 } },
  { id: 'rot13', params: {} },
  { id: 'gf-caesar3', params: { shift: 3 } },
  { id: 'atbash', params: {} },
  { id: 'vigenere', params: { key: '密钥' } },
  { id: 'vigenere', params: { key: 'KEY' } },
  { id: 'beaufort', params: { key: '密码' } },
  { id: 'autokey', params: { key: 'SECRET' } },
  { id: 'gronsfeld', params: { key: '31415' } },
  { id: 'rot-all', params: { n: 5 } },
  { id: 'unicode-cp-caesar', params: { shift: 88 } },
  { id: 'unicode-cp-vigenere', params: { key: '中文' } },
  { id: 'unicode-cp-affine', params: { a: 5, b: 7 } },
];

let passed = 0;
let failed = 0;

for (const plain of PLAINS) {
  for (const { id, params } of CIPHER_CASES) {
    const label = `${id}(${JSON.stringify(params)}) ←「${plain}」`;
    try {
      const cipher = encrypt(id, plain, params);
      assert.notStrictEqual(cipher, plain, `${label} 密文不应等于明文`);
      const back = decrypt(id, cipher, params);
      assert.strictEqual(back, plain, `${label} 往返失败: ${back}`);
      console.log('PASS', label.slice(0, 60));
      passed++;
    } catch (e) {
      console.error('FAIL', label, e.message);
      failed++;
    }
  }
}

// 英文经典用例不退化
assert.strictEqual(E.caesar('KHOOR', -3), 'HELLO');
assert.strictEqual(decrypt('caesar', encrypt('caesar', '中文', { shift: 3 }), { shift: 3 }), '中文');
console.log('PASS 英文+中文经典');
passed++;

console.log(`\n多语言自测: ${passed} 通过${failed ? `, ${failed} 失败` : ''}`);
process.exit(failed ? 1 : 0);
