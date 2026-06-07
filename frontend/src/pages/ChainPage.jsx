import { useState, useEffect, useRef } from 'react';
import { useSettings } from '../hooks/useSettings.js';
import { useApp } from '../context/AppContext.jsx';
import { autoChain } from '../api.js';
import CopyButton from '../components/CopyButton.jsx';
import ManualChainPanel from '../components/ManualChainPanel.jsx';
import TextAnalysisPanel from '../components/TextAnalysisPanel.jsx';
import PageHeader from '../components/PageHeader.jsx';

export default function ChainPage() {
  const { settings } = useSettings();
  const { t, goToTransformFromIdentify } = useApp();
  const [input, setInput] = useState('');
  const [chains, setChains] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const chainReq = useRef(0);

  useEffect(() => {
    if (!input.trim()) {
      setChains([]);
      setLoading(false);
      setError('');
      return undefined;
    }

    const reqId = ++chainReq.current;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        setError('');
        const c = await autoChain(input);
        if (reqId !== chainReq.current) return;
        setChains(c);
      } catch (e) {
        if (reqId !== chainReq.current) return;
        setError(e.message);
      } finally {
        if (reqId === chainReq.current) setLoading(false);
      }
    }, settings.identifyDebounce);

    return () => {
      chainReq.current += 1;
      clearTimeout(timer);
    };
  }, [input, settings.identifyDebounce]);

  const openInTransform = (chain) => {
    const last = chain.chain?.[chain.chain.length - 1];
    if (!last) return;
    goToTransformFromIdentify(
      { id: last.id, name: last.name, params: last.params, paramsLabel: last.paramsLabel, result: chain.result },
      input,
    );
  };

  return (
    <div className="page-single chain-page">
      <PageHeader
        title={t('chain.title')}
        desc={t('chain.desc')}
        descShort={t('chain.descShort')}
        t={t}
      />

      <div className="identify-layout">
        <div className="identify-main">
          <div className="panel">
            <div className="text-area-wrap">
              <label>{t('chain.inputLabel')}</label>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={t('chain.inputPh')}
                className="tall"
                aria-busy={loading}
              />
            </div>
            {error && <p className="error">{error}</p>}
          </div>

          <ManualChainPanel input={input} t={t} />

          {chains.length > 0 && (
            <h3 className="section-title panel-title-inline">{t('chain.autoTitle')}</h3>
          )}

          {chains.map((c, i) => (
            <div key={i} className={`panel chain-card${loading ? ' is-pending' : ''}`}>
              <div className="chain-header">
                <span className="score-badge conf-high">{c.score}%</span>
                <div className="chain-steps">
                  {c.names.map((n, j) => (
                    <span key={j}>
                      {j > 0 && <span className="chain-arrow"> → </span>}
                      <span className="chain-tag">{n}{c.paramsLabels?.[j] ? ` (${c.paramsLabels[j]})` : ''}</span>
                    </span>
                  ))}
                </div>
              </div>
              <p className="chain-explain">{c.explanation}</p>
              <div className="result-header">
                <strong>{t('chain.result')}</strong>
                <CopyButton text={c.result} />
              </div>
              <pre className="result-text">{c.result}</pre>
              <div className="btn-row">
                <button type="button" className="btn btn-primary" onClick={() => openInTransform(c)}>
                  {t('chain.goTransform')}
                </button>
              </div>
            </div>
          ))}

          {!loading && input && chains.length === 0 && (
            <div className="panel empty-state"><p>{t('chain.empty')}</p></div>
          )}
        </div>

        <aside className="identify-aside">
          <TextAnalysisPanel text={input} t={t} />
        </aside>
      </div>
    </div>
  );
}
