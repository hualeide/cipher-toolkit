import assert from 'node:assert/strict';
import { semaphoreEncode, semaphoreDecode } from './src/ciphers/specialCiphers.js';

const enc = semaphoreEncode('HI');
assert.ok(enc.includes(' '), 'semaphore groups spaced');
const dec = semaphoreDecode(enc);
assert.equal(dec, 'HI', `roundtrip HI got ${dec}`);

const dec2 = semaphoreDecode(semaphoreEncode('CTF'));
assert.equal(dec2, 'CTF', 'roundtrip CTF');

console.log('test-semaphore: ok');
