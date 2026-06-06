import LangSupportTags from './LangSupportTags.jsx';
import KeyRequiredTag from './KeyRequiredTag.jsx';

export default function CipherMetaTags({ cipher, compact = false }) {
  if (!cipher) return null;
  const hasLang = cipher.langSupport?.length > 0;
  const hasKey = cipher.requiresKey;
  if (!hasLang && !hasKey) return null;

  return (
    <span className={`cipher-meta-tags ${compact ? 'compact' : ''}`}>
      {hasKey && <KeyRequiredTag compact={compact} />}
      {hasLang && <LangSupportTags langs={cipher.langSupport} compact={compact} />}
    </span>
  );
}
