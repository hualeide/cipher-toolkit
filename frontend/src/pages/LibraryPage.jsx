import { useState, useMemo, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext.jsx';
import SeeAlsoLinks from '../components/SeeAlsoLinks.jsx';
import CipherMetaTags from '../components/CipherMetaTags.jsx';
import CipherExampleBox from '../components/CipherExampleBox.jsx';
import PageHeader from '../components/PageHeader.jsx';

export default function LibraryPage() {
  const { ciphers, libraryFocusId, setLibraryFocusId, goToCipher, t } = useApp();
  const [search, setSearch] = useState('');
  const allLabel = t('library.all');
  const [category, setCategory] = useState(allLabel);
  const [expanded, setExpanded] = useState(null);
  const cardRefs = useRef({});
  const categories = useMemo(() => {
    const cats = [...new Set(ciphers.map((c) => c.category))];
    return [allLabel, ...cats];
  }, [ciphers, allLabel]);

  useEffect(() => {
    setCategory((prev) => (categories.includes(prev) ? prev : allLabel));
  }, [categories, allLabel]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return ciphers.filter((c) => {
      const matchCat = category === allLabel || c.category === category;
      const matchSearch = !q
        || c.name.toLowerCase().includes(q)
        || c.description.toLowerCase().includes(q)
        || c.howItWorks?.toLowerCase().includes(q)
        || c.category.toLowerCase().includes(q);
      return matchCat && matchSearch;
    });
  }, [ciphers, search, category, allLabel]);

  useEffect(() => {
    if (!libraryFocusId) return;
    setExpanded(libraryFocusId);
    requestAnimationFrame(() => {
      cardRefs.current[libraryFocusId]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setLibraryFocusId(null);
    });
  }, [libraryFocusId, setLibraryFocusId]);

  const goTransform = (id) => goToCipher(id, 'transform');

  return (
    <div className="page-single library-page">
      <PageHeader
        title={t('library.title')}
        desc={t('library.desc')}
        descShort={t('library.descShort')}
        t={t}
      />

      <div className="panel">
        <input className="search-box" placeholder={t('library.searchPh')} value={search} onChange={(e) => setSearch(e.target.value)} />
        <div className="category-tabs">
          {categories.map((cat) => (
            <button key={cat} type="button" className={`tab ${category === cat ? 'active' : ''}`} onClick={() => setCategory(cat)}>{cat}</button>
          ))}
        </div>
      </div>

      <div className="library-grid">
        {filtered.map((c) => (
          <div key={c.id} ref={(el) => { cardRefs.current[c.id] = el; }} className={`library-card ${expanded === c.id ? 'expanded' : ''}`}>
            <div className="library-card-head" onClick={() => setExpanded(expanded === c.id ? null : c.id)}>
              <div>
                <h4>{c.name}</h4>
                <div className="card-meta">
                  <span className="cat">{c.category}</span>
                  {(c.langSupport?.length > 0 || c.requiresKey) && <CipherMetaTags cipher={c} compact />}
                  {c.difficulty && <span className={`diff-badge diff-${c.difficulty}`}>{c.difficulty}</span>}
                </div>
              </div>
              <span className="expand-icon">{expanded === c.id ? '−' : '+'}</span>
            </div>
            {expanded === c.id && (
              <div className="library-card-body">
                <p className="desc">{c.description}</p>

                {c.howItWorks && (
                  <div className="detail-block">
                    <strong>{t('library.principle')}</strong>
                    <p>{c.howItWorks}</p>
                  </div>
                )}

                {c.steps?.length > 0 && (
                  <div className="detail-block">
                    <strong>{t('library.steps')}</strong>
                    <ol className="steps-list">
                      {c.steps.map((s, i) => <li key={i}>{s}</li>)}
                    </ol>
                  </div>
                )}

                {c.formula && <div className="formula-box">{c.formula}</div>}

                <CipherExampleBox cipher={c} />

                {c.origin && <p className="history">{t('library.origin')}：{c.origin}</p>}
                {c.trivia && <p className="trivia">{t('library.trivia')}：{c.trivia}</p>}
                <p className="usage">{c.usage}</p>

                {c.seeAlso?.length > 0 && <SeeAlsoLinks ids={c.seeAlso} />}

                {c.params?.length > 0 && (
                  <div className="param-list">
                    {t('library.params')}：
                    {c.params.map((p) => (
                      <span key={p.name} className="param-chip">{p.label} ({p.type})</span>
                    ))}
                  </div>
                )}

                <div className="btn-row">
                  {c.reversible !== false && (
                    <button type="button" className="btn btn-primary" onClick={() => goTransform(c.id)}>{t('library.goTransform')}</button>
                  )}
                  {c.reversible === false && (
                    <>
                      <button type="button" className="btn btn-primary" onClick={() => goTransform(c.id)}>{t('library.goTransform')}</button>
                      <span className="hint">{t('library.irreversible')}</span>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
