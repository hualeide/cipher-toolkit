/**
 * 中文短密文 / 网络口语识别（码点凯撒等）
 */
import { identify } from './src/services/identifier.js';
import { encrypt } from './src/ciphers/registry.js';
import { slangSize } from './src/ciphers/slangCorpus.js';

let passed = 0;
let failed = 0;

function ok(name, cond) {
  if (cond) { passed++; console.log(`PASS ${name}`); }
  else { failed++; console.error(`FAIL ${name}`); }
}

console.log(`口语库: ${slangSize()} 条\n`);

const plain = '几把';
const ct = encrypt('unicode-cp-caesar', plain, { shift: 88 });
ok('encrypt roundtrip', ct === '券拢');

const hits = identify(ct, { limit: 5 });
const top = hits[0];
ok('identify top id', top?.id === 'unicode-cp-caesar');
ok('identify shift 88', top?.params?.shift === 88);
ok('identify result', top?.result === plain);
ok('identify verified', top?.verified === true);
ok('identify confidence', (top?.confidence ?? 0) >= 85);

console.log(`\n${passed}/${passed + failed} passed`);
if (failed) process.exit(1);
