import { useState } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { resolveParams } from '../utils/cipherParams.js';
import { encrypt } from '../api.js';

export default function BatchTransformPanel({ selected, params }) {
  const { t } = useApp();
  const [lines, setLines] = useState('');
  const [output, setOutput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const runBatch = async () => {
    if (!selected) return;
    const items = lines.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (!items.length) {
      setOutput('');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const effective = resolveParams(selected, params);
      const results = [];
      for (const item of items) {
        results.push(await encrypt(selected.id, item, effective));
      }
      setOutput(results.join('\n'));
    } catch (e) {
      setError(e.message);
      setOutput('');
    } finally {
      setBusy(false);
    }
  };

  if (selected?.reversible === false) return null;

  return (
    <div className="panel batch-panel">
      <h3 className="section-title">{t('transform.batchTitle')}</h3>
      <p className="hint">{t('transform.batchDesc')}</p>
      <div className="io-grid">
        <div className="text-area-wrap">
          <label>{t('transform.batchInput')}</label>
          <textarea
            rows={5}
            value={lines}
            onChange={(e) => setLines(e.target.value)}
            placeholder={t('transform.batchInputPh')}
          />
        </div>
        <div className="text-area-wrap">
          <label>{t('transform.batchOutput')}</label>
          <textarea rows={5} value={output} readOnly placeholder={t('transform.batchOutputPh')} />
        </div>
      </div>
      <button type="button" className="btn btn-primary" onClick={runBatch} disabled={busy}>
        {busy ? t('common.analyzing') : t('transform.batchRun')}
      </button>
      {error && <p className="error">{error}</p>}
    </div>
  );
}
