/** 从算法定义取默认参数 */
export function buildDefaultParams(cipher) {
  if (!cipher?.params?.length) return {};
  const defaults = {};
  cipher.params.forEach((p) => {
    if (p.default !== undefined) defaults[p.name] = p.default;
  });
  return defaults;
}

/** 合并 UI 参数与默认值（空数字字段不会变成 0） */
export function resolveParams(cipher, params) {
  const defaults = buildDefaultParams(cipher);
  const merged = { ...defaults, ...params };
  for (const p of cipher?.params || []) {
    const v = merged[p.name];
    if (p.type === 'number' && (v === '' || v === null || v === undefined || Number.isNaN(Number(v)))) {
      merged[p.name] = defaults[p.name] ?? p.min ?? 0;
    }
  }
  return merged;
}
