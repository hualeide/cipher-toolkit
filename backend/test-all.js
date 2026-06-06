/**
 * 全模块测试入口
 */
import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const node = process.execPath;

const suites = [
  { name: '密码识别', file: 'test-identify.js' },
  { name: '识别置信度', file: 'test-identify-confidence.js' },
  { name: '识别打磨', file: 'test-identify-polish.js' },
  { name: '中文口语识别', file: 'test-identify-zh-slang.js' },
  { name: '文本分析', file: 'test-text-analysis.js' },
  { name: '识别回环', file: 'test-identify-roundtrip.js' },
  // 慢测：node test-identify-bible-zh.js（和合本全文，约数小时）
  { name: '摩斯中英', file: 'test-morse-zh.js' },
  { name: '多语言加密', file: 'test-multilingual.js' },
  { name: '语言校验', file: 'test-lang-guard.js' },
  { name: '全算法中文', file: 'test-chinese-all.js' },
  { name: '算法示例', file: 'test-examples.js' },
  { name: '多媒体处理', file: 'test-media.js' },
  { name: '格式转换', file: 'test-format-convert.js' },
  { name: '文件加密', file: 'test-file-cipher.js' },
  { name: 'LSB 藏文', file: 'test-stego-lsb.js' },
  // 慢测：node test-identify-classic-zh.js（四大名著，需先 fetch-classics-zh）
];

let allOk = true;
console.log('══════════════════════════════════════');
console.log('  Cipher Toolkit 全模块自测');
console.log('══════════════════════════════════════\n');

for (const s of suites) {
  console.log(`▶ ${s.name} (${s.file})`);
  const r = spawnSync(node, [path.join(__dir, s.file)], { stdio: 'inherit', cwd: __dir });
  if (r.status !== 0) {
    allOk = false;
    console.error(`✗ ${s.name} 失败\n`);
  } else {
    console.log(`✓ ${s.name} 通过\n`);
  }
}

console.log('══════════════════════════════════════');
console.log(allOk ? '全部模块通过' : '存在失败模块');
process.exit(allOk ? 0 : 1);
