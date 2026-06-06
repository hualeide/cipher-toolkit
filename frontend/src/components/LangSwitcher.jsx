import { useApp } from '../context/AppContext.jsx';
import { LOCALES } from '../i18n/index.js';

export default function LangSwitcher() {
  const { locale, setLocale, t } = useApp();

  return (
    <div className="lang-switcher">
      {LOCALES.map((loc) => (
        <button
          key={loc}
          type="button"
          className={`lang-btn ${locale === loc ? 'active' : ''}`}
          onClick={() => setLocale(loc)}
          title={t(`lang.${loc}`)}
        >
          {loc.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
