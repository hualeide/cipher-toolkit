export default function LoadingInline({ label, compact = false }) {
  return (
    <div
      className={`loading-inline${compact ? ' loading-inline--compact' : ''}`}
      role="status"
      aria-live="polite"
    >
      <span className="loading-spinner" aria-hidden />
      {label && !compact && <span>{label}</span>}
      {label && compact && <span className="visually-hidden">{label}</span>}
    </div>
  );
}
