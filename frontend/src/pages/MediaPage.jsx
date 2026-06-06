import { useState, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext.jsx';
import {
  mirageTank, blendImages, embedImage, convertFile, upscaleImage, denoiseImage,
  fetchFormats, fetchBlendModes,
} from '../api/media.js';
import FileDrop, { ToolHeader, ResultPanel, DownloadBtn, LoadingBar, SliderControl, UploadPreviewBar } from '../components/media/MediaUI.jsx';

const TAB_IDS = [
  { id: 'mirage', icon: '🎭', labelKey: 'media.tabs.mirage.label', descKey: 'media.tabs.mirage.desc' },
  { id: 'embed', icon: '🧩', labelKey: 'media.tabs.embed.label', descKey: 'media.tabs.embed.desc' },
  { id: 'blend', icon: '🎨', labelKey: 'media.tabs.blend.label', descKey: 'media.tabs.blend.desc' },
  { id: 'convert', icon: '🔄', labelKey: 'media.tabs.convert.label', descKey: 'media.tabs.convert.desc' },
  { id: 'upscale', icon: '🔍', labelKey: 'media.tabs.upscale.label', descKey: 'media.tabs.upscale.desc' },
  { id: 'denoise', icon: '✨', labelKey: 'media.tabs.denoise.label', descKey: 'media.tabs.denoise.desc' },
];

function MirageTab() {
  const { t } = useApp();
  const [white, setWhite] = useState(null);
  const [black, setBlack] = useState(null);
  const [size, setSize] = useState(800);
  const [colorBoost, setColorBoost] = useState(1.1);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const run = async () => {
    if (!white || !black) return;
    setLoading(true); setError('');
    try {
      setResult(await mirageTank(white, black, { size, colorBoost }));
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="media-tool">
      <ToolHeader
        title={t('media.mirage.title')}
        badge={t('media.mirage.badge')}
        desc={t('media.mirage.desc')}
      />
      <div className="upload-grid-2">
        <FileDrop label={t('media.mirage.whiteShow')} hint={t('media.mirage.whiteHint')} file={white} onFile={setWhite} />
        <FileDrop label={t('media.mirage.blackShow')} hint={t('media.mirage.blackHint')} file={black} onFile={setBlack} />
      </div>
      <div className="control-grid">
        <SliderControl label={t('media.mirage.outputSize')} value={size} min={256} max={1200} step={64} onChange={setSize} unit="px" />
        <SliderControl label={t('media.mirage.colorBoost')} value={colorBoost} min={0.8} max={1.4} step={0.05} onChange={setColorBoost} unit="×" />
      </div>
      <UploadPreviewBar items={[
        { file: white, label: t('media.mirage.whitePreview') },
        { file: black, label: t('media.mirage.blackPreview') },
      ]} />
      <LoadingBar show={loading} />
      <button type="button" className="btn btn-primary btn-lg media-action" onClick={run} disabled={!white || !black || loading}>
        {loading ? t('media.mirage.generating') : t('media.mirage.generate')}
      </button>
      {error && <p className="error">{error}</p>}
      {result && (
        <ResultPanel title={t('media.mirage.resultTitle')}>
          <div className="preview-grid-3">
            <figure className="preview-card bg-white-card">
              <img src={result.previewWhite || result.result} alt="white" />
              <figcaption>{t('media.mirage.whiteEffect')}</figcaption>
            </figure>
            <figure className="preview-card bg-black-card">
              <img src={result.previewBlack || result.result} alt="black" />
              <figcaption>{t('media.mirage.blackEffect')}</figcaption>
            </figure>
            <figure className="preview-card bg-checker-card">
              <img src={result.result} alt="raw" />
              <figcaption>{t('media.mirage.composite')}</figcaption>
            </figure>
          </div>
          <DownloadBtn dataUrl={result.result} filename="mirage-color.png" />
        </ResultPanel>
      )}
    </div>
  );
}

function EmbedTab() {
  const { t } = useApp();
  const [base, setBase] = useState(null);
  const [insert, setInsert] = useState(null);
  const [scale, setScale] = useState(0.45);
  const [opacity, setOpacity] = useState(0.92);
  const [feather, setFeather] = useState(8);
  const [position, setPosition] = useState('center');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const run = async () => {
    if (!base || !insert) return;
    setLoading(true); setError('');
    try {
      const data = await embedImage(base, insert, { scale, opacity, feather, position });
      setResult(data.result);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="media-tool">
      <ToolHeader title={t('media.embed.title')} desc={t('media.embed.desc')} />
      <div className="upload-grid-2">
        <FileDrop label={t('media.embed.baseLabel')} file={base} onFile={setBase} />
        <FileDrop label={t('media.embed.insertLabel')} file={insert} onFile={setInsert} />
      </div>
      <div className="control-grid">
        <SliderControl label={t('media.embed.scale')} value={scale} min={0.1} max={0.9} step={0.05} onChange={setScale} />
        <SliderControl label={t('media.embed.opacity')} value={opacity} min={0.2} max={1} step={0.02} onChange={setOpacity} />
        <SliderControl label={t('media.embed.feather')} value={feather} min={0} max={30} onChange={setFeather} />
      </div>
      <label className="select-control">{t('media.pos.label')}
        <select value={position} onChange={(e) => setPosition(e.target.value)}>
          <option value="center">{t('media.pos.center')}</option>
          <option value="top-left">{t('media.pos.topLeft')}</option>
          <option value="bottom-right">{t('media.pos.bottomRight')}</option>
        </select>
      </label>
      <UploadPreviewBar items={[
        { file: base, label: t('media.shared.base') },
        { file: insert, label: t('media.shared.foreground') },
      ]} />
      <LoadingBar show={loading} />
      <button type="button" className="btn btn-primary btn-lg media-action" onClick={run} disabled={!base || !insert || loading}>
        {t('media.embed.run')}
      </button>
      {error && <p className="error">{error}</p>}
      {result && (
        <ResultPanel>
          <img src={result} alt="embed" className="result-hero" />
          <DownloadBtn dataUrl={result} filename="embedded.png" />
        </ResultPanel>
      )}
    </div>
  );
}

function BlendTab() {
  const { t } = useApp();
  const [base, setBase] = useState(null);
  const [top, setTop] = useState(null);
  const [modes, setModes] = useState([]);
  const [mode, setMode] = useState('overlay');
  const [opacity, setOpacity] = useState(0.85);
  const [scale, setScale] = useState(0.5);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const modeLabel = (id) => {
    const label = t(`media.blend.modes.${id}`);
    return label === `media.blend.modes.${id}` ? id : label;
  };

  useEffect(() => { fetchBlendModes().then(setModes).catch(() => {}); }, []);

  const run = async () => {
    if (!base || !top) return;
    setLoading(true); setError('');
    try {
      const data = await blendImages(base, top, { mode, opacity, scale, x: 50, y: 50 });
      setResult(data.result);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const modeOptions = modes.length ? modes : [{ id: 'overlay' }];

  return (
    <div className="media-tool">
      <ToolHeader title={t('media.blend.title')} desc={t('media.blend.desc')} />
      <div className="upload-grid-2">
        <FileDrop label={t('media.shared.bottom')} file={base} onFile={setBase} />
        <FileDrop label={t('media.shared.top')} file={top} onFile={setTop} />
      </div>
      <div className="control-grid">
        <label className="select-control">{t('media.blend.mode')}
          <select value={mode} onChange={(e) => setMode(e.target.value)}>
            {modeOptions.map((m) => (
              <option key={m.id} value={m.id}>{modeLabel(m.id)}</option>
            ))}
          </select>
        </label>
        <SliderControl label={t('media.blend.topOpacity')} value={opacity} min={0.1} max={1} step={0.05} onChange={setOpacity} />
        <SliderControl label={t('media.blend.topScale')} value={scale} min={0.2} max={1} step={0.05} onChange={setScale} />
      </div>
      <UploadPreviewBar items={[
        { file: base, label: t('media.shared.bottom') },
        { file: top, label: t('media.shared.top') },
      ]} />
      <LoadingBar show={loading} />
      <button type="button" className="btn btn-primary btn-lg media-action" onClick={run} disabled={!base || !top || loading}>
        {t('media.blend.run')}
      </button>
      {error && <p className="error">{error}</p>}
      {result && (
        <ResultPanel>
          <img src={result} alt="blend" className="result-hero" />
          <DownloadBtn dataUrl={result} filename="blend.png" />
        </ResultPanel>
      )}
    </div>
  );
}

function ConvertTab() {
  const { t } = useApp();
  const [file, setFile] = useState(null);
  const [formats, setFormats] = useState(['png', 'jpeg', 'webp']);
  const [format, setFormat] = useState('webp');
  const [quality, setQuality] = useState(90);
  const [result, setResult] = useState(null);
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { fetchFormats().then(setFormats).catch(() => {}); }, []);

  const run = async () => {
    if (!file) return;
    setLoading(true); setError('');
    try {
      const data = await convertFile(file, format, quality);
      setResult(data.result);
      setInfo(data.info);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="media-tool">
      <ToolHeader title={t('media.convert.title')} desc={t('media.convert.desc')} />
      <FileDrop label={t('media.convert.upload')} file={file} onFile={setFile} />
      <div className="control-grid">
        <label className="select-control">{t('media.convert.targetFormat')}
          <select value={format} onChange={(e) => setFormat(e.target.value)}>
            {formats.map((f) => <option key={f} value={f}>{f.toUpperCase()}</option>)}
          </select>
        </label>
        <SliderControl label={t('media.convert.quality')} value={quality} min={50} max={100} onChange={setQuality} unit="%" />
      </div>
      <UploadPreviewBar items={[{ file, label: t('media.shared.original') }]} />
      <LoadingBar show={loading} />
      <button type="button" className="btn btn-primary btn-lg media-action" onClick={run} disabled={!file || loading}>
        {t('media.convert.run')}
      </button>
      {error && <p className="error">{error}</p>}
      {result && (
        <ResultPanel>
          {info && <p className="info-line">{info.width}×{info.height} · {format.toUpperCase()} · {(info.size / 1024).toFixed(1)} KB</p>}
          <img src={result} alt="converted" className="result-hero" />
          <DownloadBtn dataUrl={result} filename={`out.${format}`} />
        </ResultPanel>
      )}
    </div>
  );
}

function UpscaleTab() {
  const { t } = useApp();
  const [file, setFile] = useState(null);
  const [scale, setScale] = useState(2);
  const [denoiseFirst, setDenoiseFirst] = useState(true);
  const [result, setResult] = useState(null);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const run = async () => {
    if (!file) return;
    setLoading(true); setError('');
    try {
      const data = await upscaleImage(file, scale, denoiseFirst);
      setResult(data.result);
      setMeta({ before: data.before, after: data.after });
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="media-tool">
      <ToolHeader title={t('media.upscale.title')} desc={t('media.upscale.desc')} />
      <FileDrop label={t('media.upscale.upload')} file={file} onFile={setFile} />
      <div className="control-grid">
        <label className="select-control">{t('media.upscale.factor')}
          <select value={scale} onChange={(e) => setScale(Number(e.target.value))}>
            <option value={2}>2×</option><option value={3}>3×</option><option value={4}>4×</option>
          </select>
        </label>
        <label className="check-control">
          <input type="checkbox" checked={denoiseFirst} onChange={(e) => setDenoiseFirst(e.target.checked)} />
          {t('media.upscale.denoiseFirst')}
        </label>
      </div>
      <UploadPreviewBar items={[{ file, label: t('media.shared.original') }]} />
      <LoadingBar show={loading} />
      <button type="button" className="btn btn-primary btn-lg media-action" onClick={run} disabled={!file || loading}>
        {t('media.upscale.run')}
      </button>
      {error && <p className="error">{error}</p>}
      {result && meta && (
        <ResultPanel title={`${meta.before.width}×${meta.before.height} → ${meta.after.width}×${meta.after.height}`}>
          <img src={result} alt="upscale" className="result-hero" />
          <DownloadBtn dataUrl={result} filename="upscaled.png" />
        </ResultPanel>
      )}
    </div>
  );
}

function DenoiseTab() {
  const { t } = useApp();
  const [file, setFile] = useState(null);
  const [strength, setStrength] = useState(3);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const run = async () => {
    if (!file) return;
    setLoading(true); setError('');
    try {
      const data = await denoiseImage(file, strength);
      setResult(data.result);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="media-tool">
      <ToolHeader title={t('media.denoise.title')} desc={t('media.denoise.desc')} />
      <FileDrop label={t('media.denoise.upload')} file={file} onFile={setFile} />
      <SliderControl label={t('media.denoise.strength')} value={strength} min={1} max={5} onChange={setStrength} />
      <UploadPreviewBar items={[{ file, label: t('media.shared.original') }]} />
      <LoadingBar show={loading} />
      <button type="button" className="btn btn-primary btn-lg media-action" onClick={run} disabled={!file || loading}>
        {t('media.denoise.run')}
      </button>
      {error && <p className="error">{error}</p>}
      {result && file && (
        <ResultPanel title={t('media.denoise.compare')}>
          <div className="compare-grid">
            <figure><img src={URL.createObjectURL(file)} alt="before" /><figcaption>{t('media.shared.original')}</figcaption></figure>
            <figure><img src={result} alt="after" /><figcaption>{t('media.denoise.after')}</figcaption></figure>
          </div>
          <DownloadBtn dataUrl={result} filename="denoised.png" />
        </ResultPanel>
      )}
    </div>
  );
}

export default function MediaPage() {
  const { t } = useApp();
  const [tab, setTab] = useState('mirage');

  const tabs = useMemo(() => TAB_IDS.map((item) => ({
    ...item,
    label: t(item.labelKey),
    desc: t(item.descKey),
  })), [t]);

  const current = tabs.find((x) => x.id === tab);

  return (
    <div className="page-single media-page-v2">
      <div className="media-hero">
        <h2>{t('media.title')}</h2>
        <p>{t('media.desc')}</p>
      </div>
      <div className="media-tab-bar">
        {tabs.map((item) => (
          <button key={item.id} type="button" className={`media-tab-v2 ${tab === item.id ? 'active' : ''}`} onClick={() => setTab(item.id)}>
            <span className="tab-icon">{item.icon}</span>
            <span className="tab-text">
              <strong>{item.label}</strong>
              <small>{item.desc}</small>
            </span>
          </button>
        ))}
      </div>
      <div className="media-panel-v2">
        {current && <div className="media-panel-title">{current.icon} {current.label}</div>}
        {tab === 'mirage' && <MirageTab />}
        {tab === 'embed' && <EmbedTab />}
        {tab === 'blend' && <BlendTab />}
        {tab === 'convert' && <ConvertTab />}
        {tab === 'upscale' && <UpscaleTab />}
        {tab === 'denoise' && <DenoiseTab />}
      </div>
    </div>
  );
}
