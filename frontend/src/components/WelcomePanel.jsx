export default function WelcomePanel({ examples, onExample }) {
  if (!examples?.length) return null;
  return (
    <div className="welcome-panel">
      <div className="welcome-chips" role="group" aria-label="examples">
        {examples.map((ex) => (
          <button key={ex} type="button" className="welcome-chip" onClick={() => onExample(ex)}>
            {ex}
          </button>
        ))}
      </div>
    </div>
  );
}
