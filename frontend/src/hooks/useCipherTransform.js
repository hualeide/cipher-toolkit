import { useState, useEffect, useCallback } from 'react';
import { buildDefaultParams, resolveParams } from '../utils/cipherParams.js';
import { checkLangSupport, formatScriptLabels } from '../utils/langGuard.js';

function resolveTransformError(e, t, selected) {
  if (e.code === 'LANG_NOT_SUPPORTED') {
    const scripts = formatScriptLabels(e.scripts?.length ? e.scripts : ['zh'], t);
    return t('errors.langNotSupported', { cipher: selected?.name || '', scripts });
  }
  return e.message;
}

export function useCipherTransform(apiFn, selected, settings, t) {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [params, setParams] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setParams(buildDefaultParams(selected));
    setOutput('');
    setError('');
  }, [selected?.id]);

  const run = useCallback(async () => {
    if (!selected || !input.trim()) {
      setOutput('');
      return;
    }
    const effective = resolveParams(selected, params);
    const langErr = checkLangSupport(selected, input);
    if (langErr) {
      setError(t('errors.langNotSupported', {
        cipher: selected.name,
        scripts: formatScriptLabels(langErr.scripts, t),
      }));
      setOutput('');
      setBusy(false);
      return;
    }
    setBusy(true);
    try {
      setError('');
      setOutput(await apiFn(selected.id, input, effective));
    } catch (e) {
      setError(resolveTransformError(e, t, selected));
      setOutput('');
    } finally {
      setBusy(false);
    }
  }, [selected, input, params, apiFn, t]);
  useEffect(() => {
    if (!settings.autoTransform || !input.trim() || !selected) return undefined;
    const timer = setTimeout(run, 400);
    return () => clearTimeout(timer);
  }, [input, params, selected, settings.autoTransform, run]);

  const onParamChange = (name, value) => {
    setParams((prev) => ({ ...prev, [name]: value }));
  };

  return {
    input, setInput, output, params, error, busy, run, onParamChange,
  };
}
