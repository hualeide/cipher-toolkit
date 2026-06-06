#!/usr/bin/env node
/**
 * 格式转换 CLI — text/hex/base64/binary
 * node scripts/cipher-format.mjs -f text -t hex "你好"
 */
import { formatConvert } from '../src/services/formatConvert.js';

function usage() {
  console.log(`用法:
  node scripts/cipher-format.mjs -f <text|hex|base64|binary> -t <text|hex|base64|binary> <输入>

示例:
  node scripts/cipher-format.mjs -f text -t hex "hello"
  node scripts/cipher-format.mjs -f hex -t base64 "68656c6c6f"`);
}

const args = process.argv.slice(2);
let from = 'text';
let to = 'hex';
let input = '';

for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '-f') from = args[++i];
  else if (a === '-t') to = args[++i];
  else if (a === '-h' || a === '--help') { usage(); process.exit(0); }
  else input = a;
}

if (!input) {
  usage();
  process.exit(1);
}

process.stdout.write(formatConvert(input, from, to));
