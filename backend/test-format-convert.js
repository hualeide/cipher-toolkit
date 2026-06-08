import assert from 'assert';
import { formatConvert, listFormats } from './src/services/formatConvert.js';
import { encrypt, decrypt } from './src/ciphers/registry.js';

assert.deepStrictEqual(listFormats(), ['text', 'hex', 'base64', 'binary']);

const plain = '你好 Cipher';
const hex = formatConvert(plain, 'text', 'hex');
assert.ok(hex.includes(' '));
assert.strictEqual(formatConvert(hex, 'hex', 'text'), plain);

const b64 = formatConvert(plain, 'text', 'base64');
assert.strictEqual(formatConvert(b64, 'base64', 'text'), plain);

const bin = formatConvert('Hi', 'text', 'binary');
assert.strictEqual(formatConvert(bin, 'binary', 'text'), 'Hi');

const chained = formatConvert(formatConvert(plain, 'text', 'hex'), 'hex', 'base64');
assert.strictEqual(formatConvert(chained, 'base64', 'hex'), formatConvert(plain, 'text', 'hex'));

const viaRegistry = encrypt('format-convert', plain, { from: 'text', to: 'hex' });
assert.strictEqual(decrypt('format-convert', viaRegistry, { from: 'text', to: 'hex' }), plain);

console.log('format-convert 全部通过');
