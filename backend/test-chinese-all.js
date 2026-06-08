/**
 * 全算法中文自测
 * - 带 langSupport 标签：中文必须加密且往返一致
 * - 通用编码/换位/对称加密：中文处理不抛错
 * - 仅拉丁算法：中文应抛出 LangNotSupportedError
 */
import assert from 'assert';
import { registry, encrypt, decrypt } from './src/ciphers/registry.js';
import { getLangSupport, isUnicodeSafeCipher, LangNotSupportedError } from './src/ciphers/langSupport.js';

const ZH = '你好世界';
const MIX = 'Hello中国';
const SAMPLE_LINE = '全字符 ROT';

function defaultParams(cipher) {
  const p = {};
  for (const param of cipher.params || []) {
    if (param.default !== undefined) p[param.name] = param.default;
  }
  return p;
}

const SKIP_IDS = new Set(['des', '3des', 'rsa']);

let passed = 0;
let failed = 0;

for (const cipher of registry) {
  if (cipher.reversible === false || SKIP_IDS.has(cipher.id)) continue;
  const params = defaultParams(cipher);
  const langs = getLangSupport(cipher.id);
  const label = `${cipher.id} (${cipher.name})`;

  try {
    if (langs) {
      const encZh = encrypt(cipher.id, ZH, params);
      const encMix = encrypt(cipher.id, MIX, params);
      assert.notStrictEqual(encZh, ZH, '纯中文未加密');
      assert.strictEqual(decrypt(cipher.id, encZh, params), ZH, '纯中文往返失败');
      assert.notStrictEqual(encMix, MIX, '混合未加密');
      const decMix = decrypt(cipher.id, encMix, params);
      const expectMix = cipher.id === 'morse' ? 'HELLO中国' : MIX;
      assert.strictEqual(decMix, expectMix, '混合往返失败');
      const sampleOut = encrypt(cipher.id, SAMPLE_LINE, params);
      assert.notStrictEqual(sampleOut.split(' ')[0], '全字符', '「全字符」应变换');
    } else if (isUnicodeSafeCipher(cipher.id, cipher.category)) {
      const encZh = encrypt(cipher.id, ZH, params);
      const backZh = decrypt(cipher.id, encZh, params);
      assert.ok(typeof backZh === 'string', '中文解密应返回字符串');
    } else {
      assert.throws(() => encrypt(cipher.id, ZH, params), LangNotSupportedError, '应拒绝中文');
    }
    passed++;
  } catch (e) {
    failed++;
    console.error('FAIL', label, '-', e.message);
  }
}

console.log(`\n全算法中文自测: ${passed} 通过, ${failed} 失败 (多语言 ${getLangSupport('caesar') ? 15 : 0} 种须变换中文)`);
if (failed) process.exit(1);
