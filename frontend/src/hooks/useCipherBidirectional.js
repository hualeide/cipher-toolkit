import { useState, useEffect, useCallback, useRef } from 'react';
import { buildDefaultParams, resolveParams } from '../utils/cipherParams.js';
import { checkLangSupport, formatScriptLabels } from '../utils/langGuard.js';
import { encrypt, decrypt } from '../api.js';

function resolveTransformError(e, t, selected) {
  if (e.code === 'LANG_NOT_SUPPORTED') {
    const scripts = formatScriptLabels(e.scripts?.length ? e.scripts : ['zh'], t);
    return t('errors.langNotSupported', { cipher: selected?.name || '', scripts });
  }
  return e.message;
}

export function useCipherBidirectional(selected, settings, t, prefill, onPrefillConsumed, onHistory) {
  const [plain, setPlain] = useState('');
  const [cipher, setCipher] = useState('');
  const [params, setParams] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const activeSide = useRef(null);
  const prefillApplied = useRef(null);

  useEffect(() => {
    if (!selected?.id) return;
    if (prefill?.cipherId === selected.id) {
      prefillApplied.current = selected.id;
      setParams({ ...buildDefaultParams(selected), ...prefill.params });
      setPlain(prefill.plain || '');
      setCipher(prefill.cipher || '');
      setError('');
      activeSide.current = prefill.cipher ? 'cipher' : 'plain';
      onPrefillConsumed?.();
      return;
    }
    if (prefillApplied.current === selected.id) return;
    prefillApplied.current = null;
    setParams(buildDefaultParams(selected));
    setPlain('');
    setCipher('');
    setError('');
    activeSide.current = null;
  }, [selected?.id, prefill, onPrefillConsumed, selected]);

  const recordHistory = useCallback((dir, plainText, cipherText) => {
    if (!selected || !onHistory) return;
    onHistory({
      cipherId: selected.id,
      cipherName: selected.name,
      params: resolveParams(selected, params),
      plain: plainText,
      cipher: cipherText,
      dir,
    });
  }, [selected, params, onHistory]);

  const run = useCallback(async () => {
    if (!selected) return;
    const side = activeSide.current;
    const effective = resolveParams(selected, params);

    if (side === 'plain') {
      if (!plain.trim()) {
        setCipher('');
        setError('');
        return;
      }
      const langErr = checkLangSupport(selected, plain);
      if (langErr) {
        setError(t('errors.langNotSupported', {
          cipher: selected.name,
          scripts: formatScriptLabels(langErr.scripts, t),
        }));
        setCipher('');
        return;
      }
      setBusy(true);
      try {
        setError('');
        const out = await encrypt(selected.id, plain, effective);
        setCipher(out);
        recordHistory('encrypt', plain, out);
      } catch (e) {
        setError(resolveTransformError(e, t, selected));
        setCipher('');
      } finally {
        setBusy(false);
      }
      return;
    }

    if (side === 'cipher') {
      if (!cipher.trim()) {
        setPlain('');
        setError('');
        return;
      }
      if (selected.reversible === false) {
        setError(t('transform.irreversibleHint'));
        setPlain('');
        return;
      }
      const langErr = checkLangSupport(selected, cipher);
      if (langErr) {
        setError(t('errors.langNotSupported', {
          cipher: selected.name,
          scripts: formatScriptLabels(langErr.scripts, t),
        }));
        setPlain('');
        return;
      }
      setBusy(true);
      try {
        setError('');
        const out = await decrypt(selected.id, cipher, effective);
        setPlain(out);
        recordHistory('decrypt', out, cipher);
      } catch (e) {
        setError(resolveTransformError(e, t, selected));
        setPlain('');
      } finally {
        setBusy(false);
      }
    }
  }, [selected, plain, cipher, params, t, recordHistory]);

  useEffect(() => {
    if (!settings.autoTransform || !activeSide.current || !selected) return undefined;
    const timer = setTimeout(run, 400);
    return () => clearTimeout(timer);
  }, [plain, cipher, params, selected, settings.autoTransform, run]);

  const onPlainChange = (value) => {
    activeSide.current = 'plain';
    setPlain(value);
  };

  const onCipherChange = (value) => {
    activeSide.current = 'cipher';
    setCipher(value);
  };

  const onParamChange = (name, value) => {
    activeSide.current = activeSide.current || 'plain';
    setParams((prev) => ({ ...prev, [name]: value }));
  };

  return {
    plain, cipher, params, error, busy, run,
    onPlainChange, onCipherChange, onParamChange,
  };
}
