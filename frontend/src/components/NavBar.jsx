import { useApp } from '../context/AppContext.jsx';
import LangSwitcher from './LangSwitcher.jsx';

const NAV_IDS = ['identify', 'transform', 'chain', 'library', 'media', 'settings'];

const NAV_ICONS = {
  identify: '🔍',
  transform: '🔐',
  chain: '🔗',
  library: '📚',
  media: '🖼️',
  settings: '⚙️',
};

export default function NavBar() {
  const { page, setPage, count, t } = useApp();

  return (
    <nav className="top-nav">
      <div className="nav-brand">
        <span className="brand-title">{t('brand.title')}</span>
        <span className="brand-badge">{count}{t('brand.algorithms')}</span>
      </div>
      <div className="nav-links">
        {NAV_IDS.map((id) => (
          <button
            key={id}
            type="button"
            className={`nav-link ${page === id ? 'active' : ''}`}
            onClick={() => setPage(id)}
          >
            <span className="nav-icon">{NAV_ICONS[id]}</span>
            {t(`nav.${id}`)}
          </button>
        ))}
      </div>
      <LangSwitcher />
    </nav>
  );
}
