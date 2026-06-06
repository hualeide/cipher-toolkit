/**
 * 识别置信度分级测试
 */
import assert from 'assert';
import { encrypt } from './src/ciphers/registry.js';
import { identify, finalizeIdentifyResults } from './src/services/identifier.js';

const plain = '代码，轻而易举啊';
const cipher = encrypt('unicode-cp-caesar', plain, { shift: 5 });
const matches = identify(cipher, { limit: 5 });

assert.ok(matches.length >= 1, '应有识别结果');
assert.ok(['unicode-cp-caesar', 'caesar'].includes(matches[0].id));
assert.strictEqual(matches[0].params.shift, 5);
assert.strictEqual(matches[0].result, plain);
assert.ok(matches[0].confidenceLevel, '应有 confidenceLevel');
assert.ok(['high', 'medium', 'low'].includes(matches[0].confidenceLevel));
assert.ok(typeof matches[0].scoreGap === 'number');

const meta = finalizeIdentifyResults([
  { id: 'a', score: 100, confidence: 95, alreadyPlaintext: false },
  { id: 'b', score: 70, confidence: 70, alreadyPlaintext: false },
]);
assert.strictEqual(meta[0].confidenceLevel, 'high');

console.log('PASS identify confidence:', matches[0].confidenceLevel, 'gap', matches[0].scoreGap);
