import assert from 'assert';
import sharp from 'sharp';
import { embedLsbText, extractLsbText } from './src/services/imageProcess.js';

async function solidPng(w, h) {
  const buf = Buffer.alloc(w * h * 3);
  for (let i = 0; i < w * h; i++) {
    buf[i * 3] = 120;
    buf[i * 3 + 1] = 80;
    buf[i * 3 + 2] = 200;
  }
  return sharp(buf, { raw: { width: w, height: h, channels: 3 } }).png().toBuffer();
}

const img = await solidPng(256, 256);
const messages = ['hello', '密码学工具箱 LSB', '红楼梦：满纸荒唐言，一把辛酸泪。'];

for (const msg of messages) {
  const stego = await embedLsbText(img, msg);
  const out = await extractLsbText(stego);
  assert.strictEqual(out, msg);
}

console.log('LSB 藏文 全部通过');
