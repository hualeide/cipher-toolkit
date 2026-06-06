const BASE = '/api/media';

async function postForm(path, formData) {
  const res = await fetch(`${BASE}${path}`, { method: 'POST', body: formData });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || '处理失败');
  return data;
}

export async function mirageTank(whiteFile, blackFile, opts = {}) {
  const fd = new FormData();
  fd.append('whiteImage', whiteFile);
  fd.append('blackImage', blackFile);
  if (opts.size) fd.append('size', String(opts.size));
  if (opts.colorBoost) fd.append('colorBoost', String(opts.colorBoost));
  return postForm('/mirage-tank', fd);
}

export async function blendImages(baseFile, topFile, opts = {}) {
  const fd = new FormData();
  fd.append('baseImage', baseFile);
  fd.append('topImage', topFile);
  Object.entries(opts).forEach(([k, v]) => fd.append(k, String(v)));
  return postForm('/blend', fd);
}

export async function embedImage(baseFile, insertFile, opts = {}) {
  const fd = new FormData();
  fd.append('baseImage', baseFile);
  fd.append('insertImage', insertFile);
  Object.entries(opts).forEach(([k, v]) => fd.append(k, String(v)));
  return postForm('/embed', fd);
}

export async function convertFile(file, format, quality) {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('format', format);
  if (quality) fd.append('quality', String(quality));
  return postForm('/convert', fd);
}

export async function upscaleImage(file, scale, denoiseFirst) {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('scale', String(scale));
  if (denoiseFirst) fd.append('denoiseFirst', 'true');
  return postForm('/upscale', fd);
}

export async function denoiseImage(file, strength) {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('strength', String(strength));
  return postForm('/denoise', fd);
}

export async function fetchFormats() {
  const res = await fetch(`${BASE}/formats`);
  return res.json();
}

export async function fetchBlendModes() {
  const res = await fetch(`${BASE}/blend-modes`);
  return res.json();
}
