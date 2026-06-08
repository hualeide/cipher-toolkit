import { useApp } from '../context/AppContext.jsx';
import SeeAlsoLinks from './SeeAlsoLinks.jsx';
import CipherMetaTags from './CipherMetaTags.jsx';
import CipherExampleBox from './CipherExampleBox.jsx';
import PigpenChart from './PigpenChart.jsx';

export default function CipherInfo({ cipher, detailed = false, suppressTitle = false }) {
  const { t } = useApp();
  if (!cipher) return null;
  return (
    <div className="info-card">
      {!suppressTitle ? (
        <>
          <div className="info-card-head">
            <h3>{cipher.name}</h3>
            <div className="info-badges">
              <span className="info-tag">{cipher.category}</span>
              {(cipher.langSupport?.length > 0 || cipher.requiresKey) && <CipherMetaTags cipher={cipher} compact />}
              {cipher.difficulty && <span className={`info-tag diff-${cipher.difficulty}`}>{cipher.difficulty}</span>}
              {cipher.reversible === false && <span className="info-tag warn">{t('identify.irreversible')}</span>}
            </div>
          </div>
          <p className="desc">{cipher.description}</p>
        </>
      ) : (
        <div className="info-card-head info-card-head--compact">
          <div className="info-badges">
            <span className="info-tag">{cipher.category}</span>
            {(cipher.langSupport?.length > 0 || cipher.requiresKey) && <CipherMetaTags cipher={cipher} compact />}
            {cipher.difficulty && <span className={`info-tag diff-${cipher.difficulty}`}>{cipher.difficulty}</span>}
            {cipher.reversible === false && <span className="info-tag warn">{t('identify.irreversible')}</span>}
          </div>
        </div>
      )}
      {detailed && cipher.howItWorks && (
        <div className="detail-block">
          <strong>{t('library.principle')}</strong>
          <p>{cipher.howItWorks}</p>
        </div>
      )}
      {detailed && cipher.steps?.length > 0 && (
        <div className="detail-block">
          <strong>{t('library.steps')}</strong>
          <ol className="steps-list">
            {cipher.steps.map((s, i) => <li key={i}>{s}</li>)}
          </ol>
        </div>
      )}
      {cipher.formula && (
        <div className="formula-box">{cipher.formula}</div>
      )}
      {detailed && cipher.id === 'pigpen' && <PigpenChart />}
      {(cipher.examplePlain || cipher.exampleCipher) && (
        <CipherExampleBox cipher={cipher} largeCipher={cipher.id === 'pigpen'} />
      )}
      {cipher.origin && <p className="history">{t('library.origin')}：{cipher.origin}</p>}
      {cipher.trivia && <p className="trivia">{t('library.trivia')}：{cipher.trivia}</p>}
      <p className="usage">{t('library.usage')}：{cipher.usage}</p>
      {cipher.seeAlso?.length > 0 && <SeeAlsoLinks ids={cipher.seeAlso} />}
    </div>
  );
}
