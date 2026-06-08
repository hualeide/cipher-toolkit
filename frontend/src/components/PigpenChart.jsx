import { useApp } from '../context/AppContext.jsx';

/** 经典 Masonic 猪圈对照图（Wikimedia Commons, PD） */
export default function PigpenChart() {
  const { t } = useApp();
  return (
    <div className="pigpen-chart" aria-label={t('pigpen.chartTitle')}>
      <strong>{t('pigpen.chartTitle')}</strong>
      <p className="hint">{t('pigpen.chartHint')}</p>
      <img
        src="/pigpen-key.png"
        alt={t('pigpen.chartTitle')}
        className="pigpen-key-img"
        width={219}
        height={222}
        loading="lazy"
      />
      <p className="hint pigpen-credit">
        {t('pigpen.chartCredit')}
        {' '}
        <a href="https://commons.wikimedia.org/wiki/File:Pigpen_cipher_key.png" target="_blank" rel="noopener noreferrer">
          Wikimedia Commons
        </a>
      </p>
    </div>
  );
}
