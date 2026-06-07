import { useApp } from '../context/AppContext.jsx';
import LangSwitcher from './LangSwitcher.jsx';

const NAV_IDS = ['identify', 'transform', 'chain', 'library', 'media', 'settings'];

export default function NavBar() {
  const { page, setPage, count, t } = useApp();

  return (
    <nav className="top-nav" aria-label={t('brand.title')}>
      <button
        type="button"
        className="nav-brand"
        onClick={() => setPage('identify')}
        aria-label={t('brand.title')}
      >
        <span className="brand-title">{t('brand.title')}</span>
        <span className="brand-badge">
          {count}
          {t('brand.algorithms')}
        </span>
      </button>
      <div className="nav-links" role="tablist">
        {NAV_IDS.map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={page === id}
            className={`nav-link ${page === id ? 'active' : ''}`}
            onClick={() => setPage(id)}
          >
            {t(`nav.${id}`)}
          </button>
        ))}
      </div>
      <LangSwitcher />
    </nav>
  );
}
