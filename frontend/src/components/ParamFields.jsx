import { useApp } from '../context/AppContext.jsx';

export default function ParamFields({ cipher, params, onChange }) {
  const { t } = useApp();
  if (!cipher?.params?.length) return null;

  const showKeyPh = (p) => ['key', 'keyword', 'keyText'].includes(p.name) && cipher.langSupport?.length > 1;

  return (
    <div className="params-row">
      {cipher.params.map((p) => {
        const val = params[p.name] ?? p.default ?? '';
        return (
          <div key={p.name} className="param-field">
            <label>{p.label || p.name}</label>
            {p.type === 'textarea' ? (
              <textarea
                rows={3}
                value={val}
                onChange={(e) => onChange(p.name, e.target.value)}
                className="param-textarea"
                placeholder={showKeyPh(p) ? t('params.keyPh') : undefined}
              />
            ) : p.type === 'select' ? (
              <select
                value={val}
                onChange={(e) => onChange(p.name, e.target.value)}
              >
                {(p.options || []).map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            ) : (
              <input
                type={p.type === 'password' ? 'password' : p.type === 'number' ? 'number' : 'text'}
                value={val}
                min={p.min}
                max={p.max}
                placeholder={showKeyPh(p) ? t('params.keyPh') : undefined}
                onChange={(e) => {
                  const raw = e.target.value;
                  if (p.type === 'number') {
                    onChange(p.name, raw === '' ? p.default : Number(raw));
                  } else {
                    onChange(p.name, raw);
                  }
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
