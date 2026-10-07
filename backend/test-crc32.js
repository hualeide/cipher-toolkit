import assert from 'node:assert/strict';
import test from 'node:test';
import { crc32 } from './src/ciphers/cryptoModern.js';
import { encrypt, decrypt } from './src/ciphers/registry.js';

/** Python zlib.crc32(text.encode('utf-8'))，固定向量，不在测试里现算。 */
const VECTORS = [
  ['', '00000000'],
  ['123456789', 'cbf43926'],
  ['中文', '5a09ed37'],
  ['é', '0e048d3e'],
  ['\0\u00ff', '4448f382'],
  ['😀', '054db544'],
  ['A中文😀Z', 'eb0d6065'],
];

for (const [text, hex] of VECTORS) {
  test(`crc32 ${JSON.stringify(text)}`, () => {
    assert.equal(crc32(text), hex);
    assert.equal(encrypt('crc32', text), hex);
  });
}

test('registry crc32 decrypt 不可逆', () => {
  assert.throws(() => decrypt('crc32', 'cbf43926'), /CRC32 不可逆/);
});
