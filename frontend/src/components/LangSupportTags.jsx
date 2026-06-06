import { useApp } from '../context/AppContext.jsx';

export default function LangSupportTags({ langs, compact = false }) {
  const { t } = useApp();
  if (!langs?.length) return null;

  return (
    <span className={`lang-support-tags ${compact ? 'compact' : ''}`} title={t('langs.supportTitle')}>
      {!compact && <span className="lang-support-label">{t('langs.supportTitle')}</span>}
      {langs.map((code) => (
        <span key={code} className="lang-tag">{t(`langs.${code}`)}</span>
      ))}
    </span>
  );
}
