import { useState } from 'react';
import { useApp } from '../context/AppContext.jsx';

export default function CopyButton({ text, label }) {
  const { t } = useApp();
  const [copied, setCopied] = useState(false);
  const lbl = label ?? t('common.copy');

  const copy = async () => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* ignore */ }
  };

  return (
    <button type="button" className={`copy-btn-lg ${copied ? 'copied' : ''}`} onClick={copy} disabled={!text}>
      {copied ? t('common.copied') : lbl}
    </button>
  );
}
