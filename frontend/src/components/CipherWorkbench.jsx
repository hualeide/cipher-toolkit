import ParamFields from '../components/ParamFields.jsx';
import CopyButton from '../components/CopyButton.jsx';
import CipherInfo from '../components/CipherInfo.jsx';
import PageHeader from '../components/PageHeader.jsx';
import { useApp } from '../context/AppContext.jsx';

export default function CipherWorkbench({
  mode,
  selected,
  params,
  onParamChange,
  input,
  onInputChange,
  output,
  plain,
  cipher,
  onPlainChange,
  onCipherChange,
  error,
  busy,
  autoTransform,
  onRun,
  runLabel,
}) {
  const { t } = useApp();
  const bidirectional = mode === 'bidirectional';
  const m = mode === 'decrypt' ? 'decrypt' : 'encrypt';
  const ns = bidirectional ? 'transform' : m;

  return (
    <main className="page-main">
      <PageHeader
        title={selected?.name || t(`${ns}.title`)}
        desc={selected?.description || t(`${ns}.desc`)}
        descShort={selected?.description || t(`${ns}.descShort`)}
        t={t}
      />

      <div className="multilingual-banner">{t('multilingual.banner')}</div>

      <div className="panel workbench-input-top workbench-panel">
        <ParamFields cipher={selected} params={params} onChange={onParamChange} />
        <div className="io-grid">
          <div className="text-area-wrap">
            <label className="output-label">
              <span>{bidirectional ? t('transform.plain') : t(`${m}.input`)}</span>
              {bidirectional && <CopyButton text={plain} />}
            </label>
            <textarea
              value={bidirectional ? plain : input}
              onChange={(e) => (bidirectional ? onPlainChange(e.target.value) : onInputChange(e.target.value))}
              placeholder={bidirectional ? t('transform.plainPh') : t(`${m}.inputPh`)}
              className="tall"
              aria-busy={busy}
            />
          </div>
          <div className="text-area-wrap">
            <label className="output-label">
              <span>{bidirectional ? t('transform.cipher') : t(`${m}.output`)}</span>
              <CopyButton text={bidirectional ? cipher : output} />
            </label>
            <textarea
              value={bidirectional ? cipher : output}
              onChange={bidirectional ? (e) => onCipherChange(e.target.value) : undefined}
              readOnly={!bidirectional}
              placeholder={bidirectional ? t('transform.cipherPh') : t(`${m}.outputPh`)}
              className="tall"
              aria-busy={busy}
            />
          </div>
        </div>
        {bidirectional && <p className="hint transform-hint">{t('transform.hint')}</p>}
        {!autoTransform && (
          <button type="button" className="btn btn-primary btn-lg" onClick={onRun}>
            {runLabel || t(bidirectional ? 'transform.run' : `${m}.run`)}
          </button>
        )}
        {error && <p className="error">{error}</p>}
      </div>

      <CipherInfo cipher={selected} detailed suppressTitle />
    </main>
  );
}
