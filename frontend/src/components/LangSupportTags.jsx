import { useApp } from '../context/AppContext.jsx';

export default function LangSupportTags({ langs, compact = false }) {
  const { t } = useApp();
  if (!langs?.length) return null;

  return (
    <span className={`lang-support-tags ${compact ? 'compact' : ''}`} title={t('langs.naturalTitle')}>
      {!compact && <span className="lang-support-label">{t('langs.supportTitle')}</span>}
      <span className="lang-tag">{t('langs.natural')}</span>
    </span>
  );
}
