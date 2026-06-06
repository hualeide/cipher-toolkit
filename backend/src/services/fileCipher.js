/**
 * 文件加解密 — 按 cipher id + params 处理二进制/文本文件
 */
import { readFileSync, writeFileSync } from 'fs';
import { encrypt, decrypt } from '../ciphers/registry.js';

export function cipherFile({ inputPath, outputPath, cipherId, mode = 'encrypt', params = {}, encoding = 'utf8' }) {
  if (!inputPath || !outputPath) throw new Error('需要 inputPath 与 outputPath');
  if (!cipherId) throw new Error('需要 cipherId');
  const buf = readFileSync(inputPath);
  const text = buf.toString(encoding);
  const fn = mode === 'decrypt' ? decrypt : encrypt;
  const result = fn(cipherId, text, params);
  writeFileSync(outputPath, result, encoding);
  return { bytesIn: buf.length, bytesOut: Buffer.byteLength(result, encoding), mode, cipherId };
}
