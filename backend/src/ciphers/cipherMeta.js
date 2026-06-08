const KEY_PARAM_NAMES = new Set([
  'key', 'keyword', 'keyText', 'password', 'keyByte', 'publicKey', 'privateKey',
]);

/** 算法是否需要用户填写密钥/密码类参数 */
export function cipherRequiresKey(cipher) {
  if (!cipher?.params?.length) return false;
  return cipher.params.some(
    (p) => KEY_PARAM_NAMES.has(p.name) || p.type === 'password',
  );
}
