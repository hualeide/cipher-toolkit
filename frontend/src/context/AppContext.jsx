import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { detectLocale, translate, applyDocumentLang, LOCALES } from '../i18n/index.js';
import { loadSettings, saveSettings } from '../hooks/useSettings.js';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [ciphers, setCiphers] = useState([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState('caesar');
  const [page, setPage] = useState('identify');
  const [libraryFocusId, setLibraryFocusId] = useState(null);
  const [transformPrefill, setTransformPrefill] = useState(null);
  const [locale, setLocaleState] = useState(() => loadSettings().locale || detectLocale());

  useEffect(() => {
    applyDocumentLang(locale);
  }, [locale]);

  const setLocale = useCallback((loc) => {
    if (!LOCALES.includes(loc)) return;
    setLocaleState(loc);
    const s = { ...loadSettings(), locale: loc };
    saveSettings(s);
    applyDocumentLang(loc);
  }, []);

  const t = useCallback((path, vars) => translate(locale, path, vars), [locale]);

  useEffect(() => {
    fetch('/api/ciphers')
      .then((r) => r.json())
      .then((data) => {
        setCiphers(data.ciphers);
        setCount(data.count);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const selected = ciphers.find((c) => c.id === selectedId);

  const goToCipher = (id, targetPage = 'library') => {
    setSelectedId(id);
    setLibraryFocusId(id);
    if (targetPage === 'encrypt' || targetPage === 'decrypt' || targetPage === 'transform') {
      setPage('transform');
    } else setPage('library');
  };

  const goToTransformFromIdentify = (match, sourceCipher) => {
    if (!match?.id) return;
    setTransformPrefill({
      cipherId: match.id,
      params: match.params || {},
      plain: match.result || '',
      cipher: sourceCipher || '',
    });
    setSelectedId(match.id);
    setPage('transform');
  };

  const consumeTransformPrefill = useCallback(() => {
    setTransformPrefill(null);
  }, []);

  return (
    <AppContext.Provider value={{
      ciphers, count, loading, selectedId, setSelectedId, selected, page, setPage,
      libraryFocusId, setLibraryFocusId, goToCipher,
      transformPrefill, goToTransformFromIdentify, consumeTransformPrefill,
      locale, setLocale, t,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp outside provider');
  return ctx;
}
