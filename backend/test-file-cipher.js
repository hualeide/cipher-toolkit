import assert from 'assert';
import { writeFileSync, readFileSync, unlinkSync, mkdtempSync } from 'fs';
import path from 'path';
import { tmpdir } from 'os';
import { cipherFile } from './src/services/fileCipher.js';
import { encrypt } from './src/ciphers/registry.js';

const dir = mkdtempSync(path.join(tmpdir(), 'cipher-file-'));
const plainPath = path.join(dir, 'plain.txt');
const encPath = path.join(dir, 'enc.txt');
const decPath = path.join(dir, 'dec.txt');
const plain = '文件加密测试 — cipher-toolkit';

writeFileSync(plainPath, plain, 'utf8');

cipherFile({ inputPath: plainPath, outputPath: encPath, cipherId: 'caesar', mode: 'encrypt', params: { shift: 5 } });
const enc = readFileSync(encPath, 'utf8');
assert.notStrictEqual(enc, plain);
assert.strictEqual(encrypt('caesar', plain, { shift: 5 }), enc);

cipherFile({ inputPath: encPath, outputPath: decPath, cipherId: 'caesar', mode: 'decrypt', params: { shift: 5 } });
assert.strictEqual(readFileSync(decPath, 'utf8'), plain);

for (const f of [plainPath, encPath, decPath]) unlinkSync(f);
console.log('file-cipher 全部通过');
