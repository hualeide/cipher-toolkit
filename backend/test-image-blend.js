import assert from 'node:assert/strict';
import test from 'node:test';
import sharp from 'sharp';
import { blendImages, embedImage } from './src/services/imageProcess.js';

async function solid(w, h, rgb) {
  const buf = Buffer.alloc(w * h * 3);
  for (let i = 0; i < w * h; i++) {
    buf[i * 3] = rgb[0];
    buf[i * 3 + 1] = rgb[1];
    buf[i * 3 + 2] = rgb[2];
  }
  return sharp(buf, { raw: { width: w, height: h, channels: 3 } }).png().toBuffer();
}

async function pixels(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data: Buffer.from(data), width: info.width, height: info.height };
}

function at(p, x, y) {
  const i = (y * p.width + x) * 4;
  return [p.data[i], p.data[i + 1], p.data[i + 2], p.data[i + 3]];
}

/** 上层 alpha 先乘 opacity，再按所选模式合成一次。 */
async function sharpBlend(base, top, mode, opacity) {
  let input = await sharp(top).resize(16, null, { fit: 'inside' }).ensureAlpha().toBuffer();
  if (opacity < 1) {
    input = await sharp(input).ensureAlpha().linear([1, 1, 1, opacity], [0, 0, 0, 0]).toBuffer();
  }
  return sharp(base)
    .composite([{ input, left: 0, top: 0, blend: mode === 'normal' ? 'over' : mode }])
    .png()
    .toBuffer();
}

const baseP = solid(32, 32, [70, 120, 180]);
const topP = solid(16, 16, [180, 100, 60]);

test('blend 默认 opacity 等于显式 0.85，且是 sharp 参考像素', async () => {
  const [base, top] = await Promise.all([baseP, topP]);
  const omitted = await pixels(await blendImages(base, top, { mode: 'over', scale: 1, x: 0, y: 0 }));
  const explicit = await pixels(await blendImages(base, top, { mode: 'over', scale: 1, x: 0, y: 0, opacity: 0.85 }));
  const ref = await pixels(await sharpBlend(base, top, 'over', 0.85));
  assert.deepEqual(at(omitted, 0, 0), at(explicit, 0, 0));
  assert.deepEqual(omitted.data, explicit.data);
  assert.deepEqual(at(omitted, 0, 0), at(ref, 0, 0));
  assert.deepEqual(omitted.data, ref.data);
});

test('blend opacity 0 不改变底图，1 按模式全强度合成', async () => {
  const [base, top] = await Promise.all([baseP, topP]);
  const basePx = await pixels(base);
  for (const mode of ['over', 'multiply', 'screen']) {
    const zero = await pixels(await blendImages(base, top, { mode, scale: 1, x: 0, y: 0, opacity: 0 }));
    assert.deepEqual(zero.data, basePx.data, mode);
    const full = await pixels(await blendImages(base, top, { mode, scale: 1, x: 0, y: 0, opacity: 1 }));
    const ref = await pixels(await sharpBlend(base, top, mode, 1));
    assert.deepEqual(at(full, 0, 0), at(ref, 0, 0), mode);
    assert.deepEqual(full.data, ref.data, mode);
  }
});

test('blend opacity 0.5 的 over/multiply/screen/normal 等于 sharp 参考', async () => {
  const [base, top] = await Promise.all([baseP, topP]);
  const modes = ['over', 'multiply', 'screen', 'normal'];
  const got = {};
  for (const mode of modes) {
    const actual = await pixels(await blendImages(base, top, { mode, scale: 1, x: 0, y: 0, opacity: 0.5 }));
    const refMode = mode === 'normal' ? 'over' : mode;
    const ref = await pixels(await sharpBlend(base, top, refMode, 0.5));
    assert.deepEqual(at(actual, 0, 0), at(ref, 0, 0), mode);
    assert.deepEqual(actual.data, ref.data, mode);
    got[mode] = at(actual, 0, 0);
  }
  assert.deepEqual(got.normal, got.over);
  assert.notDeepEqual(got.multiply, got.over);
  assert.notDeepEqual(got.screen, got.over);
});

test('embed 默认 opacity 等于显式 0.92', async () => {
  const [base, top] = await Promise.all([baseP, topP]);
  const omitted = await pixels(await embedImage(base, top, {}));
  const explicit = await pixels(await embedImage(base, top, { opacity: 0.92 }));
  assert.deepEqual(at(omitted, 16, 16), at(explicit, 16, 16));
  assert.deepEqual(omitted.data, explicit.data);
});

test('embed opacity 0 底图不变，opacity 1 可合成', async () => {
  const [base, top] = await Promise.all([baseP, topP]);
  const basePx = await pixels(base);
  const zero = await pixels(await embedImage(base, top, { opacity: 0, feather: 1 }));
  assert.deepEqual(zero.data, basePx.data);
  const full = await pixels(await embedImage(base, top, { opacity: 1, feather: 1, position: 'custom', x: 0, y: 0 }));
  assert.notDeepEqual(at(full, 0, 0).slice(0, 3), [70, 120, 180]);
});

async function jpegSolid(w, h, rgb) {
  const buf = Buffer.alloc(w * h * 3);
  for (let i = 0; i < w * h; i++) {
    buf[i * 3] = rgb[0];
    buf[i * 3 + 1] = rgb[1];
    buf[i * 3 + 2] = rgb[2];
  }
  return sharp(buf, { raw: { width: w, height: h, channels: 3 } }).jpeg().toBuffer();
}

async function checker(w, h) {
  const buf = Buffer.alloc(w * h * 3);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const on = ((x >> 2) ^ (y >> 2)) & 1;
      const i = (y * w + x) * 3;
      buf[i] = on ? 240 : 20;
      buf[i + 1] = on ? 20 : 240;
      buf[i + 2] = 128;
    }
  }
  return sharp(buf, { raw: { width: w, height: h, channels: 3 } }).png().toBuffer();
}

test('jpeg 上层 blend 与同一 JPEG 解码出的 PNG 像素一致', async () => {
  const base = await baseP;
  const jpeg = await jpegSolid(16, 16, [180, 100, 60]);
  const png = await sharp(jpeg).png().toBuffer();
  const basePx = await pixels(base);
  for (const mode of ['over', 'multiply', 'screen']) {
    for (const opacity of [0, 0.5, 1, undefined]) {
      const opts = { mode, scale: 1, x: 0, y: 0 };
      if (opacity !== undefined) opts.opacity = opacity;
      const fromJpeg = await pixels(await blendImages(base, jpeg, opts));
      const fromPng = await pixels(await blendImages(base, png, opts));
      assert.deepEqual(fromJpeg.data, fromPng.data, `${mode} ${opacity}`);
      if (opacity === 0) assert.deepEqual(fromJpeg.data, basePx.data, mode);
    }
  }
});

test('jpeg 上层 embed 与同一 JPEG 解码出的 PNG 像素一致', async () => {
  const base = await baseP;
  const jpeg = await jpegSolid(16, 16, [180, 100, 60]);
  const png = await sharp(jpeg).png().toBuffer();
  const basePx = await pixels(base);
  for (const opacity of [0, 0.5, 1, undefined]) {
    const opts = opacity === undefined ? {} : { opacity };
    const fromJpeg = await pixels(await embedImage(base, jpeg, opts));
    const fromPng = await pixels(await embedImage(base, png, opts));
    assert.deepEqual(fromJpeg.data, fromPng.data, String(opacity));
    if (opacity === 0) assert.deepEqual(fromJpeg.data, basePx.data);
  }
});

test('已有 alpha 时 opacity 相乘而不是覆盖成 opacity*255', async () => {
  const base = await baseP;
  const raw = Buffer.alloc(16 * 16 * 4);
  for (let i = 0; i < 16 * 16; i++) {
    raw[i * 4] = 180;
    raw[i * 4 + 1] = 100;
    raw[i * 4 + 2] = 60;
    raw[i * 4 + 3] = 100;
  }
  const top = await sharp(raw, { raw: { width: 16, height: 16, channels: 4 } }).png().toBuffer();
  const sized = await sharp(top).resize(16, null, { fit: 'inside' }).ensureAlpha().png().toBuffer();
  const faded = await sharp(sized).ensureAlpha().linear([1, 1, 1, 0.5], [0, 0, 0, 0]).png().toBuffer();
  const srcA = (await pixels(sized)).data[3];
  const outA = (await pixels(faded)).data[3];
  assert.equal(srcA, 100);
  assert.notEqual(outA, 100);
  assert.notEqual(outA, Math.round(255 * 0.5));
  assert.ok(Math.abs(outA - srcA * 0.5) <= 1);
  const actual = await pixels(await blendImages(base, top, { mode: 'over', scale: 1, x: 0, y: 0, opacity: 0.5 }));
  const ref = await pixels(await sharp(base).composite([{ input: faded, left: 0, top: 0, blend: 'over' }]).png().toBuffer());
  assert.deepEqual(actual.data, ref.data);
});

test('feather 0 保持清晰，默认仍是 8', async () => {
  const base = await baseP;
  const board = await checker(32, 32);
  const sharpNoBlur = async () => {
    const iw = Math.round(32 * 0.45);
    const insertPng = await sharp(board).resize(iw, null, { fit: 'inside' }).ensureAlpha().png().toBuffer();
    const im = await sharp(insertPng).metadata();
    const left = Math.round((32 - im.width) / 2);
    const top = Math.round((32 - im.height) / 2);
    const faded = await sharp(insertPng).ensureAlpha().linear([1, 1, 1, 1], [0, 0, 0, 0]).png().toBuffer();
    return sharp(base).resize(32, 32).composite([{ input: faded, left, top, blend: 'over' }]).png().toBuffer();
  };
  const zero = await pixels(await embedImage(base, board, { opacity: 1, feather: 0 }));
  const omitted = await pixels(await embedImage(base, board, { opacity: 1 }));
  const eight = await pixels(await embedImage(base, board, { opacity: 1, feather: 8 }));
  const ref = await pixels(await sharpNoBlur());
  assert.deepEqual(omitted.data, eight.data);
  assert.notDeepEqual(zero.data, eight.data);
  assert.deepEqual(zero.data, ref.data);
});

test('embed custom 省略坐标居中，显式 0 留在左上', async () => {
  const [base, top] = await Promise.all([baseP, topP]);
  const center = await pixels(await embedImage(base, top, { opacity: 0.92, position: 'center' }));
  const missing = await pixels(await embedImage(base, top, { opacity: 0.92, position: 'custom' }));
  const origin = await pixels(await embedImage(base, top, { opacity: 0.92, position: 'custom', x: 0, y: 0 }));
  assert.deepEqual(missing.data, center.data);
  assert.deepEqual(at(center, 0, 0).slice(0, 3), [70, 120, 180]);
  assert.notDeepEqual(at(origin, 0, 0).slice(0, 3), [70, 120, 180]);
  assert.deepEqual(at(origin, 24, 24).slice(0, 3), [70, 120, 180]);
  assert.notDeepEqual(origin.data, center.data);
});

function pngMagic(buf) {
  assert.equal(buf.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
}

function covers(p, rgb) {
  for (let i = 0; i < p.width * p.height; i++) {
    const o = i * 4;
    if (p.data[o] !== rgb[0] || p.data[o + 1] !== rgb[1] || p.data[o + 2] !== rgb[2]) return true;
  }
  return false;
}

async function solidJpeg(w, h, rgb) {
  const buf = Buffer.alloc(w * h * 3);
  for (let i = 0; i < w * h; i++) {
    buf[i * 3] = rgb[0];
    buf[i * 3 + 1] = rgb[1];
    buf[i * 3 + 2] = rgb[2];
  }
  return sharp(buf, { raw: { width: w, height: h, channels: 3 } }).jpeg().toBuffer();
}

async function expectOnBase(buf, w, h, baseRgb) {
  pngMagic(buf);
  const p = await pixels(buf);
  assert.equal(p.width, w);
  assert.equal(p.height, h);
  assert.equal(covers(p, baseRgb), true);
}

test('极端比例与 1x1 留在底图内，覆盖可见', async () => {
  const baseRgb = [70, 120, 180];
  const topRgb = [180, 100, 60];
  const [base32, top16, shortBase, tall, wideBase, flat, tiny, chip, small, jpegTall] = await Promise.all([
    solid(32, 32, baseRgb),
    solid(16, 16, topRgb),
    solid(32, 16, baseRgb),
    solid(2, 64, topRgb),
    solid(16, 32, baseRgb),
    solid(64, 2, topRgb),
    solid(1, 1, baseRgb),
    solid(8, 8, topRgb),
    solid(8, 8, baseRgb),
    solidJpeg(2, 64, topRgb),
  ]);

  const normal = await pixels(await blendImages(base32, top16, { mode: 'over', scale: 1, opacity: 1, x: 0, y: 0 }));
  const ref = await pixels(await sharpBlend(base32, top16, 'over', 1));
  assert.deepEqual(normal.data, ref.data);

  await expectOnBase(await blendImages(shortBase, tall, { mode: 'over', scale: 0.5, opacity: 1, x: 0, y: 0 }), 32, 16, baseRgb);
  await expectOnBase(await blendImages(wideBase, flat, { mode: 'over', scale: 3, opacity: 1 }), 16, 32, baseRgb);
  await expectOnBase(await blendImages(base32, top16, { mode: 'over', scale: 3, opacity: 1 }), 32, 32, baseRgb);
  await expectOnBase(await blendImages(tiny, chip, { mode: 'over', opacity: 1 }), 1, 1, baseRgb);
  const piece = await solid(4, 4, topRgb);
  await expectOnBase(await blendImages(shortBase, jpegTall, { mode: 'over', scale: 0.5, opacity: 1 }), 32, 16, baseRgb);
  await expectOnBase(await blendImages(small, piece, { mode: 'over', scale: 1, opacity: 1, x: -20, y: 500 }), 8, 8, baseRgb);

  assert.deepEqual((await pixels(await blendImages(shortBase, tall, { mode: 'over', scale: 0.5, opacity: 0 }))).data, (await pixels(shortBase)).data);
  assert.deepEqual((await pixels(await blendImages(tiny, chip, { mode: 'over', opacity: 0 }))).data, (await pixels(tiny)).data);

  await expectOnBase(await embedImage(shortBase, tall, { scale: 0.5, opacity: 1, feather: 0 }), 32, 16, baseRgb);
  await expectOnBase(await embedImage(wideBase, flat, { opacity: 1, feather: 0 }), 16, 32, baseRgb);
  await expectOnBase(await embedImage(tiny, chip, { opacity: 1, feather: 0 }), 1, 1, baseRgb);
  await expectOnBase(await embedImage(shortBase, jpegTall, { scale: 0.5, opacity: 1, feather: 0 }), 32, 16, baseRgb);
  for (const position of ['center', 'top-left', 'bottom-right']) {
    await expectOnBase(await embedImage(small, piece, { position, opacity: 1, feather: 0 }), 8, 8, baseRgb);
  }
  await expectOnBase(await embedImage(small, piece, { position: 'custom', x: -40, y: -40, opacity: 1, feather: 0 }), 8, 8, baseRgb);
  await expectOnBase(await embedImage(small, piece, { position: 'custom', x: 999, y: 999, opacity: 1, feather: 0 }), 8, 8, baseRgb);
  assert.deepEqual((await pixels(await embedImage(shortBase, tall, { scale: 0.5, opacity: 0, feather: 0 }))).data, (await pixels(shortBase)).data);
  assert.deepEqual((await pixels(await embedImage(tiny, chip, { opacity: 0 }))).data, (await pixels(tiny)).data);
});
