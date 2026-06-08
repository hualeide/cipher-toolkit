import { useApp } from '../context/AppContext.jsx';

export default function CipherExampleBox({ cipher, largeCipher = false }) {
  const { t } = useApp();
  if (!cipher?.examplePlain && !cipher?.exampleCipher) return null;

  const fromCorpus = cipher.langSupport?.includes('zh');

  return (
    <div className="example-box">
      {fromCorpus && t('library.exampleSource') && (
        <p className="hint example-source">{t('library.exampleSource')}</p>
      )}
      {cipher.exampleParams && (
        <div className="example-params">{t('library.exampleParams')}: <code>{cipher.exampleParams}</code></div>
      )}
      {cipher.examplePlain && (
        <div>{t('library.plainEx')}：<code>{cipher.examplePlain}</code></div>
      )}
      {cipher.exampleCipher && (
        <div className={largeCipher ? 'example-cipher-glyphs' : undefined}>
          {t(cipher.reversible === false ? 'library.digestEx' : 'library.cipherEx')}：
          <code className={largeCipher ? 'pigpen-glyphs' : undefined}>{cipher.exampleCipher}</code>
        </div>
      )}
    </div>
  );
}
