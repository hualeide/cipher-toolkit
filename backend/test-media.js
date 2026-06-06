/**
 * 多媒体自测 — 5 轮 × 6 项功能
 */
import sharp from 'sharp';
import assert from 'assert';
import {
  createMirageTank, simulateMiragePreview, blendImages, embedImage,
  convertImage, upscaleImage, denoiseImage, getImageInfo,
} from './src/services/imageProcess.js';

async function solid(w, h, r, g, b) {
  const buf = Buffer.alloc(w * h * 3);
  for (let i = 0; i < w * h; i++) {
    buf[i * 3] = r; buf[i * 3 + 1] = g; buf[i * 3 + 2] = b;
  }
  return sharp(buf, { raw: { width: w, height: h, channels: 3 } }).png().toBuffer();
}

async function gradient(w, h) {
  const buf = Buffer.alloc(w * h * 3);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 3;
      buf[i] = Math.round((x / w) * 255);
      buf[i + 1] = Math.round((y / h) * 255);
      buf[i + 2] = 128;
    }
  }
  return sharp(buf, { raw: { width: w, height: h, channels: 3 } }).png().toBuffer();
}

async function hasColor(buf) {
  const { data, info } = await sharp(buf).raw().toBuffer({ resolveWithObject: true });
  const ch = info.channels || 3;
  let rSum = 0, gSum = 0, bSum = 0, n = 0;
  for (let i = 0; i < data.length; i += ch) {
    rSum += data[i]; gSum += data[i + 1]; bSum += data[i + 2]; n++;
  }
  const r = rSum / n, g = gSum / n, b = bSum / n;
  return Math.max(r, g, b) - Math.min(r, g, b) > 8;
}

const ROUNDS = 5;
let total = 0, passed = 0;

function pass(name) { passed++; console.log(`  ✓ ${name}`); }
function fail(name, e) { console.error(`  ✗ ${name}:`, e.message || e); }

for (let round = 1; round <= ROUNDS; round++) {
  console.log(`\n═══ 第 ${round} 轮 ═══`);
  const size = Math.max(128, 64 + round * 32);
  const whiteImg = await gradient(size, size);
  const blackImg = await solid(size, size, 30, 80, 200);
  const baseImg = await gradient(size, size);
  const insertImg = await solid(Math.round(size * 0.4), Math.round(size * 0.4), 255, 200, 50);

  // 1 彩色幻影坦克
  total++;
  try {
    const mirage = await createMirageTank(whiteImg, blackImg, { size, colorBoost: 1 + round * 0.02 });
    const info = await getImageInfo(mirage);
    assert.strictEqual(info.width, size);
    assert.strictEqual(info.height, size);
    assert.ok(await hasColor(mirage), 'mirage should be color');
    const prev = await simulateMiragePreview(mirage);
    assert.ok(prev.onWhite.length > 100 && prev.onBlack.length > 100);
    pass(`幻影坦克 ${size}px 彩色`);
  } catch (e) { fail('幻影坦克', e); }

  // 2 图片融入
  total++;
  try {
    const out = await embedImage(baseImg, insertImg, {
      scale: 0.3 + round * 0.05, opacity: 0.9, feather: round, position: round % 2 ? 'center' : 'bottom-right',
    });
    const meta = await getImageInfo(out);
    assert.ok(meta.width >= size && meta.height >= size);
    pass('图片融入');
  } catch (e) { fail('图片融入', e); }

  // 3 图层融合
  total++;
  try {
    const modes = ['overlay', 'multiply', 'screen'];
    const out = await blendImages(baseImg, insertImg, {
      mode: modes[round % 3], opacity: 0.7 + round * 0.02, scale: 0.4, x: 10, y: 10,
    });
    assert.ok(out.length > 200);
    pass(`图层融合 (${modes[round % 3]})`);
  } catch (e) { fail('图层融合', e); }

  // 4 格式互转
  total++;
  try {
    const webp = await convertImage(baseImg, 'webp', { quality: 80 + round });
    const jpeg = await convertImage(webp, 'jpeg', { quality: 85 });
    assert.ok(webp.length > 0 && jpeg.length > 0);
    pass('格式互转 webp→jpeg');
  } catch (e) { fail('格式互转', e); }

  // 5 超分
  total++;
  try {
    const small = await solid(32, 32, 100, 150, 200);
    const up = await upscaleImage(small, 2, { denoiseFirst: round % 2 === 0 });
    const before = await getImageInfo(small);
    const after = await getImageInfo(up);
    assert.strictEqual(after.width, before.width * 2);
    assert.strictEqual(after.height, before.height * 2);
    pass('超分 2×');
  } catch (e) { fail('超分', e); }

  // 6 降噪
  total++;
  try {
    const noisy = await sharp(baseImg).blur(0.8).jpeg({ quality: 30 }).toBuffer();
    const clean = await denoiseImage(noisy, Math.min(round, 5));
    assert.ok(clean.length > 100);
    pass(`降噪 强度${Math.min(round, 5)}`);
  } catch (e) { fail('降噪', e); }
}

console.log(`\n${'═'.repeat(40)}`);
console.log(`多媒体自测: ${passed}/${total} 通过 (${ROUNDS} 轮)`);
process.exit(passed === total ? 0 : 1);
