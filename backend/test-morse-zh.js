/**
 * 摩斯电码中英模式测试
 */
import assert from 'assert';
import { encrypt, decrypt } from './src/ciphers/registry.js';

const zh = '你好';
const en = 'HELLO';

const zhAuto = encrypt('morse', zh, {});
assert.ok(zhAuto.includes(' / '), '中文自动模式应有分段');
assert.strictEqual(decrypt('morse', zhAuto, {}), zh);

const zhForce = encrypt('morse', zh, { variant: 'zh' });
assert.strictEqual(decrypt('morse', zhForce, { variant: 'zh' }), zh);

const enIntl = encrypt('morse', en, { variant: 'intl' });
assert.ok(enIntl.includes('.-'));
assert.strictEqual(decrypt('morse', enIntl, { variant: 'intl' }), en);

console.log('PASS morse zh/en modes');
