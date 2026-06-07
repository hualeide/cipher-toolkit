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
  const runGen = useRef(0);

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
    const gen = ++runGen.current;

    const finishBusy = () => {
      if (gen === runGen.current) setBusy(false);
    };

    if (side === 'plain') {
      if (!plain.trim()) {
        setCipher('');
        setError('');
        setBusy(false);
        return;
      }
      const langErr = checkLangSupport(selected, plain);
      if (langErr) {
        setError(t('errors.langNotSupported', {
          cipher: selected.name,
          scripts: formatScriptLabels(langErr.scripts, t),
        }));
        setCipher('');
        setBusy(false);
        return;
      }
      setBusy(true);
      try {
        setError('');
        const out = await encrypt(selected.id, plain, effective);
        if (gen !== runGen.current) return;
        setCipher(out);
        recordHistory('encrypt', plain, out);
      } catch (e) {
        if (gen !== runGen.current) return;
        setError(resolveTransformError(e, t, selected));
        setCipher('');
      } finally {
        finishBusy();
      }
      return;
    }

    if (side === 'cipher') {
      if (!cipher.trim()) {
        setPlain('');
        setError('');
        setBusy(false);
        return;
      }
      if (selected.reversible === false) {
        setError(t('transform.irreversibleHint'));
        setPlain('');
        setBusy(false);
        return;
      }
      const langErr = checkLangSupport(selected, cipher);
      if (langErr) {
        setError(t('errors.langNotSupported', {
          cipher: selected.name,
          scripts: formatScriptLabels(langErr.scripts, t),
        }));
        setPlain('');
        setBusy(false);
        return;
      }
      setBusy(true);
      try {
        setError('');
        const out = await decrypt(selected.id, cipher, effective);
        if (gen !== runGen.current) return;
        setPlain(out);
        recordHistory('decrypt', out, cipher);
      } catch (e) {
        if (gen !== runGen.current) return;
        setError(resolveTransformError(e, t, selected));
        setPlain('');
      } finally {
        finishBusy();
      }
    }
  }, [selected, plain, cipher, params, t, recordHistory]);

  // Only re-run when the user-edited side (or params) changes — not when output is written back.
  useEffect(() => {
    if (!settings.autoTransform || !selected) return undefined;
    const timer = setTimeout(() => {
      if (activeSide.current !== 'plain') return;
      run();
    }, 400);
    return () => clearTimeout(timer);
  }, [plain, params, selected?.id, settings.autoTransform, run]);

  useEffect(() => {
    if (!settings.autoTransform || !selected) return undefined;
    const timer = setTimeout(() => {
      if (activeSide.current !== 'cipher') return;
      run();
    }, 400);
    return () => clearTimeout(timer);
  }, [cipher, params, selected?.id, settings.autoTransform, run]);

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
