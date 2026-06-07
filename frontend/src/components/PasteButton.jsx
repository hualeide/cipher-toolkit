import { useState } from 'react';
import { useApp } from '../context/AppContext.jsx';

export default function PasteButton({ onPaste, label }) {
  const { t } = useApp();
  const [pasted, setPasted] = useState(false);
  const lbl = label ?? t('common.paste');

  const paste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      onPaste?.(text);
      setPasted(true);
      setTimeout(() => setPasted(false), 1800);
    } catch { /* ignore */ }
  };

  return (
    <button type="button" className={`copy-btn-lg paste-btn ${pasted ? 'copied' : ''}`} onClick={paste}>
      {pasted ? t('common.pasted') : lbl}
    </button>
  );
}
