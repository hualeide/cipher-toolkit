import { useApp } from '../context/AppContext.jsx';

export default function KeyRequiredTag({ compact = false }) {
  const { t } = useApp();
  return (
    <span className={`key-required-tag ${compact ? 'compact' : ''}`} title={t('tags.keyRequiredTitle')}>
      {t('tags.keyRequired')}
    </span>
  );
}
