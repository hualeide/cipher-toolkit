import { useApp } from '../context/AppContext.jsx';
import { useSettings } from '../hooks/useSettings.js';

export default function TransformHistoryPanel() {
  const { t, setSelectedId, setPage } = useApp();
  const { settings, clearHistory } = useSettings();
  const history = settings.transformHistory || [];

  if (!history.length) return null;

  return (
    <div className="panel history-panel">
      <div className="history-head">
        <h3 className="section-title">{t('transform.historyTitle')}</h3>
        <button type="button" className="btn btn-sm" onClick={clearHistory}>{t('transform.historyClear')}</button>
      </div>
      <ul className="history-list">
        {history.slice(0, 8).map((h) => (
          <li key={h.at + h.cipherId}>
            <button
              type="button"
              className="history-item"
              onClick={() => { setSelectedId(h.cipherId); setPage('transform'); }}
            >
              <span className="history-meta">{h.cipherName} · {h.dir === 'decrypt' ? t('transform.historyDecrypt') : t('transform.historyEncrypt')}</span>
              <span className="history-preview">{(h.plain || h.cipher || '').slice(0, 40)}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
