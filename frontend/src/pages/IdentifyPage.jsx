import { useState, useEffect } from 'react';

import { useSettings } from '../hooks/useSettings.js';

import { useApp } from '../context/AppContext.jsx';

import { identify } from '../api.js';

import CopyButton from '../components/CopyButton.jsx';

import CipherMetaTags from '../components/CipherMetaTags.jsx';

import TextAnalysisPanel from '../components/TextAnalysisPanel.jsx';



export default function IdentifyPage() {

  const { settings } = useSettings();

  const { t, goToTransformFromIdentify } = useApp();

  const [input, setInput] = useState('');

  const [matches, setMatches] = useState([]);

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState('');

  const [selected, setSelected] = useState(null);

  const defaultParams = t('identify.defaultParams');



  useEffect(() => {

    if (!input.trim()) {

      setMatches([]);

      setSelected(null);

      return;

    }

    setLoading(true);

    const extraKeys = settings.extraKeys.split(',').map((k) => k.trim()).filter(Boolean);

    const timer = setTimeout(async () => {

      try {

        setError('');

        const m = await identify(input, 15, settings.identifyMinScore, extraKeys);

        setMatches(m);

        setSelected(m[0] || null);

      } catch (e) {

        setError(e.message);

      } finally {

        setLoading(false);

      }

    }, settings.identifyDebounce);

    return () => clearTimeout(timer);

  }, [input, settings.identifyDebounce, settings.identifyMinScore, settings.extraKeys]);



  const lowConfidence = selected && !selected.alreadyPlaintext && selected.confidenceLevel === 'low';



  return (

    <div className="page-single identify-page">

      <div className="page-header">

        <h2>{t('identify.title')}</h2>

        <p>{t('identify.desc')}</p>

      </div>



      <div className="identify-layout">

        <div className="identify-main">

          <div className="panel">

            <div className="text-area-wrap">

              <label>{t('identify.inputLabel')}</label>

              <textarea

                value={input}

                onChange={(e) => setInput(e.target.value)}

                placeholder={t('identify.inputPh')}

                className="tall"

              />

            </div>

            {loading && <p className="hint">{t('common.analyzing')}</p>}

            {error && <p className="error">{error}</p>}

          </div>



          {selected && (

            <div className={`panel result-highlight ${selected.alreadyPlaintext ? 'plaintext-result' : ''} ${lowConfidence ? 'low-confidence' : ''}`}>

              <h3>{selected.alreadyPlaintext ? t('identify.conclusion') : t('identify.best')}</h3>

              {lowConfidence && (

                <div className="explain-block warn-block">

                  <strong>{t('identify.lowConfidenceTitle')}</strong>

                  <p>{t('identify.lowConfidenceDesc', { gap: selected.scoreGap ?? 0, alts: selected.alternativeCount ?? 0 })}</p>

                </div>

              )}

              <div className="result-meta">

                <span className="result-name">{selected.name}</span>

                {!selected.alreadyPlaintext && <span className="info-tag">{selected.category}</span>}

                {!selected.alreadyPlaintext && (selected.langSupport?.length > 0 || selected.requiresKey) && (

                  <CipherMetaTags cipher={selected} compact />

                )}

                {!selected.alreadyPlaintext && selected.paramsLabel && selected.paramsLabel !== defaultParams && (

                  <span className="info-tag accent">{t('identify.params')}: {selected.paramsLabel}</span>

                )}

                <span className={`score-badge conf-${selected.confidenceLevel || 'high'}`}>

                  {selected.confidence}% {t('identify.confidence')}

                </span>

                {selected.verified && !selected.alreadyPlaintext && (

                  <span className="info-tag verified-tag">{t('identify.verified')}</span>

                )}

                {selected.readable != null && !selected.alreadyPlaintext && (

                  <span className="info-tag">{t('identify.readable')} {selected.readable}</span>

                )}

                {selected.rank > 1 && (

                  <span className="info-tag warn-tag">#{selected.rank}</span>

                )}

              </div>

              <div className="explain-block">

                <strong>{selected.alreadyPlaintext ? t('identify.note') : t('identify.what')}</strong>

                <p>{selected.explanation}</p>

              </div>

              {selected.usage && (

                <div className="explain-block">

                  <strong>{selected.alreadyPlaintext ? t('identify.tip') : t('identify.how')}</strong>

                  <p>{selected.usage}</p>

                </div>

              )}

              {selected.alreadyPlaintext ? (

                <div className="explain-block success-block">

                  <strong>{t('identify.inputContent')}</strong>

                  <pre className="result-text">{selected.result}</pre>

                </div>

              ) : selected.reversible === false ? (

                <div className="explain-block warn-block">

                  <strong>{t('identify.warn')}</strong>

                  <p>{t('identify.hashWarn')}</p>

                </div>

              ) : selected.result && (

                <div className="explain-block success-block">

                  <div className="result-header">

                    <strong>{t('identify.result')}</strong>

                    <CopyButton text={selected.result} />

                  </div>

                  <pre className="result-text">{selected.result}</pre>

                </div>

              )}

              {!selected.alreadyPlaintext && selected.reversible !== false && (

                <div className="btn-row">

                  <button

                    type="button"

                    className="btn btn-primary"

                    onClick={() => goToTransformFromIdentify(selected, input)}

                  >

                    {t('identify.goTransform')}

                  </button>

                </div>

              )}

            </div>

          )}



          {matches.length > 1 && !selected?.alreadyPlaintext && (

            <div className="panel">

              <h3 className="section-title">{t('identify.others')} ({matches.length})</h3>

              {matches.map((m, i) => (

                <div

                  key={`${m.id}-${m.paramsLabel}-${i}`}

                  className={`match-item ${selected === m ? 'selected' : ''}`}

                  onClick={() => setSelected(m)}

                >

                  <div className="match-left">

                    <span className="match-rank">#{m.rank ?? i + 1}</span>

                    <strong>{m.name}</strong>

                    {m.paramsLabel && m.paramsLabel !== defaultParams && (

                      <span className="param-hint"> ({m.paramsLabel})</span>

                    )}

                    {m.confidenceLevel === 'low' && <span className="info-tag warn-tag">{t('identify.lowTag')}</span>}

                    {m.verified && <span className="info-tag verified-tag">{t('identify.verified')}</span>}

                    <div className="preview">{m.reversible === false ? t('identify.irreversible') : m.result}</div>

                  </div>

                  <span className={`score conf-${m.confidenceLevel || 'high'}`}>{m.confidence}%</span>

                </div>

              ))}

            </div>

          )}



          {!loading && input && matches.length === 0 && (

            <div className="panel empty-state">

              <p>{t('identify.empty')}</p>

            </div>

          )}

        </div>



        <aside className="identify-aside">

          <TextAnalysisPanel text={input} t={t} />

        </aside>

      </div>

    </div>

  );

}

