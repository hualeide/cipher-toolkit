import { useRef, useState, useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext.jsx';

export default function FileDrop({ label, hint, file, onFile, preview }) {
  const { t } = useApp();
  const ref = useRef(null);
  const [drag, setDrag] = useState(false);
  const [localUrl, setLocalUrl] = useState(null);

  useEffect(() => {
    if (preview) {
      setLocalUrl(null);
      return undefined;
    }
    if (!file) {
      setLocalUrl(null);
      return undefined;
    }
    const url = URL.createObjectURL(file);
    setLocalUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file, preview]);

  const pick = (f) => { if (f?.type?.startsWith('image/')) onFile(f); };
  const imgSrc = preview || localUrl;

  return (
    <div
      className={`file-drop ${drag ? 'drag-over' : ''} ${file ? 'has-file' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files?.[0]); }}
      onClick={() => ref.current?.click()}
      role="button"
      tabIndex={0}
    >
      <input ref={ref} type="file" accept="image/*" hidden onChange={(e) => pick(e.target.files?.[0])} />
      {!imgSrc && (
        <>
          <div className="file-drop-icon">📁</div>
          <div className="file-drop-label">{label}</div>
          <div className="file-drop-hint">{file ? file.name : (hint || t('media.ui.uploadHint'))}</div>
        </>
      )}
      {imgSrc && (
        <div className="file-drop-preview-wrap">
          <img src={imgSrc} alt={label} className="file-drop-preview-lg" />
          <div className="file-drop-meta">{file?.name || label}</div>
        </div>
      )}
    </div>
  );
}

export function UploadPreviewBar({ items, title }) {
  const { t } = useApp();
  const barTitle = title ?? t('media.previewBefore');
  const ready = items?.filter((x) => x.file) || [];
  const urls = useMemo(() => ready.map(({ file }) => URL.createObjectURL(file)), [ready.map((x) => x.file?.name + x.file?.size).join('|')]);
  useEffect(() => () => urls.forEach((u) => URL.revokeObjectURL(u)), [urls]);
  if (!ready.length) return null;
  return (
    <div className="upload-preview-bar">
      <div className="upload-preview-bar-title">{barTitle}</div>
      <div className="upload-preview-bar-grid">
        {ready.map(({ label }, i) => (
          <figure key={label} className="upload-preview-fig">
            <img src={urls[i]} alt={label} />
            <figcaption>{label}</figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}

export function ToolHeader({ title, desc, badge }) {
  return (
    <div className="tool-header">
      <div>
        <h3>{title} {badge && <span className="tool-badge">{badge}</span>}</h3>
        <p>{desc}</p>
      </div>
    </div>
  );
}

export function ResultPanel({ children, title }) {
  const { t } = useApp();
  return (
    <div className="result-panel">
      <div className="result-panel-head">{title ?? t('media.ui.result')}</div>
      {children}
    </div>
  );
}

export function DownloadBtn({ dataUrl, filename, label }) {
  const { t } = useApp();
  if (!dataUrl) return null;
  return <a href={dataUrl} download={filename} className="btn btn-primary btn-lg media-dl">{label ?? t('media.ui.download')}</a>;
}

export function LoadingBar({ show }) {
  if (!show) return null;
  return <div className="loading-bar"><div className="loading-bar-inner" /></div>;
}

export function SliderControl({ label, value, min, max, step, onChange, unit = '' }) {
  return (
    <label className="slider-control">
      <span>{label} <strong>{value}{unit}</strong></span>
      <input type="range" min={min} max={max} step={step || 1} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}
