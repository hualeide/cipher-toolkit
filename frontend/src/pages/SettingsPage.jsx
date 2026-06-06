import { useSettings } from '../hooks/useSettings.js';
import { useApp } from '../context/AppContext.jsx';
import { LOCALES } from '../i18n/index.js';

export default function SettingsPage() {
  const { settings, setSettings, resetSettings } = useSettings();
  const { locale, setLocale, t } = useApp();

  const onLocaleChange = (loc) => {
    setLocale(loc);
    setSettings({ locale: loc });
  };

  const onReset = () => {
    resetSettings();
    setLocale('zh');
    document.body.dataset.theme = 'dark';
  };

  return (
    <div className="page-single settings-page">
      <div className="page-header">
        <h2>{t('settings.title')}</h2>
        <p>{t('settings.desc')}</p>
      </div>

      <div className="panel settings-group">
        <h3>{t('settings.language')}</h3>
        <div className="locale-options">
          {LOCALES.map((loc) => (
            <button
              key={loc}
              type="button"
              className={`locale-btn ${locale === loc ? 'active' : ''}`}
              onClick={() => onLocaleChange(loc)}
            >
              {t(`lang.${loc}`)}
            </button>
          ))}
        </div>
        <p className="setting-desc">{t('settings.languageDesc')}</p>
      </div>

      <div className="panel settings-group">
        <h3>{t('settings.crypto')}</h3>
        <label className="setting-row">
          <span>{t('settings.autoTransform')}</span>
          <input
            type="checkbox"
            checked={settings.autoTransform}
            onChange={(e) => setSettings({ autoTransform: e.target.checked })}
          />
        </label>
        <p className="setting-desc">{t('settings.autoTransformDesc')}</p>
      </div>

      <div className="panel settings-group">
        <h3>{t('settings.identify')}</h3>
        <label className="setting-row">
          <span>{t('settings.sensitivity')}</span>
          <input
            type="range"
            min={20}
            max={60}
            value={settings.identifyMinScore}
            onChange={(e) => setSettings({ identifyMinScore: Number(e.target.value) })}
          />
          <span className="range-val">{settings.identifyMinScore}</span>
        </label>
        <label className="setting-row">
          <span>{t('settings.delay')}</span>
          <input
            type="number"
            min={200}
            max={2000}
            step={100}
            value={settings.identifyDebounce}
            onChange={(e) => setSettings({ identifyDebounce: Number(e.target.value) })}
          />
        </label>
        <label className="setting-row column">
          <span>{t('settings.extraKeys')}</span>
          <input
            type="text"
            className="full-input"
            value={settings.extraKeys}
            onChange={(e) => setSettings({ extraKeys: e.target.value })}
            placeholder="KEY,SECRET,PASSWORD"
          />
        </label>
        <p className="setting-desc">{t('settings.extraKeysDesc')}</p>
      </div>

      <div className="panel settings-group">
        <h3>{t('settings.appearance')}</h3>
        <label className="setting-row">
          <span>{t('settings.theme')}</span>
          <select
            value={settings.theme}
            onChange={(e) => {
              setSettings({ theme: e.target.value });
              document.body.dataset.theme = e.target.value;
            }}
          >
            <option value="dark">{t('settings.dark')}</option>
            <option value="light">{t('settings.light')}</option>
          </select>
        </label>
      </div>

      <button type="button" className="btn" onClick={onReset}>{t('settings.reset')}</button>
    </div>
  );
}
