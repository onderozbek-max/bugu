import "./PlayPauseButton.css";

export function PlayPauseButton({
  isPlaying,
  onToggle,
  label,
  buffering,
}: {
  isPlaying: boolean;
  onToggle: () => void;
  label: string;
  /** Browser is waiting on data for the tapped source. Keeps the existing
   * ring rather than swapping in a spinner glyph — a slow, even pulse on
   * the same frame she already tapped, not a new loading widget appearing. */
  buffering?: boolean;
}) {
  return (
    <button
      type="button"
      className={`play-pause${buffering ? " play-pause--buffering" : ""}`}
      onClick={onToggle}
      aria-label={buffering ? "yükleniyor" : label}
      aria-pressed={isPlaying}
    >
      {isPlaying ? (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="6" y="5" width="4" height="14" />
          <rect x="14" y="5" width="4" height="14" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M7 4.5v15l14-7.5z" />
        </svg>
      )}
    </button>
  );
}
