import { useApp } from '../context/AppContext.jsx';

export default function SeeAlsoLinks({ ids }) {
  const { ciphers, goToCipher, t } = useApp();
  if (!ids?.length) return null;

  return (
    <p className="see-also">
      {t('seeAlso.title')}：
      {ids.map((id, i) => {
        const c = ciphers.find((x) => x.id === id);
        return (
          <span key={id}>
            {i > 0 && <span className="see-sep"> · </span>}
            <button
              type="button"
              className="see-also-link"
              title={c?.name || id}
              onClick={() => goToCipher(id, 'library')}
            >
              {c?.name || id}
            </button>
          </span>
        );
      })}
    </p>
  );
}
