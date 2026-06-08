#!/usr/bin/env node
/**
 * 文件加解密 CLI
 * node scripts/cipher-file.mjs -i in.txt -o out.txt --cipher caesar --encrypt --shift 3
 */
import { cipherFile } from '../src/services/fileCipher.js';

function usage() {
  console.log(`用法:
  node scripts/cipher-file.mjs -i <输入> -o <输出> --cipher <id> [--encrypt|--decrypt] [--key 密钥] [--shift N]

示例:
  node scripts/cipher-file.mjs -i plain.txt -o enc.txt --cipher caesar --encrypt --shift 3
  node scripts/cipher-file.mjs -i enc.txt -o plain.txt --cipher caesar --decrypt --shift 3`);
}

const args = process.argv.slice(2);
const opts = { params: {}, mode: 'encrypt' };
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '-i') opts.inputPath = args[++i];
  else if (a === '-o') opts.outputPath = args[++i];
  else if (a === '--cipher') opts.cipherId = args[++i];
  else if (a === '--encrypt') opts.mode = 'encrypt';
  else if (a === '--decrypt') opts.mode = 'decrypt';
  else if (a === '--shift') opts.params.shift = Number(args[++i]);
  else if (a === '--key') opts.params.key = args[++i];
  else if (a === '--rails') opts.params.rails = Number(args[++i]);
  else if (a === '-h' || a === '--help') { usage(); process.exit(0); }
}

if (!opts.inputPath || !opts.outputPath || !opts.cipherId) {
  usage();
  process.exit(1);
}

const stat = cipherFile(opts);
console.log(`${stat.mode} ${stat.cipherId}: ${stat.bytesIn} → ${stat.bytesOut} 字节`);
