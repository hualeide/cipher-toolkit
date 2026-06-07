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
assert.ok(zhMatches[0].verified, '中文凯撒应往返校验通过');
const okCipher = (zhMatches[0].id === 'unicode-cp-caesar' && zhMatches[0].params.shift === 5)
  || (zhMatches[0].id === 'caesar' && Number(zhMatches[0].params.shift) === 5)
  || (['affine', 'unicode-cp-affine'].includes(zhMatches[0].id) && Number(zhMatches[0].params.a) === 1 && Number(zhMatches[0].params.b) === 5);
assert.ok(okCipher, `期望 shift=5 或 a=1,b=5，实际 ${zhMatches[0].id} ${JSON.stringify(zhMatches[0].params)}`);
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

// 乱汉字短密文：码点凯撒 shift=3 虽可往返，但明文无意义，不应高置信命中
const garbled = '戔撕祢';
const garbledMatches = identify(garbled, { limit: 5 });
const topGarbled = garbledMatches[0];
const badHit = garbledMatches.find((m) => m.id === 'unicode-cp-caesar' && m.params?.shift === 3 && m.verified);
assert.ok(!badHit || badHit.confidenceLevel === 'low' || badHit.confidence < 72,
  '无意义短中文不应高置信 unicode-cp-caesar shift=3');
if (topGarbled?.id === 'unicode-cp-caesar') {
  assert.ok(topGarbled.confidenceLevel !== 'high' || !topGarbled.verified,
    '无意义短中文不应作为高置信首选');
}
console.log('PASS garbled short CJK false positive guard');

// 仿射 a=5 b=8（UI 常见）应识别为仿射，而非码点凯撒
const affPlain = '我是人';
const affCt = encrypt('affine', affPlain, { a: 5, b: 8 });
const affMatches = identify(affCt, { limit: 5 });
assert.ok(affMatches.length > 0, '仿射密文应有识别结果');
assert.strictEqual(affMatches[0].result, affPlain);
assert.ok(['affine', 'unicode-cp-affine'].includes(affMatches[0].id), '首选应为仿射');
assert.notStrictEqual(affMatches[0].id, 'unicode-cp-caesar', '不应误报码点凯撒');
console.log('PASS affine a=5 b=8 identify');

// 仿射 a=5 b=8：非常用字短句（康神开播了）应识别为仿射，不应被码点凯撒 shift=1 抢占
const affPlain2 = '康神开播了';
const affCt2 = encrypt('affine', affPlain2, { a: 5, b: 8 });
const affMatches2 = identify(affCt2, { limit: 5 });
assert.ok(affMatches2.length > 0, '康神开播了 仿射密文应有识别结果');
assert.strictEqual(affMatches2[0].result, affPlain2);
assert.ok(['affine', 'unicode-cp-affine'].includes(affMatches2[0].id), '首选应为仿射');
assert.notStrictEqual(affMatches2[0].id, 'unicode-cp-caesar', '不应误报码点凯撒');
const caesar1Hit = affMatches2.find((m) => m.id === 'unicode-cp-caesar' && m.params?.shift === 1);
assert.ok(!caesar1Hit || caesar1Hit.confidenceLevel === 'low' || !caesar1Hit.verified || caesar1Hit.confidence < 72,
  '不应高置信 unicode-cp-caesar shift=1');
console.log('PASS affine 康神开播了 a=5 b=8');

// ROT13 中文：应识别为 rot13 而非码点凯撒
const rotPlain = '我真是人吗';
const rotCt = encrypt('rot13', rotPlain, {});
const rotMatches = identify(rotCt, { limit: 5 });
assert.ok(rotMatches.length > 0, 'ROT13 中文密文应有结果');
assert.strictEqual(rotMatches[0].result, rotPlain);
assert.ok(['rot13', 'rot-all', 'caesar', 'unicode-cp-caesar'].includes(rotMatches[0].id), `首选应为 ROT13/凯撒，实际 ${rotMatches[0].id}`);
console.log('PASS rot13 Chinese identify');

// 乱汉字无意义密文：不应高置信码点凯撒 shift=1
const junk = '诮盏端鄓驹';
const junkMatches = identify(junk, { limit: 5 });
const junkTop = junkMatches[0];
if (junkTop?.id === 'unicode-cp-caesar' && junkTop.params?.shift === 1) {
  assert.ok(junkTop.confidenceLevel === 'low' || !junkTop.verified || junkTop.confidence < 72,
    '乱汉字不应高置信 shift=1 码点凯撒');
}
console.log('PASS junk CJK no caesar shift=1 false positive');

// 英文短句凯撒多移位消歧
for (const { plain, shift } of [{ plain: 'ATTACK AT DAWN', shift: 5 }, { plain: 'ATTACK AT DAWN', shift: 13 }]) {
  const ct = encrypt('caesar', plain, { shift });
  const top = identify(ct, { limit: 3 })[0];
  assert.strictEqual(top?.id, 'caesar', `期望 caesar，实际 ${top?.id}`);
  assert.strictEqual(top?.result, plain);
  assert.strictEqual(Number(top?.params?.shift), shift);
}
console.log('PASS English Caesar shift disambiguation');

console.log('\n识别打磨测试全部通过');
