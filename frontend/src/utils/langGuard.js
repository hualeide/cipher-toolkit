const SCRIPT_DETECTORS = {
  zh: /[\u4e00-\u9fff\u3400-\u4dbf\uff00-\uffef]/,
  ja: /[\u3040-\u30ff]/,
  ko: /[\uac00-\ud7af]/,
};

const UNICODE_SAFE_CATEGORIES = new Set(['对称加密', '哈希/摘要', '非对称加密']);

const UNICODE_SAFE_IDS = new Set([
  'binary', 'hex', 'octal', 'base64', 'base32', 'url', 'html-entities',
  'unicode-escape', 'quoted-printable', 'ascii85', 'gzip-base64',
  'decimal', 'base58', 'uuencode', 'zero-width',
]);

const ANY_CHAR_IDS = new Set([
  'rail-fence', 'columnar', 'scytale', 'reverse', 'even-odd-split', 'acrostic',
]);

export function detectScripts(text) {
  if (!text) return [];
  return Object.entries(SCRIPT_DETECTORS)
    .filter(([, re]) => re.test(text))
    .map(([code]) => code);
}

function isUnicodeSafeCipher(cipher) {
  if (!cipher) return true;
  if (UNICODE_SAFE_CATEGORIES.has(cipher.category)) return true;
  if (UNICODE_SAFE_IDS.has(cipher.id)) return true;
  if (ANY_CHAR_IDS.has(cipher.id)) return true;
  return false;
}

export function checkLangSupport(cipher, text) {
  const scripts = detectScripts(text);
  if (!scripts.length) return null;
  const supported = cipher.langSupport;
  if (supported?.length) {
    if (scripts.every((s) => supported.includes(s))) return null;
    return { code: 'LANG_NOT_SUPPORTED', scripts };
  }
  if (isUnicodeSafeCipher(cipher)) return null;
  return { code: 'LANG_NOT_SUPPORTED', scripts };
}

export function formatScriptLabels(scripts, t) {
  return scripts.map((s) => t(`langs.${s}`)).join('、');
}
