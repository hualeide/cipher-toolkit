import { useState, useEffect, useRef } from 'react';
import { analyzeText } from '../api.js';

/**
 * 密文统计分析面板（熵 / IC / 字母频率 / 算法提示）
 */
export default function TextAnalysisPanel({ text, t }) {
  const [data, setData] = useState(null);
  const [pending, setPending] = useState(false);
  const analyzeReq = useRef(0);

  useEffect(() => {
    if (!text?.trim()) {
      setData(null);
      setPending(false);
      return undefined;
    }

    const reqId = ++analyzeReq.current;
    const timer = setTimeout(async () => {
      setPending(true);
      try {
        const a = await analyzeText(text);
        if (reqId !== analyzeReq.current) return;
        setData(a);
      } catch {
        if (reqId !== analyzeReq.current) return;
        setData(null);
      } finally {
        if (reqId === analyzeReq.current) setPending(false);
      }
    }, 400);

    return () => {
      analyzeReq.current += 1;
      clearTimeout(timer);
    };
  }, [text]);

  if (!text?.trim()) return null;

  const showSkeleton = !data;
  const maxPct = data ? Math.max(...data.frequencies.map((f) => f.pct), 1) : 1;

  return (
    <div className={`panel analysis-panel${pending ? ' is-pending' : ''}${showSkeleton ? ' is-skeleton' : ''}`}>
      <h3 className="section-title">
        {t('analysis.title')}
        {pending && <span className="analysis-pending-dot" aria-hidden />}
      </h3>
      {t('analysis.desc') && !showSkeleton && <p className="hint analysis-desc">{t('analysis.desc')}</p>}

      {showSkeleton ? (
        <div className="analysis-stats" aria-hidden>
          <div className="stat-chip skeleton-chip" />
          <div className="stat-chip skeleton-chip" />
          <div className="stat-chip skeleton-chip" />
        </div>
      ) : (
        <>
          <div className="analysis-stats">
            <div className="stat-chip">
              <span className="stat-label">{t('analysis.length')}</span>
              <span className="stat-value">{data.length}</span>
            </div>
            <div className="stat-chip">
              <span className="stat-label">{t('analysis.entropy')}</span>
              <span className="stat-value">{data.entropy}</span>
            </div>
            {data.indexOfCoincidence != null && (
              <div className="stat-chip">
                <span className="stat-label">{t('analysis.ic')}</span>
                <span className="stat-value">{data.indexOfCoincidence}</span>
              </div>
            )}
            {data.letterCount > 0 && (
              <div className="stat-chip">
                <span className="stat-label">{t('analysis.letters')}</span>
                <span className="stat-value">{data.letterCount}</span>
              </div>
            )}
          </div>

          {data.charset?.length > 0 && (
            <div className="charset-tags">
              {data.charset.map((c) => (
                <span key={c} className="info-tag">{c}</span>
              ))}
            </div>
          )}

          {data.hints?.length > 0 && (
            <div className="analysis-hints">
              <strong>{t('analysis.hints')}</strong>
              <ul>
                {data.hints.map((h) => (
                  <li key={h.type}>
                    <span className="hint-label">{h.label}</span>
                    <span className="hint-detail">{h.detail}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {data.kasiski?.length > 0 && (
            <div className="kasiski-block">
              <strong>{t('analysis.kasiski')}</strong>
              <div className="kasiski-rows">
                {data.kasiski.map((k) => (
                  <div key={k.period} className="kasiski-row" title={t('analysis.kasiskiHint')}>
                    <span className="kasiski-period">n={k.period}</span>
                    <div className="kasiski-bar-wrap">
                      <div className="kasiski-bar" style={{ width: `${Math.min(100, k.avgIc * 1200)}%` }} />
                    </div>
                    <span className="kasiski-ic">{k.avgIc}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {data.frequencies.length > 0 && (
            <div className="freq-chart">
              <strong>{t('analysis.freq')}</strong>
              <div className="freq-bars">
                {data.frequencies.slice(0, 8).map((f) => (
                  <div key={f.char} className="freq-row" title={`${f.char}: ${f.pct}% (英文期望 ${f.expected}%)`}>
                    <span className="freq-char">{f.char}</span>
                    <div className="freq-bar-wrap">
                      <div className="freq-bar" style={{ width: `${(f.pct / maxPct) * 100}%` }} />
                    </div>
                    <span className="freq-pct">{f.pct}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
