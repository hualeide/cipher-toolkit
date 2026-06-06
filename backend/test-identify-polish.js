/**
 * 识别系统打磨回归测试
 */
import assert from 'assert';
import { encrypt } from './src/ciphers/registry.js';
import { identify } from './src/services/identifier.js';
import { scoreDecryptCandidate, verifyRoundtrip } from './src/services/identifyScore.js';

// 中文凯撒 + 往返校验
const zhPlain = '代码，轻而易举啊';
const zhCipher = encrypt('unicode-cp-caesar', zhPlain, { shift: 5 });
const zhMatches = identify(zhCipher, { limit: 5 });
assert.strictEqual(zhMatches[0].result, zhPlain);
assert.strictEqual(zhMatches[0].params.shift, 5);
assert.strictEqual(zhMatches[0].verified, true, '中文凯撒应往返校验通过');
console.log('PASS 中文凯撒 verified shift=5');

// 维吉尼亚 我爱你
const vigCipher = encrypt('vigenere', '我爱你', { key: '密钥' });
const vigMatches = identify(vigCipher, { limit: 5 });
assert.ok(vigMatches.some((m) => m.result === '我爱你'), '应识别出我爱你');
console.log('PASS 维吉尼亚 我爱你');

// 摩斯
const morseCipher = encrypt('morse', '你好', {});
const morseMatches = identify(morseCipher, { limit: 3 });
assert.ok(morseMatches[0]?.id === 'morse' && morseMatches[0].result === '你好');
console.log('PASS 中文摩斯');

// 英文摩斯
const morseEn = encrypt('morse', 'HELLO', { variant: 'intl' });
const morseEnMatches = identify(morseEn, { limit: 3 });
assert.strictEqual(morseEnMatches[0].id, 'morse');
assert.strictEqual(morseEnMatches[0].result, 'HELLO');
console.log('PASS 英文摩斯');

// 十六进制
const hexMatches = identify('68656c6c6f', { limit: 3 });
assert.strictEqual(hexMatches[0].result, 'hello');
console.log('PASS hex early detect');

// 置信度字段
assert.ok(['high', 'medium', 'low'].includes(zhMatches[0].confidenceLevel));
assert.ok(typeof zhMatches[0].scoreGap === 'number');
console.log('PASS confidence meta');

// scoreDecryptCandidate 单元
const sc = scoreDecryptCandidate(zhCipher, zhPlain, { cipherId: 'unicode-cp-caesar', params: { shift: 5 } });
assert.ok(sc.score >= 50);
assert.strictEqual(sc.verified, true);
assert.ok(verifyRoundtrip('unicode-cp-caesar', zhPlain, zhCipher, { shift: 5 }));
console.log('PASS scoreDecryptCandidate');

console.log('\n识别打磨测试全部通过');
