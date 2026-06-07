import { useState } from 'react';

export default function PageHeader({ title, desc, descShort, t }) {
  const [expanded, setExpanded] = useState(false);
  const short = descShort || desc;
  const long = desc || short;
  const collapsible = long.length > (short?.length || 0) + 20;

  return (
    <header className={`page-header ${expanded ? 'expanded' : ''}`}>
      <h2 className="page-title">{title}</h2>
      <p>{expanded || !collapsible ? long : short}</p>
      {collapsible && (
        <button
          type="button"
          className="desc-toggle"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
        >
          {expanded ? t('common.collapse') : t('common.learnMore')}
        </button>
      )}
    </header>
  );
}
