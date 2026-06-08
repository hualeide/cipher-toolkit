import ParamFields from '../components/ParamFields.jsx';
import CopyButton from '../components/CopyButton.jsx';
import PasteButton from '../components/PasteButton.jsx';
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
  const isPigpen = selected?.id === 'pigpen';
  const pigpenIn = isPigpen && !bidirectional && m === 'decrypt' ? ' pigpen-font' : '';
  const pigpenOut = isPigpen && (bidirectional || m === 'encrypt') ? ' pigpen-font' : '';

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
            <div className="text-area-head">
              <span className="text-area-title">{bidirectional ? t('transform.plain') : t(`${m}.input`)}</span>
              <div className="text-area-actions">
                <PasteButton onPaste={bidirectional ? onPlainChange : onInputChange} />
                <CopyButton text={bidirectional ? plain : input} />
              </div>
            </div>
            <textarea
              value={bidirectional ? plain : input}
              onChange={(e) => (bidirectional ? onPlainChange(e.target.value) : onInputChange(e.target.value))}
              placeholder={bidirectional ? t('transform.plainPh') : t(`${m}.inputPh`)}
              className={`tall${pigpenIn}`}
              aria-busy={busy}
            />
          </div>
          <div className="text-area-wrap">
            <div className="text-area-head">
              <span className="text-area-title">{bidirectional ? t('transform.cipher') : t(`${m}.output`)}</span>
              <div className="text-area-actions">
                {bidirectional && <PasteButton onPaste={onCipherChange} />}
                <CopyButton text={bidirectional ? cipher : output} />
              </div>
            </div>
            <textarea
              value={bidirectional ? cipher : output}
              onChange={bidirectional ? (e) => onCipherChange(e.target.value) : undefined}
              readOnly={!bidirectional}
              placeholder={bidirectional ? t('transform.cipherPh') : t(`${m}.outputPh`)}
              className={`tall${pigpenOut}`}
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
