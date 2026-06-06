import { useState, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { chainDecrypt } from '../api.js';
import CopyButton from './CopyButton.jsx';
import ParamFields from './ParamFields.jsx';
import {
  createRecipe, encodeRecipe, decodeRecipe, buildShareUrl,
  loadSavedRecipes, saveRecipeToStorage, deleteRecipeFromStorage,
  parseRecipeFromHash,
} from '../utils/recipeCodec.js';

function defaultParams(cipher) {
  const p = {};
  for (const param of cipher?.params || []) {
    if (param.default !== undefined) p[param.name] = param.default;
    else if (param.type === 'number') p[param.name] = param.min ?? 0;
    else p[param.name] = '';
  }
  return p;
}

function stepsFromRecipe(recipe) {
  if (!recipe?.steps?.length) return [{ id: 'base64', params: {} }];
  return recipe.steps.map((s) => ({ id: s.id, params: s.params || {} }));
}

/**
 * 手动组合解密 + Recipe 保存/分享（CyberChef 风格）
 */
export default function ManualChainPanel({ input, t }) {
  const { ciphers } = useApp();
  const reversible = useMemo(
    () => ciphers.filter((c) => c.reversible !== false),
    [ciphers],
  );

  const [steps, setSteps] = useState([{ id: 'base64', params: {} }]);
  const [recipeName, setRecipeName] = useState('');
  const [savedRecipes, setSavedRecipes] = useState([]);
  const [importText, setImportText] = useState('');
  const [shareUrl, setShareUrl] = useState('');
  const [result, setResult] = useState(null);
  const [trace, setTrace] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setSavedRecipes(loadSavedRecipes());
    const fromHash = parseRecipeFromHash();
    if (fromHash) {
      setSteps(stepsFromRecipe(fromHash));
      setRecipeName(fromHash.name || '');
    }
  }, []);

  const applyRecipe = (recipe) => {
    setSteps(stepsFromRecipe(recipe));
    setRecipeName(recipe.name || '');
    setError('');
    setShareUrl('');
  };

  const addStep = () => {
    setSteps((s) => [...s, { id: 'caesar', params: defaultParams(reversible.find((c) => c.id === 'caesar')) }]);
  };

  const removeStep = (idx) => {
    setSteps((s) => s.filter((_, i) => i !== idx));
  };

  const updateStepId = (idx, id) => {
    const cipher = reversible.find((c) => c.id === id);
    setSteps((s) => s.map((st, i) => (i === idx ? { id, params: defaultParams(cipher) } : st)));
  };

  const updateStepParams = (idx, params) => {
    setSteps((s) => s.map((st, i) => (i === idx ? { ...st, params } : st)));
  };

  const currentRecipe = () => createRecipe({ name: recipeName, steps });

  const handleSave = () => {
    const entry = saveRecipeToStorage(currentRecipe());
    setSavedRecipes(loadSavedRecipes());
    setShareUrl(buildShareUrl(entry));
  };

  const handleCopyLink = async () => {
    const url = buildShareUrl(currentRecipe());
    setShareUrl(url);
    try {
      await navigator.clipboard.writeText(url);
    } catch { /* fallback shown in UI */ }
  };

  const handleCopyJson = async () => {
    const json = JSON.stringify(currentRecipe(), null, 2);
    try {
      await navigator.clipboard.writeText(json);
    } catch { /* ignore */ }
  };

  const handleImport = () => {
    setError('');
    try {
      let recipe;
      const raw = importText.trim();
      if (raw.startsWith('{')) {
        recipe = JSON.parse(raw);
      } else if (raw.includes('recipe=')) {
        const part = raw.includes('#') ? raw.split('#').pop() : raw;
        recipe = decodeRecipe(decodeURIComponent(part.replace(/^recipe=/, '')));
      } else {
        recipe = decodeRecipe(raw);
      }
      applyRecipe(recipe);
      setImportText('');
    } catch (e) {
      setError(t('chain.recipeImportFail'));
    }
  };

  const run = async () => {
    if (!input?.trim()) return;
    setBusy(true);
    setError('');
    try {
      const payload = steps.map((s) => ({ id: s.id, params: s.params }));
      const data = await chainDecrypt(input, payload);
      setResult(data.result);
      setTrace(data.steps || []);
    } catch (e) {
      setError(e.message);
      setResult(null);
      setTrace([]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="panel manual-chain-panel">
      <h3 className="section-title">{t('chain.manualTitle')}</h3>
      <p className="hint">{t('chain.manualDesc')}</p>

      <div className="recipe-bar">
        <input
          type="text"
          className="recipe-name-input"
          value={recipeName}
          onChange={(e) => setRecipeName(e.target.value)}
          placeholder={t('chain.recipeNamePh')}
        />
        <div className="btn-row recipe-actions">
          <button type="button" className="btn btn-sm" onClick={handleSave}>{t('chain.recipeSave')}</button>
          <button type="button" className="btn btn-sm" onClick={handleCopyLink}>{t('chain.recipeCopyLink')}</button>
          <button type="button" className="btn btn-sm" onClick={handleCopyJson}>{t('chain.recipeCopyJson')}</button>
        </div>
      </div>

      {shareUrl && (
        <p className="hint recipe-share-url">
          {t('chain.recipeShareUrl')}: <code>{shareUrl}</code>
        </p>
      )}

      {savedRecipes.length > 0 && (
        <div className="recipe-saved-list">
          <strong>{t('chain.recipeSaved')}</strong>
          <ul>
            {savedRecipes.map((r) => (
              <li key={r.id} className="recipe-saved-item">
                <button type="button" className="link-btn" onClick={() => applyRecipe(r)}>{r.name}</button>
                <span className="recipe-meta">{r.steps.length} {t('chain.recipeSteps')}</span>
                <button type="button" className="btn btn-sm" onClick={() => {
                  deleteRecipeFromStorage(r.id);
                  setSavedRecipes(loadSavedRecipes());
                }}>×</button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="recipe-import">
        <label>{t('chain.recipeImport')}</label>
        <textarea
          className="recipe-import-input"
          value={importText}
          onChange={(e) => setImportText(e.target.value)}
          placeholder={t('chain.recipeImportPh')}
          rows={2}
        />
        <button type="button" className="btn btn-sm" onClick={handleImport} disabled={!importText.trim()}>
          {t('chain.recipeImportBtn')}
        </button>
      </div>

      {steps.map((step, idx) => {
        const cipher = reversible.find((c) => c.id === step.id);
        return (
          <div key={idx} className="chain-step-row">
            <span className="chain-step-num">{idx + 1}</span>
            <select
              className="chain-step-select"
              value={step.id}
              onChange={(e) => updateStepId(idx, e.target.value)}
            >
              {reversible.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            {cipher?.params?.length > 0 && (
              <div className="chain-step-params">
                <ParamFields
                  cipher={cipher}
                  params={step.params}
                  onChange={(name, value) => updateStepParams(idx, { ...step.params, [name]: value })}
                />
              </div>
            )}
            <button type="button" className="btn btn-sm" onClick={() => removeStep(idx)} disabled={steps.length <= 1}>
              ×
            </button>
          </div>
        );
      })}

      <div className="btn-row">
        <button type="button" className="btn" onClick={addStep}>+ {t('chain.addStep')}</button>
        <button type="button" className="btn btn-primary" onClick={run} disabled={busy || !input?.trim()}>
          {busy ? t('chain.running') : t('chain.runManual')}
        </button>
      </div>

      {error && <p className="error">{error}</p>}

      {trace.length > 0 && (
        <div className="chain-trace">
          <strong>{t('chain.trace')}</strong>
          <ol>
            {trace.map((tr, i) => (
              <li key={i}>
                <span className="chain-tag">{tr.name}</span>
                <pre className="trace-preview">{String(tr.output).slice(0, 120)}{tr.output?.length > 120 ? '…' : ''}</pre>
              </li>
            ))}
          </ol>
        </div>
      )}

      {result != null && (
        <div className="explain-block success-block">
          <div className="result-header">
            <strong>{t('chain.result')}</strong>
            <CopyButton text={result} />
          </div>
          <pre className="result-text">{result}</pre>
        </div>
      )}
    </div>
  );
}
