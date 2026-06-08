import { useState, useMemo, useEffect } from 'react';

import { useApp } from '../context/AppContext.jsx';

import { useSettings } from '../hooks/useSettings.js';

import { CTF_CLASSICAL_IDS } from '../data/ctfClassical.js';
import CipherMetaTags from './CipherMetaTags.jsx';

export default function CipherPicker({ filterReversible }) {

  const { ciphers, selectedId, setSelectedId, t } = useApp();

  const { settings, toggleFavorite } = useSettings();

  const [search, setSearch] = useState('');

  const allLabel = t('library.all');

  const favLabel = t('picker.favorites');
  const ctfLabel = t('picker.ctfClassical');
  const [category, setCategory] = useState(ctfLabel);



  const categories = useMemo(() => {

    const cats = [...new Set(ciphers.map((c) => c.category))];

    return [ctfLabel, favLabel, allLabel, ...cats];
  }, [ciphers, allLabel, favLabel, ctfLabel]);



  useEffect(() => {

    setCategory((prev) => (categories.includes(prev) ? prev : ctfLabel));
  }, [categories, ctfLabel]);



  const filtered = useMemo(() => {

    const q = search.toLowerCase();

    const favSet = new Set(settings.favoriteIds || []);

    return ciphers.filter((c) => {

      if (filterReversible && c.reversible === false) return false;

      const matchCat = category === allLabel || c.category === category
        || (category === favLabel && favSet.has(c.id))
        || (category === ctfLabel && CTF_CLASSICAL_IDS.includes(c.id));

      const matchSearch = !q || c.name.toLowerCase().includes(q)

        || c.description.toLowerCase().includes(q)

        || c.id.includes(q);

      return matchCat && matchSearch;

    });

  }, [ciphers, search, category, filterReversible, allLabel, favLabel, ctfLabel, settings.favoriteIds]);



  return (

    <div className="picker-panel">

      <input

        className="search-box"

        placeholder={t('picker.searchPh')}

        value={search}

        onChange={(e) => setSearch(e.target.value)}

      />

      <div className="category-tabs">

        {categories.map((cat) => (

          <button

            key={cat}

            type="button"

            className={`tab ${category === cat ? 'active' : ''}`}

            onClick={() => setCategory(cat)}

          >

            {cat}

          </button>

        ))}

      </div>

      <div className="cipher-list">

        {filtered.map((c) => {

          const isFav = (settings.favoriteIds || []).includes(c.id);

          return (

          <div

            key={c.id}

            className={`cipher-item ${selectedId === c.id ? 'selected' : ''}`}

            onClick={() => setSelectedId(c.id)}

          >

            <div className="cipher-item-top">

              <div className="name">{c.name}</div>

              <button

                type="button"

                className={`fav-btn ${isFav ? 'active' : ''}`}

                title={t('picker.favToggle')}

                onClick={(e) => { e.stopPropagation(); toggleFavorite(c.id); }}

              >

                {isFav ? '★' : '☆'}

              </button>

            </div>

            {c.examplePlain && c.exampleCipher && (

              <div className="cipher-item-example">

                <code>{c.examplePlain}</code>

                <span className="ex-arrow">→</span>

                <code>{c.exampleCipher.length > 36 ? `${c.exampleCipher.slice(0, 36)}…` : c.exampleCipher}</code>

              </div>

            )}

            <div className="cat">

              {c.category}{c.reversible === false ? ` · ${t('identify.irreversible')}` : ''}

              {c.langSupport?.length > 0 || c.requiresKey ? <CipherMetaTags cipher={c} compact /> : null}

            </div>

          </div>

        );})}

      </div>

    </div>

  );

}


