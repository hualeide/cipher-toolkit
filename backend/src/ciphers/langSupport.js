/** 算法支持的明文/密钥语言（ISO 639-1 简码） */
export const LANG_ALL = ['en', 'zh', 'ja', 'ko'];

const MAP = {
  caesar: LANG_ALL,
  rot13: LANG_ALL,
  'rot-all': LANG_ALL,
  atbash: LANG_ALL,
  affine: LANG_ALL,
  vigenere: LANG_ALL,
  beaufort: LANG_ALL,
  autokey: LANG_ALL,
  gronsfeld: LANG_ALL,
  'gf-caesar3': LANG_ALL,
  'gf-vigenere-pines': LANG_ALL,
  'unicode-cp-decimal': LANG_ALL,
  'unicode-cp-caesar': LANG_ALL,
  'unicode-cp-vigenere': LANG_ALL,
  'unicode-cp-affine': LANG_ALL,
  'running-key': LANG_ALL,
  morse: ['en', 'zh'],
};

const SCRIPT_DETECTORS = {
  zh: /[\u4e00-\u9fff\u3400-\u4dbf\uff00-\uffef]/,
  ja: /[\u3040-\u30ff]/,
  ko: /[\uac00-\ud7af]/,
};

const SCRIPT_LABELS = { zh: '中文', ja: '日文', ko: '韩文' };

/** 任意 Unicode 字节/字符均可处理的类别 */
const UNICODE_SAFE_CATEGORIES = new Set(['对称加密', '哈希/摘要', '非对称加密']);

/** 编码类：可处理任意 Unicode */
const UNICODE_SAFE_IDS = new Set([
  'binary', 'hex', 'octal', 'base64', 'base32', 'url', 'html-entities', 'format-convert',
  'unicode-escape', 'quoted-printable', 'ascii85', 'gzip-base64',
  'decimal', 'base58', 'uuencode', 'zero-width', 'jwt',
]);

/** 换位/全文操作：对 CJK 同样有效 */
const ANY_CHAR_IDS = new Set([
  'rail-fence', 'columnar', 'scytale', 'reverse', 'even-odd-split', 'acrostic',
]);

export function getLangSupport(id) {
  return MAP[id] || null;
}

export const MULTILINGUAL_KEYS = [
  '密钥', '密码', '中文', 'KEY', 'SECRET', 'PASSWORD', 'CIPHER', 'CRYPTO',
  'こんにちは', '안녕',
];

export function detectScripts(text) {
  if (!text) return [];
  return Object.entries(SCRIPT_DETECTORS)
    .filter(([, re]) => re.test(text))
    .map(([code]) => code);
}

export function isUnicodeSafeCipher(id, category) {
  if (UNICODE_SAFE_CATEGORIES.has(category)) return true;
  if (UNICODE_SAFE_IDS.has(id)) return true;
  if (ANY_CHAR_IDS.has(id)) return true;
  return false;
}

export class LangNotSupportedError extends Error {
  constructor(cipherName, scripts) {
    const labels = scripts.map((s) => SCRIPT_LABELS[s] || s).join('、');
    super(`「${cipherName}」不支持${labels}文本，请选择带中/日/韩标签的算法，或使用 Base64 等通用编码。`);
    this.name = 'LangNotSupportedError';
    this.code = 'LANG_NOT_SUPPORTED';
    this.scripts = scripts;
  }
}

export function assertTextLangSupported(id, text, cipherName, category) {
  const scripts = detectScripts(text);
  if (!scripts.length) return;

  const supported = getLangSupport(id);
  if (supported && scripts.every((s) => supported.includes(s))) return;
  if (isUnicodeSafeCipher(id, category)) return;

  throw new LangNotSupportedError(cipherName, scripts);
}
