/**
 * 文本分析 + JWT 解码
 */
import { analyzeText, kasiskiKeyLengths } from './src/services/textAnalysis.js';
import { encrypt, decrypt } from './src/ciphers/registry.js';
import { identify } from './src/services/identifier.js';

let passed = 0;
let failed = 0;

function ok(name, cond) {
  if (cond) { passed++; console.log(`PASS ${name}`); }
  else { failed++; console.error(`FAIL ${name}`); }
}

const sample = 'KHOOR ZRUOG';
const a = analyzeText(sample);
ok('entropy', a.entropy > 0);
ok('ic mono', a.indexOfCoincidence != null && a.indexOfCoincidence > 0.04);
ok('hints', a.hints.length >= 1);
ok('frequencies', a.frequencies.length >= 3);

const jwtSample = encrypt('jwt', '{"sub":"user123","name":"Test"}', {});
ok('jwt roundtrip', decrypt('jwt', jwtSample, {}).includes('user123'));

const jwtTop = identify(jwtSample, { limit: 3 });
ok('jwt identify', jwtTop[0]?.id === 'jwt');

const bct = encrypt('bifid', 'HELLO', { key: 'KEYWORD' });
ok('bifid roundtrip', decrypt('bifid', bct, { key: 'KEYWORD' }) === 'HELLO');
ok('bifid identify', identify(bct, { limit: 3 })[0]?.id === 'bifid');

const tct = encrypt('trifid', 'HELLO', { key: 'KEYWORD' });
ok('trifid roundtrip', decrypt('trifid', tct, { key: 'KEYWORD' }) === 'HELLO');
ok('trifid identify', identify(tct, { limit: 3 })[0]?.id === 'trifid');

const fsct = encrypt('four-square', 'HELLO', { key1: 'KEYWORD', key2: 'SECRET' });
ok('four-square roundtrip', decrypt('four-square', fsct, { key1: 'KEYWORD', key2: 'SECRET' }) === 'HELLO');
ok('four-square identify', identify(fsct, { limit: 3 })[0]?.id === 'four-square');

const kas = kasiskiKeyLengths('KHOORYDSSZOTGKFEZUSKABCDEFGHIJKLMNOP');
ok('kasiski', kas.length > 0 && kas[0].period >= 2);

console.log(`\n${passed}/${passed + failed} passed`);
process.exit(failed ? 1 : 0);
