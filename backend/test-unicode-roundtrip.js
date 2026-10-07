import assert from 'node:assert/strict';
import * as E from './src/ciphers/engine.js';
import { rc4 } from './src/ciphers/cryptoModern.js';
import { encrypt, decrypt } from './src/ciphers/registry.js';
import { formatConvert } from './src/services/formatConvert.js';

const SAMPLES = ['', 'ASCII', '中文', '\u{1F600}', 'A中\u{1F600}b'];

function round(label, fn) {
  for (const plain of SAMPLES) {
    assert.equal(fn(plain), plain, `${label} «${plain}»`);
  }
}

round('formatConvert binary', (t) => formatConvert(formatConvert(t, 'text', 'binary'), 'binary', 'text'));
round('engine binary', (t) => E.binaryDecode(E.binaryEncode(t)));
round('registry binary', (t) => decrypt('binary', encrypt('binary', t)));
round('engine octal', (t) => E.octalDecode(E.octalEncode(t)));
round('registry octal', (t) => decrypt('octal', encrypt('octal', t)));
round('engine hex', (t) => E.hexDecode(E.hexEncode(t)));
round('registry hex', (t) => decrypt('hex', encrypt('hex', t)));
round('rc4', (t) => rc4(rc4(t, 'secret'), 'secret'));
round('registry rc4', (t) => decrypt('rc4', encrypt('rc4', t, { key: 'secret' }), { key: 'secret' }));

assert.equal(E.hexDecode('100000'), String.fromCharCode(0x10, 0x00, 0x00), '100000 仍是三字节');
assert.equal(E.hexDecode('10ffff'), String.fromCharCode(0x10, 0xff, 0xff), '10ffff 仍是三字节');
assert.equal(E.hexEncode('Hi'), '48 69');
assert.equal(E.hexEncode('中文'), '4e2d 6587');
assert.equal(E.binaryEncode('Hi'), '01001000 01101001');
assert.equal(E.octalEncode('Hi'), '110 151');
assert.equal(rc4('Hi', 'secret'), '\xa5_');

for (const plain of ['\u{10000}', '\u{100000}', '\u{10FFFF}', 'A\u{10000}中\u{100000}\u{10FFFF}']) {
  assert.equal(E.hexEncode('\u{10000}').includes(' '), true);
  const enc = E.hexEncode(plain);
  assert.ok(enc.split(' ').every((p) => p.length === 2 || p.length === 4), `hex 码元宽度 ${enc}`);
  assert.equal(E.hexDecode(enc), plain, `hex «${plain}»`);
  assert.equal(decrypt('hex', encrypt('hex', plain)), plain);
}
assert.equal(E.hexEncode('\u{10000}'), 'd800 dc00');
assert.equal(E.hexEncode('\u{100000}'), 'dbc0 dc00');
assert.equal(E.hexEncode('\u{10FFFF}'), 'dbff dfff');

console.log('unicode roundtrip ok', SAMPLES.length);
