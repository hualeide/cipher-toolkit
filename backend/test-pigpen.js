import assert from 'node:assert/strict';
import { pigpenEncode, pigpenDecode } from './src/ciphers/specialCiphers.js';

const sym = pigpenEncode('HELLO');
assert.equal(sym, 'HELLO', 'encode uppercase letters');
assert.equal(pigpenDecode(sym), 'HELLO', 'letter roundtrip');
assert.equal(pigpenDecode('C2 B2 D3 D3 E3'), 'HELLO', 'legacy coords');

console.log('test-pigpen: ok', sym);
